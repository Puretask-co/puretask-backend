// src/workers/processPayouts.ts
// Worker to process pending payouts via Stripe Connect

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { processSinglePayout, processPendingPayouts as processPendingPayoutsService } from "../services/payoutsService";
import type { Payout, CleanerEarning } from "../types/db";

// Configuration
const BATCH_SIZE = parseInt(process.env.PAYOUT_BATCH_SIZE || "50", 10);
const MIN_PAYOUT_USD = parseFloat(process.env.MIN_PAYOUT_USD || "10.00");

interface CleanerWithPendingEarnings {
  cleaner_id: string;
  total_pending_usd: number;
  earnings_count: number;
}

/**
 * Find cleaners with pending earnings above minimum threshold
 */
async function findCleanersWithPendingEarnings(): Promise<CleanerWithPendingEarnings[]> {
  const result = await query<CleanerWithPendingEarnings>(
    `
      SELECT 
        cleaner_id,
        SUM(usd_due) as total_pending_usd,
        COUNT(*) as earnings_count
      FROM cleaner_earnings
      WHERE status = 'pending'
        AND payout_id IS NULL
      GROUP BY cleaner_id
      HAVING SUM(usd_due) >= $1
      ORDER BY SUM(usd_due) DESC
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
      WHERE p.status = 'pending'
        AND u.stripe_connect_id IS NOT NULL
      ORDER BY p.created_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Create payouts for cleaners with pending earnings
 */
async function createPayoutsForCleaners(): Promise<{ created: number; failed: number }> {
  const cleaners = await findCleanersWithPendingEarnings();

  let created = 0;
  let failed = 0;

  for (const cleaner of cleaners) {
    try {
      // Check if cleaner already has a pending payout
      const existingPayout = await query<Payout>(
        `
          SELECT id FROM payouts
          WHERE cleaner_id = $1 AND status = 'pending'
          LIMIT 1
        `,
        [cleaner.cleaner_id]
      );

      if (existingPayout.rows.length > 0) {
        logger.debug("cleaner_already_has_pending_payout", {
          cleanerId: cleaner.cleaner_id,
        });
        continue;
      }

      // TODO: Implement createPayoutForCleaner or use processPendingPayoutsService
      // For now, use processPendingPayoutsService which handles creating payouts
      await processPendingPayoutsService();
      created++;

      logger.info("payout_created_for_cleaner", {
        cleanerId: cleaner.cleaner_id,
        totalUsd: cleaner.total_pending_usd,
        earningsCount: cleaner.earnings_count,
      });
    } catch (error) {
      failed++;
      logger.error("create_payout_for_cleaner_failed", {
        cleanerId: cleaner.cleaner_id,
        error: (error as Error).message,
      });
    }
  }

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
 * Main worker function
 */
export async function runPayoutsWorker(): Promise<{
  payoutsCreated: number;
  payoutsProcessed: number;
  failed: number;
}> {
  logger.info("payouts_worker_started", {
    batchSize: BATCH_SIZE,
    minPayoutUsd: MIN_PAYOUT_USD,
  });

  // Step 1: Create payouts for cleaners with pending earnings
  const createResult = await createPayoutsForCleaners();

  // Step 2: Process pending payouts
  const processResult = await processPendingPayouts();

  const result = {
    payoutsCreated: createResult.created,
    payoutsProcessed: processResult.processed,
    failed: createResult.failed + processResult.failed,
  };

  logger.info("payouts_worker_completed", result);

  return result;
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

