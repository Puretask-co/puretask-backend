"use strict";
// src/core/db/clientRiskDb.ts
// Database layer for Client Risk Score Engine (Tasks 2.1-2.5)
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_RISK_EVENT_WEIGHTS = void 0;
exports.sumClientRiskEventWeightsSince = sumClientRiskEventWeightsSince;
exports.clientRiskEventsExistSince = clientRiskEventsExistSince;
exports.getClientsWithEventsSince = getClientsWithEventsSince;
exports.upsertClientRiskScore = upsertClientRiskScore;
exports.getClientRiskScore = getClientRiskScore;
exports.insertClientRiskEvent = insertClientRiskEvent;
exports.logClientRiskEvents = logClientRiskEvents;
exports.logLateRescheduleEvent = logLateRescheduleEvent;
exports.logLateReschedulePatternEvent = logLateReschedulePatternEvent;
exports.logCancellationEvent = logCancellationEvent;
exports.logClientNoShowEvent = logClientNoShowEvent;
exports.logCardDeclineEvent = logCardDeclineEvent;
exports.logChargebackEvent = logChargebackEvent;
exports.logAbuseFlagEvent = logAbuseFlagEvent;
exports.countLateReschedulesLast14Days = countLateReschedulesLast14Days;
exports.getActiveClients = getActiveClients;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
// ============================================
// 2.1 - Sum Risk Event Weights Since
// ============================================
/**
 * Task 2.1: db.clientRiskEvents.sumWeightsSince(clientId, days)
 *
 * Returns sum of all risk event weights for a client within the last N days.
 */
async function sumClientRiskEventWeightsSince(clientId, days) {
    const result = await (0, client_1.query)(`SELECT COALESCE(SUM(weight), 0)::text as sum
     FROM client_risk_events
     WHERE client_id = $1
     AND created_at >= NOW() - INTERVAL '1 day' * $2`, [String(clientId), days]);
    return Number(result.rows[0]?.sum || 0);
}
// ============================================
// 2.2 - Check if Events Exist Since
// ============================================
/**
 * Task 2.2: db.clientRiskEvents.existsSince(clientId, days)
 *
 * Returns true if there are any risk events for the client within last N days.
 * Used for decay logic (-2 per week with no events).
 */
async function clientRiskEventsExistSince(clientId, days) {
    const result = await (0, client_1.query)(`SELECT EXISTS(
      SELECT 1 FROM client_risk_events
      WHERE client_id = $1
      AND created_at >= NOW() - INTERVAL '1 day' * $2
      AND weight > 0
    ) as exists`, [String(clientId), days]);
    return result.rows[0]?.exists ?? false;
}
// ============================================
// 2.3 - Get Clients with Events Since
// ============================================
/**
 * Task 2.3: db.clientRiskEvents.getClientsWithEventsSince(days)
 *
 * Returns list of client IDs who have had risk events in the last N days.
 * Used for daily recompute job.
 */
async function getClientsWithEventsSince(days) {
    const result = await (0, client_1.query)(`SELECT DISTINCT client_id
     FROM client_risk_events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1`, [days]);
    return result.rows.map(row => Number(row.client_id));
}
// ============================================
// 2.4 - Upsert Client Risk Score
// ============================================
/**
 * Task 2.4: db.clientRiskScores.upsert({ clientId, riskScore, riskBand })
 *
 * Updates or inserts the client's current risk score and band.
 */
async function upsertClientRiskScore(data) {
    await (0, client_1.query)(`INSERT INTO client_risk_scores (client_id, risk_score, risk_band, last_recomputed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (client_id) DO UPDATE SET
       risk_score = $2,
       risk_band = $3,
       last_recomputed_at = NOW()`, [String(data.clientId), data.riskScore, data.riskBand]);
    logger_1.logger.info("client_risk_score_updated", {
        clientId: data.clientId,
        riskScore: data.riskScore,
        riskBand: data.riskBand,
    });
}
/**
 * Get current risk score for a client
 */
async function getClientRiskScore(clientId) {
    const result = await (0, client_1.query)(`SELECT client_id, risk_score, risk_band, last_recomputed_at
     FROM client_risk_scores
     WHERE client_id = $1`, [String(clientId)]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        clientId: Number(row.client_id),
        riskScore: Number(row.risk_score),
        riskBand: row.risk_band,
        updatedAt: new Date(row.last_recomputed_at),
    };
}
// ============================================
// 2.5 - Event Producers (Insert Functions)
// ============================================
/**
 * Task 2.5: db.clientRiskEvents.insert({...})
 *
 * Insert a single client risk event.
 */
async function insertClientRiskEvent(event) {
    const result = await (0, client_1.query)(`INSERT INTO client_risk_events (client_id, job_id, event_type, weight, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     RETURNING id`, [
        String(event.clientId),
        event.jobId ? String(event.jobId) : null,
        event.eventType,
        event.weight,
        JSON.stringify(event.metadata || {}),
    ]);
    logger_1.logger.info("client_risk_event_inserted", {
        clientId: event.clientId,
        eventType: event.eventType,
        weight: event.weight,
    });
    return Number(result.rows[0].id);
}
/**
 * Log multiple client risk events at once
 */
