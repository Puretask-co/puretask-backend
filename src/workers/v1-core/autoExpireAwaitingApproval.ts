// src/workers/autoExpireAwaitingApproval.ts
// Worker to auto-approve jobs that have been in awaiting_approval status too long
// This prevents jobs from being stuck indefinitely if client doesn't respond
//
// Run on a schedule (e.g., hourly):
// node dist/workers/autoExpireAwaitingApproval.js

import { pool, query } from "../../db/client";
import { logger } from "../../lib/logger";
import { publishEvent } from "../../lib/events";
import { releaseJobCreditsToCleaner } from "../../services/creditsService";
import { recordEarningsForCompletedJob } from "../../services/payoutsService";
import { Job } from "../../types/db";

// Configuration
const AUTO_APPROVE_HOURS = parseInt(process.env.AUTO_APPROVE_HOURS || "24", 10);
const BATCH_SIZE = 50;

interface ExpirableJob {
  id: string;
  client_id: string;
  cleaner_id: string | null;
  status: string;
  credit_amount: number;
  actual_end_at: string;
}

/**
 * Find jobs that should be auto-approved
 * - Status is 'awaiting_approval'
 * - actual_end_at is past by AUTO_APPROVE_HOURS
 */
async function findJobsToAutoApprove(): Promise<ExpirableJob[]> {
  const result = await query<ExpirableJob>(
    `
      SELECT id, client_id, cleaner_id, status, credit_amount, actual_end_at
      FROM jobs
      WHERE status = 'awaiting_approval'
        AND actual_end_at < NOW() - INTERVAL '${AUTO_APPROVE_HOURS} hours'
      ORDER BY actual_end_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Auto-approve a single job
 * - Marks job as completed
 * - Releases credits to cleaner
 * - Creates payout record
 */
async function autoApproveJob(job: ExpirableJob): Promise<void> {
  try {
    // Update job status to completed with default rating
    await query(
      `
        UPDATE jobs
        SET status = 'completed',
            rating = 5,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'awaiting_approval'
      `,
      [job.id]
    );

    // Release credits to cleaner
    if (job.cleaner_id && job.credit_amount > 0) {
      await releaseJobCreditsToCleaner(job.cleaner_id, job.id, job.credit_amount);
      
      // Create payout record
      const jobForPayout = {
        id: job.id,
        cleaner_id: job.cleaner_id,
        credit_amount: job.credit_amount,
      } as Job;
      await recordEarningsForCompletedJob(jobForPayout);
    }

    // Publish auto-approve event
    await publishEvent({
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

    logger.info("job_auto_approved", {
      jobId: job.id,
      clientId: job.client_id,
      cleanerId: job.cleaner_id,
      creditAmount: job.credit_amount,
      actualEndAt: job.actual_end_at,
    });
  } catch (error) {
    logger.error("auto_approve_job_failed", {
      jobId: job.id,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Main worker function
 */
export async function runAutoExpireWorker(): Promise<{ approved: number; failed: number }> {
  logger.info("auto_expire_worker_started", {
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
    } catch {
      failed++;
    }
  }

  logger.info("auto_expire_worker_completed", {
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
      pool.end();
      process.exit(0);
    })
    .catch((error) => {
      console.error("Auto-expire worker failed:", error);
      pool.end();
      process.exit(1);
    });
}

