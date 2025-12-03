// src/core/cancellationService.ts
// Cancellation System v2 - Full implementation
//
// Implements:
// - Time windows: 0% (>48h), 50% (24-48h), 100% (<24h)
// - Grace cancellations (2 per client lifetime)
// - Fee/credit routing (client refund, cleaner comp, platform fee)
// - No-show handling (client and cleaner)
// - Risk/reliability event logging

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import {
  Job,
  Client,
  CancellationType,
  CancellationActor,
  CancellationWindow,
  CancellationEvent,
  ClientRiskEvent,
  CleanerEvent,
} from './types';
import {
  computeHoursBeforeStart,
  computeWindow,
  baseFeePctForWindow,
  getTimeBucket,
} from './timeBuckets';
import { CANCELLATION_CONFIG as cfg } from './config';

// ============================================
// Types
// ============================================

export interface CancellationInput {
  jobId: number;
  clientId: number;
  cleanerId: number;
  scheduledStart: Date;
  now: Date;
  actor: CancellationActor;
  type: CancellationType;
  reasonCode: string | null;
  wasRescheduleContext: boolean;
  jobStatusAtCancellation: string;
  heldCredits: number;
  isEmergency: boolean;
}

export interface ClientProfile {
  id: number;
  graceCancellationsTotal: number;
  graceCancellationsUsed: number;
}

export interface CancellationFeeBreakdown {
  window: CancellationWindow | null;
  baseFeePct: number;
  feePct: number;
  graceUsed: boolean;
  feeCredits: number;
  refundCredits: number;
  cleanerCompCredits: number;
  platformCompCredits: number;
  bonusCreditsToClient: number;
}

export interface CancellationResult {
  jobId: number;
  type: CancellationType;
  actor: CancellationActor;
  clientId: number;
  cleanerId: number;
  feeBreakdown: CancellationFeeBreakdown;
  isNoShow: boolean;
  afterRescheduleDeclined: boolean;
}

interface CancelOptions {
  useGraceIfAvailable?: boolean;
}

// ============================================
// Main Service
// ============================================

export class CancellationServiceV2 {
  /**
   * Main entrypoint: process a cancellation or no-show.
   */
  static async processCancellation(input: CancellationInput): Promise<CancellationResult> {
    const {
      jobId,
      clientId,
      cleanerId,
      scheduledStart,
      now,
      actor,
      type,
      reasonCode,
      wasRescheduleContext,
      jobStatusAtCancellation,
      heldCredits,
      isEmergency,
    } = input;

    // Load client profile for grace cancellations
    const client = await this.getClientProfile(clientId);

    const hoursBefore = computeHoursBeforeStart(scheduledStart, now);
    const window: CancellationWindow | null =
      type === 'client_cancel_normal' || type === 'client_cancel_after_reschedule_declined'
        ? computeWindow(hoursBefore)
        : null;

    // Calculate fee breakdown based on cancellation type
    let feeBreakdown: CancellationFeeBreakdown;

    switch (type) {
      case 'client_cancel_normal':
      case 'client_cancel_after_reschedule_declined':
        feeBreakdown = await this.handleClientCancellation(
          input,
          client,
          window,
          hoursBefore
        );
        break;

      case 'cleaner_cancel_normal':
      case 'cleaner_cancel_emergency':
        feeBreakdown = await this.handleCleanerCancellation(input, isEmergency);
        break;

      case 'client_no_show':
        feeBreakdown = await this.handleClientNoShow(input);
        break;

      case 'cleaner_no_show':
        feeBreakdown = await this.handleCleanerNoShow(input);
        break;

      case 'system_cancel':
        feeBreakdown = await this.handleSystemCancel(input);
        break;

      default:
        throw new Error(`Unsupported cancellation type: ${type}`);
    }

    const isNoShow = type === 'client_no_show' || type === 'cleaner_no_show';
    const bucket = hoursBefore > 0 ? getTimeBucket(hoursBefore) : 'no_show';

    // Persist cancellation event
    const cancellationEvent = await this.persistCancellationEvent({
      jobId,
      cancelledBy: actor,
      type,
      tCancel: now,
      hoursBeforeStart: isNoShow ? null : hoursBefore,
      bucket,
      reasonCode,
      afterRescheduleDeclined: type === 'client_cancel_after_reschedule_declined',
      feePct: feeBreakdown.feePct,
      feeCredits: feeBreakdown.feeCredits,
      refundCredits: feeBreakdown.refundCredits,
      cleanerCompCredits: feeBreakdown.cleanerCompCredits,
      platformCompCredits: feeBreakdown.platformCompCredits,
      graceUsed: feeBreakdown.graceUsed,
      bonusCreditsToClient: feeBreakdown.bonusCreditsToClient,
    });

    // Apply credit movements
    await this.applyCredits({
      jobId,
      clientId,
      cleanerId,
      heldCredits,
      feeBreakdown,
    });

    // Log risk and reliability events
    await this.logRiskAndReliabilityEvents({
      input,
      window,
      hoursBefore,
      feeBreakdown,
      cancellationEventId: cancellationEvent.id,
    });

    // Publish system event
    await publishEvent({
      jobId: String(jobId),
      actorType: actor === 'system' ? 'system' : actor,
      actorId: actor === 'client' ? String(clientId) : actor === 'cleaner' ? String(cleanerId) : null,
      eventName: `cancellation.${type}`,
      payload: {
        type,
        feeBreakdown,
        isNoShow,
        isEmergency,
      },
    });

    logger.info("cancellation_processed", {
      jobId,
      type,
      actor,
      clientId,
      cleanerId,
      feeBreakdown,
      isNoShow,
    });

    return {
      jobId,
      type,
      actor,
      clientId,
      cleanerId,
      feeBreakdown,
      isNoShow,
      afterRescheduleDeclined: type === 'client_cancel_after_reschedule_declined',
    };
  }

