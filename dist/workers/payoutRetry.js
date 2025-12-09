"use strict";
// src/workers/payoutRetry.ts
// Worker to process failed payout retries
//
// Run every 30 minutes: node dist/workers/payoutRetry.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPayoutRetry = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const payoutImprovementsService_1 = require("../services/payoutImprovementsService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("payout_retry_worker_started");
    try {
        const result = await (0, payoutImprovementsService_1.processPayoutRetries)();
        logger_1.logger.info("payout_retry_worker_completed", result);
    }
    catch (error) {
        logger_1.logger.error("payout_retry_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Payout retry worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Payout retry worker failed:", error);
        process.exit(1);
    });
}