async function logClientRiskEvents(events) {
    for (const event of events) {
        await insertClientRiskEvent(event);
    }
}
// ============================================
// Event Type Constants & Weights
// ============================================
exports.CLIENT_RISK_EVENT_WEIGHTS = {
    // Reschedule events
    late_reschedule_lt24: 1,
    late_reschedule_pattern: 10, // 3+ in 14 days
    // Cancellation events
    cancel_24_48: 3,
    cancel_24_48_with_grace: 1,
    cancel_lt24: 5,
    cancel_lt24_with_grace: 2,
    cancel_after_decline: 1,
    // No-show
    no_show: 20,
    // Disputes
    dispute_client_at_fault: 10,
    // Payment issues
    card_decline: 1, // capped at 3 total
    chargeback: 20,
    // Inconvenience patterns
    inconvenience_pattern_3: 5, // 3+ high inconvenience
    inconvenience_pattern_5: 5, // 5+ (additional)
    // Manual flags
    abuse_flag: 20,
};
// ============================================
// Specialized Event Producers
// ============================================
/**
 * Log a late reschedule event (<24h)
 */
async function logLateRescheduleEvent(clientId, jobId, rescheduleId) {
    await insertClientRiskEvent({
        clientId,
        jobId,
        eventType: 'late_reschedule_lt24',
        weight: exports.CLIENT_RISK_EVENT_WEIGHTS.late_reschedule_lt24,
        metadata: { rescheduleId },
    });
}
/**
 * Log a late reschedule pattern event (3+ in 14 days)
 */
async function logLateReschedulePatternEvent(clientId, jobId, count14d) {
    await insertClientRiskEvent({
        clientId,
        jobId,
        eventType: 'late_reschedule_pattern',
        weight: exports.CLIENT_RISK_EVENT_WEIGHTS.late_reschedule_pattern,
        metadata: { count14d },
    });
}
/**
 * Log a cancellation event
 */
async function logCancellationEvent(clientId, jobId, bucket, graceUsed, afterRescheduleDeclined) {
    let eventType;
    let weight;
    if (bucket === 'gt48') {
        return; // No risk for early cancellations
    }
    else if (bucket === '24_48') {
        eventType = graceUsed ? 'cancel_24_48_grace' : 'cancel_24_48';
        weight = graceUsed
            ? exports.CLIENT_RISK_EVENT_WEIGHTS.cancel_24_48_with_grace
            : exports.CLIENT_RISK_EVENT_WEIGHTS.cancel_24_48;
    }
    else {
        eventType = graceUsed ? 'cancel_lt24_grace' : 'cancel_lt24';
        weight = graceUsed
            ? exports.CLIENT_RISK_EVENT_WEIGHTS.cancel_lt24_with_grace
            : exports.CLIENT_RISK_EVENT_WEIGHTS.cancel_lt24;
    }
    await insertClientRiskEvent({
        clientId,
        jobId,
        eventType,
        weight,
        metadata: { graceUsed, bucket },
    });
    // Additional weight for cancel after reschedule declined
    if (afterRescheduleDeclined) {
        await insertClientRiskEvent({
            clientId,
            jobId,
            eventType: 'cancel_after_decline',
            weight: exports.CLIENT_RISK_EVENT_WEIGHTS.cancel_after_decline,
            metadata: {},
        });
    }
}
/**
 * Log a client no-show event
 */
async function logClientNoShowEvent(clientId, jobId) {
    await insertClientRiskEvent({
        clientId,
        jobId,
        eventType: 'no_show',
        weight: exports.CLIENT_RISK_EVENT_WEIGHTS.no_show,
        metadata: {},
    });
}
/**
 * Log a card decline event (capped at 3)
 */
async function logCardDeclineEvent(clientId, paymentIntentId) {
    // Check current card decline count
    const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count
     FROM client_risk_events
     WHERE client_id = $1
     AND event_type = 'card_decline'
     AND created_at >= NOW() - INTERVAL '60 days'`, [String(clientId)]);
    const currentCount = Number(result.rows[0]?.count || 0);
    if (currentCount < 3) {
        await insertClientRiskEvent({
            clientId,
            eventType: 'card_decline',
            weight: exports.CLIENT_RISK_EVENT_WEIGHTS.card_decline,
            metadata: { paymentIntentId },
        });
    }
}
/**
 * Log a chargeback event
 */
async function logChargebackEvent(clientId, jobId, stripeDisputeId) {
    await insertClientRiskEvent({
        clientId,
        jobId,
        eventType: 'chargeback',
        weight: exports.CLIENT_RISK_EVENT_WEIGHTS.chargeback,
        metadata: { stripeDisputeId },
    });
}
/**
 * Log an abuse/harassment flag
 */
async function logAbuseFlagEvent(clientId, reason, supportUserId) {
    await insertClientRiskEvent({
        clientId,
        eventType: 'abuse_flag',
        weight: exports.CLIENT_RISK_EVENT_WEIGHTS.abuse_flag,
        metadata: { reason, supportUserId },
    });
}
// ============================================
// Pattern Detection Helpers
// ============================================
/**
 * Count late reschedules (<24h) in last N days for a client
 */
async function countLateReschedulesLast14Days(clientId) {
    const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count
     FROM client_risk_events
     WHERE client_id = $1
     AND event_type = 'late_reschedule_lt24'
     AND created_at >= NOW() - INTERVAL '14 days'`, [String(clientId)]);
    return Number(result.rows[0]?.count || 0);
}
/**
 * Get all active clients for daily recompute
 */
async function getActiveClients() {
    const result = await (0, client_1.query)(`SELECT DISTINCT u.id
     FROM users u
     WHERE u.role = 'client'
     AND (
       EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = u.id AND j.created_at > NOW() - INTERVAL '60 days')
       OR EXISTS (SELECT 1 FROM client_risk_events e WHERE e.client_id = u.id AND e.created_at > NOW() - INTERVAL '60 days')
     )`);
    return result.rows.map(row => ({ id: Number(row.id) }));
}
