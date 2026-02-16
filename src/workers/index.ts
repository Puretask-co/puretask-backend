// src/workers/index.ts
// Worker runner - can run all workers or specific ones

// V1 Core Workers
import { runAutoCancelWorker } from "./v1-core/autoCancelJobs";
import { runAutoExpireWorker } from "./v1-core/autoExpireAwaitingApproval";
import { runPayoutWeeklyWorker } from "./v1-core/payoutWeekly";
import { retryFailedNotifications } from "./v1-core/retryFailedNotifications";
import { runWebhookRetryWorker } from "./v1-core/webhookRetry";
import { runJobRemindersWorker } from "./v1-core/jobReminders";
import { runNoShowDetectionWorker } from "./v1-core/noShowDetection";

// V2 Operations Workers
import { runPhotoRetentionCleanup } from "./v2-operations/photoRetentionCleanup";
import { runGoalChecker } from "./v2-operations/goalChecker";
import { runCreditEconomyMaintenance } from "./v2-operations/creditEconomyMaintenance";
import { runPayoutRetry } from "./v2-operations/payoutRetry";
import { runPayoutReconciliation } from "./v2-operations/payoutReconciliation";
import { runBackupDaily } from "./v2-operations/backupDaily";

// V3 Automation Workers
import { runSubscriptionJobs } from "./v3-automation/subscriptionJobs";

// V4 Analytics Workers
import { runExpireBoosts } from "./v4-analytics/expireBoosts";
import { runKpiDailySnapshot } from "./v4-analytics/kpiDailySnapshot";
import { runWeeklySummary } from "./v4-analytics/weeklySummary";

// Reliability Workers
import { runNightlyScoreRecompute } from "./reliability/nightlyScoreRecompute";
import { runCleaningScores } from "./reliability/cleaningScores";
import { runReliabilityRecalc } from "./reliability/reliabilityRecalc";

// Gamification Workers
import { runComputeGovernorMetrics } from "./gamification/computeGovernorMetrics";

// Other Workers
import { runOnboardingReminderWorker } from "./onboardingReminderWorker";

import { logger } from "../lib/logger";
import { env } from "../config/env";

type WorkerName =
  | "auto-cancel"
  | "auto-expire"
  | "payouts"
  | "payout-weekly"
  | "retry-notifications"
  | "webhook-retry"
  | "photo-cleanup"
  | "nightly-scores"
  | "cleaning-scores"
  | "credit-economy"
  | "expire-boosts"
  | "kpi-daily"
  | "reliability-recalc"
  | "subscription-jobs"
  | "weekly-summary"
  | "onboarding-reminders"
  | "payout-retry"
  | "payout-reconciliation"
  | "backup-daily"
  | "job-reminders"
  | "no-show-detection"
  | "governor-metrics"
  | "goal-checker"
  | "all";

const workers: Record<string, () => Promise<unknown>> = {
  "auto-cancel": runAutoCancelWorker,
  "auto-expire": runAutoExpireWorker,
  payouts: runPayoutWeeklyWorker,
  "payout-weekly": runPayoutWeeklyWorker,
  "retry-notifications": retryFailedNotifications,
  "webhook-retry": runWebhookRetryWorker,
  "photo-cleanup": runPhotoRetentionCleanup,
  "nightly-scores": runNightlyScoreRecompute,
  "cleaning-scores": runCleaningScores,
  "credit-economy": runCreditEconomyMaintenance,
  "expire-boosts": runExpireBoosts,
  "kpi-daily": runKpiDailySnapshot,
  "reliability-recalc": runReliabilityRecalc,
  "subscription-jobs": runSubscriptionJobs,
  "weekly-summary": runWeeklySummary,
  "onboarding-reminders": runOnboardingReminderWorker,
  "payout-retry": runPayoutRetry,
  "payout-reconciliation": runPayoutReconciliation,
  "backup-daily": runBackupDaily,
  "job-reminders": runJobRemindersWorker,
  "no-show-detection": runNoShowDetectionWorker,
  "governor-metrics": runComputeGovernorMetrics,
  "goal-checker": runGoalChecker,
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
