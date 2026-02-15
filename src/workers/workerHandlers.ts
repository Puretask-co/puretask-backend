// src/workers/workerHandlers.ts
// Section 6: Register durable job handlers for cron-enqueue-only mode.
// When CRONS_ENQUEUE_ONLY=true, scheduler enqueues; durable job worker processes.

import { registerHandler } from "./durableJobWorker";
import { runWorker } from "./index";
import { runLockRecovery } from "./lockRecovery";

/**
 * Register all worker handlers for durable job processing.
 * Call once at app/worker startup.
 */
export function registerWorkerHandlers(): void {
  const workerNames = [
    "auto-cancel",
    "auto-expire",
    "payout-weekly",
    "retry-notifications",
    "webhook-retry",
    "photo-cleanup",
    "nightly-scores",
    "cleaning-scores",
    "credit-economy",
    "expire-boosts",
    "kpi-daily",
    "reliability-recalc",
    "subscription-jobs",
    "weekly-summary",
    "onboarding-reminders",
    "payout-retry",
    "payout-reconciliation",
    "backup-daily",
    "job-reminders",
    "no-show-detection",
    "governor-metrics",
  ];

  for (const name of workerNames) {
    registerHandler(name, async () => {
      await runWorker(name as any);
    });
  }

  registerHandler("lock-recovery", async () => {
    await runLockRecovery();
  });
}
