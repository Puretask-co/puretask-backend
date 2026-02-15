// src/workers/scheduler.ts
// Centralized cron scheduler for background workers
// Can be used as internal scheduler or Railway cron runner

import { logger } from "../lib/logger";
import { env } from "../config/env";
import { runWorker } from "./index";
import { runLockRecovery } from "./lockRecovery";
import { enqueue } from "../services/durableJobService";

// ============================================
// Worker Schedule Configuration
// ============================================

export interface WorkerSchedule {
  workerName: string;
  cronExpression: string; // e.g., "0 2 * * *" (daily at 2 AM)
  description: string;
  enabled: boolean;
}

export const WORKER_SCHEDULES: WorkerSchedule[] = [
  {
    workerName: "auto-cancel",
    cronExpression: "*/5 * * * *", // Every 5 minutes
    description: "Auto-cancel stale bookings",
    enabled: true,
  },
  {
    workerName: "retry-notifications",
    cronExpression: "*/10 * * * *", // Every 10 minutes
    description: "Retry failed email/SMS notifications",
    enabled: true,
  },
  {
    workerName: "webhook-retry",
    cronExpression: "*/5 * * * *", // Every 5 minutes
    description: "Retry failed webhook deliveries",
    enabled: true,
  },
  {
    workerName: "lock-recovery",
    cronExpression: "*/15 * * * *", // Every 15 minutes
    description: "Recover expired locks from crashed workers",
    enabled: true,
  },
  {
    workerName: "auto-expire",
    cronExpression: "0 * * * *", // Every hour
    description: "Auto-approve jobs stuck in awaiting_approval",
    enabled: true,
  },
  {
    workerName: "kpi-daily",
    cronExpression: "0 1 * * *", // Daily at 1 AM
    description: "Daily KPI snapshot",
    enabled: true,
  },
  {
    workerName: "nightly-scores",
    cronExpression: "0 2 * * *", // Daily at 2 AM
    description: "Recompute client risk + cleaner reliability scores",
    enabled: true,
  },
  {
    workerName: "subscription-jobs",
    cronExpression: "0 2 * * *", // Daily at 2 AM
    description: "Create subscription jobs",
    enabled: true,
  },
  {
    workerName: "reliability-recalc",
    cronExpression: "0 3 * * *", // Daily at 3 AM
    description: "Recalculate cleaner reliability scores",
    enabled: true,
  },
  {
    workerName: "backup-daily",
    cronExpression: "0 3 * * *", // Daily at 3 AM
    description: "Daily backup",
    enabled: true,
  },
  {
    workerName: "credit-economy",
    cronExpression: "0 4 * * *", // Daily at 4 AM
    description: "Credit decay & tier lock maintenance",
    enabled: true,
  },
  {
    workerName: "photo-cleanup",
    cronExpression: "0 5 * * *", // Daily at 5 AM
    description: "Delete photos older than 90 days",
    enabled: true,
  },
  {
    workerName: "onboarding-reminders",
    cronExpression: "0 */6 * * *", // Every 6 hours
    description: "Send reminders to incomplete onboarding",
    enabled: true,
  },
  {
    workerName: "payout-retry",
    cronExpression: "*/30 * * * *", // Every 30 minutes
    description: "Retry failed Stripe payouts",
    enabled: env.PAYOUTS_ENABLED ?? false,
  },
  {
    workerName: "payout-reconciliation",
    cronExpression: "0 6 * * *", // Daily at 6 AM
    description: "Flag payout/earnings mismatches",
    enabled: env.PAYOUTS_ENABLED ?? false,
  },
  {
    workerName: "payout-weekly",
    cronExpression: "0 0 * * 0", // Every Sunday at midnight
    description: "Weekly payout processing",
    enabled: env.PAYOUTS_ENABLED ?? false,
  },
  {
    workerName: "expire-boosts",
    cronExpression: "0 0 * * *", // Daily at midnight
    description: "Expire expired boosts",
    enabled: true,
  },
  {
    workerName: "weekly-summary",
    cronExpression: "0 4 * * 1", // Every Monday at 4 AM
    description: "Weekly summary generation",
    enabled: true,
  },
  {
    workerName: "job-reminders",
    cronExpression: "*/30 * * * *", // Every 30 minutes
    description: "Send job reminders (24h and 2h before)",
    enabled: true,
  },
  {
    workerName: "no-show-detection",
    cronExpression: "*/15 * * * *", // Every 15 minutes
    description: "Detect and warn about no-shows",
    enabled: true,
  },
  {
    workerName: "governor-metrics",
    cronExpression: "0 * * * *", // Every hour
    description: "Compute marketplace metrics + governor state per region",
    enabled: true,
  },
];

