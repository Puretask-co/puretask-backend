"use strict";
// src/workers/processPayouts.ts
// Worker to process pending payouts via Stripe Connect
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPayoutsWorker = runPayoutsWorker;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const payoutsService_1 = require("../services/payoutsService");
// Configuration
const BATCH_SIZE = parseInt(process.env.PAYOUT_BATCH_SIZE || "50", 10);
const MIN_PAYOUT_USD = parseFloat(process.env.MIN_PAYOUT_USD || "10.00");
/**
 * Find cleaners with pending earnings above minimum threshold
 */
async function findCleanersWithPendingEarnings() {
    const result = await (0, client_1.query)(`
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
    `, [MIN_PAYOUT_USD, BATCH_SIZE]);
    return result.rows;
}
/**
 * Find pending payouts that need processing
 */
async function findPendingPayouts() {
    const result = await (0, client_1.query)(`
      SELECT p.*
      FROM payouts p
      JOIN users u ON p.cleaner_id = u.id
      WHERE p.status = 'pending'
        AND u.stripe_connect_id IS NOT NULL
      ORDER BY p.created_at ASC
      LIMIT $1
    `, [BATCH_SIZE]);
    return result.rows;
}
/**
 * Create payouts for cleaners with pending earnings
 */
async function createPayoutsForCleaners() {
    const cleaners = await findCleanersWithPendingEarnings();
    let created = 0;
    let failed = 0;
    for (const cleaner of cleaners) {
        try {
            // Check if cleaner already has a pending payout
            const existingPayout = await (0, client_1.query)(`
          SELECT id FROM payouts
          WHERE cleaner_id = $1 AND status = 'pending'
          LIMIT 1
        `, [cleaner.cleaner_id]);
            if (existingPayout.rows.length > 0) {
                logger_1.logger.debug("cleaner_already_has_pending_payout", {
                    cleanerId: cleaner.cleaner_id,
                });
                continue;
            }
            await (0, payoutsService_1.createPayoutForCleaner)(cleaner.cleaner_id);
            created++;
            logger_1.logger.info("payout_created_for_cleaner", {
                cleanerId: cleaner.cleaner_id,
                totalUsd: cleaner.total_pending_usd,
                earningsCount: cleaner.earnings_count,
            });
        }
        catch (error) {
            failed++;
            logger_1.logger.error("create_payout_for_cleaner_failed", {
                cleanerId: cleaner.cleaner_id,
                error: error.message,
            });
        }
    }
    return { created, failed };
}
/**
 * Process pending payouts via Stripe Connect
 */
async function processPendingPayouts() {
    const payouts = await findPendingPayouts();
    let processed = 0;
    let failed = 0;
    for (const payout of payouts) {
        try {
            await (0, payoutsService_1.processPayout)(payout.id);
            processed++;
            logger_1.logger.info("payout_processed", {
                payoutId: payout.id,
                cleanerId: payout.cleaner_id,
                totalUsd: payout.total_usd,
            });
        }
        catch (error) {
            failed++;
            logger_1.logger.error("process_payout_failed", {
                payoutId: payout.id,
                cleanerId: payout.cleaner_id,
                error: error.message,
            });
        }
    }
    return { processed, failed };
}
/**
 * Main worker function
 */
async function runPayoutsWorker() {
    logger_1.logger.info("payouts_worker_started", {
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
    logger_1.logger.info("payouts_worker_completed", result);
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
