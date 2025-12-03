// src/core/db/clientRiskDb.ts
// Database layer for Client Risk Score Engine (Tasks 2.1-2.5)

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { RiskBand } from '../scoring';

// ============================================
// Types
// ============================================

export interface ClientRiskEventRecord {
  id: number;
  clientId: number;
  jobId: number | null;
  eventType: string;
  weight: number;
  createdAt: Date;
  metadata: Record<string, any> | null;
}

export interface ClientRiskScoreRecord {
  clientId: number;
  riskScore: number;
  riskBand: RiskBand;
  updatedAt: Date;
}

// ============================================
// 2.1 - Sum Risk Event Weights Since
// ============================================

/**
 * Task 2.1: db.clientRiskEvents.sumWeightsSince(clientId, days)
 * 
 * Returns sum of all risk event weights for a client within the last N days.
 */
export async function sumClientRiskEventWeightsSince(
  clientId: number,
  days: number
): Promise<number> {
  const result = await query<{ sum: string }>(
    `SELECT COALESCE(SUM(weight), 0)::text as sum
     FROM client_risk_events
     WHERE client_id = $1
     AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [String(clientId), days]
  );
  
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
export async function clientRiskEventsExistSince(
  clientId: number,
  days: number
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM client_risk_events
      WHERE client_id = $1
      AND created_at >= NOW() - INTERVAL '1 day' * $2
      AND weight > 0
    ) as exists`,
    [String(clientId), days]
  );
  
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
export async function getClientsWithEventsSince(days: number): Promise<number[]> {
  const result = await query<{ client_id: string }>(
    `SELECT DISTINCT client_id
     FROM client_risk_events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
    [days]
  );
  
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
export async function upsertClientRiskScore(data: {
  clientId: number;
  riskScore: number;
  riskBand: RiskBand;
}): Promise<void> {
  await query(
    `INSERT INTO client_risk_scores (client_id, risk_score, risk_band, last_recomputed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (client_id) DO UPDATE SET
       risk_score = $2,
       risk_band = $3,
       last_recomputed_at = NOW()`,
    [String(data.clientId), data.riskScore, data.riskBand]
  );

  logger.info("client_risk_score_updated", {
    clientId: data.clientId,
    riskScore: data.riskScore,
    riskBand: data.riskBand,
  });
}

/**
 * Get current risk score for a client
 */
export async function getClientRiskScore(clientId: number): Promise<ClientRiskScoreRecord | null> {
  const result = await query<any>(
    `SELECT client_id, risk_score, risk_band, last_recomputed_at
     FROM client_risk_scores
     WHERE client_id = $1`,
    [String(clientId)]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    clientId: Number(row.client_id),
    riskScore: Number(row.risk_score),
    riskBand: row.risk_band as RiskBand,
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
export async function insertClientRiskEvent(event: {
  clientId: number;
  jobId?: number | null;
  eventType: string;
  weight: number;
  metadata?: Record<string, any>;
}): Promise<number> {
  const result = await query<{ id: string }>(
    `INSERT INTO client_risk_events (client_id, job_id, event_type, weight, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     RETURNING id`,
    [
      String(event.clientId),
      event.jobId ? String(event.jobId) : null,
      event.eventType,
      event.weight,
      JSON.stringify(event.metadata || {}),
    ]
  );
  
  logger.info("client_risk_event_inserted", {
    clientId: event.clientId,
    eventType: event.eventType,
    weight: event.weight,
  });
  
  return Number(result.rows[0].id);
}

/**
 * Log multiple client risk events at once
 */
export async function logClientRiskEvents(events: Array<{
  clientId: number;
  jobId?: number | null;
  eventType: string;
  weight: number;
  metadata?: Record<string, any>;
}>): Promise<void> {
  for (const event of events) {
    await insertClientRiskEvent(event);
  }
}

// ============================================
// Event Type Constants & Weights
// ============================================

export const CLIENT_RISK_EVENT_WEIGHTS = {
  // Reschedule events
  late_reschedule_lt24: 1,
  late_reschedule_pattern: 10,  // 3+ in 14 days

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
  card_decline: 1,  // capped at 3 total
  chargeback: 20,

  // Inconvenience patterns
  inconvenience_pattern_3: 5,   // 3+ high inconvenience
  inconvenience_pattern_5: 5,   // 5+ (additional)

  // Manual flags
  abuse_flag: 20,
};

// ============================================
// Specialized Event Producers
// ============================================

/**
 * Log a late reschedule event (<24h)
 */
export async function logLateRescheduleEvent(
  clientId: number,
  jobId: number,
  rescheduleId: number
): Promise<void> {
  await insertClientRiskEvent({
    clientId,
    jobId,
    eventType: 'late_reschedule_lt24',
    weight: CLIENT_RISK_EVENT_WEIGHTS.late_reschedule_lt24,
    metadata: { rescheduleId },
  });
}

/**
 * Log a late reschedule pattern event (3+ in 14 days)
 */
export async function logLateReschedulePatternEvent(
  clientId: number,
  jobId: number,
  count14d: number
): Promise<void> {
  await insertClientRiskEvent({
    clientId,
    jobId,
    eventType: 'late_reschedule_pattern',
    weight: CLIENT_RISK_EVENT_WEIGHTS.late_reschedule_pattern,
    metadata: { count14d },
  });
}

/**
 * Log a cancellation event
 */
export async function logCancellationEvent(
  clientId: number,
  jobId: number,
  bucket: 'gt48' | '24_48' | 'lt24',
  graceUsed: boolean,
  afterRescheduleDeclined: boolean
): Promise<void> {
  let eventType: string;
  let weight: number;

  if (bucket === 'gt48') {
    return; // No risk for early cancellations
  } else if (bucket === '24_48') {
    eventType = graceUsed ? 'cancel_24_48_grace' : 'cancel_24_48';
    weight = graceUsed 
      ? CLIENT_RISK_EVENT_WEIGHTS.cancel_24_48_with_grace 
      : CLIENT_RISK_EVENT_WEIGHTS.cancel_24_48;
  } else {
    eventType = graceUsed ? 'cancel_lt24_grace' : 'cancel_lt24';
    weight = graceUsed 
      ? CLIENT_RISK_EVENT_WEIGHTS.cancel_lt24_with_grace 
      : CLIENT_RISK_EVENT_WEIGHTS.cancel_lt24;
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
      weight: CLIENT_RISK_EVENT_WEIGHTS.cancel_after_decline,
      metadata: {},
    });
  }
}

/**
 * Log a client no-show event
 */
export async function logClientNoShowEvent(
  clientId: number,
  jobId: number
): Promise<void> {
  await insertClientRiskEvent({
    clientId,
    jobId,
    eventType: 'no_show',
    weight: CLIENT_RISK_EVENT_WEIGHTS.no_show,
    metadata: {},
  });
}

/**
 * Log a card decline event (capped at 3)
 */
export async function logCardDeclineEvent(
  clientId: number,
  paymentIntentId: string
): Promise<void> {
  // Check current card decline count
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM client_risk_events
     WHERE client_id = $1
     AND event_type = 'card_decline'
     AND created_at >= NOW() - INTERVAL '60 days'`,
    [String(clientId)]
  );

  const currentCount = Number(result.rows[0]?.count || 0);
  
  if (currentCount < 3) {
    await insertClientRiskEvent({
      clientId,
      eventType: 'card_decline',
      weight: CLIENT_RISK_EVENT_WEIGHTS.card_decline,
      metadata: { paymentIntentId },
    });
  }
}

/**
 * Log a chargeback event
 */
export async function logChargebackEvent(
  clientId: number,
  jobId: number,
  stripeDisputeId: string
): Promise<void> {
  await insertClientRiskEvent({
    clientId,
    jobId,
    eventType: 'chargeback',
    weight: CLIENT_RISK_EVENT_WEIGHTS.chargeback,
    metadata: { stripeDisputeId },
  });
}

/**
 * Log an abuse/harassment flag
 */
export async function logAbuseFlagEvent(
  clientId: number,
  reason: string,
  supportUserId?: string
): Promise<void> {
  await insertClientRiskEvent({
    clientId,
    eventType: 'abuse_flag',
    weight: CLIENT_RISK_EVENT_WEIGHTS.abuse_flag,
    metadata: { reason, supportUserId },
  });
}

// ============================================
// Pattern Detection Helpers
// ============================================

/**
 * Count late reschedules (<24h) in last N days for a client
 */
export async function countLateReschedulesLast14Days(clientId: number): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM client_risk_events
     WHERE client_id = $1
     AND event_type = 'late_reschedule_lt24'
     AND created_at >= NOW() - INTERVAL '14 days'`,
    [String(clientId)]
  );
  
  return Number(result.rows[0]?.count || 0);
}

/**
 * Get all active clients for daily recompute
 */
export async function getActiveClients(): Promise<{ id: number }[]> {
  const result = await query<{ id: string }>(
    `SELECT DISTINCT u.id
     FROM users u
     WHERE u.role = 'client'
     AND (
       EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = u.id AND j.created_at > NOW() - INTERVAL '60 days')
       OR EXISTS (SELECT 1 FROM client_risk_events e WHERE e.client_id = u.id AND e.created_at > NOW() - INTERVAL '60 days')
     )`
  );

  return result.rows.map(row => ({ id: Number(row.id) }));
}

