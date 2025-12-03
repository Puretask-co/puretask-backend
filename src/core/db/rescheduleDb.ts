// src/core/db/rescheduleDb.ts
// Database layer for Rescheduling System (Tasks 3.1-3.9)

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { RescheduleEvent, TimeBucket } from '../types';

// ============================================
// Types
// ============================================

export interface RescheduleEventInsert {
  jobId: number;
  clientId: number;
  cleanerId: number;
  requestedBy: 'client' | 'cleaner';
  requestedTo: 'client' | 'cleaner';
  tRequest: Date;
  tStartOriginal: Date;
  tStartNew: Date;
  hoursBeforeOriginal: number;
  bucket: TimeBucket;
  reasonCode: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  isReasonable: boolean;
  declinedBy?: 'client' | 'cleaner' | null;
  declineReasonCode?: string | null;
}

export interface RescheduleEventUpdate {
  status?: 'pending' | 'accepted' | 'declined' | 'expired';
  declinedBy?: 'client' | 'cleaner' | null;
  declineReasonCode?: string | null;
}

// ============================================
// 3.1 - Insert Reschedule Event
// ============================================

/**
 * Task 3.1: db.rescheduleEvents.insert({...})
 */
export async function insertRescheduleEvent(data: RescheduleEventInsert): Promise<RescheduleEvent> {
  const result = await query<{ id: string }>(
    `INSERT INTO reschedule_events (
      job_id, client_id, cleaner_id, requested_by, requested_to,
      t_request, t_start_original, t_start_new, hours_before_original,
      bucket, reason_code, status, is_reasonable, declined_by, decline_reason_code,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING id`,
    [
      String(data.jobId),
      String(data.clientId),
      String(data.cleanerId),
      data.requestedBy,
      data.requestedTo,
      data.tRequest.toISOString(),
      data.tStartOriginal.toISOString(),
      data.tStartNew.toISOString(),
      data.hoursBeforeOriginal,
      data.bucket,
      data.reasonCode,
      data.status,
      data.isReasonable,
      data.declinedBy || null,
      data.declineReasonCode || null,
    ]
  );

  const id = Number(result.rows[0].id);

  logger.info("reschedule_event_inserted", {
    id,
    jobId: data.jobId,
    requestedBy: data.requestedBy,
    bucket: data.bucket,
    isReasonable: data.isReasonable,
  });

  return {
    id,
    ...data,
  };
}

// ============================================
// 3.2 - Update Reschedule Event
// ============================================

/**
 * Task 3.2: db.rescheduleEvents.update(id, {...})
 */
export async function updateRescheduleEvent(
  id: number,
  updates: RescheduleEventUpdate
): Promise<RescheduleEvent> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[] = [id];
  let paramIndex = 2;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.declinedBy !== undefined) {
    setClauses.push(`declined_by = $${paramIndex++}`);
    values.push(updates.declinedBy);
  }
  if (updates.declineReasonCode !== undefined) {
    setClauses.push(`decline_reason_code = $${paramIndex++}`);
    values.push(updates.declineReasonCode);
  }

  const result = await query<any>(
    `UPDATE reschedule_events
     SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Reschedule event ${id} not found`);
  }

  return mapRescheduleEventRow(result.rows[0]);
}

// ============================================
// 3.3 - Find Reschedule Event by ID
// ============================================

/**
 * Task 3.3: db.rescheduleEvents.findById(id)
 */
export async function findRescheduleEventById(id: number): Promise<RescheduleEvent | null> {
  const result = await query<any>(
    `SELECT * FROM reschedule_events WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  return mapRescheduleEventRow(result.rows[0]);
}

// ============================================
// 3.4 - Count Reschedules for Job
// ============================================

/**
 * Task 3.4: db.rescheduleEvents.countForJob(jobId)
 * 
 * Enforces max 1 reschedule per job rule.
 */
export async function countReschedulesForJob(jobId: number): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM reschedule_events
     WHERE job_id = $1`,
    [String(jobId)]
  );

  return Number(result.rows[0]?.count || 0);
}

// ============================================
// 3.5 - Count Late Client Reschedules
// ============================================

/**
 * Task 3.5: db.rescheduleEvents.countLateClientReschedulesLt24LastNDays(clientId, days)
 * 
 * Used for pattern detection (3+ in 14 days → +10 risk).
 */
