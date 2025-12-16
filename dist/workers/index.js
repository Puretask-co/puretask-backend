"use strict";
// src/workers/index.ts
// Worker runner - can run all workers or specific ones
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorker = runWorker;
const autoCancelJobs_1 = require("./autoCancelJobs");
const processPayouts_1 = require("./processPayouts");
const kpiSnapshot_1 = require("./kpiSnapshot");
const retryFailedEvents_1 = require("./retryFailedEvents");
const photoRetentionCleanup_1 = require("./photoRetentionCleanup");
const nightlyScoreRecompute_1 = require("./nightlyScoreRecompute");
const cleaningScores_1 = require("./disabled/cleaningScores");
const creditEconomyMaintenance_1 = require("./creditEconomyMaintenance");
const expireBoosts_1 = require("./disabled/expireBoosts");
const goalChecker_1 = require("./disabled/goalChecker");
const kpiDailySnapshot_1 = require("./disabled/kpiDailySnapshot");
const reliabilityRecalc_1 = require("./reliabilityRecalc");
const stuckJobDetection_1 = require("./disabled/stuckJobDetection");
const subscriptionJobs_1 = require("./disabled/subscriptionJobs");
const weeklySummary_1 = require("./disabled/weeklySummary");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
const workers = {
    "auto-cancel": autoCancelJobs_1.runAutoCancelWorker,
    "payouts": processPayouts_1.runPayoutsWorker,
    "kpi-snapshot": kpiSnapshot_1.runKPISnapshotWorker,
    "retry-events": retryFailedEvents_1.runRetryFailedEventsWorker,
    "photo-cleanup": photoRetentionCleanup_1.runPhotoRetentionCleanup, // Per Photo Proof policy: 90-day retention
    "nightly-scores": nightlyScoreRecompute_1.runNightlyScoreRecompute, // Client risk + Cleaner reliability + Flexibility scores
    "cleaning-scores": cleaningScores_1.runCleaningScores,
    "credit-economy": creditEconomyMaintenance_1.runCreditEconomyMaintenance,
    "expire-boosts": expireBoosts_1.runExpireBoosts,
    "goal-checker": goalChecker_1.runGoalChecker,
    "kpi-daily": kpiDailySnapshot_1.runKpiDailySnapshot,
    "reliability-recalc": reliabilityRecalc_1.runReliabilityRecalc,
    "stuck-detection": stuckJobDetection_1.runStuckJobDetection,
    "subscription-jobs": subscriptionJobs_1.runSubscriptionJobs,
    "weekly-summary": weeklySummary_1.runWeeklySummary,
};
/**
 * Run a specific worker or all workers
 * V1 HARDENING: Checks WORKERS_ENABLED guard flag
 */
async function runWorker(name) {
    // V1 HARDENING: Check workers guard flag
    if (!env_1.env.WORKERS_ENABLED) {
        logger_1.logger.warn("workers_disabled", { message: "Workers are disabled via WORKERS_ENABLED flag" });
        return;
    }
    if (name === "all") {
        logger_1.logger.info("running_all_workers");
        for (const [workerName, workerFn] of Object.entries(workers)) {
            try {
                logger_1.logger.info("worker_starting", { worker: workerName });
                await workerFn();
                logger_1.logger.info("worker_finished", { worker: workerName });
            }
            catch (error) {
                logger_1.logger.error("worker_error", {
                    worker: workerName,
                    error: error.message,
                });
            }
        }
        return;
    }
    const workerFn = workers[name];
    if (!workerFn) {
        throw new Error(`Unknown worker: ${name}. Available: ${Object.keys(workers).join(", ")}`);
    }
    await workerFn();
}
// Run if executed directly
if (require.main === module) {
    const workerName = (process.argv[2] || "all");
    runWorker(workerName)
        .then(() => {
        console.log(`Worker(s) completed: ${workerName}`);
        process.exit(0);
    })
        .catch((error) => {
        console.error(`Worker(s) failed:`, error);
        process.exit(1);
    });
}
