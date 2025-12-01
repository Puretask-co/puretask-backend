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
  status: "pending" | "processing" | "completed" | "failed";
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface EnqueueOptions {
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
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
   * Enqueue a job
   */
  async enqueue<T>(
    queueName: QueueName,
    payload: T,
    options: EnqueueOptions = {}
  ): Promise<number> {
    const { priority = 0, scheduledAt, maxAttempts = 3 } = options;

    const result = await query<{ id: number }>(
      `
        INSERT INTO job_queue (queue_name, payload, priority, scheduled_at, max_attempts)
        VALUES ($1, $2::jsonb, $3, $4, $5)
        RETURNING id
      `,
      [
        queueName,
        JSON.stringify(payload),
        priority,
        scheduledAt?.toISOString() ?? new Date().toISOString(),
        maxAttempts,
      ]
    );

    const jobId = result.rows[0].id;
    logger.debug("job_enqueued", { queueName, jobId, priority });
    return jobId;
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

    // Fetch and lock pending jobs
    const jobs = await query<QueueJob>(
      `
        UPDATE job_queue
        SET status = 'processing', started_at = NOW(), attempts = attempts + 1
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
      [queueName, batchSize]
    );

    let succeeded = 0;
    let failed = 0;

    for (const job of jobs.rows) {
      try {
        await handler(job.payload);
        
        await query(
          `UPDATE job_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [job.id]
        );
        succeeded++;
        
        logger.debug("job_completed", { queueName, jobId: job.id });
      } catch (err) {
        const shouldRetry = job.attempts < job.max_attempts;
        
        await query(
          `
            UPDATE job_queue 
            SET status = $2, 
                error_message = $3,
                scheduled_at = CASE WHEN $4 THEN NOW() + INTERVAL '5 minutes' * $5 ELSE scheduled_at END
            WHERE id = $1
          `,
          [
            job.id,
            shouldRetry ? "pending" : "failed",
            (err as Error).message,
            shouldRetry,
            job.attempts, // Exponential backoff
          ]
        );
        failed++;
        
        logger.error("job_failed", {
          queueName,
          jobId: job.id,
          error: (err as Error).message,
          willRetry: shouldRetry,
        });
      }
    }

    return { processed: jobs.rows.length, succeeded, failed };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName?: QueueName): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const whereClause = queueName ? "WHERE queue_name = $1" : "";
    const params = queueName ? [queueName] : [];

    const result = await query<{
      pending: string;
      processing: string;
      completed: string;
      failed: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
          COUNT(*) FILTER (WHERE status = 'processing')::text as processing,
          COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours')::text as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::text as failed
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