// ============================================
// Internal Scheduler (using node-cron)
// ============================================

let cronScheduler: any = null;

/**
 * Start internal cron scheduler (if node-cron is installed)
 */
export async function startInternalScheduler(): Promise<void> {
  try {
    // Dynamic import to avoid requiring node-cron if not installed
    const cron = await import("node-cron");
    const cronModule = cron.default || cron;

    logger.info("internal_scheduler_starting");

    for (const schedule of WORKER_SCHEDULES) {
      if (!schedule.enabled) {
        logger.debug("worker_schedule_disabled", {
          worker: schedule.workerName,
        });
        continue;
      }

      cronModule.schedule(schedule.cronExpression, async () => {
        logger.info("scheduled_worker_triggered", {
          worker: schedule.workerName,
          schedule: schedule.cronExpression,
          enqueueOnly: env.CRONS_ENQUEUE_ONLY,
        });

        try {
          if (env.CRONS_ENQUEUE_ONLY) {
            const bucket = Math.floor(Date.now() / 60_000).toString(); // 1 min bucket
            const key = `${schedule.workerName}:${bucket}`;
            const inserted = await enqueue(
              schedule.workerName,
              key,
              { triggeredAt: new Date().toISOString() },
              new Date()
            );
            if (!inserted) {
              logger.debug("scheduled_worker_already_queued", {
                worker: schedule.workerName,
                key,
              });
            }
          } else if (schedule.workerName === "lock-recovery") {
            await runLockRecovery();
          } else {
            await runWorker(schedule.workerName as any);
          }
        } catch (error) {
          logger.error("scheduled_worker_failed", {
            worker: schedule.workerName,
            error: (error as Error).message,
          });
        }
      });

      logger.info("worker_schedule_registered", {
        worker: schedule.workerName,
        schedule: schedule.cronExpression,
        description: schedule.description,
      });
    }

    logger.info("internal_scheduler_started", {
      schedulesRegistered: WORKER_SCHEDULES.filter((s) => s.enabled).length,
    });
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND") {
      logger.warn("node_cron_not_installed", {
        message:
          "node-cron not installed. Use Railway cron or install: npm install node-cron @types/node-cron",
      });
    } else {
      logger.error("internal_scheduler_failed", {
        error: error.message,
      });
      throw error;
    }
  }
}

/**
 * Stop internal scheduler
 */
export function stopInternalScheduler(): void {
  if (cronScheduler) {
    // node-cron doesn't have a global stop, but tasks can be stopped individually
    logger.info("internal_scheduler_stopped");
  }
}

// ============================================
// Railway Cron Runner (single worker execution)
// ============================================

/**
 * Run a specific worker (for Railway cron jobs)
 * Usage: node dist/workers/scheduler.js <worker-name>
 */
export async function runScheduledWorker(workerName: string): Promise<void> {
  const schedule = WORKER_SCHEDULES.find((s) => s.workerName === workerName);

  if (!schedule) {
    throw new Error(`Unknown worker: ${workerName}`);
  }

  if (!schedule.enabled) {
    logger.warn("worker_schedule_disabled", { worker: workerName });
    return;
  }

  logger.info("scheduled_worker_running", {
    worker: workerName,
    description: schedule.description,
    enqueueOnly: env.CRONS_ENQUEUE_ONLY,
  });

  try {
    if (env.CRONS_ENQUEUE_ONLY) {
      const bucket = Math.floor(Date.now() / 60_000).toString();
      const key = `${workerName}:${bucket}`;
      const inserted = await enqueue(
        workerName,
        key,
        { triggeredAt: new Date().toISOString() },
        new Date()
      );
      if (!inserted) {
        logger.info("scheduled_worker_already_queued", { worker: workerName, key });
      }
    } else if (workerName === "lock-recovery") {
      await runLockRecovery();
    } else {
      await runWorker(workerName as any);
    }

    logger.info("scheduled_worker_completed", { worker: workerName });
  } catch (error) {
    logger.error("scheduled_worker_failed", {
      worker: workerName,
      error: (error as Error).message,
    });
    throw error;
  }
}

// ============================================
// CLI Entry Point
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node dist/workers/scheduler.js <worker-name>");
    console.error("\nAvailable workers:");
    WORKER_SCHEDULES.forEach((s) => {
      console.error(`  - ${s.workerName}: ${s.description} (${s.cronExpression})`);
    });
    process.exit(1);
  }

  const workerName = args[0];
  runScheduledWorker(workerName)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Scheduled worker failed:", error);
      process.exit(1);
    });
}
