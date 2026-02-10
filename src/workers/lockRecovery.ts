// src/workers/lockRecovery.ts
// Worker to recover expired locks from crashed workers

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { queueService } from "../lib/queue";

const LOCK_TIMEOUT_MINUTES = 30; // Jobs stuck for 30+ minutes are considered expired

/**
 * Recover expired locks in job_queue
 */
export async function recoverExpiredJobLocks(): Promise<number> {
  logger.info("lock_recovery_started", { lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES });

  try {
    const recovered = await queueService.recoverExpiredLocks(LOCK_TIMEOUT_MINUTES);

    if (recovered > 0) {
      logger.warn("expired_job_locks_recovered", {
        count: recovered,
        lockTimeoutMinutes: LOCK_TIMEOUT_MINUTES,
      });
    } else {
      logger.debug("no_expired_locks_found");
    }

    return recovered;
  } catch (error) {
    logger.error("lock_recovery_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Recover expired worker runs
 */
export async function recoverExpiredWorkerRuns(
  lockTimeoutMinutes: number = 60
): Promise<number> {
  logger.info("worker_run_recovery_started", { lockTimeoutMinutes });

  try {
    const result = await query<{ count: string }>(
      `
        SELECT recover_expired_worker_runs($1)::text as count
      `,
      [lockTimeoutMinutes]
    );

    const recovered = Number(result.rows[0]?.count || 0);

    if (recovered > 0) {
      logger.warn("expired_worker_runs_recovered", {
        count: recovered,
        lockTimeoutMinutes,
      });
    } else {
      logger.debug("no_expired_worker_runs_found");
    }

    return recovered;
  } catch (error) {
    logger.error("worker_run_recovery_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Main recovery function (runs both job and worker run recovery)
 */
export async function runLockRecovery(): Promise<{
  jobLocksRecovered: number;
  workerRunsRecovered: number;
}> {
  const jobLocksRecovered = await recoverExpiredJobLocks();
  const workerRunsRecovered = await recoverExpiredWorkerRuns();

  logger.info("lock_recovery_completed", {
    jobLocksRecovered,
    workerRunsRecovered,
  });

  return { jobLocksRecovered, workerRunsRecovered };
}

// Run if executed directly
if (require.main === module) {
  runLockRecovery()
    .then((result) => {
      console.log("Lock recovery completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Lock recovery failed:", error);
      process.exit(1);
    });
}
