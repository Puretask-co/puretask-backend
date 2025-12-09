"use strict";
// src/core/flexibilityService.ts
// Flexibility Services (2.3 & 2.4)
//
// 2.3 Low Flexibility Badge System (for cleaners)
// Triggered by: % of reasonable reschedules declined
// Patterns in 14- or 30-day windows
//
// 2.4 Flexibility Profile for Clients
// Tracks: reschedules, reaction patterns, inconvenience, grace usage, payment
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlexibilityService = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const scoring_1 = require("./scoring");
const config_1 = require("./config");
// ============================================
// Main Service
// ============================================
class FlexibilityService {
    // ========================================
    // Cleaner Flexibility (Low Flex Badge)
    // ========================================
    /**
     * Log when a cleaner declines a reasonable client reschedule request
     */
    static async logCleanerReasonableDecline(cleanerId, rescheduleEventId) {
        await (0, client_1.query)(`INSERT INTO flexibility_decline_events (cleaner_id, reschedule_event_id, created_at)
       VALUES ($1, $2, NOW())`, [String(cleanerId), rescheduleEventId]);
        logger_1.logger.info("cleaner_reasonable_decline_logged", {
            cleanerId,
            rescheduleEventId,
        });
    }
    /**
     * Nightly job: Evaluate cleaners' flexibility and assign/remove Low Flexibility badge
     */
    static async evaluateCleanerFlexibility(windowDays = config_1.FLEXIBILITY_CONFIG.cleaner.windowDays) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - windowDays);
        const cleaners = await this.getActiveCleaners();
        let evaluated = 0;
        let badgesAssigned = 0;
        let badgesRemoved = 0;
        for (const cleaner of cleaners) {
            const stats = await this.getCleanerFlexStats(cleaner.id, windowStart);
            const reasonableRequests = stats.reasonableRequests;
            const reasonableDeclines = stats.reasonableDeclines;
            let lowFlexActive = false;
            if (reasonableRequests >= config_1.FLEXIBILITY_CONFIG.cleaner.minReasonableRequests) {
                const declineRate = reasonableDeclines / reasonableRequests;
                if (declineRate >= config_1.FLEXIBILITY_CONFIG.cleaner.lowFlexDeclineRate) {
                    lowFlexActive = true;
                }
            }
            // Get current status
            const currentProfile = await this.getCleanerFlexProfile(cleaner.id);
            const wasActive = currentProfile?.lowFlexibilityActive || false;
            // Update profile
            const profile = {
                cleanerId: cleaner.id,
                reasonableRescheduleRequests: reasonableRequests,
                reasonableDeclines: reasonableDeclines,
                lowFlexibilityActive: lowFlexActive,
                lastEvaluatedAt: new Date(),
            };
            await this.upsertCleanerFlexProfile(profile);
            // Assign or remove badge
            if (lowFlexActive && !wasActive) {
                await this.assignLowFlexBadge(cleaner.id);
                badgesAssigned++;
            }
            else if (!lowFlexActive && wasActive) {
                await this.removeLowFlexBadge(cleaner.id);
                badgesRemoved++;
            }
            evaluated++;
        }
        logger_1.logger.info("cleaner_flexibility_evaluation_completed", {
            evaluated,
            badgesAssigned,
            badgesRemoved,
        });
        return { evaluated, badgesAssigned, badgesRemoved };
    }
    static async getCleanerFlexStats(cleanerId, since) {
        // Get reasonable reschedule requests to this cleaner
        const requestsResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM reschedule_events
       WHERE cleaner_id = $1
       AND requested_to = 'cleaner'
       AND is_reasonable = true
       AND t_request >= $2`, [String(cleanerId), since.toISOString()]);
        // Get declines of reasonable requests
        const declinesResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM reschedule_events
       WHERE cleaner_id = $1
       AND requested_to = 'cleaner'
       AND is_reasonable = true
       AND status = 'declined'
       AND declined_by = 'cleaner'
       AND t_request >= $2`, [String(cleanerId), since.toISOString()]);
        return {
            reasonableRequests: Number(requestsResult.rows[0]?.count || 0),
            reasonableDeclines: Number(declinesResult.rows[0]?.count || 0),
        };
    }
    static async getCleanerFlexProfile(cleanerId) {
        const result = await (0, client_1.query)(`SELECT * FROM cleaner_flex_profiles WHERE cleaner_id = $1`, [String(cleanerId)]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            cleanerId: Number(row.cleaner_id),
            reasonableRescheduleRequests: Number(row.reasonable_reschedule_requests || 0),
            reasonableDeclines: Number(row.reasonable_declines || 0),
            lowFlexibilityActive: row.low_flexibility_active || false,
            lastEvaluatedAt: new Date(row.last_evaluated_at),
        };
    }
    static async upsertCleanerFlexProfile(profile) {
        await (0, client_1.query)(`INSERT INTO cleaner_flex_profiles (
        cleaner_id, reasonable_reschedule_requests, reasonable_declines,
        low_flexibility_active, last_evaluated_at
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cleaner_id) DO UPDATE SET
        reasonable_reschedule_requests = $2,
        reasonable_declines = $3,
        low_flexibility_active = $4,
        last_evaluated_at = $5`, [
            String(profile.cleanerId),
            profile.reasonableRescheduleRequests,
            profile.reasonableDeclines,
            profile.lowFlexibilityActive,
            profile.lastEvaluatedAt.toISOString(),
        ]);
    }
    static async assignLowFlexBadge(cleanerId) {
        await (0, client_1.query)(`INSERT INTO badge_assignments (cleaner_id, badge_type, assigned_at)
       VALUES ($1, 'low_flexibility', NOW())
       ON CONFLICT (cleaner_id, badge_type) DO NOTHING`, [String(cleanerId)]);
        logger_1.logger.info("low_flex_badge_assigned", { cleanerId });
    }
    static async removeLowFlexBadge(cleanerId) {
        await (0, client_1.query)(`DELETE FROM badge_assignments
       WHERE cleaner_id = $1 AND badge_type = 'low_flexibility'`, [String(cleanerId)]);
        logger_1.logger.info("low_flex_badge_removed", { cleanerId });
    }
    // ========================================
    // Client Flexibility Profile
    // ========================================
    /**
     * Nightly job: Recompute client flexibility scores
     */
    static async recomputeClientFlexProfiles(windowDays = config_1.FLEXIBILITY_CONFIG.client.windowDays) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - windowDays);
        const clients = await this.getActiveClients();
        let evaluated = 0;
        for (const client of clients) {
            const reschedStats = await this.getClientRescheduleStats(client.id, windowStart);
            const cancelStats = await this.getClientCancelStats(client.id, windowStart);
            const inconvenienceStats = await this.getClientInconvenienceStats(client.id, windowStart);
            const paymentStats = await this.getClientPaymentStats(client.id, windowStart);
            const graceInfo = await this.getClientGraceInfo(client.id);
            const reschedules = reschedStats.rescheduleCount;
            const lateCancels = cancelStats.lateCancelCount;
            const noShows = cancelStats.noShowCount;
            const highInconvenience = inconvenienceStats.highInconvenienceCount;
            const paymentIssues = paymentStats.paymentIssues;
            const flexScore = this.computeClientFlexScore({
                reschedules,
                lateCancels,
                noShows,
                highInconvenience,
                graceUsed: graceInfo.used,
                graceTotal: graceInfo.total,
                paymentIssues,
            });
            const profile = {
                clientId: client.id,
                flexScore,
                rescheduleCount: reschedules,
                lateCancelCount: lateCancels,
                noShowCount: noShows,
                highInconvenienceEvents: highInconvenience,
                graceUsed: graceInfo.used,
                graceTotal: graceInfo.total,
                paymentIssueCount: paymentIssues,
                lastEvaluatedAt: new Date(),
            };
            await this.upsertClientFlexProfile(profile);
            evaluated++;
        }
        logger_1.logger.info("client_flexibility_evaluation_completed", { evaluated });
        return { evaluated };
    }
    /**
     * Compute client flexibility score (0-1)
     * 1.0 = very flexible / easy to work with
     * 0.0 = frequently last-minute changes, no-shows, payment problems
     */
    static computeClientFlexScore(params) {
        const { lateCancels, noShows, highInconvenience, graceUsed, graceTotal, paymentIssues, } = params;
        const weights = config_1.FLEXIBILITY_CONFIG.client.weights;
        const maxPenalties = config_1.FLEXIBILITY_CONFIG.client.maxPenalties;
        // Start from 1.0 and subtract penalty factors
        let score = 1.0;
        // Late cancels and no-shows hurt flexibility a lot
        score -= Math.min(maxPenalties.lateCancel, lateCancels * weights.lateCancelPenalty);
        score -= Math.min(maxPenalties.noShow, noShows * weights.noShowPenalty);
        // High inconvenience pattern
        score -= Math.min(maxPenalties.inconvenience, highInconvenience * weights.inconveniencePenalty);
        // Heavy use of grace cancellations lowers score
        if (graceTotal > 0) {
            const graceRatio = graceUsed / graceTotal;
            score -= graceRatio * weights.gracePenaltyRatio;
        }
        // Payment issues
        score -= Math.min(maxPenalties.payment, paymentIssues * weights.paymentIssuePenalty);
        return (0, scoring_1.clampScore)(score, 0, 1);
    }
    static async getClientRescheduleStats(clientId, since) {
        const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM reschedule_events
       WHERE client_id = $1
       AND requested_by = 'client'
       AND t_request >= $2`, [String(clientId), since.toISOString()]);
        return { rescheduleCount: Number(result.rows[0]?.count || 0) };
    }
    static async getClientCancelStats(clientId, since) {
        const lateResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM cancellation_events
       WHERE client_id = $1
       AND cancelled_by = 'client'
       AND bucket IN ('24_48', 'lt24')
       AND t_cancel >= $2`, [String(clientId), since.toISOString()]);
        const noShowResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM cancellation_events
       WHERE client_id = $1
       AND type = 'client_no_show'
       AND t_cancel >= $2`, [String(clientId), since.toISOString()]);
        return {
            lateCancelCount: Number(lateResult.rows[0]?.count || 0),
            noShowCount: Number(noShowResult.rows[0]?.count || 0),
        };
    }
    static async getClientInconvenienceStats(clientId, since) {
        const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM inconvenience_logs
       WHERE client_id = $1
       AND caused_by = 'client'
       AND score >= 3
       AND created_at >= $2`, [String(clientId), since.toISOString()]);
        return { highInconvenienceCount: Number(result.rows[0]?.count || 0) };
    }
    static async getClientPaymentStats(clientId, since) {
        const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM client_risk_events
       WHERE client_id = $1
       AND event_type IN ('card_decline', 'chargeback')
       AND created_at >= $2`, [String(clientId), since.toISOString()]);
        return { paymentIssues: Number(result.rows[0]?.count || 0) };
    }
    static async getClientGraceInfo(clientId) {
        const result = await (0, client_1.query)(`SELECT 
        COALESCE(grace_cancellations_used, 0) as grace_cancellations_used,
        COALESCE(grace_cancellations_total, 2) as grace_cancellations_total
       FROM client_profiles WHERE user_id = $1`, [String(clientId)]);
        if (result.rows.length === 0) {
            return { used: 0, total: 2 };
        }
        return {
            used: result.rows[0].grace_cancellations_used,
            total: result.rows[0].grace_cancellations_total,
        };
    }
    static async upsertClientFlexProfile(profile) {
        await (0, client_1.query)(`INSERT INTO client_flex_profiles (
        client_id, flex_score, reschedule_count, late_cancel_count,
        no_show_count, high_inconvenience_events, grace_used, grace_total,
        payment_issue_count, last_evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (client_id) DO UPDATE SET
        flex_score = $2,
        reschedule_count = $3,
        late_cancel_count = $4,
        no_show_count = $5,
        high_inconvenience_events = $6,
        grace_used = $7,
        grace_total = $8,
        payment_issue_count = $9,
        last_evaluated_at = $10`, [
            String(profile.clientId),
            profile.flexScore,
            profile.rescheduleCount,
            profile.lateCancelCount,
            profile.noShowCount,
            profile.highInconvenienceEvents,
            profile.graceUsed,
            profile.graceTotal,
            profile.paymentIssueCount,
            profile.lastEvaluatedAt.toISOString(),
        ]);
    }
    // ========================================
    // Helper Functions
    // ========================================
    static async getActiveCleaners() {
        const result = await (0, client_1.query)(`SELECT user_id FROM cleaner_profiles`);
        return result.rows.map(row => ({ id: Number(row.user_id) }));
    }
    static async getActiveClients() {
        const result = await (0, client_1.query)(`SELECT DISTINCT u.id FROM users u
       WHERE u.role = 'client'
       AND EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = u.id AND j.created_at > NOW() - INTERVAL '60 days')`);
        return result.rows.map(row => ({ id: Number(row.id) }));
    }
}
exports.FlexibilityService = FlexibilityService;
