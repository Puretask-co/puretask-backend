// src/workers/processPayouts.ts
// Worker to process pending payouts via Stripe Connect
// V1 HARDENING: Uses workerUtils for advisory locks and run tracking

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { runWorkerWithLock, getWorkerLockId } from "../../lib/workerUtils";
import {
  processSinglePayout,
  processPendingPayouts as processPendingPayoutsService,
} from "../../services/payoutsService";
import type { Payout, CleanerEarning } from "../../types/db";

// Configuration
const BATCH_SIZE = parseInt(process.env.PAYOUT_BATCH_SIZE || "50", 10);
const MIN_PAYOUT_USD = parseFloat(process.env.MIN_PAYOUT_USD || "10.00");

interface CleanerWithPendingEarnings {
  cleaner_id: string;
  total_pending_usd: number;
  earnings_count: number;
}

/**
 * Find cleaners with pending payouts above minimum threshold
 * V1: Uses payouts table directly (cleaner_earnings is not actively used in V1)
 */
async function findCleanersWithPendingPayouts(): Promise<CleanerWithPendingEarnings[]> {
  const result = await query<CleanerWithPendingEarnings>(
    `
      SELECT 
        cleaner_id,
        SUM(amount_cents) / 100.0 as total_pending_usd,
        COUNT(*) as earnings_count
      FROM payouts
      WHERE status = 'pending'
      GROUP BY cleaner_id
      HAVING SUM(amount_cents) / 100.0 >= $1
      ORDER BY SUM(amount_cents) DESC
      LIMIT $2
    `,
    [MIN_PAYOUT_USD, BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Find pending payouts that need processing
 */
async function findPendingPayouts(): Promise<Payout[]> {
  const result = await query<Payout>(
    `
      SELECT p.*
      FROM payouts p
      JOIN users u ON p.cleaner_id = u.id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
      WHERE p.status = 'pending'
        AND cp.stripe_account_id IS NOT NULL
      ORDER BY p.created_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Create payouts for cleaners with pending earnings
 * V1: This function is not needed since payouts are created directly when jobs complete
 * via recordEarningsForCompletedJob. This is kept for compatibility but returns 0.
 */
async function createPayoutsForCleaners(): Promise<{ created: number; failed: number }> {
  // V1: Payouts are already created when jobs complete via recordEarningsForCompletedJob
  // This function is a no-op in V1
  logger.debug("create_payouts_skipped_v1", {
    message: "Payouts are created automatically when jobs complete. No batch creation needed.",
  });
  return { created: 0, failed: 0 };

  let created = 0;
  let failed = 0;

  // V1: No-op - payouts are created automatically
  return { created, failed };
}

/**
 * Process pending payouts via Stripe Connect
 */
async function processPendingPayouts(): Promise<{ processed: number; failed: number }> {
  const payouts = await findPendingPayouts();

  let processed = 0;
  let failed = 0;

  for (const payout of payouts) {
    try {
      await processSinglePayout(payout.id);
      processed++;

      logger.info("payout_processed", {
        payoutId: payout.id,
        cleanerId: payout.cleaner_id,
        totalUsd: payout.total_usd,
      });
    } catch (error) {
      failed++;
      logger.error("process_payout_failed", {
        payoutId: payout.id,
        cleanerId: payout.cleaner_id,
        error: (error as Error).message,
      });
    }
  }

  return { processed, failed };
}

/**
 * V1 HARDENING: Main worker function with advisory lock and idempotency
 * Uses workerUtils.runWorkerWithLock for concurrency protection
 */
export async function runPayoutsWorker(): Promise<{
  payoutsCreated: number;
  payoutsProcessed: number;
  failed: number;
}> {
  const WORKER_NAME = "payouts";
  const LOCK_ID = 1001; // Unique lock ID for payout worker (manual override)

  const result = await runWorkerWithLock(WORKER_NAME, LOCK_ID, async () => {
    logger.info("payouts_worker_executing", {
      batchSize: BATCH_SIZE,
      minPayoutUsd: MIN_PAYOUT_USD,
    });

    // Step 1: Create payouts for cleaners with pending earnings
    const createResult = await createPayoutsForCleaners();

    // Step 2: Process pending payouts
    const processResult = await processPendingPayouts();

    return {
      processed: createResult.created + processResult.processed,
      failed: createResult.failed + processResult.failed,
      payoutsCreated: createResult.created,
      payoutsProcessed: processResult.processed,
    };
  });

  // If lock was held (null), return zero stats
  if (!result) {
    return { payoutsCreated: 0, payoutsProcessed: 0, failed: 0 };
  }

  return {
    payoutsCreated: result.payoutsCreated || 0,
    payoutsProcessed: result.payoutsProcessed || 0,
    failed: result.failed || 0,
  };
}

// Run if executed directly
if (require.main === module) {
  runPayoutsWorker()
    .then((result) => {
      console.log("Payouts worker completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Payouts worker failed:", error);
      process.exit(1);
    });
}
