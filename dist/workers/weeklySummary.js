"use strict";
// src/workers/weeklySummary.ts
// Worker to send weekly summary emails to clients and cleaners
//
// Run weekly (Sunday evening): node dist/workers/weeklySummary.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWeeklySummary = main;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
const weeklySummaryService_1 = require("../../services/weeklySummaryService");
/**
 * Main worker function
 */
async function main() {
    const { weekStart, weekEnd } = (0, weeklySummaryService_1.getPreviousWeekRange)();
    logger_1.logger.info("weekly_summary_worker_started", {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
    });
    try {
        // Send client summaries
        logger_1.logger.info("sending_client_summaries");
        const clientResults = await (0, weeklySummaryService_1.sendAllClientWeeklySummaries)(weekStart, weekEnd);
        logger_1.logger.info("client_summaries_completed", clientResults);
        // Send cleaner summaries
        logger_1.logger.info("sending_cleaner_summaries");
        const cleanerResults = await (0, weeklySummaryService_1.sendAllCleanerWeeklySummaries)(weekStart, weekEnd);
        logger_1.logger.info("cleaner_summaries_completed", cleanerResults);
        logger_1.logger.info("weekly_summary_worker_completed", {
            clientsSent: clientResults.sent,
            clientsFailed: clientResults.failed,
            cleanersSent: cleanerResults.sent,
            cleanersFailed: cleanerResults.failed,
            totalSent: clientResults.sent + cleanerResults.sent,
            totalFailed: clientResults.failed + cleanerResults.failed,
        });
    }
    catch (error) {
        logger_1.logger.error("weekly_summary_worker_failed", {
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
        console.log("Weekly summary worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Weekly summary worker failed:", error);
        process.exit(1);
    });
}
