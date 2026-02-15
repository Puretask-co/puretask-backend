// src/core/clientRiskService.ts
// Client Risk Score System - Full Implementation
//
// Implements:
// - Event-driven risk calculation
// - Pattern detection (3+ late reschedules in 14 days)
// - Time-based decay (-2 per week with no events)
// - Risk bands and their effects
// - Nightly cron recompute

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { ClientRiskEvent } from "./types";
import { clampScore, computeRiskBand, RiskBand } from "./scoring";
import { CLIENT_RISK_CONFIG as cfg, FLEXIBILITY_CONFIG } from "./config";
import { daysAgo } from "./timeBuckets";

// ============================================
// Types
// ============================================

export interface ClientRiskScoreRecord {
  clientId: number;
  riskScore: number;
  riskBand: RiskBand;
  lastRecomputedAt: Date;
}

export interface ClientRiskEventRecord {
  id: number;
  clientId: number;
  jobId: number | null;
  eventType: string;
  weight: number;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface ClientRiskCalculationResult {
  clientId: number;
  riskScore: number;
  riskBand: RiskBand;
  baseRisk: number;
  patternBonuses: {
    lateReschedulePattern14d: number;
    inconveniencePattern: number;
  };
  decayApplied: number;
  stats: {
    eventsLast60: number;
    eventsLast14: number;
    lateReschedulesLt24Count14d: number;
    cardDeclineCount60d: number;
    cardDeclineWeightRaw60d: number;
    disputeClientAtFaultWeightRaw60d: number;
    highInconvenienceCount: number;
  };
}

// ============================================
// Main Service
// ============================================

export class ClientRiskService {
  /**
   * Recompute risk score for a single client
   */
  static async recomputeForClient(clientId: number): Promise<ClientRiskCalculationResult> {
    const now = new Date();

    const longWindowDays = cfg.windows.longDays;
    const since = new Date(now.getTime());
    since.setDate(since.getDate() - longWindowDays);

    const eventsLast60 = await this.getEventsForClientSince(clientId, since);

    const calc = this.computeRiskFromEvents(clientId, eventsLast60, now);

    // Persist the score
    await this.upsertRiskScore({
      clientId: calc.clientId,
      riskScore: calc.riskScore,
      riskBand: calc.riskBand,
      lastRecomputedAt: now,
    });

    // Log snapshot for audit/debugging
    await this.logScoreSnapshot(calc, now);

    logger.info("client_risk_recomputed", {
      clientId,
      riskScore: calc.riskScore,
      riskBand: calc.riskBand,
      baseRisk: calc.baseRisk,
      patternBonuses: calc.patternBonuses,
      decayApplied: calc.decayApplied,
    });

    return calc;
  }

  /**
   * Nightly cron to recompute risk for all active clients
   */
  static async recomputeAllClients(): Promise<{
    processed: number;
    failed: number;
  }> {
    const clients = await this.getActiveClients();

    let processed = 0;
    let failed = 0;

    for (const client of clients) {
      try {
        await this.recomputeForClient(client.id);
        processed++;
      } catch (err) {
        logger.error("client_risk_recompute_failed", {
          clientId: client.id,
          error: (err as Error).message,
        });
        failed++;
      }
    }

    logger.info("client_risk_recompute_all_completed", {
      processed,
      failed,
      total: clients.length,
    });

    return { processed, failed };
  }

  /**
   * Get current risk score for a client
   */
  static async getRiskScore(clientId: number): Promise<ClientRiskScoreRecord | null> {
    const result = await query<any>(
      `SELECT client_id, risk_score, risk_band, last_recomputed_at
       FROM client_risk_scores
       WHERE client_id = $1`,
      [String(clientId)]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      clientId: Number(row.client_id),
      riskScore: Number(row.risk_score),
      riskBand: row.risk_band,
      lastRecomputedAt: new Date(row.last_recomputed_at),
    };
  }

