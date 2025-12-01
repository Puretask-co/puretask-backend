// src/services/payoutImprovementsService.ts
// Payout improvements: reversals, minimum threshold, retry logic

import Stripe from "stripe";
import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { createAuditLog } from "./creditEconomyService";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ============================================
// Configuration
// ============================================

export const PAYOUT_CONFIG = {
  DEFAULT_MINIMUM_CENTS: 2500,  // $25 minimum
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_INTERVALS_MS: [
    5 * 60 * 1000,      // 5 minutes
    30 * 60 * 1000,     // 30 minutes
    2 * 60 * 60 * 1000, // 2 hours
  ],
  INSTANT_PAYOUT_FEE_PERCENT: 1.5,
};

// ============================================
// Types
// ============================================

export interface PayoutAdjustment {
  id: string;
  payout_id: string | null;
  cleaner_id: string;
  adjustment_type: string;
  amount_cents: number;
  reason: string;
  stripe_reversal_id: string | null;
  initiated_by: string | null;
  status: string;
  created_at: string;
}

export interface PayoutRetryItem {
  id: string;
  payout_id: string;
  cleaner_id: string;
  amount_cents: number;
  stripe_account_id: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: string;
}

export interface EligibleCleaner {
  cleaner_id: string;
  email: string;
  stripe_account_id: string;
  minimum_payout_cents: number;
  pending_payout_cents: number;
}

// ============================================
// Minimum Threshold Logic
// ============================================

/**
 * Get cleaners eligible for payout (met minimum threshold)
 */
export async function getCleanersEligibleForPayout(): Promise<EligibleCleaner[]> {
  const result = await query<EligibleCleaner>(
    `SELECT * FROM cleaners_eligible_for_payout`
  );
  return result.rows;
}

/**
 * Check if cleaner meets minimum payout threshold
 */
export async function checkMinimumThreshold(cleanerId: string): Promise<{
  eligible: boolean;
  pendingAmount: number;
  minimumRequired: number;
  shortfall: number;
}> {
  const result = await query<{
    pending_cents: string;
    minimum_cents: string;
  }>(
    `
      SELECT 
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0)::text as pending_cents,
        COALESCE(cp.minimum_payout_cents, $2)::text as minimum_cents
      FROM cleaner_profiles cp
      LEFT JOIN payouts p ON p.cleaner_id = cp.user_id
      WHERE cp.user_id = $1
      GROUP BY cp.minimum_payout_cents
    `,
    [cleanerId, PAYOUT_CONFIG.DEFAULT_MINIMUM_CENTS]
  );

  const row = result.rows[0];
  const pendingAmount = Number(row?.pending_cents || 0);
  const minimumRequired = Number(row?.minimum_cents || PAYOUT_CONFIG.DEFAULT_MINIMUM_CENTS);

  return {
    eligible: pendingAmount >= minimumRequired,
    pendingAmount,
    minimumRequired,
    shortfall: Math.max(0, minimumRequired - pendingAmount),
  };
}

/**
 * Update cleaner's minimum payout threshold
 */
