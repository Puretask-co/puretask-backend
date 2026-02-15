// src/services/durableJobService.ts
// Section 6: enqueue, claim, complete, fail for durable_jobs table.
// Workers use claim() with FOR UPDATE SKIP LOCKED; crons should only enqueue.

import { pool } from "../db/client";
import { logger } from "../lib/logger";

const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 min
const DEFAULT_MAX_ATTEMPTS = 5;

export interface DurableJobRow {
  id: string;
  job_type: string;
  idempotency_key: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  run_at: Date;
  locked_at: Date | null;
  locked_by: string | null;
  payload_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Enqueue a job. Idempotent: same (job_type, idempotency_key) does not create a duplicate.
 * Returns true if inserted, false if duplicate.
 */
export async function enqueue(
  jobType: string,
  idempotencyKey: string,
  payload?: Record<string, unknown>,
  runAt?: Date
): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO durable_jobs (job_type, idempotency_key, payload_json, run_at, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (job_type, idempotency_key) DO NOTHING`,
    [jobType, idempotencyKey, payload ? JSON.stringify(payload) : null, runAt ?? new Date()]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Claim up to `limit` pending jobs that are due (run_at <= now).
 * Uses FOR UPDATE SKIP LOCKED. Sets locked_at, locked_by, status = 'running'.
 * Returns claimed rows.
 */
export async function claim(workerId: string, limit: number = 5): Promise<DurableJobRow[]> {
  const client = await pool.connect();
  try {
    const now = new Date();
    const res = await client.query<DurableJobRow>(
      `UPDATE durable_jobs
       SET status = 'running', locked_at = $1, locked_by = $2, updated_at = $1
       WHERE id IN (
         SELECT id FROM durable_jobs
         WHERE status = 'pending' AND run_at <= $1
         ORDER BY run_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, job_type, idempotency_key, status, attempt_count, max_attempts,
                 run_at, locked_at, locked_by, payload_json, result_json, error_message,
                 created_at, updated_at`,
      [now, workerId, limit]
    );
    return res.rows ?? [];
  } finally {
    client.release();
  }
}

/**
 * Mark job completed. Call after handler succeeds.
 */
export async function complete(jobId: string, result?: Record<string, unknown>): Promise<void> {
  await pool.query(
    `UPDATE durable_jobs SET status = 'completed', result_json = $2, locked_at = NULL, locked_by = NULL, updated_at = NOW() WHERE id = $1`,
    [jobId, result ? JSON.stringify(result) : null]
  );
}

/**
 * Mark job failed. If attempt_count < max_attempts, set status = 'retrying' and run_at = now + backoff.
 * Otherwise set status = 'dead'.
 */
export async function fail(
  jobId: string,
  errorMessage: string,
  retry: boolean = true
): Promise<void> {
  const client = await pool.connect();
  try {
    const row = await client.query(
      `SELECT attempt_count, max_attempts FROM durable_jobs WHERE id = $1`,
      [jobId]
    );
    if (row.rows.length === 0) return;
    const { attempt_count, max_attempts } = row.rows[0];
    const nextAttempt = attempt_count + 1;
    if (retry && nextAttempt < max_attempts) {
      const backoffMs = Math.min(30_000 * Math.pow(2, nextAttempt), 3600_000);
      const runAt = new Date(Date.now() + backoffMs);
      await client.query(
        `UPDATE durable_jobs SET status = 'retrying', attempt_count = $2, error_message = $3, run_at = $4, locked_at = NULL, locked_by = NULL, updated_at = NOW() WHERE id = $1`,
        [jobId, nextAttempt, errorMessage, runAt]
      );
    } else {
      await client.query(
        `UPDATE durable_jobs SET status = 'dead', attempt_count = $2, error_message = $3, locked_at = NULL, locked_by = NULL, updated_at = NOW() WHERE id = $1`,
        [jobId, nextAttempt, errorMessage]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Release jobs stuck in 'running' with locked_at older than `olderThanMs`.
 * Used for crash recovery (e.g. by lock-recovery cron).
 */
export async function releaseStaleLocks(olderThanMs: number): Promise<number> {
  const res = await pool.query(
    `UPDATE durable_jobs
     SET status = 'pending', locked_at = NULL, locked_by = NULL, updated_at = NOW()
     WHERE status = 'running' AND locked_at < NOW() - ($1 * interval '1 millisecond')`,
    [olderThanMs]
  );
  return res.rowCount ?? 0;
}

/**
 * Get dead jobs (Section 6: dead-letter handling). Used for alerts and manual retry UI.
 */
export async function getDeadJobs(limit: number = 100): Promise<DurableJobRow[]> {
  const res = await pool.query<DurableJobRow>(
    `SELECT id, job_type, idempotency_key, status, attempt_count, max_attempts,
            run_at, locked_at, locked_by, payload_json, result_json, error_message,
            created_at, updated_at
     FROM durable_jobs
     WHERE status = 'dead'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows ?? [];
}

/**
 * Retry a dead job by resetting to pending. Safe for manual retry from admin.
 */
export async function retryDeadJob(jobId: string): Promise<boolean> {
  const res = await pool.query(
    `UPDATE durable_jobs
     SET status = 'pending', attempt_count = 0, error_message = NULL,
         run_at = NOW(), locked_at = NULL, locked_by = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'dead'
     RETURNING id`,
    [jobId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Count dead jobs for alerting.
 */
export async function countDeadJobs(): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM durable_jobs WHERE status = 'dead'`
  );
  return parseInt(res.rows[0]?.count ?? "0", 10);
}
