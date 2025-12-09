"use strict";
// src/workers/payoutWeekly.ts
// Weekly worker to process pending payouts via Stripe Connect
//
// Run this worker on a schedule (e.g., weekly, daily, or multiple times per day)
// Example: node dist/workers/payoutWeekly.js
// Or via cron: 0 0 * * 0 node dist/workers/payoutWeekly.js (every Sunday at midnight)
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPayoutWeeklyWorker = main;
const logger_1 = require("../lib/logger");
const payoutsService_1 = require("../services/payoutsService");
const client_1 = require("../db/client");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("payout_weekly_worker_started", {
        timestamp: new Date().toISOString(),
    });
    try {
        const result = await payoutsService_1.payoutsService.processPendingPayouts();
        logger_1.logger.info("payout_weekly_worker_completed", {
            ...result,
            timestamp: new Date().toISOString(),
        });
        // Exit with appropriate code
        if (result.failed > 0 && result.processed === 0) {
            // All failed
            process.exit(1);
        }
    }
    catch (error) {
        logger_1.logger.error("payout_weekly_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
    finally {
        // Close database connection pool
        await client_1.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Payout weekly worker completed successfully");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Payout weekly worker failed:", error);
        process.exit(1);
    });
}
