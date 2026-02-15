// src/core/db/cancellationDb.ts
// Database layer for Cancellation System (Tasks 4.1-4.4)

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { CancellationType, CancellationActor, TimeBucket } from "../types";

// ============================================
// Types
// ============================================

export interface CancellationEventInsert {
  jobId: number;
  clientId?: number;
  cleanerId?: number;
  cancelledBy: CancellationActor;
  type?: CancellationType;
  tCancel: Date;
  hoursBeforeStart: number | null;
  bucket: TimeBucket | null;
  reasonCode: string | null;
  afterRescheduleDeclined: boolean;
  feePct: number;
  feeCredits: number;
  refundCredits: number;
  cleanerCompCredits: number;
  platformCompCredits: number;
  graceUsed: boolean;
  bonusCreditsToClient?: number;
  isEmergency?: boolean;
  jobStatusAtCancellation?: string;
}

export interface CancellationEventRecord extends CancellationEventInsert {
  id: number;
  createdAt: Date;
}

// ============================================
// 4.1 - Create Cancellation Events Table
// ============================================
// (Table defined in migration 018_core_systems_v2.sql)

/**
 * Task 4.1: Insert a cancellation event record
 */
export async function insertCancellationEvent(
  data: CancellationEventInsert
): Promise<CancellationEventRecord> {
  const result = await query<{ id: string }>(
    `INSERT INTO cancellation_events (
      job_id, client_id, cleaner_id, cancelled_by, type, t_cancel,
      hours_before_start, bucket, reason_code, after_reschedule_declined,
      fee_pct, fee_credits, refund_credits, cleaner_comp_credits, platform_comp_credits,
      grace_used, bonus_credits_to_client, is_emergency, job_status_at_cancellation,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
    RETURNING id`,
    [
      String(data.jobId),
      data.clientId ? String(data.clientId) : null,
      data.cleanerId ? String(data.cleanerId) : null,
      data.cancelledBy,
      data.type || null,
      data.tCancel.toISOString(),
      data.hoursBeforeStart,
      data.bucket,
      data.reasonCode,
      data.afterRescheduleDeclined,
      data.feePct,
      data.feeCredits,
      data.refundCredits,
      data.cleanerCompCredits,
      data.platformCompCredits,
      data.graceUsed,
      data.bonusCreditsToClient || 0,
      data.isEmergency || false,
      data.jobStatusAtCancellation || null,
    ]
  );

  const id = Number(result.rows[0].id);

  logger.info("cancellation_event_inserted", {
    id,
    jobId: data.jobId,
    cancelledBy: data.cancelledBy,
    type: data.type,
    feePct: data.feePct,
    graceUsed: data.graceUsed,
  });

  return {
    id,
    ...data,
    createdAt: new Date(),
  };
}

// ============================================
// 4.2 - Apply Credit Movements
// ============================================

/**
 * Task 4.2: db.credits.applyCancellation({...})
 *
 * Handles all credit movements for a cancellation:
 * - Refund credits to client
 * - Compensation credits to cleaner
 * - Platform fee credits
 * - Bonus credits (for cleaner no-show, etc.)
 */