export async function updateMinimumThreshold(
  cleanerId: string,
  minimumCents: number,
  updatedBy?: string
): Promise<void> {
  const oldResult = await query<{ minimum_payout_cents: number }>(
    `SELECT minimum_payout_cents FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  await query(
    `UPDATE cleaner_profiles SET minimum_payout_cents = $2, updated_at = NOW() WHERE user_id = $1`,
    [cleanerId, minimumCents]
  );

  await createAuditLog({
    actorId: updatedBy,
    actorType: updatedBy ? "admin" : "system",
    action: "minimum_payout_updated",
    resourceType: "cleaner_profile",
    resourceId: cleanerId,
    oldValue: { minimum_payout_cents: oldResult.rows[0]?.minimum_payout_cents },
    newValue: { minimum_payout_cents: minimumCents },
  });

  logger.info("minimum_payout_updated", { cleanerId, minimumCents });
}

// ============================================
// Payout Reversal Logic
// ============================================

/**
 * Reverse a payout (for disputes, fraud, etc.)
 */
export async function reversePayout(params: {
  payoutId: string;
  reason: string;
  initiatedBy: string;
}): Promise<PayoutAdjustment> {
  const { payoutId, reason, initiatedBy } = params;

  // Get original payout
  const payoutResult = await query<{
    id: string;
    cleaner_id: string;
    amount_cents: number;
    stripe_transfer_id: string | null;
    status: string;
  }>(
    `SELECT * FROM payouts WHERE id = $1`,
    [payoutId]
  );

  const payout = payoutResult.rows[0];
  if (!payout) {
    throw Object.assign(new Error("Payout not found"), { statusCode: 404 });
  }

  if (payout.status !== "paid") {
    throw Object.assign(new Error("Can only reverse paid payouts"), { statusCode: 400 });
  }

  // Try to reverse Stripe transfer
  let stripeReversalId: string | null = null;
  if (payout.stripe_transfer_id) {
    try {
      const reversal = await stripe.transfers.createReversal(
        payout.stripe_transfer_id,
        {
          amount: payout.amount_cents,
          description: `Reversal: ${reason}`,
        }
      );
      stripeReversalId = reversal.id;
      logger.info("stripe_transfer_reversed", {
        transferId: payout.stripe_transfer_id,
        reversalId: reversal.id,
      });
    } catch (err) {
      logger.error("stripe_reversal_failed", {
        transferId: payout.stripe_transfer_id,
        error: (err as Error).message,
      });
      // Continue anyway - we'll mark it as pending for manual intervention
    }
  }

  // Create adjustment record
  const adjustmentResult = await query<PayoutAdjustment>(
    `
      INSERT INTO payout_adjustments (
        payout_id, cleaner_id, adjustment_type, amount_cents,
        reason, stripe_reversal_id, initiated_by, status
      )
      VALUES ($1, $2, 'reversal', $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      payoutId,
      payout.cleaner_id,
      -payout.amount_cents, // Negative = deducted from cleaner
      reason,
      stripeReversalId,
      initiatedBy,
      stripeReversalId ? "completed" : "pending",
    ]
  );

  // Update payout status
  await query(
    `UPDATE payouts SET status = 'reversed', updated_at = NOW() WHERE id = $1`,
    [payoutId]
  );

  // Deduct credits from cleaner (they got paid but we reversed it)
  await query(
    `
      INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
      VALUES ($1, (SELECT job_id FROM payouts WHERE id = $2), $3, 'adjustment')
    `,
    [payout.cleaner_id, payoutId, -Math.floor(payout.amount_cents / 100)]
  );

  await createAuditLog({
    actorId: initiatedBy,
    actorType: "admin",
    action: "payout_reversed",
    resourceType: "payout",
    resourceId: payoutId,
    oldValue: { status: payout.status, amount_cents: payout.amount_cents },
    newValue: { status: "reversed", reversal_id: stripeReversalId },
    metadata: { reason },
  });

  logger.info("payout_reversed", {
    payoutId,
    cleanerId: payout.cleaner_id,
    amountCents: payout.amount_cents,
    stripeReversalId,
    reason,
  });

  return adjustmentResult.rows[0];
}

/**
 * Hold payout for dispute (freeze credits)
 */
export async function holdPayoutForDispute(params: {
  cleanerId: string;
  jobId: string;
  amountCents: number;
  reason: string;
}): Promise<PayoutAdjustment> {
  const { cleanerId, jobId, amountCents, reason } = params;

  const result = await query<PayoutAdjustment>(
    `
      INSERT INTO payout_adjustments (
        cleaner_id, adjustment_type, amount_cents, reason, status, metadata
      )
      VALUES ($1, 'dispute_hold', $2, $3, 'completed', $4::jsonb)
      RETURNING *
    `,
    [cleanerId, -amountCents, reason, JSON.stringify({ job_id: jobId })]
  );

  logger.info("payout_held_for_dispute", { cleanerId, jobId, amountCents });

  return result.rows[0];
}