  // ============================================
  // Per-Type Handlers
  // ============================================

  private static async handleClientCancellation(
    input: CancellationInput,
    client: ClientProfile,
    window: CancellationWindow | null,
    hoursBefore: number
  ): Promise<CancellationFeeBreakdown> {
    const { heldCredits, isEmergency } = input;

    if (!window) {
      // After start time - should be no-show, not cancellation
      throw new Error('client_cancel called after start time – use client_no_show instead');
    }

    const baseFeePct = baseFeePctForWindow(window);

    // Grace cancellation logic
    const graceRemaining = client.graceCancellationsTotal - client.graceCancellationsUsed;
    let feePct = baseFeePct;
    let graceUsed = false;

    const isClientInitiated = input.actor === 'client';

    if (
      isClientInitiated &&
      baseFeePct > 0 &&
      graceRemaining > 0 &&
      hoursBefore > 0 // Cannot use grace on no-shows
    ) {
      // Use grace cancellation to waive fee
      graceUsed = true;
      feePct = 0;

      await this.updateGraceUsage(client.id, client.graceCancellationsUsed + 1);
    }

    // Emergency / force majeure override
    if (isEmergency) {
      feePct = 0;
      graceUsed = false; // Don't consume grace in emergencies
    }

    // Compute credits
    const feeCredits = Math.round((heldCredits * feePct) / 100);
    const refundCredits = heldCredits - feeCredits;

    let cleanerCompCredits = 0;
    let platformCompCredits = 0;

    if (feeCredits > 0 && !isEmergency) {
      const split = cfg.feeSplits.byWindow(window);
      cleanerCompCredits = Math.round(feeCredits * split.cleanerCompPct);
      platformCompCredits = feeCredits - cleanerCompCredits;
    }

    return {
      window,
      baseFeePct,
      feePct,
      graceUsed,
      feeCredits,
      refundCredits,
      cleanerCompCredits,
      platformCompCredits,
      bonusCreditsToClient: 0,
    };
  }

  private static async handleCleanerCancellation(
    input: CancellationInput,
    isEmergency: boolean
  ): Promise<CancellationFeeBreakdown> {
    const { heldCredits } = input;

    // Client always gets full refund when cleaner cancels
    return {
      window: null,
      baseFeePct: 0,
      feePct: 0,
      graceUsed: false,
      feeCredits: 0,
      refundCredits: heldCredits,
      cleanerCompCredits: 0,
      platformCompCredits: 0,
      bonusCreditsToClient: 0,
    };
  }

  private static async handleClientNoShow(
    input: CancellationInput
  ): Promise<CancellationFeeBreakdown> {
    const { heldCredits } = input;

    // 100% fee, no grace allowed, majority to cleaner
    const feePct = 100;
    const feeCredits = heldCredits;
    const refundCredits = 0;

    const cleanerCompCredits = Math.round(
      feeCredits * cfg.feeSplits.clientNoShowCleanerCompPct
    );
    const platformCompCredits = feeCredits - cleanerCompCredits;

    return {
      window: null,
      baseFeePct: 100,
      feePct,
      graceUsed: false,
      feeCredits,
      refundCredits,
      cleanerCompCredits,
      platformCompCredits,
      bonusCreditsToClient: 0,
    };
  }

