// src/core/rescheduleService.ts
// Rescheduling System - Full Implementation
//
// Implements:
// - Request → pending → accept/decline workflow
// - Time-window logic (<24h, 24-48h, >48h)
// - Reasonable/unreasonable classification
// - Integration with cancellation, risk, and reliability systems

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import {
  Job,
  Client,
  Cleaner,
  RescheduleEvent,
  ClientRiskEvent,
  CleanerEvent,
  TimeBucket,
} from './types';
import { hoursDiff, getTimeBucket } from './timeBuckets';
import { RESCHEDULE_CONFIG, CLIENT_RISK_CONFIG, RELIABILITY_CONFIG } from './config';

// ============================================
// Types
// ============================================

export interface RescheduleRequestInput {
  job: Job;
  client: Client;
  cleaner: Cleaner;
  requestedBy: 'client' | 'cleaner';
  newStartTime: Date;
  reasonCode: string | null;
}

export interface RescheduleResponseInput {
  rescheduleEvent: RescheduleEvent;
  action: 'accept' | 'decline';
  actor: 'client' | 'cleaner';
  declineReasonCode?: string | null;
}

export interface AvailabilityCheckResult {
  available: boolean;
  reason?: string;
  conflictJobId?: number | null;
}

// ============================================
// Main Service
// ============================================

export class RescheduleServiceV2 {
  /**
   * Create a reschedule request
   */
  static async createRequest(input: RescheduleRequestInput): Promise<RescheduleEvent> {
    const { job, requestedBy, newStartTime, reasonCode, client, cleaner } = input;
    const now = new Date();

    const tStartOriginal = job.startTime;
    const tRequest = now;
    const hoursBeforeOriginal = hoursDiff(tRequest, tStartOriginal);
    const bucket = getTimeBucket(hoursBeforeOriginal);

    const requestedTo: 'client' | 'cleaner' =
      requestedBy === 'client' ? 'cleaner' : 'client';

    // Check cleaner availability for new time
    const newEndTime = new Date(
      newStartTime.getTime() + (job.endTime.getTime() - job.startTime.getTime())
    );
    const availability = await this.checkCleanerAvailability(
      job.cleanerId,
      newStartTime,
      newEndTime
    );

    // Count previous reschedules for this job
    const previousCount = await this.countReschedulesForJob(job.id);

    // Determine if this is a "reasonable" reschedule request
    const isReasonable = this.evaluateReasonableness({
      availability,
      tStartOriginal,
      tStartNew: newStartTime,
      tRequest,
      previousRescheduleCount: previousCount,
    });

    const rescheduleEvent: RescheduleEvent = {
      jobId: job.id,
      clientId: job.clientId,
      cleanerId: job.cleanerId,
      requestedBy,
      requestedTo,
      tRequest,
      tStartOriginal,
      tStartNew: newStartTime,
      hoursBeforeOriginal,
      bucket,
      reasonCode,
      status: 'pending',
      isReasonable,
    };

    // Persist the reschedule event
    const inserted = await this.persistRescheduleEvent(rescheduleEvent);

    // Send notification to other party
    await publishEvent({
      jobId: String(job.id),
      actorType: requestedBy,
      actorId: requestedBy === 'client' ? String(job.clientId) : String(job.cleanerId),
      eventName: 'reschedule.request_created',
      payload: {
        rescheduleEventId: inserted.id,
        requestedBy,
        requestedTo,
        newStartTime: newStartTime.toISOString(),
        isReasonable,
        bucket,
      },
    });

    logger.info("reschedule_request_created", {
      rescheduleEventId: inserted.id,
      jobId: job.id,
      requestedBy,
      requestedTo,
      hoursBeforeOriginal,
      bucket,
      isReasonable,
    });

    return inserted;
  }

  /**
   * Respond to a reschedule request (accept or decline)
   */
  static async respond(input: RescheduleResponseInput): Promise<RescheduleEvent> {
    const { rescheduleEvent, action, actor, declineReasonCode } = input;

    if (rescheduleEvent.status !== 'pending') {
      throw new Error('Reschedule already handled');
    }

    if (actor !== rescheduleEvent.requestedTo) {
      throw new Error('Only the receiving party can respond');
    }

    if (action === 'accept') {
      return this.acceptReschedule(rescheduleEvent);
    } else {
      return this.declineReschedule(rescheduleEvent, actor, declineReasonCode ?? null);
    }
  }

