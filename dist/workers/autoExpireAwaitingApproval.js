"use strict";
// src/workers/autoExpireAwaitingApproval.ts
// Worker to auto-approve jobs that have been in awaiting_approval status too long
// This prevents jobs from being stuck indefinitely if client doesn't respond
//
// Run on a schedule (e.g., hourly):
// node dist/workers/autoExpireAwaitingApproval.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutoExpireWorker = runAutoExpireWorker;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const creditsService_1 = require("../services/creditsService");
const payoutsService_1 = require("../services/payoutsService");
// Configuration
const AUTO_APPROVE_HOURS = parseInt(process.env.AUTO_APPROVE_HOURS || "24", 10);
const BATCH_SIZE = 50;
/**
 * Find jobs that should be auto-approved
 * - Status is 'awaiting_approval'
 * - actual_end_at is past by AUTO_APPROVE_HOURS
 */
async function findJobsToAutoApprove() {
    const result = await (0, client_1.query)(`
      SELECT id, client_id, cleaner_id, status, credit_amount, actual_end_at
      FROM jobs
      WHERE status = 'awaiting_approval'
        AND actual_end_at < NOW() - INTERVAL '${AUTO_APPROVE_HOURS} hours'
      ORDER BY actual_end_at ASC
      LIMIT $1
    `, [BATCH_SIZE]);
    return result.rows;
}
/**
 * Auto-approve a single job
 * - Marks job as completed
 * - Releases credits to cleaner
 * - Creates payout record
 */
async function autoApproveJob(job) {
    try {
        // Update job status to completed with default rating
        await (0, client_1.query)(`
        UPDATE jobs
        SET status = 'completed',
            rating = 5,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'awaiting_approval'
      `, [job.id]);
        // Release credits to cleaner
        if (job.cleaner_id && job.credit_amount > 0) {
            await (0, creditsService_1.releaseJobCreditsToCleaner)(job.cleaner_id, job.id, job.credit_amount);
            // Create payout record
            const jobForPayout = {
                id: job.id,
                cleaner_id: job.cleaner_id,
                credit_amount: job.credit_amount,
            };
            await (0, payoutsService_1.recordEarningsForCompletedJob)(jobForPayout);
        }
        // Publish auto-approve event
        await (0, events_1.publishEvent)({
            jobId: job.id,
            actorType: "system",
            actorId: undefined,
            eventName: "job_auto_approved",
            payload: {
                reason: "client_no_response",
                actualEndAt: job.actual_end_at,
                hoursWaited: AUTO_APPROVE_HOURS,
                defaultRating: 5,
            },
        });
        logger_1.logger.info("job_auto_approved", {
            jobId: job.id,
            clientId: job.client_id,
            cleanerId: job.cleaner_id,
            creditAmount: job.credit_amount,
            actualEndAt: job.actual_end_at,
        });
    }
    catch (error) {
        logger_1.logger.error("auto_approve_job_failed", {
            jobId: job.id,
            error: error.message,
        });
        throw error;
    }
}
/**
 * Main worker function
 */
async function runAutoExpireWorker() {
    logger_1.logger.info("auto_expire_worker_started", {
        autoApproveHours: AUTO_APPROVE_HOURS,
        batchSize: BATCH_SIZE,
    });
    const jobs = await findJobsToAutoApprove();
    let approved = 0;
    let failed = 0;
    for (const job of jobs) {
        try {
            await autoApproveJob(job);
            approved++;
        }
        catch {
            failed++;
        }
    }
    logger_1.logger.info("auto_expire_worker_completed", {
        found: jobs.length,
        approved,
        failed,
    });
    return { approved, failed };
}
// Run if executed directly
if (require.main === module) {
    runAutoExpireWorker()
        .then((result) => {
        console.log("Auto-expire worker completed:", result);
        client_1.pool.end();
        process.exit(0);
    })
        .catch((error) => {
        console.error("Auto-expire worker failed:", error);
        client_1.pool.end();
        process.exit(1);
    });
}
