"use strict";
// src/core/clientRiskService.ts
// Client Risk Score System - Full Implementation
//
// Implements:
// - Event-driven risk calculation
// - Pattern detection (3+ late reschedules in 14 days)
// - Time-based decay (-2 per week with no events)
// - Risk bands and their effects
// - Nightly cron recompute
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientRiskService = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const scoring_1 = require("./scoring");
const config_1 = require("./config");
const timeBuckets_1 = require("./timeBuckets");
// ============================================
// Main Service
// ============================================
class ClientRiskService {
    /**
     * Recompute risk score for a single client
     */
    static async recomputeForClient(clientId) {
        const now = new Date();
        const longWindowDays = config_1.CLIENT_RISK_CONFIG.windows.longDays;
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
        logger_1.logger.info("client_risk_recomputed", {
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
    static async recomputeAllClients() {
        const clients = await this.getActiveClients();
        let processed = 0;
        let failed = 0;
        for (const client of clients) {
            try {
                await this.recomputeForClient(client.id);
                processed++;
            }
            catch (err) {
                logger_1.logger.error("client_risk_recompute_failed", {
                    clientId: client.id,
                    error: err.message,
                });
                failed++;
            }
        }
        logger_1.logger.info("client_risk_recompute_all_completed", {
            processed,
            failed,
            total: clients.length,
        });
        return { processed, failed };
    }
    /**
     * Get current risk score for a client
     */
    static async getRiskScore(clientId) {
        const result = await (0, client_1.query)(`SELECT client_id, risk_score, risk_band, last_recomputed_at
       FROM client_risk_scores
       WHERE client_id = $1`, [String(clientId)]);
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
    static async logRiskEvent(event) {
        await (0, client_1.query)(`INSERT INTO client_risk_events (client_id, job_id, event_type, weight, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`, [
            String(event.clientId),
            event.jobId ? String(event.jobId) : null,
            event.eventType,
            event.weight,
            JSON.stringify(event.metadata || {}),
        ]);
        logger_1.logger.info("client_risk_event_logged", {
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
    static computeRiskFromEvents(clientId, eventsLast60, now) {
        const shortWindowDays = config_1.CLIENT_RISK_CONFIG.windows.shortDays;
        // Filter events from last 14 days
        const eventsLast14 = eventsLast60.filter(e => (0, timeBuckets_1.daysAgo)(e.createdAt, now) <= shortWindowDays);
        // Calculate raw base risk and track specific event types
        let baseRisk = 0;
        let cardDeclineCount = 0;
        let cardDeclineWeightRaw = 0;
        let disputeClientAtFaultWeightRaw = 0;
        for (const ev of eventsLast60) {
            baseRisk += ev.weight;
            if (ev.eventType === 'card_decline') {
                cardDeclineCount++;
                cardDeclineWeightRaw += ev.weight;
            }
            if (ev.eventType === 'dispute_client_at_fault') {
                disputeClientAtFaultWeightRaw += ev.weight;
            }
        }
        // Apply caps on specific event classes
        // Disputes where client at fault: max +20
        const disputeMax = config_1.CLIENT_RISK_CONFIG.caps.disputeClientAtFaultMax;
        if (disputeClientAtFaultWeightRaw > disputeMax) {
            const excess = disputeClientAtFaultWeightRaw - disputeMax;
            baseRisk -= excess;
        }
        // Card declines: capped at total +3
        const cardMax = config_1.CLIENT_RISK_CONFIG.caps.cardDeclineTotalMax;
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
        const lateReschedLt24Count14d = eventsLast14.filter(e => e.eventType === 'late_reschedule_lt24').length;
        if (lateReschedLt24Count14d >= config_1.CLIENT_RISK_CONFIG.patterns.lateReschedulePatternThreshold) {
            patterns.lateReschedulePattern14d = config_1.CLIENT_RISK_CONFIG.patterns.lateReschedulePatternBonus;
            baseRisk += patterns.lateReschedulePattern14d;
        }
        // Inconvenience patterns (already logged as events with weights)
        const inconveniencePatternEvents = eventsLast60.filter(e => e.eventType === 'inconvenience_pattern');
        patterns.inconveniencePattern = inconveniencePatternEvents.reduce((sum, e) => sum + e.weight, 0);
        // High inconvenience count for stats
        const highInconvenienceCount = eventsLast14.filter(e => e.eventType === 'high_inconvenience').length;
        // Time-based decay: -2 per full week with no new negative events
        const lastNegativeAt = this.getLastNegativeEventAt(eventsLast60);
        let decayApplied = 0;
        if (lastNegativeAt) {
            const diffMs = now.getTime() - lastNegativeAt.getTime();
            const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
            if (weeks > 0) {
                const decay = weeks * config_1.CLIENT_RISK_CONFIG.decay.pointsPerWeek;
                decayApplied = Math.min(decay, baseRisk);
                baseRisk -= decayApplied;
            }
        }
        // Final clamp and band
        const riskScore = (0, scoring_1.clampScore)(baseRisk, 0, 100);
        const riskBand = (0, scoring_1.computeRiskBand)(riskScore);
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
    static getLastNegativeEventAt(events) {
        const negativeEvents = events.filter(e => e.weight > 0);
        if (negativeEvents.length === 0)
            return null;
        return negativeEvents.reduce((latest, e) => (e.createdAt > latest ? e.createdAt : latest), negativeEvents[0].createdAt);
    }
    // ============================================
    // Risk Band Effects (for other services to use)
    // ============================================
    /**
     * Check if client can use grace cancellations based on risk band
     * High and Critical risk clients cannot use grace for late windows
     */
    static canUseGraceCancellation(riskBand, window) {
        if (riskBand === 'high' || riskBand === 'critical') {
            if (window === '50%' || window === '100%') {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if client can reschedule within <24h
     * High and Critical risk clients must cancel instead
     */
    static canRescheduleLt24(riskBand) {
        return riskBand !== 'high' && riskBand !== 'critical';
    }
    /**
     * Check if Elite cleaners should be shown to this client
     * Deprioritize for high-risk clients
     */
    static shouldShowEliteCleaners(riskBand) {
        return riskBand !== 'high' && riskBand !== 'critical';
    }
    // ============================================
    // Database Operations
    // ============================================
    static async getEventsForClientSince(clientId, since) {
        const result = await (0, client_1.query)(`SELECT id, client_id, job_id, event_type, weight, metadata, created_at
       FROM client_risk_events
       WHERE client_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`, [String(clientId), since.toISOString()]);
        return result.rows.map(row => ({
            id: Number(row.id),
            clientId: Number(row.client_id),
            jobId: row.job_id ? Number(row.job_id) : null,
            eventType: row.event_type,
            weight: Number(row.weight),
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
        }));
    }
    static async getActiveClients() {
        // Get clients who have had activity in the last 60 days
        const result = await (0, client_1.query)(`SELECT DISTINCT u.id
       FROM users u
       WHERE u.role = 'client'
       AND (
         EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = u.id AND j.created_at > NOW() - INTERVAL '60 days')
         OR EXISTS (SELECT 1 FROM client_risk_events e WHERE e.client_id = u.id AND e.created_at > NOW() - INTERVAL '60 days')
       )`);
        return result.rows.map(row => ({ id: Number(row.id) }));
    }
    static async upsertRiskScore(score) {
        await (0, client_1.query)(`INSERT INTO client_risk_scores (client_id, risk_score, risk_band, last_recomputed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO UPDATE
       SET risk_score = $2, risk_band = $3, last_recomputed_at = $4`, [
            String(score.clientId),
            score.riskScore,
            score.riskBand,
            score.lastRecomputedAt.toISOString(),
        ]);
    }
    static async logScoreSnapshot(calc, timestamp) {
        await (0, client_1.query)(`INSERT INTO client_risk_score_snapshots (
        client_id, risk_score, risk_band, base_risk, 
        pattern_bonuses, decay_applied, stats, created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`, [
            String(calc.clientId),
            calc.riskScore,
            calc.riskBand,
            calc.baseRisk,
            JSON.stringify(calc.patternBonuses),
            calc.decayApplied,
            JSON.stringify(calc.stats),
            timestamp.toISOString(),
        ]);
    }
}
exports.ClientRiskService = ClientRiskService;
