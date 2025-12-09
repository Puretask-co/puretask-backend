"use strict";
// src/workers/reliabilityRecalc.ts
// Nightly worker to recalculate all cleaner reliability scores
//
// Run on a schedule (e.g., daily at 03:00 UTC):
// node dist/workers/reliabilityRecalc.js
//
// Cron example: 0 3 * * * node /app/dist/workers/reliabilityRecalc.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReliabilityRecalc = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const reliabilityService_1 = require("../services/reliabilityService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("reliability_recalc_worker_started", {
        timestamp: new Date().toISOString(),
    });
    try {
        const result = await (0, reliabilityService_1.recalcAllCleanersReliability)();
        // Log significant score changes
        const significantChanges = result.updates.filter((u) => Math.abs(u.newScore - u.previousScore) >= 5);
        if (significantChanges.length > 0) {
            logger_1.logger.info("reliability_significant_changes", {
                count: significantChanges.length,
                changes: significantChanges.map((c) => ({
                    cleanerId: c.cleanerId,
                    from: c.previousScore,
                    to: c.newScore,
                    delta: c.newScore - c.previousScore,
                })),
            });
        }
        logger_1.logger.info("reliability_recalc_worker_completed", {
            processed: result.processed,
            failed: result.failed,
            significantChanges: significantChanges.length,
        });
    }
    catch (error) {
        logger_1.logger.error("reliability_recalc_worker_failed", {
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
        console.log("Reliability recalc worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Reliability recalc worker failed:", error);
        process.exit(1);
    });
}