  /**
   * Accept a reschedule request
   */
  private static async acceptReschedule(event: RescheduleEvent): Promise<RescheduleEvent> {
    // Update job time
    await this.updateJobTime(event.jobId, event.tStartNew);

    // Update reschedule event status
    const updatedEvent = await this.updateRescheduleStatus(event.id!, {
      status: 'accepted',
      declinedBy: null,
      declineReasonCode: null,
    });

    // Log scoring events for late reschedules
    const scoringEvents: (ClientRiskEvent | CleanerEvent)[] = [];

    if (event.bucket === 'lt24') {
      if (event.requestedBy === 'client') {
        // Client late reschedule: +1 risk
        scoringEvents.push({
          clientId: event.clientId,
          jobId: event.jobId,
          eventType: 'late_reschedule_lt24',
          weight: CLIENT_RISK_CONFIG.weights.lateRescheduleLt24,
          metadata: { source: 'reschedule_accept', rescheduleEventId: event.id },
        } as ClientRiskEvent);
      } else if (event.requestedBy === 'cleaner') {
        // Cleaner late reschedule: -3 reliability
        scoringEvents.push({
          cleanerId: event.cleanerId,
          jobId: event.jobId,
          eventType: 'late_reschedule',
          weight: RESCHEDULE_CONFIG.reliability.cleanerLateReschedulePenalty,
          metadata: { source: 'reschedule_accept', rescheduleEventId: event.id },
        } as CleanerEvent);
      }
    }

    if (scoringEvents.length) {
      await this.logScoringEvents(scoringEvents);
    }

    // Publish acceptance event
    await publishEvent({
      jobId: String(event.jobId),
      actorType: event.requestedTo,
      actorId: event.requestedTo === 'client' ? String(event.clientId) : String(event.cleanerId),
      eventName: 'reschedule.accepted',
      payload: {
        rescheduleEventId: event.id,
        newStartTime: event.tStartNew.toISOString(),
      },
    });

    logger.info("reschedule_accepted", {
      rescheduleEventId: event.id,
      jobId: event.jobId,
      newStartTime: event.tStartNew,
    });

    return updatedEvent;
  }

  /**
   * Decline a reschedule request
   */
  private static async declineReschedule(
    event: RescheduleEvent,
    actor: 'client' | 'cleaner',
    declineReasonCode: string | null
  ): Promise<RescheduleEvent> {
    const updatedEvent = await this.updateRescheduleStatus(event.id!, {
      status: 'declined',
      declinedBy: actor,
      declineReasonCode,
    });

    // Low Flexibility tracking: cleaner declines reasonable client requests
    if (
      actor === 'cleaner' &&
      event.requestedBy === 'client' &&
      event.isReasonable
    ) {
      await this.logCleanerReasonableDecline(event.cleanerId, event.id!);
    }

    // Publish decline event
    await publishEvent({
      jobId: String(event.jobId),
      actorType: actor,
      actorId: actor === 'client' ? String(event.clientId) : String(event.cleanerId),
      eventName: 'reschedule.declined',
      payload: {
        rescheduleEventId: event.id,
        declinedBy: actor,
        declineReasonCode,
      },
    });

    logger.info("reschedule_declined", {
      rescheduleEventId: event.id,
      jobId: event.jobId,
      declinedBy: actor,
      declineReasonCode,
      wasReasonable: event.isReasonable,
    });

    return updatedEvent;
  }

  // ============================================
  // Reasonableness Evaluation
  // ============================================

  /**
   * Evaluate if a reschedule request is "reasonable"
   * 
   * Reasonable if ALL of:
   * 1. Inside cleaner's availability (new time)
   * 2. Within 7 days of original booking
   * 3. Not the 2nd+ reschedule for this job
   * 4. Requested before job actually starts
   */
  private static evaluateReasonableness(params: {
    availability: AvailabilityCheckResult;
    tStartOriginal: Date;
    tStartNew: Date;
    tRequest: Date;
    previousRescheduleCount: number;
  }): boolean {
    const { availability, tStartOriginal, tStartNew, tRequest, previousRescheduleCount } = params;

    // 1. Must be within cleaner's availability
    if (!availability.available) {
      return false;
    }

    // 2. Within 7 days of original
    const daysDiff = Math.abs(hoursDiff(tStartOriginal, tStartNew)) / 24;
    if (daysDiff > RESCHEDULE_CONFIG.reasonable.maxDaysFromOriginal) {
      return false;
    }

    // 3. First reschedule only
    if (previousRescheduleCount >= RESCHEDULE_CONFIG.reasonable.maxPreviousReschedules + 1) {
      return false;
    }

    // 4. Request must be before original start time
    if (tRequest >= tStartOriginal) {
      return false;
    }

    return true;
  }

  // ============================================
  // Availability Check
  // ============================================