  private static async handleCleanerNoShow(
    input: CancellationInput
  ): Promise<CancellationFeeBreakdown> {
    const { heldCredits } = input;

    // Full refund + bonus credits to client, cleaner gets nothing
    const bonus = cfg.bonusCredits.cleanerNoShowToClient;

    return {
      window: null,
      baseFeePct: 0,
      feePct: 0,
      graceUsed: false,
      feeCredits: 0,
      refundCredits: heldCredits,
      cleanerCompCredits: 0,
      platformCompCredits: 0,
      bonusCreditsToClient: bonus,
    };
  }

  private static async handleSystemCancel(
    input: CancellationInput
  ): Promise<CancellationFeeBreakdown> {
    const { heldCredits } = input;

    // Platform error: full refund + apology credits
    const bonus = cfg.bonusCredits.systemErrorToClient;

    return {
      window: null,
      baseFeePct: 0,
      feePct: 0,
      graceUsed: false,
      feeCredits: 0,
      refundCredits: heldCredits,
      cleanerCompCredits: 0,
      platformCompCredits: 0,
      bonusCreditsToClient: bonus,
    };
  }

  // ============================================
  // Risk & Reliability Event Logging
  // ============================================

  private static async logRiskAndReliabilityEvents(params: {
    input: CancellationInput;
    window: CancellationWindow | null;
    hoursBefore: number;
    feeBreakdown: CancellationFeeBreakdown;
    cancellationEventId: number;
  }): Promise<void> {
    const { input, window, feeBreakdown, cancellationEventId, hoursBefore } = params;
    const { type, clientId, cleanerId, jobId, isEmergency } = input;

    const clientRiskEvents: ClientRiskEvent[] = [];
    const cleanerEvents: CleanerEvent[] = [];

    switch (type) {
      case 'client_cancel_normal':
      case 'client_cancel_after_reschedule_declined': {
        if (window === '50%' || window === '100%') {
          let weight: number;
          
          if (feeBreakdown.graceUsed) {
            weight = window === '50%'
              ? cfg.riskWeights.clientLateCancel24_48WithGrace
              : cfg.riskWeights.clientLateCancelLt24WithGrace;
          } else {
            weight = window === '50%'
              ? cfg.riskWeights.clientLateCancel24_48
              : cfg.riskWeights.clientLateCancelLt24;
          }

          if (type === 'client_cancel_after_reschedule_declined') {
            weight += cfg.riskWeights.clientExtraAfterDeclined;
          }

          clientRiskEvents.push({
            clientId,
            jobId,
            eventType: `cancel_${window === '50%' ? '24_48' : 'lt24'}`,
            weight,
            metadata: {
              afterRescheduleDeclined: type === 'client_cancel_after_reschedule_declined',
              graceUsed: feeBreakdown.graceUsed,
              cancellationEventId,
            },
          });
        }
        break;
      }

      case 'client_no_show': {
        clientRiskEvents.push({
          clientId,
          jobId,
          eventType: 'client_no_show',
          weight: cfg.riskWeights.clientNoShow,
          metadata: { cancellationEventId },
        });
        break;
      }

      case 'cleaner_cancel_normal':
      case 'cleaner_cancel_emergency': {
        const w = computeWindow(hoursBefore);

        let weight = 0;
        if (w === '50%') {
          weight = cfg.reliabilityWeights.cleanerCancel24_48;
        } else if (w === '100%') {
          weight = cfg.reliabilityWeights.cleanerCancelLt24;
        }

        if (type === 'cleaner_cancel_emergency' && weight !== 0) {
          // Softer penalty for emergencies
          weight = cfg.reliabilityWeights.cleanerEmergencyCancelAdjustment;
        }

        if (weight !== 0) {
          cleanerEvents.push({
            cleanerId,
            jobId,
            eventType: 'cleaner_cancel',
            weight,
            metadata: { cancellationEventId, emergency: isEmergency },
          });
        }
        break;
      }

      case 'cleaner_no_show': {
        cleanerEvents.push({
          cleanerId,
          jobId,
          eventType: 'cleaner_no_show',
          weight: cfg.reliabilityWeights.cleanerNoShow,
          metadata: { cancellationEventId },
        });
        break;
      }

      case 'system_cancel': {
        // No risk or reliability events for system cancellations
        break;
      }
    }

    // Persist events
    if (clientRiskEvents.length) {
      await this.persistClientRiskEvents(clientRiskEvents);
    }
    if (cleanerEvents.length) {
      await this.persistCleanerEvents(cleanerEvents);
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  private static async getClientProfile(clientId: number): Promise<ClientProfile> {
    const result = await query<{
      id: string;
      grace_cancellations_total: number;
      grace_cancellations_used: number;
    }>(
      `SELECT 
        user_id as id,
        COALESCE(grace_cancellations_total, 2) as grace_cancellations_total,
        COALESCE(grace_cancellations_used, 0) as grace_cancellations_used
       FROM client_profiles 
       WHERE user_id = $1`,
      [String(clientId)]
    );

    if (result.rows.length === 0) {
      // Return defaults if no profile exists
      return {
        id: clientId,
        graceCancellationsTotal: 2,
        graceCancellationsUsed: 0,
      };
    }

    const row = result.rows[0];
    return {
      id: clientId,
      graceCancellationsTotal: row.grace_cancellations_total,
      graceCancellationsUsed: row.grace_cancellations_used,
    };
  }

  private static async updateGraceUsage(clientId: number, newUsed: number): Promise<void> {
    await query(
      `UPDATE client_profiles 
       SET grace_cancellations_used = $2, updated_at = NOW() 
       WHERE user_id = $1`,
      [String(clientId), newUsed]
    );

    // Also record in grace_cancellations table
    await query(
      `INSERT INTO grace_cancellations (client_id) VALUES ($1)`,
      [String(clientId)]
    );

    logger.info("grace_cancellation_used", { clientId, newUsed });
  }

  private static async persistCancellationEvent(event: Partial<CancellationEvent> & { 
    type?: CancellationType;
    bonusCreditsToClient?: number;
  }): Promise<{ id: number }> {
    const result = await query<{ id: string }>(
      `INSERT INTO cancellation_events (
        job_id, cancelled_by, type, t_cancel, hours_before_start,
        bucket, reason_code, after_reschedule_declined, fee_pct,
        fee_credits, refund_credits, cleaner_comp_credits, platform_comp_credits,
        grace_used, bonus_credits_to_client
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        event.jobId,
        event.cancelledBy,
        event.type,
        event.tCancel,
        event.hoursBeforeStart,
        event.bucket,
        event.reasonCode,
        event.afterRescheduleDeclined,
        event.feePct,
        event.feeCredits,
        event.refundCredits,
        event.cleanerCompCredits,
        event.platformCompCredits,
        event.graceUsed,
        event.bonusCreditsToClient || 0,
      ]
    );

    return { id: Number(result.rows[0].id) };
  }

  private static async applyCredits(params: {
    jobId: number;
    clientId: number;
    cleanerId: number;
    heldCredits: number;
    feeBreakdown: CancellationFeeBreakdown;
  }): Promise<void> {
    const { jobId, clientId, cleanerId, feeBreakdown } = params;
    const { refundCredits, cleanerCompCredits, bonusCreditsToClient } = feeBreakdown;

    // Refund credits to client
    if (refundCredits > 0) {
      await query(
        `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'refund')`,
        [String(clientId), String(jobId), refundCredits]
      );
    }

    // Cleaner compensation credits
    if (cleanerCompCredits > 0) {
      await query(
        `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'job_release')`,
        [String(cleanerId), String(jobId), cleanerCompCredits]
      );
    }

    // Bonus credits to client (for cleaner no-show / system error)
    if (bonusCreditsToClient > 0) {
      await query(
        `INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'adjustment')`,
        [String(clientId), String(jobId), bonusCreditsToClient]
      );
    }
  }

  private static async persistClientRiskEvents(events: ClientRiskEvent[]): Promise<void> {
    for (const event of events) {
      await query(
        `INSERT INTO client_risk_events (
          client_id, job_id, event_type, weight, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
        [
          String(event.clientId),
          event.jobId ? String(event.jobId) : null,
          event.eventType,
          event.weight,
          JSON.stringify(event.metadata || {}),
        ]
      );
    }
  }

  private static async persistCleanerEvents(events: CleanerEvent[]): Promise<void> {
    for (const event of events) {
      await query(
        `INSERT INTO cleaner_events (
          cleaner_id, job_id, event_type, weight, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
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

// ============================================
// Legacy Compatibility Wrapper
// ============================================

/**
 * Simple cancellation function for backwards compatibility
 */
export async function cancelJobSimple(
  job: { id: number; clientId: number; cleanerId: number; startTime: Date; heldCredits: number; status: string },
  cancelledBy: CancellationActor,
  reasonCode: string | null,
  opts: CancelOptions = {}
): Promise<CancellationResult> {
  const type: CancellationType = 
    cancelledBy === 'client' ? 'client_cancel_normal' :
    cancelledBy === 'cleaner' ? 'cleaner_cancel_normal' :
    'system_cancel';

  return CancellationServiceV2.processCancellation({
    jobId: job.id,
    clientId: job.clientId,
    cleanerId: job.cleanerId,
    scheduledStart: job.startTime,
    now: new Date(),
    actor: cancelledBy,
    type,
    reasonCode,
    wasRescheduleContext: false,
    jobStatusAtCancellation: job.status,
    heldCredits: job.heldCredits,
    isEmergency: false,
  });
}

