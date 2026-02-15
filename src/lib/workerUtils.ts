// src/lib/workerUtils.ts
// V1 HARDENING: Reusable utilities for worker concurrency guards and observability

import { pool } from "../db/client";
import { logger } from "./logger";

export interface WorkerRunResult {
  processed: number;
  failed: number;
  [key: string]: any; // Allow additional metrics
}

/**
 * V1 HARDENING: Execute a worker function with advisory lock and run tracking
 *
 * @param workerName - Unique name for the worker (e.g., "payouts", "auto-cancel")
 * @param lockId - Unique PostgreSQL advisory lock ID (must be unique per worker)
 * @param workerFn - The actual worker function to execute
 * @returns Worker result or null if lock was already held
 */
export async function runWorkerWithLock<T extends WorkerRunResult>(
  workerName: string,
  lockId: number,
  workerFn: () => Promise<T>
): Promise<T | null> {
  const client = await pool.connect();
  let workerRunId: string | null = null;

  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await client.query<{ pg_try_advisory_lock: boolean }>(
      `SELECT pg_try_advisory_lock($1) as pg_try_advisory_lock`,
      [lockId]
    );

    if (!lockResult.rows[0]?.pg_try_advisory_lock) {
      logger.warn("worker_locked", {
        workerName,
        lockId,
        message: `Another ${workerName} worker is already running. Skipping this run.`,
      });
      return null;
    }

    // Record worker run start
    const runResult = await client.query<{ id: string }>(
      `
        INSERT INTO worker_runs (worker_name, status, started_at)
        VALUES ($1, 'running', NOW())
        RETURNING id
      `,
      [workerName]
    );
    workerRunId = runResult.rows[0]?.id || null;

    logger.info("worker_started", {
      workerName,
      workerRunId,
    });

    // Execute the worker function
    const result = await workerFn();

    // Update worker run as successful
    if (workerRunId) {
      await client.query(
        `
          UPDATE worker_runs
          SET status = 'success',
              finished_at = NOW(),
              processed = $1,
              failed = $2,
              metadata = $3::jsonb
          WHERE id = $4
        `,
        [result.processed || 0, result.failed || 0, JSON.stringify(result), workerRunId]
      );
    }

    logger.info("worker_completed", {
      workerName,
      workerRunId,
      ...result,
    });

    return result;
  } catch (error) {
    // Update worker run as failed
    if (workerRunId) {
      await client
        .query(
          `
          UPDATE worker_runs
          SET status = 'failed',
              finished_at = NOW(),
              error_message = $1
          WHERE id = $2
        `,
          [(error as Error).message, workerRunId]
        )
        .catch((updateError) => {
          logger.error("worker_run_update_failed", {
            workerName,
            workerRunId,
            error: (updateError as Error).message,
          });
        });
    }

    logger.error("worker_failed", {
      workerName,
      workerRunId,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Release advisory lock
    await client.query(`SELECT pg_advisory_unlock($1)`, [lockId]).catch((unlockError) => {
      logger.error("worker_unlock_failed", {
        workerName,
        lockId,
        error: (unlockError as Error).message,
      });
    });
    client.release();
  }
}

/**
 * Get unique lock ID for a worker name (deterministic hash)
 * This ensures each worker gets a unique lock ID
 */
export function getWorkerLockId(workerName: string): number {
  // Simple hash function to convert worker name to a number
  // Using a range that avoids conflicts with manual lock IDs (1000+)
  let hash = 0;
  for (let i = 0; i < workerName.length; i++) {
    const char = workerName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return positive number in range 2000-9999
  return Math.abs(hash % 8000) + 2000;
}
