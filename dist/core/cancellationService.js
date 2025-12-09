"use strict";
// src/core/cancellationService.ts
// Cancellation System v2 - Full implementation
//
// Implements:
// - Time windows: 0% (>48h), 50% (24-48h), 100% (<24h)
// - Grace cancellations (2 per client lifetime)
// - Fee/credit routing (client refund, cleaner comp, platform fee)
// - No-show handling (client and cleaner)
// - Risk/reliability event logging
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationServiceV2 = void 0;
exports.cancelJobSimple = cancelJobSimple;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const timeBuckets_1 = require("./timeBuckets");
const config_1 = require("./config");
// ============================================
// Main Service
// ============================================
class CancellationServiceV2 {
    /**
     * Main entrypoint: process a cancellation or no-show.
     */
    static async processCancellation(input) {
        const { jobId, clientId, cleanerId, scheduledStart, now, actor, type, reasonCode, wasRescheduleContext, jobStatusAtCancellation, heldCredits, isEmergency, } = input;
        // Load client profile for grace cancellations
        const client = await this.getClientProfile(clientId);
        const hoursBefore = (0, timeBuckets_1.computeHoursBeforeStart)(scheduledStart, now);
        const window = type === 'client_cancel_normal' || type === 'client_cancel_after_reschedule_declined'
            ? (0, timeBuckets_1.computeWindow)(hoursBefore)
            : null;
        // Calculate fee breakdown based on cancellation type
        let feeBreakdown;
        switch (type) {
            case 'client_cancel_normal':
            case 'client_cancel_after_reschedule_declined':
                feeBreakdown = await this.handleClientCancellation(input, client, window, hoursBefore);
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
        const bucket = hoursBefore > 0 ? (0, timeBuckets_1.getTimeBucket)(hoursBefore) : 'no_show';
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
        await (0, events_1.publishEvent)({
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
        logger_1.logger.info("cancellation_processed", {
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
    static async handleClientCancellation(input, client, window, hoursBefore) {
        const { heldCredits, isEmergency } = input;
        if (!window) {
            // After start time - should be no-show, not cancellation
            throw new Error('client_cancel called after start time – use client_no_show instead');
        }
        const baseFeePct = (0, timeBuckets_1.baseFeePctForWindow)(window);
        // Grace cancellation logic
        const graceRemaining = client.graceCancellationsTotal - client.graceCancellationsUsed;
        let feePct = baseFeePct;
        let graceUsed = false;
        const isClientInitiated = input.actor === 'client';
        if (isClientInitiated &&
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
            const split = config_1.CANCELLATION_CONFIG.feeSplits.byWindow(window);
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
    static async handleCleanerCancellation(input, isEmergency) {
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
    static async handleClientNoShow(input) {
        const { heldCredits } = input;
        // 100% fee, no grace allowed, majority to cleaner
        const feePct = 100;
        const feeCredits = heldCredits;
        const refundCredits = 0;
        const cleanerCompCredits = Math.round(feeCredits * config_1.CANCELLATION_CONFIG.feeSplits.clientNoShowCleanerCompPct);
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
    static async handleCleanerNoShow(input) {
        const { heldCredits } = input;
        // Full refund + bonus credits to client, cleaner gets nothing
        const bonus = config_1.CANCELLATION_CONFIG.bonusCredits.cleanerNoShowToClient;
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
    static async handleSystemCancel(input) {
        const { heldCredits } = input;
        // Platform error: full refund + apology credits
        const bonus = config_1.CANCELLATION_CONFIG.bonusCredits.systemErrorToClient;
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
    static async logRiskAndReliabilityEvents(params) {
        const { input, window, feeBreakdown, cancellationEventId, hoursBefore } = params;
        const { type, clientId, cleanerId, jobId, isEmergency } = input;
        const clientRiskEvents = [];
        const cleanerEvents = [];
        switch (type) {
            case 'client_cancel_normal':
            case 'client_cancel_after_reschedule_declined': {
                if (window === '50%' || window === '100%') {
                    let weight;
                    if (feeBreakdown.graceUsed) {
                        weight = window === '50%'
                            ? config_1.CANCELLATION_CONFIG.riskWeights.clientLateCancel24_48WithGrace
                            : config_1.CANCELLATION_CONFIG.riskWeights.clientLateCancelLt24WithGrace;
                    }
                    else {
                        weight = window === '50%'
                            ? config_1.CANCELLATION_CONFIG.riskWeights.clientLateCancel24_48
                            : config_1.CANCELLATION_CONFIG.riskWeights.clientLateCancelLt24;
                    }
                    if (type === 'client_cancel_after_reschedule_declined') {
                        weight += config_1.CANCELLATION_CONFIG.riskWeights.clientExtraAfterDeclined;
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
                    weight: config_1.CANCELLATION_CONFIG.riskWeights.clientNoShow,
                    metadata: { cancellationEventId },
                });
                break;
            }
            case 'cleaner_cancel_normal':
            case 'cleaner_cancel_emergency': {
                const w = (0, timeBuckets_1.computeWindow)(hoursBefore);
                let weight = 0;
                if (w === '50%') {
                    weight = config_1.CANCELLATION_CONFIG.reliabilityWeights.cleanerCancel24_48;
                }
                else if (w === '100%') {
                    weight = config_1.CANCELLATION_CONFIG.reliabilityWeights.cleanerCancelLt24;
                }
                if (type === 'cleaner_cancel_emergency' && weight !== 0) {
                    // Softer penalty for emergencies
                    weight = config_1.CANCELLATION_CONFIG.reliabilityWeights.cleanerEmergencyCancelAdjustment;
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
                    weight: config_1.CANCELLATION_CONFIG.reliabilityWeights.cleanerNoShow,
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
    static async getClientProfile(clientId) {
        const result = await (0, client_1.query)(`SELECT 
        user_id as id,
        COALESCE(grace_cancellations_total, 2) as grace_cancellations_total,
        COALESCE(grace_cancellations_used, 0) as grace_cancellations_used
       FROM client_profiles 
       WHERE user_id = $1`, [String(clientId)]);
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
    static async updateGraceUsage(clientId, newUsed) {
        await (0, client_1.query)(`UPDATE client_profiles 
       SET grace_cancellations_used = $2, updated_at = NOW() 
       WHERE user_id = $1`, [String(clientId), newUsed]);
        // Also record in grace_cancellations table
        await (0, client_1.query)(`INSERT INTO grace_cancellations (client_id) VALUES ($1)`, [String(clientId)]);
        logger_1.logger.info("grace_cancellation_used", { clientId, newUsed });
    }
    static async persistCancellationEvent(event) {
        const result = await (0, client_1.query)(`INSERT INTO cancellation_events (
        job_id, cancelled_by, type, t_cancel, hours_before_start,
        bucket, reason_code, after_reschedule_declined, fee_pct,
        fee_credits, refund_credits, cleaner_comp_credits, platform_comp_credits,
        grace_used, bonus_credits_to_client
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`, [
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
        ]);
        return { id: Number(result.rows[0].id) };
    }
    static async applyCredits(params) {
        const { jobId, clientId, cleanerId, feeBreakdown } = params;
        const { refundCredits, cleanerCompCredits, bonusCreditsToClient } = feeBreakdown;
        // Refund credits to client
        if (refundCredits > 0) {
            await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'refund')`, [String(clientId), String(jobId), refundCredits]);
        }
        // Cleaner compensation credits
        if (cleanerCompCredits > 0) {
            await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'job_release')`, [String(cleanerId), String(jobId), cleanerCompCredits]);
        }
        // Bonus credits to client (for cleaner no-show / system error)
        if (bonusCreditsToClient > 0) {
            await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
         VALUES ($1, $2, $3, 'adjustment')`, [String(clientId), String(jobId), bonusCreditsToClient]);
        }
    }
    static async persistClientRiskEvents(events) {
        for (const event of events) {
            await (0, client_1.query)(`INSERT INTO client_risk_events (
          client_id, job_id, event_type, weight, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`, [
                String(event.clientId),
                event.jobId ? String(event.jobId) : null,
                event.eventType,
                event.weight,
                JSON.stringify(event.metadata || {}),
            ]);
        }
    }
    static async persistCleanerEvents(events) {
        for (const event of events) {
            await (0, client_1.query)(`INSERT INTO cleaner_events (
          cleaner_id, job_id, event_type, weight, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`, [
                String(event.cleanerId),
                event.jobId ? String(event.jobId) : null,
                event.eventType,
                event.weight,
                JSON.stringify(event.metadata || {}),
            ]);
        }
    }
}
exports.CancellationServiceV2 = CancellationServiceV2;
// ============================================
// Legacy Compatibility Wrapper
// ============================================
/**
 * Simple cancellation function for backwards compatibility
 */
async function cancelJobSimple(job, cancelledBy, reasonCode, opts = {}) {
    const type = cancelledBy === 'client' ? 'client_cancel_normal' :
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