/**
 * Release disputed payout hold
 */
export async function releaseDisputeHold(
  adjustmentId: string,
  resolution: "refund" | "release"
): Promise<void> {
  const result = await query<PayoutAdjustment>(
    `SELECT * FROM payout_adjustments WHERE id = $1`,
    [adjustmentId]
  );

  const adjustment = result.rows[0];
  if (!adjustment) {
    throw Object.assign(new Error("Adjustment not found"), { statusCode: 404 });
  }

  if (resolution === "release") {
    // Give money back to cleaner
    await query(
      `
        INSERT INTO payout_adjustments (
          cleaner_id, adjustment_type, amount_cents, reason, status
        )
        VALUES ($1, 'dispute_release', $2, 'Dispute resolved in cleaner favor', 'completed')
      `,
      [adjustment.cleaner_id, Math.abs(adjustment.amount_cents)]
    );
  }
  // If refund, the hold stays (money goes back to client)

  logger.info("dispute_hold_resolved", { adjustmentId, resolution });
}

// ============================================
// Payout Retry Logic
// ============================================

/**
 * Queue a failed payout for retry
 */
export async function queuePayoutForRetry(params: {
  payoutId: string;
  cleanerId: string;
  amountCents: number;
  stripeAccountId: string | null;
  errorMessage: string;
}): Promise<void> {
  const nextRetryAt = new Date(Date.now() + PAYOUT_CONFIG.RETRY_INTERVALS_MS[0]);

  await query(
    `
      INSERT INTO payout_retry_queue (
        payout_id, cleaner_id, amount_cents, stripe_account_id, error_message, next_retry_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (payout_id) DO UPDATE
      SET error_message = EXCLUDED.error_message,
          retry_count = payout_retry_queue.retry_count + 1,
          next_retry_at = EXCLUDED.next_retry_at,
          status = 'pending',
          updated_at = NOW()
    `,
    [
      params.payoutId,
      params.cleanerId,
      params.amountCents,
      params.stripeAccountId,
      params.errorMessage,
      nextRetryAt.toISOString(),
    ]
  );

  logger.info("payout_queued_for_retry", {
    payoutId: params.payoutId,
    nextRetryAt,
  });
}

/**
 * Process pending payout retries
 */
