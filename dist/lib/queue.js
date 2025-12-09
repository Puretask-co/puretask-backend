"use strict";
// src/lib/queue.ts
// Simple database-backed job queue abstraction
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QUEUE_NAMES = void 0;
exports.enqueue = enqueue;
exports.processQueue = processQueue;
const client_1 = require("../db/client");
const logger_1 = require("./logger");
// ============================================
// Queue Names (type-safe)
// ============================================
exports.QUEUE_NAMES = {
    CALENDAR_SYNC: "calendar_sync",
    AI_CHECKLIST: "ai_checklist",
    AI_DISPUTE: "ai_dispute",
    WEEKLY_REPORT: "weekly_report",
    SUBSCRIPTION_JOB: "subscription_job",
    NOTIFICATION: "notification",
    WEBHOOK_RETRY: "webhook_retry",
};
// ============================================
// Queue Service
// ============================================
class QueueService {
    constructor() {
        this.handlers = new Map();
    }
    /**
     * Register a handler for a queue
     */
    registerHandler(queueName, handler) {
        this.handlers.set(queueName, handler);
        logger_1.logger.info("queue_handler_registered", { queueName });
    }
    /**
     * Enqueue a job
     */
    async enqueue(queueName, payload, options = {}) {
        const { priority = 0, scheduledAt, maxAttempts = 3 } = options;
        const result = await (0, client_1.query)(`
        INSERT INTO job_queue (queue_name, payload, priority, scheduled_at, max_attempts)
        VALUES ($1, $2::jsonb, $3, $4, $5)
        RETURNING id
      `, [
            queueName,
            JSON.stringify(payload),
            priority,
            scheduledAt?.toISOString() ?? new Date().toISOString(),
            maxAttempts,
        ]);
        const jobId = result.rows[0].id;
        logger_1.logger.debug("job_enqueued", { queueName, jobId, priority });
        return jobId;
    }
    /**
     * Enqueue multiple jobs in a batch
     */
    async enqueueBatch(queueName, payloads, options = {}) {
        const jobIds = [];
        for (const payload of payloads) {
            const id = await this.enqueue(queueName, payload, options);
            jobIds.push(id);
        }
        return jobIds;
    }
    /**
     * Process pending jobs for a queue
     */
    async processQueue(queueName, batchSize = 10) {
        const handler = this.handlers.get(queueName);
        if (!handler) {
            logger_1.logger.warn("no_handler_for_queue", { queueName });
            return { processed: 0, succeeded: 0, failed: 0 };
        }
        // Fetch and lock pending jobs
        const jobs = await (0, client_1.query)(`
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
      `, [queueName, batchSize]);
        let succeeded = 0;
        let failed = 0;
        for (const job of jobs.rows) {
            try {
                await handler(job.payload);
                await (0, client_1.query)(`UPDATE job_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`, [job.id]);
                succeeded++;
                logger_1.logger.debug("job_completed", { queueName, jobId: job.id });
            }
            catch (err) {
                const shouldRetry = job.attempts < job.max_attempts;
                await (0, client_1.query)(`
            UPDATE job_queue 
            SET status = $2, 
                error_message = $3,
                scheduled_at = CASE WHEN $4 THEN NOW() + INTERVAL '5 minutes' * $5 ELSE scheduled_at END
            WHERE id = $1
          `, [
                    job.id,
                    shouldRetry ? "pending" : "failed",
                    err.message,
                    shouldRetry,
                    job.attempts, // Exponential backoff
                ]);
                failed++;
                logger_1.logger.error("job_failed", {
                    queueName,
                    jobId: job.id,
                    error: err.message,
                    willRetry: shouldRetry,
                });
            }
        }
        return { processed: jobs.rows.length, succeeded, failed };
    }
    /**
     * Get queue statistics
     */
    async getQueueStats(queueName) {
        const whereClause = queueName ? "WHERE queue_name = $1" : "";
        const params = queueName ? [queueName] : [];
        const result = await (0, client_1.query)(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
          COUNT(*) FILTER (WHERE status = 'processing')::text as processing,
          COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours')::text as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::text as failed
        FROM job_queue
        ${whereClause}
      `, params);
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
    async retryFailedJobs(queueName) {
        const result = await (0, client_1.query)(`
        WITH retried AS (
          UPDATE job_queue
          SET status = 'pending', attempts = 0, error_message = NULL
          WHERE queue_name = $1 AND status = 'failed'
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM retried
      `, [queueName]);
        return Number(result.rows[0]?.count || 0);
    }
    /**
     * Clean up old completed jobs
     */
    async cleanupOldJobs(daysOld = 7) {
        const result = await (0, client_1.query)(`
        WITH deleted AS (
          DELETE FROM job_queue
          WHERE status IN ('completed', 'failed')
            AND created_at < NOW() - INTERVAL '1 day' * $1
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM deleted
      `, [daysOld]);
        return Number(result.rows[0]?.count || 0);
    }
}
// Export singleton instance
exports.queueService = new QueueService();
// ============================================
// Convenience Functions
// ============================================
async function enqueue(queueName, payload, options) {
    return exports.queueService.enqueue(queueName, payload, options);
}
async function processQueue(queueName, batchSize) {
    return exports.queueService.processQueue(queueName, batchSize);
}
