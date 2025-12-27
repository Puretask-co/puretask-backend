// src/workers/autoCancelJobs.ts
// Worker to auto-cancel jobs that are past their scheduled start time
// Matches 001_init.sql schema

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { releaseEscrowedCredits } from "../services/creditsService";

// Configuration
const AUTO_CANCEL_DELAY_MINUTES = parseInt(process.env.AUTO_CANCEL_DELAY_MINUTES || "30", 10);
const BATCH_SIZE = 100;

interface CancellableJob {
  id: string;
  client_id: string;
  status: string;
  scheduled_start_at: string;
  credit_amount: number;
}

/**
 * Find jobs that should be auto-cancelled
 * - Status is 'requested' (not yet accepted)
 * - scheduled_start_at is past by AUTO_CANCEL_DELAY_MINUTES
 */
async function findJobsToCancel(): Promise<CancellableJob[]> {
  const result = await query<CancellableJob>(
    `
      SELECT id, client_id, status, scheduled_start_at, credit_amount
      FROM jobs
      WHERE status = 'requested'
        AND scheduled_start_at < NOW() - INTERVAL '${AUTO_CANCEL_DELAY_MINUTES} minutes'
      ORDER BY scheduled_start_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Cancel a single job
 */
async function cancelJob(job: CancellableJob): Promise<void> {
  try {
    // Update job status to cancelled
    await query(
      `
        UPDATE jobs
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
          AND status = 'requested'
      `,
      [job.id]
    );

    // Release escrowed credits
    if (job.credit_amount > 0) {
      await releaseEscrowedCredits({
        userId: job.client_id,
        jobId: job.id,
        creditAmount: job.credit_amount,
      });
    }

    // Publish auto-cancel event
    await publishEvent({
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

    logger.info("job_auto_cancelled", {
      jobId: job.id,
      clientId: job.client_id,
      scheduledStartAt: job.scheduled_start_at,
      creditsReleased: job.credit_amount,
    });
  } catch (error) {
    logger.error("auto_cancel_job_failed", {
      jobId: job.id,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Main worker function
 */
export async function runAutoCancelWorker(): Promise<{ cancelled: number; failed: number }> {
  logger.info("auto_cancel_worker_started", {
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
    } catch {
      failed++;
    }
  }

  logger.info("auto_cancel_worker_completed", {
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