export async function applyCancellationCredits(data: {
  jobId: number;
  clientId: number;
  cleanerId: number;
  feeCredits: number;
  refundCredits: number;
  cleanerCompCredits: number;
  platformCompCredits: number;
  bonusCreditsToClient?: number;
}): Promise<void> {
  const { jobId, clientId, cleanerId, refundCredits, cleanerCompCredits, bonusCreditsToClient } =
    data;

  // Refund credits to client
  if (refundCredits > 0) {
    await query(
      `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason, created_at)
       VALUES ($1, $2, $3, 'refund', NOW())`,
      [String(clientId), String(jobId), refundCredits]
    );

    logger.info("credits_refunded", {
      clientId,
      jobId,
      amount: refundCredits,
    });
  }

  // Cleaner compensation credits
  if (cleanerCompCredits > 0) {
    await query(
      `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason, created_at)
       VALUES ($1, $2, $3, 'cancellation_compensation', NOW())`,
      [String(cleanerId), String(jobId), cleanerCompCredits]
    );

    logger.info("cleaner_compensated", {
      cleanerId,
      jobId,
      amount: cleanerCompCredits,
    });
  }

  // Bonus credits to client (for cleaner no-show / system error)
  if (bonusCreditsToClient && bonusCreditsToClient > 0) {
    await query(
      `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason, created_at)
       VALUES ($1, $2, $3, 'apology_bonus', NOW())`,
      [String(clientId), String(jobId), bonusCreditsToClient]
    );

    logger.info("bonus_credits_issued", {
      clientId,
      jobId,
      amount: bonusCreditsToClient,
    });
  }

  // Release any remaining escrow (handled by job status update)
  await query(`UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [
    String(jobId),
  ]);
}

// ============================================
// Grace Cancellation Management
// ============================================

/**
 * Get remaining grace cancellations for a client
 */
export async function getClientGraceRemaining(clientId: number): Promise<number> {
  const result = await query<{
    grace_cancellations_total: number;
    grace_cancellations_used: number;
  }>(
    `SELECT 
      COALESCE(grace_cancellations_total, 2) as grace_cancellations_total,
      COALESCE(grace_cancellations_used, 0) as grace_cancellations_used
     FROM client_profiles
     WHERE user_id = $1`,
    [String(clientId)]
  );

  if (result.rows.length === 0) {
    return 2; // Default grace amount
  }

  const row = result.rows[0];
  return row.grace_cancellations_total - row.grace_cancellations_used;
}

/**
 * Use a grace cancellation for a client
 */
export async function useGraceCancellation(clientId: number, jobId?: number): Promise<void> {
  await query(
    `UPDATE client_profiles
     SET grace_cancellations_used = COALESCE(grace_cancellations_used, 0) + 1, updated_at = NOW()
     WHERE user_id = $1`,
    [String(clientId)]
  );

  // Record in grace_cancellations table
  await query(
    `INSERT INTO grace_cancellations (client_id, job_id, created_at)
     VALUES ($1, $2, NOW())`,
    [String(clientId), jobId ? String(jobId) : null]
  );

  logger.info("grace_cancellation_used", { clientId, jobId });
}

// ============================================
// Cancellation Statistics
// ============================================

/**
 * Get client's cancellation stats for flexibility profile
 */
export async function getClientCancellationStats(
  clientId: number,
  since: Date
): Promise<{
  totalCancellations: number;
  lateCancellations: number;
  noShows: number;
  graceUsed: number;
}> {
  const result = await query<any>(
    `SELECT
      COUNT(*)::int as total_cancellations,
      COUNT(*) FILTER (WHERE bucket IN ('24_48', 'lt24'))::int as late_cancellations,
      COUNT(*) FILTER (WHERE type = 'client_no_show')::int as no_shows,
      COUNT(*) FILTER (WHERE grace_used = true)::int as grace_used
     FROM cancellation_events
     WHERE client_id = $1
     AND cancelled_by = 'client'
     AND t_cancel >= $2`,
    [String(clientId), since.toISOString()]
  );

  const row = result.rows[0] || {};
  return {
    totalCancellations: Number(row.total_cancellations || 0),
    lateCancellations: Number(row.late_cancellations || 0),
    noShows: Number(row.no_shows || 0),
    graceUsed: Number(row.grace_used || 0),
  };
}

/**
 * Get cleaner's cancellation stats
 */
export async function getCleanerCancellationStats(
  cleanerId: number,
  since: Date
): Promise<{
  totalCancellations: number;
  lateCancellations: number;
  noShows: number;
}> {
  const result = await query<any>(
    `SELECT
      COUNT(*)::int as total_cancellations,
      COUNT(*) FILTER (WHERE bucket IN ('24_48', 'lt24'))::int as late_cancellations,
      COUNT(*) FILTER (WHERE type = 'cleaner_no_show')::int as no_shows
     FROM cancellation_events
     WHERE cleaner_id = $1
     AND cancelled_by = 'cleaner'
     AND t_cancel >= $2`,
    [String(cleanerId), since.toISOString()]
  );

  const row = result.rows[0] || {};
  return {
    totalCancellations: Number(row.total_cancellations || 0),
    lateCancellations: Number(row.late_cancellations || 0),
    noShows: Number(row.no_shows || 0),
  };
}

// ============================================
// No-Show Marking
// ============================================

/**
 * Mark a job as client no-show
 */
export async function markClientNoShow(jobId: number): Promise<void> {
  await query(`UPDATE jobs SET status = 'no_show_client', updated_at = NOW() WHERE id = $1`, [
    String(jobId),
  ]);

  logger.info("job_marked_client_no_show", { jobId });
}

/**
 * Mark a job as cleaner no-show
 */
export async function markCleanerNoShow(jobId: number): Promise<void> {
  await query(`UPDATE jobs SET status = 'no_show_cleaner', updated_at = NOW() WHERE id = $1`, [
    String(jobId),
  ]);

  logger.info("job_marked_cleaner_no_show", { jobId });
}
