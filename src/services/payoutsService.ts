// src/services/payoutsService.ts
// Stripe Connect payout service for cleaners
// Matches 001_init.sql + 004_connect_payouts.sql schema

import Stripe from "stripe";
import { query } from "../db/client";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { Payout, Job } from "../types/db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Payout configuration
const PAYOUTS_ENABLED = env.PAYOUTS_ENABLED ?? false;
const PAYOUT_CURRENCY = env.PAYOUT_CURRENCY ?? "usd";
const CENTS_PER_CREDIT = env.CENTS_PER_CREDIT ?? 10; // 10 credits = $1.00 (per policy)

export async function updatePayoutPause(cleanerId: string, paused: boolean): Promise<void> {
  await query(
    `UPDATE cleaner_profiles SET payout_paused = $2, updated_at = NOW() WHERE user_id = $1`,
    [cleanerId, paused]
  );
}

/**
 * Get cleaner's payout percentage based on tier
 * Per Terms of Service: Cleaners receive 80-85% of booking amount depending on tier
 * - Bronze: 80%
 * - Silver: 82%
 * - Gold: 84%
 * - Platinum: 85%
 * Platform fee: 15%
 */
export async function getCleanerPayoutPercent(cleanerId: string): Promise<number> {
  const result = await query<{ tier: string; payout_percent: number }>(
    `SELECT tier, COALESCE(payout_percent, 80) as payout_percent FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );
  
  if (result.rows.length === 0) {
    return env.CLEANER_PAYOUT_PERCENT_BRONZE; // Default to bronze
  }
  
  const { tier, payout_percent } = result.rows[0];
  
  // Use stored payout_percent if available, otherwise calculate from tier
  if (payout_percent) {
    return payout_percent;
  }
  
  switch (tier) {
    case "platinum": return env.CLEANER_PAYOUT_PERCENT_PLATINUM;
    case "gold": return env.CLEANER_PAYOUT_PERCENT_GOLD;
    case "silver": return env.CLEANER_PAYOUT_PERCENT_SILVER;
    default: return env.CLEANER_PAYOUT_PERCENT_BRONZE;
  }
}

/**
 * Called when a job is approved & completed.
 * Creates a pending payout row for that job/cleaner.
 * 
 * Per Terms of Service:
 * - Platform fee: 15% of transaction value
 * - Cleaners receive 80-85% of booking amount depending on tier
 */
export async function recordEarningsForCompletedJob(job: Job): Promise<Payout> {
  if (!job.cleaner_id) {
    throw Object.assign(new Error("Job has no cleaner assigned"), { statusCode: 500 });
  }

  // Get cleaner's payout percentage based on tier
  const payoutPercent = await getCleanerPayoutPercent(job.cleaner_id);
  
  // Calculate payout amounts (applying tier-based percentage)
  const grossCents = job.credit_amount * CENTS_PER_CREDIT;
  const payoutCents = Math.round(grossCents * (payoutPercent / 100));
  const platformFeeCents = grossCents - payoutCents;
  const payoutCredits = Math.round(job.credit_amount * (payoutPercent / 100));

  const result = await query<Payout>(
    `
      INSERT INTO payouts (
        cleaner_id,
        job_id,
        stripe_transfer_id,
        amount_credits,
        amount_cents,
        status
      )
      VALUES ($1, $2, null, $3, $4, 'pending')
      RETURNING *
    `,
    [job.cleaner_id, job.id, payoutCredits, payoutCents]
  );

  const payout = result.rows[0];

  if (!payout) {
    throw Object.assign(new Error("Failed to create payout"), { statusCode: 500 });
  }

  logger.info("payout_recorded", {
    payoutId: payout.id,
    cleanerId: job.cleaner_id,
    jobId: job.id,
    grossCredits: job.credit_amount,
    grossCents,
    payoutPercent,
    payoutCredits,
    payoutCents,
    platformFeeCents,
  });

  await publishEvent({
    jobId: job.id,
    actorType: "system",
    eventName: "payout_created",
    payload: {
      payoutId: payout.id,
      cleanerId: job.cleaner_id,
      grossCredits: job.credit_amount,
      payoutCredits,
      payoutCents,
      payoutPercent,
      platformFeeCents,
    },
  });

  return payout;
}

interface PendingPayoutWithAccount extends Payout {
  stripe_account_id: string | null;
}

/**
 * Group pending payouts by cleaner and process them via Stripe Connect transfers.
 * This is intended to run on a schedule (e.g., weekly).
 */
export async function processPendingPayouts(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  if (!PAYOUTS_ENABLED) {
    logger.info("payouts_disabled", { message: "Payouts are disabled via config" });
    return { processed: 0, failed: 0, skipped: 0 };
  }

  // Load pending payouts joined with cleaner_profiles.stripe_account_id
  const pending = await query<PendingPayoutWithAccount>(
    `
      SELECT
        p.*,
        cp.stripe_account_id
      FROM payouts p
      LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
      WHERE p.status = 'pending'
        AND COALESCE(cp.payout_paused, false) = false
      ORDER BY p.created_at ASC
    `
  );

  if (pending.rows.length === 0) {
    logger.info("no_pending_payouts");
    return { processed: 0, failed: 0, skipped: 0 };
  }

  // Group by cleaner_id + stripe_account_id
  const byCleaner = new Map<
    string,
    { stripeAccountId: string | null; payouts: PendingPayoutWithAccount[] }
  >();

  for (const p of pending.rows) {
    const key = p.cleaner_id;
    const existing = byCleaner.get(key);
    if (existing) {
      existing.payouts.push(p);
    } else {
      byCleaner.set(key, {
        stripeAccountId: p.stripe_account_id ?? null,
        payouts: [p],
      });
    }
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [cleanerId, data] of byCleaner.entries()) {
    const { stripeAccountId, payouts } = data;

    if (!stripeAccountId) {
      // Cannot pay this cleaner — mark payouts as failed
      logger.error("payout_missing_stripe_account", {
        cleanerId,
        payoutCount: payouts.length,
      });

      const payoutIds = payouts.map((p) => p.id);
      await query(
        `
          UPDATE payouts
          SET status = 'failed', updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `,
        [payoutIds]
      );
      
      skipped += payouts.length;
      continue;
    }

    // Calculate total amount for this batch
    const totalCents = payouts.reduce((sum, p) => sum + p.amount_cents, 0);
    const totalCredits = payouts.reduce((sum, p) => sum + p.amount_credits, 0);
    const payoutIds = payouts.map((p) => p.id);

    try {
      // Create idempotency key from cleaner + date + payout IDs hash
      const idempotencyKey = `payout_${cleanerId}_${new Date().toISOString().split("T")[0]}_${payoutIds.sort().join("_").substring(0, 50)}`;

      // Create Stripe Connect transfer
      const transfer = await stripe.transfers.create(
        {
          amount: totalCents,
          currency: PAYOUT_CURRENCY,
          destination: stripeAccountId,
          metadata: {
            cleaner_id: cleanerId,
            payout_ids: payoutIds.join(",").substring(0, 500), // Stripe metadata limit
            total_credits: totalCredits.toString(),
          },
        },
        {
          idempotencyKey,
        }
      );

      // Mark all payouts as paid and store the Stripe transfer ID
      await query(
        `
          UPDATE payouts
          SET status = 'paid',
              stripe_transfer_id = $1,
              updated_at = NOW()
          WHERE id = ANY($2::uuid[])
        `,
        [transfer.id, payoutIds]
      );

      logger.info("payout_batch_success", {
        cleanerId,
        stripeAccountId,
        transferId: transfer.id,
        totalCents,
        totalCredits,
        payoutCount: payouts.length,
      });

      await publishEvent({
        actorType: "system",
        eventName: "payout_batch_processed",
        payload: {
          cleanerId,
          transferId: transfer.id,
          totalCents,
          payoutCount: payouts.length,
        },
      });

      processed += payouts.length;
    } catch (err) {
      const error = err as Error;
      logger.error("payout_batch_failed", {
        cleanerId,
        stripeAccountId,
        error: error.message,
        totalCents,
        payoutCount: payouts.length,
      });

      // Mark payouts as failed
      await query(
        `
          UPDATE payouts
          SET status = 'failed', updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `,
        [payoutIds]
      );

      failed += payouts.length;
    }
  }

  logger.info("payout_run_completed", {
    total: pending.rows.length,
    processed,
    failed,
    skipped,
  });

  return { processed, failed, skipped };
}

/**
 * Process a single payout
 */
export async function processSinglePayout(payoutId: string): Promise<Payout> {
  if (!PAYOUTS_ENABLED) {
    throw new Error("Payouts are disabled");
  }

  const payoutResult = await query<PendingPayoutWithAccount>(
    `
      SELECT p.*, cp.stripe_account_id
      FROM payouts p
      LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
      WHERE p.id = $1 AND p.status = 'pending'
    `,
    [payoutId]
  );

  if (payoutResult.rows.length === 0) {
    throw new Error("Payout not found or not pending");
  }

  const payout = payoutResult.rows[0];

  if (!payout.stripe_account_id) {
    throw new Error("Cleaner does not have Stripe Connect account");
  }

  const transfer = await stripe.transfers.create({
    amount: payout.amount_cents,
    currency: PAYOUT_CURRENCY,
    destination: payout.stripe_account_id,
    metadata: {
      payout_id: payoutId,
      cleaner_id: payout.cleaner_id,
      job_id: payout.job_id,
    },
  });

  const updatedResult = await query<Payout>(
    `
      UPDATE payouts
      SET status = 'paid',
          stripe_transfer_id = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [transfer.id, payoutId]
  );

  logger.info("single_payout_processed", {
    payoutId,
    transferId: transfer.id,
    amountCents: payout.amount_cents,
  });

  return updatedResult.rows[0];
}