  /**
   * Check if a cleaner is available for a time slot
   */
  private static async checkCleanerAvailability(
    cleanerId: number,
    requestedStart: Date,
    requestedEnd: Date
  ): Promise<AvailabilityCheckResult> {
    // Check for overlapping jobs
    const conflictResult = await query<{ id: string }>(
      `SELECT id FROM jobs 
       WHERE cleaner_id = $1 
       AND status NOT IN ('cancelled', 'completed')
       AND scheduled_start_at < $3 
       AND scheduled_end_at > $2
       LIMIT 1`,
      [String(cleanerId), requestedStart.toISOString(), requestedEnd.toISOString()]
    );

    if (conflictResult.rows.length > 0) {
      return {
        available: false,
        reason: 'job_conflict',
        conflictJobId: Number(conflictResult.rows[0].id),
      };
    }

    // Check blackout periods
    const blackoutResult = await query<{ id: string }>(
      `SELECT id FROM blackout_periods
       WHERE cleaner_id = $1
       AND start_ts < $3
       AND end_ts > $2
       LIMIT 1`,
      [String(cleanerId), requestedStart.toISOString(), requestedEnd.toISOString()]
    );

    if (blackoutResult.rows.length > 0) {
      return {
        available: false,
        reason: 'blackout_period',
      };
    }

    // Check weekly availability blocks
    const dayOfWeek = requestedStart.getDay();
    const startTimeStr = requestedStart.toTimeString().substring(0, 5); // 'HH:MM'
    const endTimeStr = requestedEnd.toTimeString().substring(0, 5);

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
      return {
        available: false,
        reason: 'outside_availability',
      };
    }

    return { available: true };
  }

  // ============================================
  // Database Operations
  // ============================================

  private static async countReschedulesForJob(jobId: number): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM reschedule_events WHERE job_id = $1`,
      [String(jobId)]
    );
    return Number(result.rows[0]?.count || 0);
  }

  private static async persistRescheduleEvent(event: RescheduleEvent): Promise<RescheduleEvent> {
    const result = await query<{ id: string }>(
      `INSERT INTO reschedule_events (
        job_id, client_id, cleaner_id, requested_by, requested_to,
        t_request, t_start_original, t_start_new, hours_before_original,
        bucket, reason_code, status, is_reasonable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        String(event.jobId),
        String(event.clientId),
        String(event.cleanerId),
        event.requestedBy,
        event.requestedTo,
        event.tRequest.toISOString(),
        event.tStartOriginal.toISOString(),
        event.tStartNew.toISOString(),
        event.hoursBeforeOriginal,
        event.bucket,
        event.reasonCode,
        event.status,
        event.isReasonable,
      ]
    );

    return {
      ...event,
      id: Number(result.rows[0].id),
    };
  }

  private static async updateRescheduleStatus(
    id: number,
    updates: {
      status: 'accepted' | 'declined';
      declinedBy: 'client' | 'cleaner' | null;
      declineReasonCode: string | null;
    }
  ): Promise<RescheduleEvent> {
    const result = await query<any>(
      `UPDATE reschedule_events
       SET status = $2, declined_by = $3, decline_reason_code = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, updates.status, updates.declinedBy, updates.declineReasonCode]
    );

    const row = result.rows[0];
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

  private static async updateJobTime(jobId: number, newStartTime: Date): Promise<void> {
    // Calculate new end time based on original duration
    const jobResult = await query<{ scheduled_start_at: string; scheduled_end_at: string }>(
      `SELECT scheduled_start_at, scheduled_end_at FROM jobs WHERE id = $1`,
      [String(jobId)]
    );

    if (jobResult.rows.length === 0) {
      throw new Error('Job not found');
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
  }

  private static async logCleanerReasonableDecline(cleanerId: number, rescheduleEventId: number): Promise<void> {
    await query(
      `INSERT INTO flexibility_decline_events (cleaner_id, reschedule_event_id, created_at)
       VALUES ($1, $2, NOW())`,
      [String(cleanerId), rescheduleEventId]
    );

    logger.info("cleaner_reasonable_decline_logged", {
      cleanerId,
      rescheduleEventId,
    });
  }

  private static async logScoringEvents(events: (ClientRiskEvent | CleanerEvent)[]): Promise<void> {
    for (const event of events) {
      if ('clientId' in event) {
        await query(
          `INSERT INTO client_risk_events (client_id, job_id, event_type, weight, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          [
            String(event.clientId),
            event.jobId ? String(event.jobId) : null,
            event.eventType,
            event.weight,
            JSON.stringify(event.metadata || {}),
          ]
        );
      } else if ('cleanerId' in event) {
        await query(
          `INSERT INTO cleaner_events (cleaner_id, job_id, event_type, weight, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          [
            String(event.cleanerId),
            event.jobId ? String(event.jobId) : null,
            event.eventType,
            event.weight,
            JSON.stringify(event.metadata || {}),
          ]
        );
      }
    }
  }

  /**
   * Get a reschedule event by ID
   */
  static async getById(id: number): Promise<RescheduleEvent | null> {
    const result = await query<any>(
      `SELECT * FROM reschedule_events WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
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
}