  /**
   * Log a client risk event (called by other services)
   */
  static async logRiskEvent(event: ClientRiskEvent): Promise<void> {
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

    logger.info("client_risk_event_logged", {
      clientId: event.clientId,
      eventType: event.eventType,
      weight: event.weight,
    });
  }

  // ============================================
  // Risk Calculation Logic
  // ============================================

  /**
   * Compute risk score from events
   *
   * Process:
   * 1. Sum all event weights (base risk)
   * 2. Apply caps (card declines, disputes)
   * 3. Apply pattern bonuses (late reschedules, inconvenience)
   * 4. Apply decay (weeks since last negative event)
   * 5. Clamp to 0-100
   */
  private static computeRiskFromEvents(
    clientId: number,
    eventsLast60: ClientRiskEventRecord[],
    now: Date
  ): ClientRiskCalculationResult {
    const shortWindowDays = cfg.windows.shortDays;

    // Filter events from last 14 days
    const eventsLast14 = eventsLast60.filter((e) => daysAgo(e.createdAt, now) <= shortWindowDays);

    // Calculate raw base risk and track specific event types
    let baseRisk = 0;
    let cardDeclineCount = 0;
    let cardDeclineWeightRaw = 0;
    let disputeClientAtFaultWeightRaw = 0;

    for (const ev of eventsLast60) {
      baseRisk += ev.weight;

      if (ev.eventType === "card_decline") {
        cardDeclineCount++;
        cardDeclineWeightRaw += ev.weight;
      }

      if (ev.eventType === "dispute_client_at_fault") {
        disputeClientAtFaultWeightRaw += ev.weight;
      }
    }

    // Apply caps on specific event classes

    // Disputes where client at fault: max +20
    const disputeMax = cfg.caps.disputeClientAtFaultMax;
    if (disputeClientAtFaultWeightRaw > disputeMax) {
      const excess = disputeClientAtFaultWeightRaw - disputeMax;
      baseRisk -= excess;
    }

    // Card declines: capped at total +3
    const cardMax = cfg.caps.cardDeclineTotalMax;
    if (cardDeclineWeightRaw > cardMax) {
      const excess = cardDeclineWeightRaw - cardMax;
      baseRisk -= excess;
    }

    // Pattern bonuses
    const patterns = {
      lateReschedulePattern14d: 0,
      inconveniencePattern: 0,
    };

    // Pattern: 3+ late_reschedule_lt24 in last 14 days → +10
    const lateReschedLt24Count14d = eventsLast14.filter(
      (e) => e.eventType === "late_reschedule_lt24"
    ).length;

    if (lateReschedLt24Count14d >= cfg.patterns.lateReschedulePatternThreshold) {
      patterns.lateReschedulePattern14d = cfg.patterns.lateReschedulePatternBonus;
      baseRisk += patterns.lateReschedulePattern14d;
    }

    // Inconvenience patterns (already logged as events with weights)
    const inconveniencePatternEvents = eventsLast60.filter(
      (e) => e.eventType === "inconvenience_pattern"
    );
    patterns.inconveniencePattern = inconveniencePatternEvents.reduce(
      (sum, e) => sum + e.weight,
      0
    );

    // High inconvenience count for stats
    const highInconvenienceCount = eventsLast14.filter(
      (e) => e.eventType === "high_inconvenience"
    ).length;

    // Time-based decay: -2 per full week with no new negative events
    const lastNegativeAt = this.getLastNegativeEventAt(eventsLast60);
    let decayApplied = 0;

    if (lastNegativeAt) {
      const diffMs = now.getTime() - lastNegativeAt.getTime();
      const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));

      if (weeks > 0) {
        const decay = weeks * cfg.decay.pointsPerWeek;
        decayApplied = Math.min(decay, baseRisk);
        baseRisk -= decayApplied;
      }
    }

    // Final clamp and band
    const riskScore = clampScore(baseRisk, 0, 100);
    const riskBand = computeRiskBand(riskScore);

