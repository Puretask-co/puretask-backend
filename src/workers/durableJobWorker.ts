// src/workers/durableJobWorker.ts
// Section 6: process jobs from durable_jobs with FOR UPDATE SKIP LOCKED.
// Run from scheduler or cron; handlers register by job_type.

import { logger } from "../lib/logger";
import {
  claim,
  complete,
  fail,
  releaseStaleLocks,
  getDeadJobs,
  countDeadJobs,
  type DurableJobRow,
} from "../services/durableJobService";
import { sendAlert, alertTemplates } from "../lib/alerting";

const WORKER_ID = `durable-${process.pid}-${Date.now()}`;
const DEAD_LETTER_ALERT_THRESHOLD = 5;
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const CLAIM_LIMIT = 5;

export type JobHandler = (payload: Record<string, unknown> | null) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a job type. Call from app startup or worker init.
 */
export function registerHandler(jobType: string, handler: JobHandler): void {
  handlers.set(jobType, handler);
}

/**
 * Default handler for unknown job types: log and complete so they don't dead-letter.
 */
function defaultHandler(payload: Record<string, unknown> | null): Promise<void> {
  logger.warn("durable_job_no_handler", { payload });
  return Promise.resolve();
}

/**
 * Run one worker cycle: release stale locks, claim jobs, run each handler, complete or fail.
 */
export async function runDurableJobWorkerCycle(): Promise<{ claimed: number; completed: number; failed: number }> {
  const released = await releaseStaleLocks(LOCK_TIMEOUT_MS);
  if (released > 0) {
    logger.info("durable_job_stale_locks_released", { count: released });
  }

  // Section 6: Dead-letter alert when threshold exceeded
  const deadCount = await countDeadJobs();
  if (deadCount >= DEAD_LETTER_ALERT_THRESHOLD) {
    const deadJobs = await getDeadJobs(10);
    await sendAlert(
      alertTemplates.deadLetterJobs(
        deadCount,
        deadJobs.map((j) => j.id),
        DEAD_LETTER_ALERT_THRESHOLD
      )
    );
  }

  const jobs = await claim(WORKER_ID, CLAIM_LIMIT);
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = handlers.get(job.job_type) ?? defaultHandler;
    const payload = job.payload_json ?? {};
    try {
      await handler(payload);
      await complete(job.id);
      completed++;
      logger.info("durable_job_completed", { jobId: job.id, job_type: job.job_type });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await fail(job.id, message, true);
      failed++;
      logger.warn("durable_job_failed", { jobId: job.id, job_type: job.job_type, error: message });
    }
  }

  return { claimed: jobs.length, completed, failed };
}

/**
 * Run worker in a loop with optional interval. For use as long-running process.
 */
export async function runDurableJobWorkerLoop(intervalMs: number = 10_000): Promise<void> {
  logger.info("durable_job_worker_started", { workerId: WORKER_ID, intervalMs });
  while (true) {
    try {
      await runDurableJobWorkerCycle();
    } catch (err) {
      logger.error("durable_job_worker_cycle_error", { error: err });
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
