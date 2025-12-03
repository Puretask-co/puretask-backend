// src/services/disputesService.ts
// Disputes service matching 001_init.sql schema
// Per Damage & Claims Policy: Disputes must be filed within 48 hours

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { env } from "../config/env";
import { Dispute, DisputeStatus, Job } from "../types/db";

/**
 * Create a dispute for a job
 * Per Damage & Claims Policy: Disputes must be filed within 48 hours of job completion
 */
export async function createDispute(options: {
  jobId: string;
  clientId: string;
  clientNotes: string;
}): Promise<Dispute> {
  const { jobId, clientId, clientNotes } = options;

  // Verify job exists and is in awaiting_approval status
  const jobResult = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1`,
    [jobId]
  );

  if (jobResult.rows.length === 0) {
    throw new Error("Job not found");
  }

  const job = jobResult.rows[0];

  if (job.client_id !== clientId) {
    throw new Error("Not authorized to dispute this job");
  }

  if (job.status !== "awaiting_approval") {
    throw new Error("Job is not in a state that can be disputed");
  }

  // Per policy: Check 48-hour dispute window
  const disputeWindowHours = env.DISPUTE_WINDOW_HOURS;
  let withinWindow = true;
  
  if (job.actual_end_at) {
    const completedAt = new Date(job.actual_end_at);
    const now = new Date();
    const hoursSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCompletion > disputeWindowHours) {
      withinWindow = false;
      throw Object.assign(
        new Error(`Dispute window has expired. Disputes must be filed within ${disputeWindowHours} hours of job completion. This job was completed ${Math.round(hoursSinceCompletion)} hours ago.`),
        { statusCode: 400, code: "DISPUTE_WINDOW_EXPIRED" }
      );
    }
  }

  // Create dispute with window tracking
  const result = await query<Dispute>(
    `
      INSERT INTO disputes (
        job_id,
        client_id,
        client_notes,
        status,
        job_completed_at,
        within_window
      )
      VALUES ($1, $2, $3, 'open', $4, $5)
      RETURNING *
    `,
    [jobId, clientId, clientNotes, job.actual_end_at, withinWindow]
  );

  const dispute = result.rows[0];

  // Update job status to disputed
  await query(
    `UPDATE jobs SET status = 'disputed', updated_at = NOW() WHERE id = $1`,
    [jobId]
  );

  // Publish event
  await publishEvent({
    jobId,
    actorType: "client",
    actorId: clientId,
    eventName: "client_disputed",
    payload: {
      disputeId: dispute.id,
      clientNotes,
      withinWindow,
    },
  });

  logger.info("dispute_created", {
    disputeId: dispute.id,
    jobId,
    clientId,
    withinWindow,
  });

  return dispute;
}

/**
 * Get dispute by job ID
 */
export async function getDisputeByJobId(jobId: string): Promise<Dispute | null> {
  const result = await query<Dispute>(
    `SELECT * FROM disputes WHERE job_id = $1`,
    [jobId]
  );

  return result.rows[0] ?? null;
}

/**
 * Get disputes for a client
 */
export async function getDisputesForClient(
  clientId: string,
  limit: number = 50
): Promise<Dispute[]> {
  const result = await query<Dispute>(
    `
      SELECT d.*, j.address, j.credit_amount, j.scheduled_start_at
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      WHERE d.client_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2
    `,
    [clientId, limit]
  );

  return result.rows;
}

/**
 * Get open disputes count (for admin dashboard)
 */
export async function getOpenDisputesCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`
  );

  return parseInt(result.rows[0]?.count || "0", 10);
}

/**
 * Update dispute notes
 */
export async function updateDisputeNotes(
  disputeId: string,
  clientNotes: string,
  clientId: string
): Promise<Dispute> {
  const result = await query<Dispute>(
    `
      UPDATE disputes
      SET client_notes = $2,
          updated_at = NOW()
      WHERE id = $1 AND client_id = $3 AND status = 'open'
      RETURNING *
    `,
    [disputeId, clientNotes, clientId]
  );

  if (result.rows.length === 0) {
    throw new Error("Dispute not found or cannot be updated");
  }

  return result.rows[0];
}

/**
 * Get dispute by ID
 */
export async function getDisputeById(disputeId: string): Promise<Dispute | null> {
  const result = await query<Dispute>(
    `SELECT * FROM disputes WHERE id = $1`,
    [disputeId]
  );
  return result.rows[0] ?? null;
}

/**
 * Get all open disputes (for admin)
 */
export async function getOpenDisputes(): Promise<(Dispute & { job: Job })[]> {
  const result = await query<Dispute & { job: Job }>(
    `
      SELECT d.*, 
             row_to_json(j.*) as job
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      WHERE d.status = 'open'
      ORDER BY d.created_at ASC
    `
  );
  return result.rows;
}

