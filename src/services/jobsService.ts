// src/services/jobsService.ts
// Jobs service matching 001_init.sql schema
// Integrates with credits service for escrow/release and payouts service

import { query } from "../db/client";
import { getNextStatus, JobEventType, validateTransition } from "../state/jobStateMachine";
import { publishEvent } from "../lib/events";
import { getJobEventsForJob } from "./jobEvents";
import {
  escrowCreditsWithTransaction,
  releaseJobCreditsToCleaner,
  refundJobCreditsToClient,
} from "./creditsService";
import { recordEarningsForCompletedJob } from "./payoutsService";
import { logger } from "../lib/logger";
import { Job, JobStatus, ActorType } from "../types/db";
import { AuthUser } from "../lib/auth";

export type { Job, JobStatus };

// ============================================
// Strong ACL Functions
// ============================================

/**
 * Get a job by ID (no ACL check - use for internal/admin operations)
 */
export async function getJobById(jobId: string): Promise<Job> {
  const result = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1`,
    [jobId]
  );
  const job = result.rows[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }
  return job;
}

/**
 * Get a job with ACL check based on user role
 * - Admin: can see all jobs
 * - Client: can only see their own jobs
 * - Cleaner: can only see jobs assigned to them
 */
export async function getJobForUser(jobId: string, user: AuthUser): Promise<Job> {
  const job = await getJobById(jobId);

  // Admin can access any job
  if (user.role === "admin") return job;

  // Client can only access their own jobs
  if (user.role === "client" && job.client_id === user.id) return job;

  // Cleaner can access jobs assigned to them, or available jobs (for accepting)
  if (user.role === "cleaner") {
    // If no cleaner assigned yet (available job), cleaner can view
    if (!job.cleaner_id && job.status === "requested") return job;
    // If assigned to this cleaner
    if (job.cleaner_id === user.id) return job;
  }

  throw Object.assign(new Error("Forbidden: You don't have access to this job"), {
    statusCode: 403,
    code: "FORBIDDEN",
  });
}

/**
 * Get a job ensuring the requester is the client
 */
export async function getJobForClientStrict(jobId: string, clientId: string): Promise<Job> {
  const job = await getJobById(jobId);
  if (job.client_id !== clientId) {
    throw Object.assign(new Error("Forbidden: Not your job"), {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }
  return job;
}

/**
 * Get a job ensuring the requester is the assigned cleaner
 */
export async function getJobForCleanerStrict(jobId: string, cleanerId: string): Promise<Job> {
  const job = await getJobById(jobId);
  if (job.cleaner_id !== cleanerId) {
    throw Object.assign(new Error("Forbidden: Not assigned to this job"), {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }
  return job;
}

// ============================================
// Job Creation
// ============================================

/**
 * Create a new job
 * - Creates job row with 'requested' status
 * - Escrows credits from client's balance
 */
export async function createJob(options: {
  clientId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  address: string;
  latitude?: number;
  longitude?: number;
  creditAmount: number;
  clientNotes?: string;
}): Promise<Job> {
  const {
    clientId,
    scheduledStartAt,
    scheduledEndAt,
    address,
    latitude = null,
    longitude = null,
    creditAmount,
    clientNotes = null,
  } = options;

  if (creditAmount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  // Insert job with 'requested' status
  const result = await query<Job>(
    `
      INSERT INTO jobs (
        client_id,
        status,
        scheduled_start_at,
        scheduled_end_at,
        address,
        latitude,
        longitude,
        credit_amount,
        client_notes
      )
      VALUES ($1, 'requested', $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      clientId,
      scheduledStartAt,
      scheduledEndAt,
      address,
      latitude,
      longitude,
      creditAmount,
      clientNotes,
    ]
  );

  const job = result.rows[0];

  // Log event
  await publishEvent({
    jobId: job.id,
    actorType: "client",
    actorId: clientId,
    eventName: "job_created",
    payload: {
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at: scheduledEndAt,
      address,
      credit_amount: creditAmount,
    },
  });

  // Escrow credits from client (with transaction safety)
  await escrowCreditsWithTransaction({
    clientId,
    jobId: job.id,
    creditAmount,
  });

  logger.info("job_created", {
    jobId: job.id,
    clientId,
    creditAmount,
  });

  return job;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const result = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1`,
    [jobId]
  );
  return result.rows[0] ?? null;
}

/**
 * List jobs for a client
 */
export async function listJobsForClient(clientId: string): Promise<Job[]> {
  const result = await query<Job>(
    `
      SELECT * FROM jobs
      WHERE client_id = $1
      ORDER BY created_at DESC
    `,
    [clientId]
  );
  return result.rows;
}

/**
 * List jobs for a cleaner
 */
export async function listJobsForCleaner(cleanerId: string): Promise<Job[]> {
  const result = await query<Job>(
    `
      SELECT * FROM jobs
      WHERE cleaner_id = $1
      ORDER BY scheduled_start_at DESC
    `,
    [cleanerId]
  );
  return result.rows;
}

/**
 * List available jobs (requested status, no cleaner assigned)
 */
export async function listAvailableJobs(): Promise<Job[]> {
  const result = await query<Job>(
    `
      SELECT * FROM jobs
      WHERE status = 'requested' AND cleaner_id IS NULL
      ORDER BY scheduled_start_at ASC
    `
  );
  return result.rows;
}

/**
 * Update a job (only allowed when in 'requested' status)
 */
export async function updateJob(options: {
  jobId: string;
  clientId: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clientNotes?: string;
}): Promise<Job | null> {
  const { jobId, clientId, scheduledStartAt, scheduledEndAt, address, latitude, longitude, clientNotes } = options;

  const result = await query<Job>(
    `
      UPDATE jobs
      SET
        scheduled_start_at = COALESCE($2, scheduled_start_at),
        scheduled_end_at = COALESCE($3, scheduled_end_at),
        address = COALESCE($4, address),
        latitude = COALESCE($5, latitude),
        longitude = COALESCE($6, longitude),
        client_notes = COALESCE($7, client_notes),
        updated_at = NOW()
      WHERE id = $1 AND client_id = $8 AND status = 'requested'
      RETURNING *
    `,
    [
      jobId,
      scheduledStartAt ?? null,
      scheduledEndAt ?? null,
      address ?? null,
      latitude ?? null,
      longitude ?? null,
      clientNotes ?? null,
      clientId,
    ]
  );

  return result.rows[0] ?? null;
}

/**
 * Delete a job (soft delete via cancellation)
 */
export async function deleteJob(jobId: string, clientId: string): Promise<Job | null> {
  const job = await getJob(jobId);
  if (!job || job.client_id !== clientId) {
    return null;
  }

  // Can only cancel jobs in certain statuses
  if (!["requested", "accepted"].includes(job.status)) {
    throw new Error(`Cannot cancel job in status: ${job.status}`);
  }

  return applyStatusTransition({
    jobId,
    eventType: "job_cancelled",
    payload: { reason: "client_deleted" },
    requesterId: clientId,
    role: "client",
  });
}

/**
 * Get events for a job
 */
export async function getEvents(jobId: string) {
  return getJobEventsForJob(jobId);
}

/**
 * Apply a status transition to a job
 * Handles all the side effects:
 * - Credit escrow/release/refund
 * - Payout creation
 * - Event publishing
 */
export async function applyStatusTransition(options: {
  jobId: string;
  eventType: JobEventType;
  payload?: Record<string, unknown>;
  requesterId: string;
  role: "client" | "cleaner" | "admin";
}): Promise<Job> {
  const { jobId, eventType, payload = {}, requesterId, role } = options;

  // Load current job
  const job = await getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Role-based access check
  if (role === "client" && job.client_id !== requesterId) {
    throw new Error("FORBIDDEN: Not your job");
  }
  if (role === "cleaner" && job.cleaner_id && job.cleaner_id !== requesterId) {
    throw new Error("FORBIDDEN: Not assigned to this job");
  }

  // Map role to actor type
  const actorType: ActorType = role === "admin" ? "admin" : role;

  // Validate transition with role check
  const validation = validateTransition({
    currentStatus: job.status,
    event: eventType,
    actorType,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const nextStatus = validation.nextStatus;

  // Build dynamic UPDATE query based on event type
  const updateFields: string[] = ["status = $2", "updated_at = NOW()"];
  const updateParams: unknown[] = [jobId, nextStatus];
  let paramIndex = 3;

  // Handle cleaner acceptance - set cleaner_id
  if (eventType === "job_accepted" && role === "cleaner") {
    updateFields.push(`cleaner_id = $${paramIndex}`);
    updateParams.push(requesterId);
    paramIndex++;
  }

  // Handle job started - set actual_start_at
  if (eventType === "job_started") {
    updateFields.push(`actual_start_at = NOW()`);
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
      updateFields.push(`latitude = $${paramIndex}`, `longitude = $${paramIndex + 1}`);
      updateParams.push(Number(payload.latitude), Number(payload.longitude));
      paramIndex += 2;
    }
  }

  // Handle job completed - set actual_end_at
  if (eventType === "job_completed") {
    updateFields.push(`actual_end_at = NOW()`);
  }

  // Handle client approval - set rating
  if (eventType === "client_approved") {
    if (payload.rating !== undefined) {
      const rating = Number(payload.rating);
      if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      updateFields.push(`rating = $${paramIndex}`);
      updateParams.push(rating);
      paramIndex++;
    }
  }

  // Execute UPDATE
  const updateQuery = `
    UPDATE jobs
    SET ${updateFields.join(", ")}
    WHERE id = $1
    RETURNING *
  `;

  const result = await query<Job>(updateQuery, updateParams);
  const updated = result.rows[0];

  if (!updated) {
    throw new Error("Job not found");
  }

  // Log event
  await publishEvent({
    jobId,
    actorType,
    actorId: requesterId,
    eventName: eventType,
    payload,
  });

  // ============================================
  // Handle credit operations based on status transitions
  // ============================================

  // On cancellation: refund escrowed credits to client
  if (nextStatus === "cancelled" && job.credit_amount > 0) {
    await refundJobCreditsToClient(job.client_id, job.id, job.credit_amount);
    logger.info("credits_refunded_on_cancel", {
      jobId,
      clientId: job.client_id,
      amount: job.credit_amount,
    });
  }

  // On completion (client_approved): release credits to cleaner + create payout + update reliability
  if (nextStatus === "completed" && job.cleaner_id) {
    // 1) Release credits to cleaner's balance (ledger entry)
    await releaseJobCreditsToCleaner(job.cleaner_id, job.id, job.credit_amount);
    logger.info("credits_released_to_cleaner", {
      jobId,
      cleanerId: job.cleaner_id,
      amount: job.credit_amount,
    });

    // 2) Update cleaner reliability score
    try {
      const { updateCleanerReliability } = await import("./reliabilityService");
      await updateCleanerReliability(job.cleaner_id);
    } catch (err) {
      logger.error("reliability_update_failed", {
        cleanerId: job.cleaner_id,
        error: (err as Error).message,
      });
    }

    // 3) Create pending payout record (for weekly Stripe transfer)
    await recordEarningsForCompletedJob(updated);
    logger.info("payout_recorded", {
      jobId,
      cleanerId: job.cleaner_id,
      creditAmount: job.credit_amount,
    });
  }

  // On dispute resolution with refund
  if (eventType === "dispute_resolved_refund") {
    // Full refund to client
    await refundJobCreditsToClient(job.client_id, job.id, job.credit_amount);
    logger.info("dispute_refunded", {
      jobId,
      clientId: job.client_id,
      amount: job.credit_amount,
    });
  }

  logger.info("job_status_changed", {
    jobId,
    fromStatus: job.status,
    toStatus: nextStatus,
    eventType,
    actorType,
  });

  return updated;
}

/**
 * Admin: List all jobs with filters
 */
export async function listAllJobs(filters?: {
  status?: JobStatus;
  clientId?: string;
  cleanerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: Job[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.clientId) {
    conditions.push(`client_id = $${paramIndex}`);
    params.push(filters.clientId);
    paramIndex++;
  }

  if (filters?.cleanerId) {
    conditions.push(`cleaner_id = $${paramIndex}`);
    params.push(filters.cleanerId);
    paramIndex++;
  }

  if (filters?.dateFrom) {
    conditions.push(`scheduled_start_at >= $${paramIndex}`);
    params.push(filters.dateFrom);
    paramIndex++;
  }

  if (filters?.dateTo) {
    conditions.push(`scheduled_start_at <= $${paramIndex}`);
    params.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM jobs ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  // Get jobs
  const jobsResult = await query<Job>(
    `
      SELECT *
      FROM jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    [...params, limit, offset]
  );

  return {
    jobs: jobsResult.rows,
    total,
  };
}

/**
 * Get job for client (with ownership check)
 */
export async function getJobForClient(jobId: string, clientId: string): Promise<Job> {
  const job = await getJob(jobId);
  
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }
  
  if (job.client_id !== clientId) {
    throw Object.assign(new Error("Not your job"), { statusCode: 403 });
  }
  
  return job;
}

/**
 * Get job for cleaner (with assignment check)
 */
export async function getJobForCleaner(jobId: string, cleanerId: string): Promise<Job> {
  const job = await getJob(jobId);
  
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }
  
  // Cleaners can view jobs assigned to them, or available jobs (for accepting)
  if (job.cleaner_id && job.cleaner_id !== cleanerId) {
    throw Object.assign(new Error("Not your job"), { statusCode: 403 });
  }
  
  return job;
}
