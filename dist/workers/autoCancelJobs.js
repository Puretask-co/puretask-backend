"use strict";
// src/workers/autoCancelJobs.ts
// Worker to auto-cancel jobs that are past their scheduled start time
// Matches 001_init.sql schema
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutoCancelWorker = runAutoCancelWorker;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const creditsService_1 = require("../services/creditsService");
// Configuration
const AUTO_CANCEL_DELAY_MINUTES = parseInt(process.env.AUTO_CANCEL_DELAY_MINUTES || "30", 10);
const BATCH_SIZE = 100;
/**
 * Find jobs that should be auto-cancelled
 * - Status is 'requested' (not yet accepted)
 * - scheduled_start_at is past by AUTO_CANCEL_DELAY_MINUTES
 */
async function findJobsToCancel() {
    const result = await (0, client_1.query)(`
      SELECT id, client_id, status, scheduled_start_at, credit_amount
      FROM jobs
      WHERE status = 'requested'
        AND scheduled_start_at < NOW() - INTERVAL '${AUTO_CANCEL_DELAY_MINUTES} minutes'
      ORDER BY scheduled_start_at ASC
      LIMIT $1
    `, [BATCH_SIZE]);
    return result.rows;
}
/**
 * Cancel a single job
 */
async function cancelJob(job) {
    try {
        // Update job status to cancelled
        await (0, client_1.query)(`
        UPDATE jobs
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
          AND status = 'requested'
      `, [job.id]);
        // Release escrowed credits
        if (job.credit_amount > 0) {
            await (0, creditsService_1.releaseEscrowedCredits)({
                userId: job.client_id,
                jobId: job.id,
                creditAmount: job.credit_amount,
            });
        }
        // Publish auto-cancel event
        await (0, events_1.publishEvent)({
            jobId: job.id,
            actorType: "system",
            actorId: undefined,
            eventName: "job_auto_cancelled",
            payload: {
                reason: "past_scheduled_start",
                scheduledStartAt: job.scheduled_start_at,
                delayMinutes: AUTO_CANCEL_DELAY_MINUTES,
            },
        });
        logger_1.logger.info("job_auto_cancelled", {
            jobId: job.id,
            clientId: job.client_id,
            scheduledStartAt: job.scheduled_start_at,
            creditsReleased: job.credit_amount,
        });
    }
    catch (error) {
        logger_1.logger.error("auto_cancel_job_failed", {
            jobId: job.id,
            error: error.message,
        });
        throw error;
    }
}
/**
 * Main worker function
 */
async function runAutoCancelWorker() {
    logger_1.logger.info("auto_cancel_worker_started", {
        delayMinutes: AUTO_CANCEL_DELAY_MINUTES,
        batchSize: BATCH_SIZE,
    });
    const jobs = await findJobsToCancel();
    let cancelled = 0;
    let failed = 0;
    for (const job of jobs) {
        try {
            await cancelJob(job);
            cancelled++;
        }
        catch {
            failed++;
        }
    }
    logger_1.logger.info("auto_cancel_worker_completed", {
        found: jobs.length,
        cancelled,
        failed,
    });
    return { cancelled, failed };
}
// Run if executed directly
if (require.main === module) {
    runAutoCancelWorker()
        .then((result) => {
        console.log("Auto-cancel worker completed:", result);
        process.exit(0);
    })
        .catch((error) => {
        console.error("Auto-cancel worker failed:", error);
        process.exit(1);
    });
}
