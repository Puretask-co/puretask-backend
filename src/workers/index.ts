// src/workers/index.ts
// Worker runner - can run all workers or specific ones

import { runAutoCancelWorker } from "./autoCancelJobs";
import { runPayoutsWorker } from "./processPayouts";
import { runKPISnapshotWorker } from "./kpiSnapshot";
import { runRetryFailedEventsWorker } from "./retryFailedEvents";
import { runPhotoRetentionCleanup } from "./photoRetentionCleanup";
import { runNightlyScoreRecompute } from "./nightlyScoreRecompute";
import { runCleaningScores } from "./cleaningScores";
import { runCreditEconomyMaintenance } from "./creditEconomyMaintenance";
import { runExpireBoosts } from "./expireBoosts";
import { runGoalChecker } from "./goalChecker";
import { runKpiDailySnapshot } from "./kpiDailySnapshot";
import { runReliabilityRecalc } from "./reliabilityRecalc";
import { runStuckJobDetection } from "./stuckJobDetection";
import { runSubscriptionJobs } from "./subscriptionJobs";
import { runWeeklySummary } from "./weeklySummary";
import { logger } from "../lib/logger";
import { env } from "../config/env";

type WorkerName =
  | "auto-cancel"
  | "payouts"
  | "kpi-snapshot"
  | "retry-events"
  | "photo-cleanup"
  | "nightly-scores"
  | "cleaning-scores"
  | "credit-economy"
  | "expire-boosts"
  | "goal-checker"
  | "kpi-daily"
  | "reliability-recalc"
  | "stuck-detection"
  | "subscription-jobs"
  | "weekly-summary"
  | "all";

const workers: Record<string, () => Promise<any>> = {
  "auto-cancel": runAutoCancelWorker,
  "payouts": runPayoutsWorker,
  "kpi-snapshot": runKPISnapshotWorker,
  "retry-events": runRetryFailedEventsWorker,
  "photo-cleanup": runPhotoRetentionCleanup, // Per Photo Proof policy: 90-day retention
  "nightly-scores": runNightlyScoreRecompute, // Client risk + Cleaner reliability + Flexibility scores
  "cleaning-scores": runCleaningScores,
  "credit-economy": runCreditEconomyMaintenance,
  "expire-boosts": runExpireBoosts,
  "goal-checker": runGoalChecker,
  "kpi-daily": runKpiDailySnapshot,
  "reliability-recalc": runReliabilityRecalc,
  "stuck-detection": runStuckJobDetection,
  "subscription-jobs": runSubscriptionJobs,
  "weekly-summary": runWeeklySummary,
};

/**
 * Run a specific worker or all workers
 * V1 HARDENING: Checks WORKERS_ENABLED guard flag
 */
export async function runWorker(name: WorkerName): Promise<void> {
  // V1 HARDENING: Check workers guard flag
  if (!env.WORKERS_ENABLED) {
    logger.warn("workers_disabled", { message: "Workers are disabled via WORKERS_ENABLED flag" });
    return;
  }

  if (name === "all") {
    logger.info("running_all_workers");

    for (const [workerName, workerFn] of Object.entries(workers)) {
      try {
        logger.info("worker_starting", { worker: workerName });
        await workerFn();
        logger.info("worker_finished", { worker: workerName });
      } catch (error) {
        logger.error("worker_error", {
          worker: workerName,
          error: (error as Error).message,
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
  const workerName = (process.argv[2] || "all") as WorkerName;

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