    return {
      clientId,
      riskScore,
      riskBand,
      baseRisk,
      patternBonuses: {
        lateReschedulePattern14d: patterns.lateReschedulePattern14d,
        inconveniencePattern: patterns.inconveniencePattern,
      },
      decayApplied,
      stats: {
        eventsLast60: eventsLast60.length,
        eventsLast14: eventsLast14.length,
        lateReschedulesLt24Count14d: lateReschedLt24Count14d,
        cardDeclineCount60d: cardDeclineCount,
        cardDeclineWeightRaw60d: cardDeclineWeightRaw,
        disputeClientAtFaultWeightRaw60d: disputeClientAtFaultWeightRaw,
        highInconvenienceCount,
      },
    };
  }

  /**
   * Get the timestamp of the last negative event (weight > 0)
   */
  private static getLastNegativeEventAt(events: ClientRiskEventRecord[]): Date | null {
    const negativeEvents = events.filter((e) => e.weight > 0);
    if (negativeEvents.length === 0) return null;

    return negativeEvents.reduce(
      (latest, e) => (e.createdAt > latest ? e.createdAt : latest),
      negativeEvents[0].createdAt
    );
  }

  // ============================================
  // Risk Band Effects (for other services to use)
  // ============================================

  /**
   * Check if client can use grace cancellations based on risk band
   * High and Critical risk clients cannot use grace for late windows
   */
  static canUseGraceCancellation(riskBand: RiskBand, window: string): boolean {
    if (riskBand === "high" || riskBand === "critical") {
      if (window === "50%" || window === "100%") {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if client can reschedule within <24h
   * High and Critical risk clients must cancel instead
   */
  static canRescheduleLt24(riskBand: RiskBand): boolean {
    return riskBand !== "high" && riskBand !== "critical";
  }

  /**
   * Check if Elite cleaners should be shown to this client
   * Deprioritize for high-risk clients
   */
  static shouldShowEliteCleaners(riskBand: RiskBand): boolean {
    return riskBand !== "high" && riskBand !== "critical";
  }

  // ============================================
  // Database Operations
  // ============================================

  private static async getEventsForClientSince(
    clientId: number,
    since: Date
  ): Promise<ClientRiskEventRecord[]> {
    const result = await query<any>(
      `SELECT id, client_id, job_id, event_type, weight, metadata, created_at
       FROM client_risk_events
       WHERE client_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [String(clientId), since.toISOString()]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      clientId: Number(row.client_id),
      jobId: row.job_id ? Number(row.job_id) : null,
      eventType: row.event_type,
      weight: Number(row.weight),
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    }));
  }

  private static async getActiveClients(): Promise<{ id: number }[]> {
    // Get clients who have had activity in the last 60 days
    const result = await query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       WHERE u.role = 'client'
       AND (
         EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = u.id AND j.created_at > NOW() - INTERVAL '60 days')
         OR EXISTS (SELECT 1 FROM client_risk_events e WHERE e.client_id = u.id AND e.created_at > NOW() - INTERVAL '60 days')
       )`
    );

    return result.rows.map((row) => ({ id: Number(row.id) }));
  }

  private static async upsertRiskScore(score: ClientRiskScoreRecord): Promise<void> {
    await query(
      `INSERT INTO client_risk_scores (client_id, risk_score, risk_band, last_recomputed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO UPDATE
       SET risk_score = $2, risk_band = $3, last_recomputed_at = $4`,
      [
        String(score.clientId),
        score.riskScore,
        score.riskBand,
        score.lastRecomputedAt.toISOString(),
      ]
    );
  }

  private static async logScoreSnapshot(
    calc: ClientRiskCalculationResult,
    timestamp: Date
  ): Promise<void> {
    await query(
      `INSERT INTO client_risk_score_snapshots (
        client_id, risk_score, risk_band, base_risk, 
        pattern_bonuses, decay_applied, stats, created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`,
      [
        String(calc.clientId),
        calc.riskScore,
        calc.riskBand,
        calc.baseRisk,
        JSON.stringify(calc.patternBonuses),
        calc.decayApplied,
        JSON.stringify(calc.stats),
        timestamp.toISOString(),
      ]
    );
  }
}