/**
 * Resolve dispute with refund
 * - Marks dispute as resolved_refund
 * - Refunds credits to client
 * - Updates job status to cancelled
 */
export async function resolveDisputeWithRefund(
  disputeId: string,
  adminNotes: string
): Promise<Dispute> {
  // Import here to avoid circular dependency
  const { refundJobCreditsToClient } = await import("./creditsService");

  // Get dispute
  const dispute = await getDisputeById(disputeId);
  if (!dispute) {
    throw Object.assign(new Error("Dispute not found"), { statusCode: 404 });
  }

  if (dispute.status !== "open") {
    throw Object.assign(new Error("Dispute is already resolved"), { statusCode: 400 });
  }

  // Get job
  const jobResult = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1`,
    [dispute.job_id]
  );
  const job = jobResult.rows[0];

  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  // Refund credits to client
  await refundJobCreditsToClient(dispute.client_id, job.id, job.credit_amount);

  // Update dispute status
  const result = await query<Dispute>(
    `
      UPDATE disputes
      SET status = 'resolved_refund',
          admin_notes = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [disputeId, adminNotes]
  );

  // Update job status to cancelled
  await query(
    `UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [job.id]
  );

  // Publish event
  await publishEvent({
    jobId: job.id,
    actorType: "admin",
    actorId: null,
    eventName: "dispute_resolved_refund",
    payload: {
      disputeId,
      adminNotes,
      refundAmount: job.credit_amount,
    },
  });

  logger.info("dispute_resolved_with_refund", {
    disputeId,
    jobId: job.id,
    clientId: dispute.client_id,
    refundAmount: job.credit_amount,
  });

  // Update cleaner reliability (dispute affects their score)
  if (job.cleaner_id) {
    try {
      const { updateCleanerReliability } = await import("./reliabilityService");
      await updateCleanerReliability(job.cleaner_id);
    } catch (err) {
      logger.error("reliability_update_on_dispute_failed", {
        cleanerId: job.cleaner_id,
        error: (err as Error).message,
      });
    }
  }

  return result.rows[0];
}

/**
 * Resolve dispute without refund
 * - Marks dispute as resolved_no_refund
 * - Cleaner gets paid (if not already)
 * - Updates job status to completed
 */
export async function resolveDisputeWithoutRefund(
  disputeId: string,
  adminNotes: string
): Promise<Dispute> {
  // Import here to avoid circular dependency
  const { releaseJobCreditsToCleaner } = await import("./creditsService");
  const { recordEarningsForCompletedJob } = await import("./payoutsService");

  // Get dispute
  const dispute = await getDisputeById(disputeId);
  if (!dispute) {
    throw Object.assign(new Error("Dispute not found"), { statusCode: 404 });
  }

  if (dispute.status !== "open") {
    throw Object.assign(new Error("Dispute is already resolved"), { statusCode: 400 });
  }

  // Get job
  const jobResult = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1`,
    [dispute.job_id]
  );
  const job = jobResult.rows[0];

  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  // Release credits to cleaner (if cleaner assigned)
  if (job.cleaner_id) {
    await releaseJobCreditsToCleaner(job.cleaner_id, job.id, job.credit_amount);
    await recordEarningsForCompletedJob(job);
  }

  // Update dispute status
  const result = await query<Dispute>(
    `
      UPDATE disputes
      SET status = 'resolved_no_refund',
          admin_notes = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [disputeId, adminNotes]
  );

  // Update job status to completed
  await query(
    `UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`,
    [job.id]
  );

  // Publish event
  await publishEvent({
    jobId: job.id,
    actorType: "admin",
    actorId: null,
    eventName: "dispute_resolved_no_refund",
    payload: {
      disputeId,
      adminNotes,
    },
  });

  logger.info("dispute_resolved_without_refund", {
    disputeId,
    jobId: job.id,
    cleanerId: job.cleaner_id,
  });

  // Update cleaner reliability (even no-refund resolution affects metrics)
  if (job.cleaner_id) {
    try {
      const { updateCleanerReliability } = await import("./reliabilityService");
      await updateCleanerReliability(job.cleaner_id);
    } catch (err) {
      logger.error("reliability_update_on_dispute_failed", {
        cleanerId: job.cleaner_id,
        error: (err as Error).message,
      });
    }
  }

  return result.rows[0];
}

/**
 * Generic resolve dispute function
 */
export async function resolveDispute(
  disputeId: string,
  resolution: "resolved_refund" | "resolved_no_refund",
  adminNotes: string
): Promise<Dispute> {
  if (resolution === "resolved_refund") {
    return resolveDisputeWithRefund(disputeId, adminNotes);
  } else {
    return resolveDisputeWithoutRefund(disputeId, adminNotes);
  }
}

