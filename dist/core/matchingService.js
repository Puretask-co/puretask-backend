"use strict";
// src/core/matchingService.ts
// Matching System - Full Implementation
//
// Implements:
// - Reliability score weighting
// - Risk-band penalties (protect top cleaners from high-risk clients)
// - Distance penalties
// - Repeat-client preference
// - Cleaner flexibility badge logic
// - Client flexibility score alignment
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingService = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const config_1 = require("./config");
const clientRiskService_1 = require("./clientRiskService");
// ============================================
// Main Service
// ============================================
class MatchingService {
    /**
     * Find and rank cleaners for a job
     */
    static async findCandidates(context) {
        const { job, client, clientRisk, clientFlexibilityScore } = context;
        const now = new Date();
        // Get available cleaners
        const availableCleaners = await this.getAvailableCleaners(job);
        // Get client's previous cleaners for repeat preference
        const previousCleanerIds = await this.getPreviousCleanerIds(client.id);
        // Calculate scores for each candidate
        const candidates = [];
        let filteredOut = 0;
        for (const cleaner of availableCleaners) {
            // Check if cleaner should be shown based on risk
            if (!this.shouldShowCleaner(cleaner, clientRisk)) {
                filteredOut++;
                continue;
            }
            // Calculate distance (simplified - you'd use actual geocoding)
            const distanceKm = await this.calculateDistance(job, cleaner);
            // Check repeat client status
            const isRepeatClient = previousCleanerIds.includes(cleaner.id);
            // Create matching input
            const input = {
                job,
                client,
                clientRisk,
                candidateCleaner: cleaner,
                distanceKm,
                isRepeatClient,
                clientFlexibilityScore,
            };
            // Calculate match score
            const { score, factors } = this.computeMatchScore(input);
            candidates.push({
                cleaner,
                score,
                distanceKm,
                isRepeatClient,
                factors,
            });
        }
        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);
        logger_1.logger.info("matching_completed", {
            jobId: job.id,
            clientId: client.id,
            totalCandidates: candidates.length,
            filteredOut,
            topScore: candidates[0]?.score,
        });
        return {
            candidates,
            totalCandidates: availableCleaners.length,
            filteredOut,
            matchedAt: now,
        };
    }
    /**
     * Compute match score for a cleaner given job context
     * Higher score = better match
     */
    static computeMatchScore(input) {
        const { candidateCleaner, clientRisk, distanceKm, isRepeatClient, clientFlexibilityScore, } = input;
        const factors = {
            reliabilityPoints: 0,
            distancePenalty: 0,
            repeatClientBonus: 0,
            flexibilityBonus: 0,
            riskPenalty: 0,
        };
        let score = 0;
        // 1. Reliability heavy weight (0-200 points)
        factors.reliabilityPoints = candidateCleaner.reliabilityScore * config_1.MATCHING_CONFIG.weights.reliabilityMultiplier;
        score += factors.reliabilityPoints;
        // 2. Distance penalty (every km reduces score)
        factors.distancePenalty = distanceKm * config_1.MATCHING_CONFIG.weights.distancePenaltyPerKm;
        score -= factors.distancePenalty;
        // 3. Repeat client preference
        if (isRepeatClient) {
            factors.repeatClientBonus = config_1.MATCHING_CONFIG.weights.repeatClientBonus;
            score += factors.repeatClientBonus;
        }
        // 4. Flexibility alignment
        // If cleaner has low-flex badge but client is inflexible (rarely reschedules), bonus
        if (candidateCleaner.flexibilityBadgeActive &&
            clientFlexibilityScore < config_1.MATCHING_CONFIG.thresholds.clientFlexibilityLow) {
            factors.flexibilityBonus = config_1.MATCHING_CONFIG.weights.flexibilityAlignmentBonus;
            score += factors.flexibilityBonus;
        }
        // 5. Risk-aware: deprioritize high-risk clients' access to top-tier cleaners
        if ((clientRisk.riskBand === 'high' || clientRisk.riskBand === 'critical') &&
            candidateCleaner.reliabilityTier === 'Elite') {
            factors.riskPenalty = config_1.MATCHING_CONFIG.weights.riskPenaltyElite;
            score -= factors.riskPenalty;
        }
        return { score, factors };
    }
    /**
     * Check if a cleaner should be shown to a client based on risk
     */
    static shouldShowCleaner(cleaner, clientRisk) {
        // High/critical risk clients don't get Elite cleaners unless necessary
        if (clientRisk.riskBand === 'high' || clientRisk.riskBand === 'critical') {
            if (cleaner.reliabilityTier === 'Elite') {
                // For now, don't completely hide - just penalize in scoring
                // Return true to allow matching but with penalty
                return true;
            }
        }
        return true;
    }
    // ============================================
    // Database Operations
    // ============================================
    static async getAvailableCleaners(job) {
        const dayOfWeek = job.startTime.getDay();
        const startTimeStr = job.startTime.toTimeString().substring(0, 5);
        const endTimeStr = job.endTime.toTimeString().substring(0, 5);
        const result = await (0, client_1.query)(`SELECT 
        u.id,
        cp.reliability_score,
        cp.tier as reliability_tier,
        COALESCE(cfp.low_flexibility_active, false) as flexibility_badge_active,
        CASE WHEN COALESCE(cfp.low_flexibility_active, false) THEN 'low_flex' ELSE 'normal' END as flexibility_status
       FROM users u
       JOIN cleaner_profiles cp ON cp.user_id = u.id
       LEFT JOIN cleaner_flex_profiles cfp ON cfp.cleaner_id = u.id
       WHERE u.role = 'cleaner'
       AND cp.is_available = true
       AND EXISTS (
         SELECT 1 FROM availability_blocks ab
         WHERE ab.cleaner_id = u.id
         AND ab.day_of_week = $1
         AND ab.start_time <= $2
         AND ab.end_time >= $3
       )
       AND NOT EXISTS (
         SELECT 1 FROM jobs j
         WHERE j.cleaner_id = u.id
         AND j.status NOT IN ('cancelled', 'completed')
         AND j.scheduled_start_at < $5
         AND j.scheduled_end_at > $4
       )
       AND NOT EXISTS (
         SELECT 1 FROM blackout_periods bp
         WHERE bp.cleaner_id = u.id
         AND bp.start_ts < $5
         AND bp.end_ts > $4
       )`, [
            dayOfWeek,
            startTimeStr,
            endTimeStr,
            job.startTime.toISOString(),
            job.endTime.toISOString(),
        ]);
        return result.rows.map(row => ({
            id: Number(row.id),
            reliabilityScore: Number(row.reliability_score || 70),
            reliabilityTier: this.mapTierFromDb(row.reliability_tier),
            flexibilityStatus: row.flexibility_status,
            flexibilityBadgeActive: row.flexibility_badge_active,
        }));
    }
    static mapTierFromDb(tier) {
        if (!tier)
            return 'Developing';
        switch (tier.toLowerCase().replace('_', ' ')) {
            case 'elite': return 'Elite';
            case 'pro': return 'Pro';
            case 'semi pro':
            case 'semi_pro': return 'Semi Pro';
            default: return 'Developing';
        }
    }
    static async getPreviousCleanerIds(clientId) {
        const result = await (0, client_1.query)(`SELECT DISTINCT cleaner_id 
       FROM jobs 
       WHERE client_id = $1 
       AND status = 'completed'
       ORDER BY cleaner_id`, [String(clientId)]);
        return result.rows.map(row => Number(row.cleaner_id));
    }
    static async calculateDistance(job, cleaner) {
        // Simplified distance calculation
        // In production, you'd use the cleaner's saved location or travel radius
        const cleanerLocation = await (0, client_1.query)(`SELECT latitude, longitude FROM cleaner_profiles WHERE user_id = $1`, [String(cleaner.id)]);
        if (cleanerLocation.rows.length === 0 || !job.latitude || !job.longitude) {
            return 10; // Default distance if no location data
        }
        const cLat = cleanerLocation.rows[0].latitude;
        const cLon = cleanerLocation.rows[0].longitude;
        const jLat = job.latitude;
        const jLon = job.longitude;
        // Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(jLat - cLat);
        const dLon = this.toRad(jLon - cLon);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(cLat)) * Math.cos(this.toRad(jLat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    static toRad(deg) {
        return deg * (Math.PI / 180);
    }
    /**
     * Get matching context for a job
     */
    static async getMatchingContext(jobId) {
        const jobResult = await (0, client_1.query)(`SELECT j.*, u.id as client_user_id
       FROM jobs j
       JOIN users u ON u.id = j.client_id
       WHERE j.id = $1`, [String(jobId)]);
        if (jobResult.rows.length === 0)
            return null;
        const row = jobResult.rows[0];
        const clientId = Number(row.client_id);
        // Get client profile
        const clientResult = await (0, client_1.query)(`SELECT user_id, grace_cancellations_total, grace_cancellations_used
       FROM client_profiles WHERE user_id = $1`, [String(clientId)]);
        const client = {
            id: clientId,
            graceCancellationsTotal: clientResult.rows[0]?.grace_cancellations_total || 2,
            graceCancellationsUsed: clientResult.rows[0]?.grace_cancellations_used || 0,
        };
        // Get client risk score
        let clientRisk = await clientRiskService_1.ClientRiskService.getRiskScore(clientId);
        if (!clientRisk) {
            clientRisk = {
                clientId,
                riskScore: 0,
                riskBand: 'normal',
                lastRecomputedAt: new Date(),
            };
        }
        // Get client flexibility score
        const flexResult = await (0, client_1.query)(`SELECT flex_score FROM client_flex_profiles WHERE client_id = $1`, [String(clientId)]);
        const clientFlexibilityScore = flexResult.rows[0]?.flex_score || 0.5;
        const job = {
            id: Number(row.id),
            clientId,
            cleanerId: Number(row.cleaner_id),
            startTime: new Date(row.scheduled_start_at),
            endTime: new Date(row.scheduled_end_at),
            heldCredits: Number(row.credit_amount || 0),
            status: row.status,
            latitude: row.latitude,
            longitude: row.longitude,
        };
        return {
            job,
            client,
            clientRisk,
            clientFlexibilityScore,
        };
    }
}
exports.MatchingService = MatchingService;
