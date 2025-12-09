"use strict";
// src/core/inconvenienceService.ts
// Inconvenience Score System (2.2)
//
// Allows:
// - 1-4 rating
// - Pattern detection
// - Hidden metadata
// - No direct penalties
//
// Feeds:
// - Cleaner reliability (slow drift)
// - Client risk score
// - Matching logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.InconvenienceService = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const config_1 = require("./config");
// ============================================
// Main Service
// ============================================
class InconvenienceService {
    /**
     * Log an inconvenience rating
     * NO direct penalties here – only logs
     */
    static async logInconvenience(input) {
        const log = {
            ...input,
            createdAt: new Date(),
        };
        const result = await (0, client_1.query)(`INSERT INTO inconvenience_logs (
        job_id, client_id, cleaner_id, caused_by, rated_by,
        score, related_event_type, related_event_id, reason_code, note, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id`, [
            String(input.jobId),
            String(input.clientId),
            String(input.cleanerId),
            input.causedBy,
            input.ratedBy,
            input.score,
            input.relatedEventType,
            input.relatedEventId,
            input.reasonCode,
            input.note || null,
        ]);
        log.id = Number(result.rows[0].id);
        logger_1.logger.info("inconvenience_logged", {
            id: log.id,
            jobId: input.jobId,
            causedBy: input.causedBy,
            ratedBy: input.ratedBy,
            score: input.score,
        });
        return log;
    }
    /**
     * Nightly pattern detection
     * Converts repeated high-inconvenience patterns into risk/reliability events
     */
    static async runPatternDetection() {
        const now = new Date();
        const cfg = config_1.FLEXIBILITY_CONFIG.inconvenience;
        let clientEventsCreated = 0;
        let cleanerEventsCreated = 0;
        // ======== Client Pattern Detection (last 14 days) ========
        const clientWindowStart = new Date(now.getTime());
        clientWindowStart.setDate(clientWindowStart.getDate() - cfg.patternWindowDays);
        const clientAgg = await (0, client_1.query)(`SELECT client_id, COUNT(*)::text as count
       FROM inconvenience_logs
       WHERE caused_by = 'client'
       AND score >= $1
       AND created_at >= $2
       GROUP BY client_id
       HAVING COUNT(*) >= $3`, [cfg.highThreshold, clientWindowStart.toISOString(), cfg.patternThreshold]);
        const clientEvents = [];
        for (const row of clientAgg.rows) {
            const count = Number(row.count);
            const clientId = Number(row.client_id);
            // Check if we already logged a pattern event recently
            const existing = await (0, client_1.query)(`SELECT id FROM client_risk_events
         WHERE client_id = $1
         AND event_type = 'inconvenience_pattern'
         AND created_at >= $2
         LIMIT 1`, [String(clientId), clientWindowStart.toISOString()]);
            if (existing.rows.length > 0)
                continue; // Already logged
            let weight = 0;
            if (count >= cfg.severePatternThreshold) {
                weight = 10; // 5+ events
            }
            else if (count >= cfg.patternThreshold) {
                weight = 5; // 3+ events
            }
            if (weight > 0) {
                clientEvents.push({
                    clientId,
                    jobId: null,
                    eventType: 'inconvenience_pattern',
                    weight,
                    metadata: { count, windowDays: cfg.patternWindowDays },
                });
            }
        }
        // Persist client risk events
        for (const event of clientEvents) {
            await (0, client_1.query)(`INSERT INTO client_risk_events (client_id, job_id, event_type, weight, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`, [
                String(event.clientId),
                null,
                event.eventType,
                event.weight,
                JSON.stringify(event.metadata || {}),
            ]);
            clientEventsCreated++;
        }
        // ======== Cleaner Pattern Detection (last 30 days) ========
        const cleanerWindowStart = new Date(now.getTime());
        cleanerWindowStart.setDate(cleanerWindowStart.getDate() - cfg.cleanerPatternWindowDays);
        const cleanerAgg = await (0, client_1.query)(`SELECT cleaner_id, COUNT(*)::text as count
       FROM inconvenience_logs
       WHERE caused_by = 'cleaner'
       AND score >= $1
       AND created_at >= $2
       GROUP BY cleaner_id
       HAVING COUNT(*) >= $3`, [cfg.highThreshold, cleanerWindowStart.toISOString(), cfg.patternThreshold]);
        const cleanerEvents = [];
        for (const row of cleanerAgg.rows) {
            const count = Number(row.count);
            const cleanerId = Number(row.cleaner_id);
            // Check if we already logged a pattern event recently
            const existing = await (0, client_1.query)(`SELECT id FROM cleaner_events
         WHERE cleaner_id = $1
         AND event_type = 'inconvenience_high'
         AND created_at >= $2
         LIMIT 1`, [String(cleanerId), cleanerWindowStart.toISOString()]);
            if (existing.rows.length > 0)
                continue;
            let weight = 0;
            if (count >= cfg.severePatternThreshold) {
                weight = -10;
            }
            else if (count >= cfg.patternThreshold) {
                weight = -5;
            }
            if (weight !== 0) {
                cleanerEvents.push({
                    cleanerId,
                    jobId: null,
                    eventType: 'inconvenience_high',
                    weight,
                    metadata: { count, windowDays: cfg.cleanerPatternWindowDays },
                });
            }
        }
        // Persist cleaner events
        for (const event of cleanerEvents) {
            await (0, client_1.query)(`INSERT INTO cleaner_events (cleaner_id, job_id, event_type, weight, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`, [
                String(event.cleanerId),
                null,
                event.eventType,
                event.weight,
                JSON.stringify(event.metadata || {}),
            ]);
            cleanerEventsCreated++;
        }
        logger_1.logger.info("inconvenience_pattern_detection_completed", {
            clientEventsCreated,
            cleanerEventsCreated,
        });
        return { clientEventsCreated, cleanerEventsCreated };
    }
    /**
     * Get inconvenience stats for a client
     */
    static async getClientStats(clientId, since) {
        const result = await (0, client_1.query)(`SELECT 
        COUNT(*)::text as total_count,
        COUNT(*) FILTER (WHERE score >= 3)::text as high_count,
        AVG(score) as avg_score
       FROM inconvenience_logs
       WHERE client_id = $1
       AND caused_by = 'client'
       AND created_at >= $2`, [String(clientId), since.toISOString()]);
        const row = result.rows[0];
        return {
            highInconvenienceCount: Number(row?.high_count || 0),
            totalCount: Number(row?.total_count || 0),
            averageScore: row?.avg_score ? Number(row.avg_score) : null,
        };
    }
    /**
     * Get inconvenience stats for a cleaner
     */
    static async getCleanerStats(cleanerId, since) {
        const result = await (0, client_1.query)(`SELECT 
        COUNT(*)::text as total_count,
        COUNT(*) FILTER (WHERE score >= 3)::text as high_count,
        AVG(score) as avg_score
       FROM inconvenience_logs
       WHERE cleaner_id = $1
       AND caused_by = 'cleaner'
       AND created_at >= $2`, [String(cleanerId), since.toISOString()]);
        const row = result.rows[0];
        return {
            highInconvenienceCount: Number(row?.high_count || 0),
            totalCount: Number(row?.total_count || 0),
            averageScore: row?.avg_score ? Number(row.avg_score) : null,
        };
    }
}
exports.InconvenienceService = InconvenienceService;