/**
 * Get payout history for a cleaner
 */
export async function getCleanerPayouts(
  cleanerId: string,
  limit: number = 50
): Promise<Payout[]> {
  const result = await query<Payout>(
    `
      SELECT *
      FROM payouts
      WHERE cleaner_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [cleanerId, limit]
  );

  return result.rows;
}

/**
 * Get payout for a specific job
 */
export async function getPayoutForJob(jobId: string): Promise<Payout | null> {
  const result = await query<Payout>(
    `SELECT * FROM payouts WHERE job_id = $1 LIMIT 1`,
    [jobId]
  );
  return result.rows[0] ?? null;
}

/**
 * Get pending payout total for a cleaner
 */
export async function getPendingPayoutTotal(cleanerId: string): Promise<{
  totalCredits: number;
  totalCents: number;
  count: number;
}> {
  const result = await query<{
    total_credits: string;
    total_cents: string;
    count: string;
  }>(
    `
      SELECT 
        COALESCE(SUM(amount_credits), 0) as total_credits,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM payouts
      WHERE cleaner_id = $1 AND status = 'pending'
    `,
    [cleanerId]
  );

  const row = result.rows[0];
  return {
    totalCredits: Number(row?.total_credits ?? 0),
    totalCents: Number(row?.total_cents ?? 0),
    count: Number(row?.count ?? 0),
  };
}

/**
 * Get payout statistics (for admin dashboard)
 */
export async function getPayoutStats(): Promise<{
  totalPending: number;
  totalPaid: number;
  totalFailed: number;
  pendingAmountCents: number;
  paidAmountCents: number;
}> {
  const result = await query<{
    status: string;
    count: string;
    total_cents: string;
  }>(
    `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount_cents), 0) as total_cents
      FROM payouts
      GROUP BY status
    `
  );

  const stats = {
    totalPending: 0,
    totalPaid: 0,
    totalFailed: 0,
    pendingAmountCents: 0,
    paidAmountCents: 0,
  };

  for (const row of result.rows) {
    const count = Number(row.count);
    const amount = Number(row.total_cents);

    switch (row.status) {
      case "pending":
        stats.totalPending = count;
        stats.pendingAmountCents = amount;
        break;
      case "paid":
        stats.totalPaid = count;
        stats.paidAmountCents = amount;
        break;
      case "failed":
        stats.totalFailed = count;
        break;
    }
  }

  return stats;
}

/**
 * Retry failed payouts for a cleaner
 */
export async function retryFailedPayouts(cleanerId: string): Promise<number> {
  // Reset failed payouts to pending
  const result = await query<{ count: string }>(
    `
      UPDATE payouts
      SET status = 'pending', updated_at = NOW()
      WHERE cleaner_id = $1 AND status = 'failed'
      RETURNING id
    `,
    [cleanerId]
  );

  const count = result.rows.length;

  if (count > 0) {
    logger.info("failed_payouts_reset", { cleanerId, count });
  }

  return count;
}

// Export service object for compatibility
export const payoutsService = {
  recordEarningsForCompletedJob,
  processPendingPayouts,
  processSinglePayout,
  getCleanerPayouts,
  getPayoutForJob,
  getPendingPayoutTotal,
  getPayoutStats,
  retryFailedPayouts,
};