export async function processPayoutRetries(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  exhausted: number;
}> {
  const pendingResult = await query<PayoutRetryItem>(
    `
      SELECT * FROM payout_retry_queue
      WHERE status = 'pending'
        AND next_retry_at <= NOW()
        AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT 50
    `
  );

  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;

  for (const item of pendingResult.rows) {
    try {
      // Mark as processing
      await query(
        `UPDATE payout_retry_queue SET status = 'processing' WHERE id = $1`,
        [item.id]
      );

      if (!item.stripe_account_id) {
        throw new Error("No Stripe account ID");
      }

      // Retry the transfer
      const transfer = await stripe.transfers.create({
        amount: item.amount_cents,
        currency: "usd",
        destination: item.stripe_account_id,
        metadata: {
          payout_id: item.payout_id,
          retry_attempt: String(item.retry_count + 1),
        },
      });

      // Update payout and retry queue
      await query(
        `UPDATE payouts SET status = 'paid', stripe_transfer_id = $2, updated_at = NOW() WHERE id = $1`,
        [item.payout_id, transfer.id]
      );

      await query(
        `UPDATE payout_retry_queue SET status = 'succeeded', updated_at = NOW() WHERE id = $1`,
        [item.id]
      );

      succeeded++;

      logger.info("payout_retry_succeeded", {
        payoutId: item.payout_id,
        transferId: transfer.id,
        attempt: item.retry_count + 1,
      });
    } catch (err) {
      const newRetryCount = item.retry_count + 1;

      if (newRetryCount >= item.max_retries) {
        // Exhausted retries
        await query(
          `UPDATE payout_retry_queue SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
          [item.id, (err as Error).message]
        );
        await query(
          `UPDATE payouts SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [item.payout_id]
        );
        exhausted++;

        logger.error("payout_retry_exhausted", {
          payoutId: item.payout_id,
          attempts: newRetryCount,
          error: (err as Error).message,
        });
      } else {
        // Schedule next retry
        const intervalIndex = Math.min(newRetryCount, PAYOUT_CONFIG.RETRY_INTERVALS_MS.length - 1);
        const nextRetryAt = new Date(Date.now() + PAYOUT_CONFIG.RETRY_INTERVALS_MS[intervalIndex]);

        await query(
          `
            UPDATE payout_retry_queue 
            SET status = 'pending', 
                retry_count = $2, 
                error_message = $3,
                next_retry_at = $4,
                updated_at = NOW()
            WHERE id = $1
          `,
          [item.id, newRetryCount, (err as Error).message, nextRetryAt.toISOString()]
        );
        failed++;

        logger.warn("payout_retry_failed", {
          payoutId: item.payout_id,
          attempt: newRetryCount,
          nextRetryAt,
          error: (err as Error).message,
        });
      }
    }
  }

  logger.info("payout_retries_processed", {
    processed: pendingResult.rows.length,
    succeeded,
    failed,
    exhausted,
  });

  return {
    processed: pendingResult.rows.length,
    succeeded,
    failed,
    exhausted,
  };
}

// ============================================
// Instant Payouts
// ============================================

/**
 * Process instant payout for cleaner (with fee)
 */
export async function processInstantPayout(
  cleanerId: string
): Promise<{
  transferId: string;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
}> {
  // Check if instant payouts enabled
  const profileResult = await query<{
    stripe_account_id: string | null;
    instant_payout_enabled: boolean;
  }>(
    `SELECT stripe_account_id, instant_payout_enabled FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const profile = profileResult.rows[0];
  if (!profile?.stripe_account_id) {
    throw Object.assign(new Error("No Stripe account connected"), { statusCode: 400 });
  }
  if (!profile.instant_payout_enabled) {
    throw Object.assign(new Error("Instant payouts not enabled"), { statusCode: 400 });
  }

  // Get pending payouts
  const pendingResult = await query<{ id: string; amount_cents: number }>(
    `SELECT id, amount_cents FROM payouts WHERE cleaner_id = $1 AND status = 'pending'`,
    [cleanerId]
  );

  if (pendingResult.rows.length === 0) {
    throw Object.assign(new Error("No pending payouts"), { statusCode: 400 });
  }

  const totalAmountCents = pendingResult.rows.reduce((sum, p) => sum + p.amount_cents, 0);
  const feeCents = Math.round(totalAmountCents * (PAYOUT_CONFIG.INSTANT_PAYOUT_FEE_PERCENT / 100));
  const netAmountCents = totalAmountCents - feeCents;

  // Create transfer
  const transfer = await stripe.transfers.create({
    amount: netAmountCents,
    currency: "usd",
    destination: profile.stripe_account_id,
    metadata: {
      cleaner_id: cleanerId,
      instant_payout: "true",
      original_amount: String(totalAmountCents),
      fee: String(feeCents),
    },
  });

  // Update all payouts
  const payoutIds = pendingResult.rows.map((p) => p.id);
  await query(
    `UPDATE payouts SET status = 'paid', stripe_transfer_id = $2, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
    [payoutIds, transfer.id]
  );

  logger.info("instant_payout_processed", {
    cleanerId,
    transferId: transfer.id,
    amountCents: totalAmountCents,
    feeCents,
    netAmountCents,
  });

  return {
    transferId: transfer.id,
    amountCents: totalAmountCents,
    feeCents,
    netAmountCents,
  };
}

