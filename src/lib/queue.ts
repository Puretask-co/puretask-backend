// src/lib/queue.ts
// Simple database-backed job queue abstraction

import { query } from "../db/client";
import { logger } from "./logger";

// ============================================
// Types
// ============================================

export interface QueueJob<T = unknown> {
  id: number;
  queue_name: string;
  payload: T;
  status: "pending" | "processing" | "completed" | "failed" | "dead";
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  locked_by: string | null;
  locked_at: string | null;
  dead_letter_reason: string | null;
  dead_letter_at: string | null;
  created_at: string;
}

export interface EnqueueOptions {
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string; // Prevents duplicate job enqueueing
}

export type JobHandler<T> = (payload: T) => Promise<void>;

// ============================================
// Queue Names (type-safe)
// ============================================

export const QUEUE_NAMES = {
  CALENDAR_SYNC: "calendar_sync",
  AI_CHECKLIST: "ai_checklist",
  AI_DISPUTE: "ai_dispute",
  WEEKLY_REPORT: "weekly_report",
  SUBSCRIPTION_JOB: "subscription_job",
  NOTIFICATION: "notification",
  WEBHOOK_RETRY: "webhook_retry",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================
// Queue Service
// ============================================

class QueueService {
  private handlers: Map<string, JobHandler<any>> = new Map();

  /**
   * Register a handler for a queue
   */
  registerHandler<T>(queueName: QueueName, handler: JobHandler<T>): void {
    this.handlers.set(queueName, handler);
    logger.info("queue_handler_registered", { queueName });
  }

  /**
   * Enqueue a job with optional idempotency key
   */
  async enqueue<T>(
    queueName: QueueName,
    payload: T,
    options: EnqueueOptions = {}
  ): Promise<number | null> {
    const { priority = 0, scheduledAt, maxAttempts = 3, idempotencyKey } = options;

    // If idempotency key provided, check for existing job
    if (idempotencyKey) {
      const existing = await query<{ id: number }>(
        `
          SELECT id FROM job_queue
          WHERE queue_name = $1 AND idempotency_key = $2
          LIMIT 1
        `,
        [queueName, idempotencyKey]
      );

      if (existing.rows.length > 0) {
        logger.debug("job_already_enqueued", {
          queueName,
          jobId: existing.rows[0].id,
          idempotencyKey,
        });
        return existing.rows[0].id; // Return existing job ID
      }
    }

    try {
      const result = await query<{ id: number }>(
        `
          INSERT INTO job_queue (queue_name, payload, priority, scheduled_at, max_attempts, idempotency_key)
          VALUES ($1, $2::jsonb, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          queueName,
          JSON.stringify(payload),
          priority,
          scheduledAt?.toISOString() ?? new Date().toISOString(),
          maxAttempts,
          idempotencyKey || null,
        ]
      );

      const jobId = result.rows[0].id;
      logger.debug("job_enqueued", { queueName, jobId, priority, idempotencyKey });
      return jobId;
    } catch (error: any) {
      // Handle unique constraint violation (idempotency key conflict)
      if (error.code === "23505" && idempotencyKey) {
        // Race condition: another process enqueued with same key
        const existing = await query<{ id: number }>(
          `
            SELECT id FROM job_queue
            WHERE queue_name = $1 AND idempotency_key = $2
            LIMIT 1
          `,
          [queueName, idempotencyKey]
        );
        if (existing.rows.length > 0) {
          logger.debug("job_already_enqueued_race", {
            queueName,
            jobId: existing.rows[0].id,
            idempotencyKey,
          });
          return existing.rows[0].id;
        }
      }
      throw error;
    }
  }

  /**
   * Enqueue multiple jobs in a batch
   */
  async enqueueBatch<T>(
    queueName: QueueName,
    payloads: T[],
    options: EnqueueOptions = {}
  ): Promise<number[]> {
    const jobIds: number[] = [];
    for (const payload of payloads) {
      const id = await this.enqueue(queueName, payload, options);
      jobIds.push(id);
    }
    return jobIds;
  }

  /**
   * Process pending jobs for a queue
   */
  async processQueue(
    queueName: QueueName,
    batchSize: number = 10
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const handler = this.handlers.get(queueName);
    if (!handler) {
      logger.warn("no_handler_for_queue", { queueName });
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Fetch and lock pending jobs (with lock tracking)
    const workerId = `worker-${process.pid}-${Date.now()}`;
    const jobs = await query<QueueJob>(
      `
        UPDATE job_queue
        SET 
          status = 'processing',
          started_at = NOW(),
          attempts = attempts + 1,
          locked_by = $3,
          locked_at = NOW()
        WHERE id IN (
          SELECT id FROM job_queue
          WHERE queue_name = $1
            AND status = 'pending'
            AND scheduled_at <= NOW()
            AND attempts < max_attempts
          ORDER BY priority DESC, scheduled_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
      [queueName, batchSize, workerId]
    );

    let succeeded = 0;
    let failed = 0;

    for (const job of jobs.rows) {
      try {
        await handler(job.payload);
        
        await query(
          `
            UPDATE job_queue 
            SET 
              status = 'completed',
              completed_at = NOW(),
              locked_by = NULL,
              locked_at = NULL
            WHERE id = $1
          `,
          [job.id]
        );
        succeeded++;
        
        logger.debug("job_completed", { queueName, jobId: job.id });
      } catch (err) {
        const shouldRetry = job.attempts < job.max_attempts;
        const isDeadLetter = !shouldRetry;
        
        await query(
          `
            UPDATE job_queue 
            SET 
              status = $2,
              error_message = $3,
              scheduled_at = CASE WHEN $4 THEN NOW() + INTERVAL '5 minutes' * $5 ELSE scheduled_at END,
              locked_by = NULL,
              locked_at = NULL,
              dead_letter_reason = CASE WHEN $6 THEN 'Max attempts exceeded' ELSE NULL END,
              dead_letter_at = CASE WHEN $6 THEN NOW() ELSE NULL END
            WHERE id = $1
          `,
          [
            job.id,
            isDeadLetter ? "dead" : shouldRetry ? "pending" : "failed",
            (err as Error).message,
            shouldRetry,
            job.attempts, // Exponential backoff
            isDeadLetter,
          ]
        );
        failed++;
        
        logger.error("job_failed", {
          queueName,
          jobId: job.id,
          error: (err as Error).message,
          willRetry: shouldRetry,
          isDeadLetter,
        });
      }
    }

    return { processed: jobs.rows.length, succeeded, failed };
  }

  /**
   * Recover expired locks (jobs stuck in processing due to crashed workers)
   */
  async recoverExpiredLocks(
    lockTimeoutMinutes: number = 30
  ): Promise<number> {
    const result = await query<{ count: string }>(
      `
        SELECT recover_expired_job_locks($1)::text as count
      `,
      [lockTimeoutMinutes]
    );

    const recovered = Number(result.rows[0]?.count || 0);
    if (recovered > 0) {
      logger.warn("expired_locks_recovered", {
        count: recovered,
        lockTimeoutMinutes,
      });
    }
    return recovered;
  }

  /**
   * Get dead-letter queue jobs
   */
  async getDeadLetterJobs(queueName?: QueueName): Promise<QueueJob[]> {
    const whereClause = queueName
      ? "WHERE queue_name = $1 AND status = 'dead'"
      : "WHERE status = 'dead'";
    const params = queueName ? [queueName] : [];

    const result = await query<QueueJob>(
      `
        SELECT * FROM job_queue
        ${whereClause}
        ORDER BY dead_letter_at DESC
        LIMIT 100
      `,
      params
    );

    return result.rows;
  }

  /**
   * Retry a dead-letter job (admin action)
   */
  async retryDeadLetterJob(jobId: number): Promise<boolean> {
    const result = await query<{ id: number }>(
      `
        UPDATE job_queue
        SET 
          status = 'pending',
          attempts = 0,
          error_message = NULL,
          dead_letter_reason = NULL,
          dead_letter_at = NULL,
          scheduled_at = NOW()
        WHERE id = $1 AND status = 'dead'
        RETURNING id
      `,
      [jobId]
    );

    if (result.rows.length > 0) {
      logger.info("dead_letter_job_retried", { jobId });
      return true;
    }
    return false;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName?: QueueName): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
  }> {
    const whereClause = queueName ? "WHERE queue_name = $1" : "";
    const params = queueName ? [queueName] : [];

    const result = await query<{
      pending: string;
      processing: string;
      completed: string;
      failed: string;
      dead: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
          COUNT(*) FILTER (WHERE status = 'processing')::text as processing,
          COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours')::text as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::text as failed,
          COUNT(*) FILTER (WHERE status = 'dead')::text as dead
        FROM job_queue
        ${whereClause}
      `,
      params
    );

    const row = result.rows[0];
    return {
      pending: Number(row?.pending || 0),
      processing: Number(row?.processing || 0),
      completed: Number(row?.completed || 0),
      failed: Number(row?.failed || 0),
      dead: Number(row?.dead || 0),
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName: QueueName): Promise<number> {
    const result = await query<{ count: string }>(
      `
        WITH retried AS (
          UPDATE job_queue
          SET status = 'pending', attempts = 0, error_message = NULL
          WHERE queue_name = $1 AND status = 'failed'
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM retried
      `,
      [queueName]
    );

    return Number(result.rows[0]?.count || 0);
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const result = await query<{ count: string }>(
      `
        WITH deleted AS (
          DELETE FROM job_queue
          WHERE status IN ('completed', 'failed')
            AND created_at < NOW() - INTERVAL '1 day' * $1
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM deleted
      `,
      [daysOld]
    );

    return Number(result.rows[0]?.count || 0);
  }
}

// Export singleton instance
export const queueService = new QueueService();

// ============================================
// Convenience Functions
// ============================================

export async function enqueue<T>(
  queueName: QueueName,
  payload: T,
  options?: EnqueueOptions
): Promise<number> {
  return queueService.enqueue(queueName, payload, options);
}

export async function processQueue(
  queueName: QueueName,
  batchSize?: number
): Promise<{ processed: number; succeeded: number; failed: number }> {
  return queueService.processQueue(queueName, batchSize);
}

