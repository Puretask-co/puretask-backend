"use strict";
// src/workers/webhookRetry.ts
// Worker to process failed webhook retries
//
// Run on a schedule (e.g., every 5 minutes):
// node dist/workers/webhookRetry.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWebhookRetryWorker = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const webhookRetryService_1 = require("../services/webhookRetryService");
const BATCH_SIZE = 50;
const CLEANUP_DAYS = 30;
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("webhook_retry_worker_started", {
        batchSize: BATCH_SIZE,
        cleanupDays: CLEANUP_DAYS,
    });
    try {
        // Get stats before processing
        const statsBefore = await (0, webhookRetryService_1.getWebhookStats)();
        logger_1.logger.info("webhook_queue_stats", statsBefore);
        // Process pending retries
        const result = await (0, webhookRetryService_1.processWebhookRetries)(BATCH_SIZE);
        // Clean up old entries
        const cleanedUp = await (0, webhookRetryService_1.cleanupOldWebhooks)(CLEANUP_DAYS);
        // Get stats after processing
        const statsAfter = await (0, webhookRetryService_1.getWebhookStats)();
        logger_1.logger.info("webhook_retry_worker_completed", {
            ...result,
            cleanedUp,
            remainingPending: statsAfter.pending,
            remainingDead: statsAfter.dead,
        });
    }
    catch (error) {
        logger_1.logger.error("webhook_retry_worker_failed", {
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
        console.log("Webhook retry worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Webhook retry worker failed:", error);
        process.exit(1);
    });
}