export async function countLateClientReschedulesLt24LastNDays(
  clientId: number,
  days: number
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM reschedule_events
     WHERE client_id = $1
     AND requested_by = 'client'
     AND bucket = 'lt24'
     AND t_request >= NOW() - INTERVAL '1 day' * $2`,
    [String(clientId), days]
  );

  return Number(result.rows[0]?.count || 0);
}

// ============================================
// 3.6 - Update Job Start Time
// ============================================

/**
 * Task 3.6: db.jobs.updateStartTime(jobId, newStartTime)
 * 
 * Updates job's scheduled start time (preserving duration).
 */
export async function updateJobStartTime(jobId: number, newStartTime: Date): Promise<void> {
  // Get original duration
  const jobResult = await query<{ scheduled_start_at: string; scheduled_end_at: string }>(
    `SELECT scheduled_start_at, scheduled_end_at FROM jobs WHERE id = $1`,
    [String(jobId)]
  );

  if (jobResult.rows.length === 0) {
    throw new Error(`Job ${jobId} not found`);
  }

  const originalStart = new Date(jobResult.rows[0].scheduled_start_at);
  const originalEnd = new Date(jobResult.rows[0].scheduled_end_at);
  const durationMs = originalEnd.getTime() - originalStart.getTime();
  const newEndTime = new Date(newStartTime.getTime() + durationMs);

  await query(
    `UPDATE jobs
     SET scheduled_start_at = $2, scheduled_end_at = $3, updated_at = NOW()
     WHERE id = $1`,
    [String(jobId), newStartTime.toISOString(), newEndTime.toISOString()]
  );

  logger.info("job_start_time_updated", {
    jobId,
    newStartTime: newStartTime.toISOString(),
    newEndTime: newEndTime.toISOString(),
  });
}

// ============================================
// 3.7 - Check Cleaner Availability
// ============================================

/**
 * Task 3.7: db.availability.isCleanerAvailableForRange(cleanerId, startTime, endTime)
 * 
 * Checks if cleaner is available for a time range.
 */
export async function isCleanerAvailableForRange(
  cleanerId: number,
  startTime: Date,
  endTime?: Date
): Promise<{ available: boolean; reason?: string; conflictJobId?: number }> {
  // Calculate end time if not provided (assume 2 hour default)
  const actualEndTime = endTime || new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

  // Check for overlapping jobs
  const conflictResult = await query<{ id: string }>(
    `SELECT id FROM jobs
     WHERE cleaner_id = $1
     AND status NOT IN ('cancelled', 'completed')
     AND scheduled_start_at < $3
     AND scheduled_end_at > $2
     LIMIT 1`,
    [String(cleanerId), startTime.toISOString(), actualEndTime.toISOString()]
  );

  if (conflictResult.rows.length > 0) {
    return {
      available: false,
      reason: 'job_conflict',
      conflictJobId: Number(conflictResult.rows[0].id),
    };
  }

  // Check for blackout periods
  const blackoutResult = await query<{ id: string }>(
    `SELECT id FROM blackout_periods
     WHERE cleaner_id = $1
     AND start_ts < $3
     AND end_ts > $2
     LIMIT 1`,
    [String(cleanerId), startTime.toISOString(), actualEndTime.toISOString()]
  );

  if (blackoutResult.rows.length > 0) {
    return { available: false, reason: 'blackout_period' };
  }

  // Check weekly availability blocks
  const dayOfWeek = startTime.getDay();
  const startTimeStr = startTime.toTimeString().substring(0, 5);
  const endTimeStr = actualEndTime.toTimeString().substring(0, 5);

  const availabilityResult = await query<{ id: string }>(
    `SELECT id FROM availability_blocks
     WHERE cleaner_id = $1
     AND day_of_week = $2
     AND start_time <= $3
     AND end_time >= $4
     LIMIT 1`,
    [String(cleanerId), dayOfWeek, startTimeStr, endTimeStr]
  );

  if (availabilityResult.rows.length === 0) {
    return { available: false, reason: 'outside_availability' };
  }

  return { available: true };
}

// ============================================
// 3.9 - Log Cleaner Decline Reasonable Request
// ============================================

/**
 * Task 3.9: db.flexibility.logCleanerDeclineReasonableRequest({...})
 * 
 * Logs when a cleaner declines a reasonable reschedule request.
 * Used for Low Flexibility badge calculation.
 */
export async function logCleanerDeclineReasonableRequest(data: {
  cleanerId: number;
  rescheduleId: number;
  createdAt?: Date;
}): Promise<void> {
  await query(
    `INSERT INTO flexibility_decline_events (cleaner_id, reschedule_event_id, created_at)
     VALUES ($1, $2, $3)`,
    [
      String(data.cleanerId),
      data.rescheduleId,
      (data.createdAt || new Date()).toISOString(),
    ]
  );

  logger.info("cleaner_reasonable_decline_logged", {
    cleanerId: data.cleanerId,
    rescheduleId: data.rescheduleId,
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map database row to RescheduleEvent type
 */
function mapRescheduleEventRow(row: any): RescheduleEvent {
  return {
    id: Number(row.id),
    jobId: Number(row.job_id),
    clientId: Number(row.client_id),
    cleanerId: Number(row.cleaner_id),
    requestedBy: row.requested_by,
    requestedTo: row.requested_to,
    tRequest: new Date(row.t_request),
    tStartOriginal: new Date(row.t_start_original),
    tStartNew: new Date(row.t_start_new),
    hoursBeforeOriginal: Number(row.hours_before_original),
    bucket: row.bucket,
    reasonCode: row.reason_code,
    status: row.status,
    isReasonable: row.is_reasonable,
    declinedBy: row.declined_by,
    declineReasonCode: row.decline_reason_code,
  };
}

/**
 * Get pending reschedule events for a job
 */
export async function getPendingReschedulesForJob(jobId: number): Promise<RescheduleEvent[]> {
  const result = await query<any>(
    `SELECT * FROM reschedule_events
     WHERE job_id = $1
     AND status = 'pending'
     ORDER BY created_at DESC`,
    [String(jobId)]
  );

  return result.rows.map(mapRescheduleEventRow);
}

/**
 * Get cleaner's reschedule stats for flexibility evaluation
 */
export async function getCleanerRescheduleStats(
  cleanerId: number,
  since: Date
): Promise<{
  reasonableRequests: number;
  reasonableDeclines: number;
}> {
  const requestsResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM reschedule_events
     WHERE cleaner_id = $1
     AND requested_to = 'cleaner'
     AND is_reasonable = true
     AND t_request >= $2`,
    [String(cleanerId), since.toISOString()]
  );

  const declinesResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM reschedule_events
     WHERE cleaner_id = $1
     AND requested_to = 'cleaner'
     AND is_reasonable = true
     AND status = 'declined'
     AND declined_by = 'cleaner'
     AND t_request >= $2`,
    [String(cleanerId), since.toISOString()]
  );

  return {
    reasonableRequests: Number(requestsResult.rows[0]?.count || 0),
    reasonableDeclines: Number(declinesResult.rows[0]?.count || 0),
  };
}

