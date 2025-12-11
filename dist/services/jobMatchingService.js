"use strict";
// src/services/jobMatchingService.ts
// Job matching algorithm - Auto-assign cleaners to jobs
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchingCleaners = findMatchingCleaners;
exports.assignCleanerToJob = assignCleanerToJob;
exports.reassignCleanerWithPenalty = reassignCleanerWithPenalty;
exports.broadcastJobToCleaners = broadcastJobToCleaners;
exports.acceptJobOffer = acceptJobOffer;
exports.getWaveEligibleCleaners = getWaveEligibleCleaners;
exports.declineJobOffer = declineJobOffer;
exports.processUnassignedJobs = processUnassignedJobs;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const availabilityService_1 = require("./availabilityService");
// Default weights for scoring
const DEFAULT_WEIGHTS = {
    reliability: 0.30, // 30% weight on reliability
    tier: 0.20, // 20% weight on tier
    distance: 0.15, // 15% weight on distance
    priceMatch: 0.15, // 15% weight on price match
    pastJobs: 0.10, // 10% weight on past jobs with client
    responseRate: 0.10, // 10% weight on response rate
};
// Tier rankings for scoring
const TIER_SCORES = {
    platinum: 100,
    gold: 80,
    silver: 60,
    bronze: 40,
};
const WAVE_CONFIG = {
    baseRadiusMiles: Number(process.env.MATCHING_BASE_RADIUS_MILES || 15),
    expandPerWaveMiles: Number(process.env.MATCHING_EXPAND_PER_WAVE_MILES || 10),
    waveDurationHours: Number(process.env.MATCHING_WAVE_DURATION_HOURS || 24),
    minTierWave1: ["platinum", "gold"], // top tiers first
    minTierWave2: ["platinum", "gold", "silver"],
};
// ============================================
// Core Matching Algorithm
// ============================================
/**
 * Find matching cleaners for a job
 */
async function findMatchingCleaners(job, options = {}) {
    const { limit = 10, minReliability = 50, weights = {}, autoAssign = false, } = options;
    const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };
    logger_1.logger.info("job_matching_started", {
        jobId: job.id,
        scheduledStart: job.scheduled_start_at,
        address: job.address,
    });
    // Step 1: Get all active cleaners with their profiles
    const cleanersResult = await (0, client_1.query)(`
      SELECT 
        u.id as user_id,
        u.email,
        cp.tier,
        cp.reliability_score,
        cp.hourly_rate_credits,
        csa.latitude,
        csa.longitude
      FROM users u
      JOIN cleaner_profiles cp ON cp.user_id = u.id
      LEFT JOIN cleaner_service_areas csa ON csa.cleaner_id = u.id
      WHERE u.role = 'cleaner'
        AND cp.reliability_score >= $1
      GROUP BY u.id, u.email, cp.tier, cp.reliability_score, cp.hourly_rate_credits, csa.latitude, csa.longitude
    `, [minReliability]);
    const candidates = [];
    // Step 2: Filter by availability and score each cleaner
    for (const cleaner of cleanersResult.rows) {
        const startAt = new Date(job.scheduled_start_at);
        const endAt = new Date(job.scheduled_end_at);
        // Check availability
        const isAvailable = await (0, availabilityService_1.isCleanerAvailableForSlot)(cleaner.user_id, startAt, endAt);
        if (!isAvailable)
            continue;
        // Check preferences match
        const prefs = await (0, availabilityService_1.getPreferences)(cleaner.user_id);
        const jobDurationHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
        if (prefs) {
            if (jobDurationHours < prefs.min_job_duration_h)
                continue;
            if (jobDurationHours > prefs.max_job_duration_h)
                continue;
        }
        // Calculate distance (simplified - would use real geocoding in production)
        const distanceMiles = calculateDistance(job.latitude, job.longitude, cleaner.latitude, cleaner.longitude);
        // Get past jobs with this client
        const pastJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE client_id = $1 AND cleaner_id = $2 AND status = 'completed'`, [job.client_id, cleaner.user_id]);
        const pastJobsCount = Number(pastJobsResult.rows[0]?.count || 0);
        // Calculate response rate (jobs accepted / jobs offered in last 30 days)
        const responseRateResult = await (0, client_1.query)(`
        SELECT 
          COUNT(*) as offered,
          COUNT(*) FILTER (WHERE status != 'cancelled') as accepted
        FROM jobs
        WHERE cleaner_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
      `, [cleaner.user_id]);
        const offered = Number(responseRateResult.rows[0]?.offered || 1);
        const accepted = Number(responseRateResult.rows[0]?.accepted || 0);
        const responseRate = offered > 0 ? accepted / offered : 1;
        // Calculate match score
        const { score, reasons } = calculateMatchScore({
            reliability: cleaner.reliability_score,
            tier: cleaner.tier,
            distance: distanceMiles,
            hourlyRate: cleaner.hourly_rate_credits,
            jobRate: job.credit_amount,
            pastJobs: pastJobsCount,
            responseRate,
            weights: finalWeights,
        });
        candidates.push({
            cleanerId: cleaner.user_id,
            email: cleaner.email,
            tier: cleaner.tier,
            reliabilityScore: cleaner.reliability_score,
            hourlyRateCredits: cleaner.hourly_rate_credits,
            distanceMiles,
            score,
            reasons,
        });
    }
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    // Limit results
    const topCandidates = candidates.slice(0, limit);
    const bestMatch = topCandidates[0] ?? null;
    // Auto-assign if requested and we have a good match
    let autoAssigned = false;
    if (autoAssign && bestMatch && bestMatch.score >= 70) {
        await assignCleanerToJob(job.id, bestMatch.cleanerId);
        autoAssigned = true;
        logger_1.logger.info("job_auto_assigned", {
            jobId: job.id,
            cleanerId: bestMatch.cleanerId,
            score: bestMatch.score,
        });
    }
    const result = {
        jobId: job.id,
        candidates: topCandidates,
        bestMatch,
        autoAssigned,
        reason: autoAssign
            ? bestMatch
                ? `Auto-assigned to ${bestMatch.email} with score ${bestMatch.score}`
                : "No available cleaners found"
            : "Matched candidates for review",
    };
    logger_1.logger.info("job_matching_completed", {
        jobId: job.id,
        candidatesFound: candidates.length,
        bestScore: bestMatch?.score,
        autoAssigned,
    });
    return result;
}
/**
 * Calculate match score for a cleaner
 */
function calculateMatchScore(params) {
    const { reliability, tier, distance, hourlyRate, jobRate, pastJobs, responseRate, weights } = params;
    const reasons = [];
    // Reliability score (0-100)
    const reliabilityScore = reliability;
    reasons.push(`Reliability: ${reliabilityScore.toFixed(0)}%`);
    // Tier score (0-100)
    const tierScore = TIER_SCORES[tier.toLowerCase()] || 40;
    reasons.push(`Tier: ${tier} (${tierScore})`);
    // Distance score (0-100, closer is better)
    let distanceScore = 100;
    if (distance !== null) {
        distanceScore = Math.max(0, 100 - (distance * 5)); // -5 points per mile
        reasons.push(`Distance: ${distance.toFixed(1)} miles`);
    }
    // Price match score (0-100, closer to job rate is better)
    let priceMatchScore = 100;
    if (hourlyRate > 0 && jobRate > 0) {
        const priceDiff = Math.abs(hourlyRate - (jobRate / 2)); // Assume 2-hour avg job
        priceMatchScore = Math.max(0, 100 - (priceDiff * 2));
        reasons.push(`Rate match: ${priceMatchScore.toFixed(0)}%`);
    }
    // Past jobs score (0-100, more is better, caps at 10 jobs)
    const pastJobsScore = Math.min(100, pastJobs * 10);
    if (pastJobs > 0) {
        reasons.push(`Past jobs: ${pastJobs}`);
    }
    // Response rate score (0-100)
    const responseRateScore = responseRate * 100;
    reasons.push(`Response rate: ${responseRateScore.toFixed(0)}%`);
    // Calculate weighted total
    const score = reliabilityScore * weights.reliability +
        tierScore * weights.tier +
        distanceScore * weights.distance +
        priceMatchScore * weights.priceMatch +
        pastJobsScore * weights.pastJobs +
        responseRateScore * weights.responseRate;
    return { score: Math.round(score), reasons };
}
/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
        return null;
    }
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return deg * (Math.PI / 180);
}
/**
 * Assign a cleaner to a job
 */
async function assignCleanerToJob(jobId, cleanerId) {
    await (0, client_1.query)(`UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`, [jobId, cleanerId]);
    // Log the assignment event
    await (0, client_1.query)(`
      INSERT INTO job_events (job_id, actor_type, actor_id, event_type, payload)
      VALUES ($1, 'system', NULL, 'job.auto_assigned', $2::jsonb)
    `, [jobId, JSON.stringify({ cleanerId, assignedBy: "matching_algorithm" })]);
}
/**
 * Reassign a job to a different cleaner and apply late reassignment penalty to the previous cleaner.
 * - Resets job_offers for the job.
 * - Applies a small reliability decrement to the previous cleaner if within the late window.
 */
async function reassignCleanerWithPenalty(options) {
    const { jobId, newCleanerId, actorId } = options;
    // Fetch current assignment and start time
    const jobResult = await (0, client_1.query)(`SELECT cleaner_id, scheduled_start_at FROM jobs WHERE id = $1`, [jobId]);
    const current = jobResult.rows[0];
    if (!current) {
        throw new Error("Job not found");
    }
    const previousCleanerId = current.cleaner_id;
    if (previousCleanerId === newCleanerId) {
        return;
    }
    // Apply late reassignment penalty if within 24h of start
    const now = new Date();
    const startAt = current.scheduled_start_at ? new Date(current.scheduled_start_at) : null;
    if (previousCleanerId && startAt) {
        const hoursBefore = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursBefore >= 0 && hoursBefore < 24) {
            const penaltyPoints = 5;
            await (0, client_1.query)(`
          UPDATE cleaner_profiles
          SET reliability_score = GREATEST(0, reliability_score - $2),
              updated_at = NOW()
          WHERE user_id = $1
        `, [previousCleanerId, penaltyPoints]);
            await (0, client_1.query)(`
          INSERT INTO reliability_history (cleaner_id, old_score, new_score, old_tier, new_tier, reason, metadata)
          SELECT
            cp.user_id,
            cp.reliability_score + $2, -- old_score before decrement
            cp.reliability_score,       -- new_score after decrement
            cp.tier,
            cp.tier,
            'reassignment_penalty',
            jsonb_build_object('hours_before', $3, 'job_id', $4, 'actor', $5)
          FROM cleaner_profiles cp
          WHERE cp.user_id = $1
        `, [previousCleanerId, penaltyPoints, hoursBefore, jobId, actorId]);
        }
    }
    // Reset offers for this job (prevent stale accepts)
    await (0, client_1.query)(`UPDATE job_offers SET status = 'expired' WHERE job_id = $1 AND status = 'pending'`, [
        jobId,
    ]);
    // Assign new cleaner
    await (0, client_1.query)(`UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`, [jobId, newCleanerId]);
    await (0, client_1.query)(`
      INSERT INTO job_events (job_id, actor_type, actor_id, event_type, payload)
      VALUES ($1, 'system', $2, 'job.reassigned', $3::jsonb)
    `, [
        jobId,
        actorId,
        JSON.stringify({
            previousCleanerId,
            newCleanerId,
        }),
    ]);
}
// ============================================
// Broadcast & Offer System
// ============================================
/**
 * Broadcast job to multiple cleaners
 */
async function broadcastJobToCleaners(job, cleanerIds, expiresInMinutes = 30) {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    for (const cleanerId of cleanerIds) {
        await (0, client_1.query)(`
        INSERT INTO job_offers (job_id, cleaner_id, expires_at, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (job_id, cleaner_id) DO UPDATE
        SET expires_at = EXCLUDED.expires_at, status = 'pending'
      `, [job.id, cleanerId, expiresAt.toISOString()]);
    }
    logger_1.logger.info("job_broadcast", {
        jobId: job.id,
        cleanerCount: cleanerIds.length,
        expiresAt,
    });
}
/**
 * Cleaner accepts a job offer
 */
async function acceptJobOffer(jobId, cleanerId) {
    // Check if offer is still valid
    const offerResult = await (0, client_1.query)(`SELECT status, expires_at FROM job_offers WHERE job_id = $1 AND cleaner_id = $2`, [jobId, cleanerId]);
    const offer = offerResult.rows[0];
    if (!offer) {
        return { success: false, reason: "No offer found" };
    }
    if (offer.status !== "pending") {
        return { success: false, reason: "Offer already processed" };
    }
    if (new Date(offer.expires_at) < new Date()) {
        return { success: false, reason: "Offer expired" };
    }
    // Check if job is still available
    const jobResult = await (0, client_1.query)(`SELECT cleaner_id, status FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
        return { success: false, reason: "Job not found" };
    }
    if (job.cleaner_id) {
        return { success: false, reason: "Job already assigned" };
    }
    if (job.status !== "requested") {
        return { success: false, reason: "Job no longer available" };
    }
    // Assign the job
    await assignCleanerToJob(jobId, cleanerId);
    // Update offer status
    await (0, client_1.query)(`UPDATE job_offers SET status = 'accepted' WHERE job_id = $1 AND cleaner_id = $2`, [jobId, cleanerId]);
    // Decline all other offers for this job
    await (0, client_1.query)(`UPDATE job_offers SET status = 'declined_by_system' WHERE job_id = $1 AND cleaner_id != $2 AND status = 'pending'`, [jobId, cleanerId]);
    logger_1.logger.info("job_offer_accepted", { jobId, cleanerId });
    return { success: true, reason: "Job assigned successfully" };
}
/**
 * Wave-based eligibility: long-wave, score/tier-first, voluntary accept
 */
async function getWaveEligibleCleaners(job, options = {}) {
    const wave = options.wave ?? 1;
    const limit = options.limit ?? 20;
    const minReliability = options.minReliability ?? 50;
    const radius = WAVE_CONFIG.baseRadiusMiles + WAVE_CONFIG.expandPerWaveMiles * Math.max(0, wave - 1);
    const allowedTiers = wave === 1 ? WAVE_CONFIG.minTierWave1 : WAVE_CONFIG.minTierWave2;
    const match = await findMatchingCleaners(job, { limit: 200, minReliability });
    const filtered = match.candidates.filter((c) => {
        const tierOk = allowedTiers.includes(c.tier.toLowerCase());
        const radiusOk = c.distanceMiles === null || c.distanceMiles <= radius;
        return tierOk && radiusOk;
    });
    return filtered.slice(0, limit);
}
/**
 * Cleaner declines a job offer
 */
async function declineJobOffer(jobId, cleanerId, reason) {
    await (0, client_1.query)(`UPDATE job_offers SET status = 'declined', decline_reason = $3 WHERE job_id = $1 AND cleaner_id = $2`, [jobId, cleanerId, reason ?? null]);
    logger_1.logger.info("job_offer_declined", { jobId, cleanerId, reason });
}
// ============================================
// Auto-Assignment Worker Logic
// ============================================
/**
 * Process unassigned jobs and try to match them
 */
async function processUnassignedJobs() {
    // Get jobs that need assignment
    const jobsResult = await (0, client_1.query)(`
      SELECT * FROM jobs
      WHERE status = 'requested'
        AND cleaner_id IS NULL
        AND scheduled_start_at > NOW() + INTERVAL '2 hours'
      ORDER BY scheduled_start_at ASC
      LIMIT 50
    `);
    let assigned = 0;
    let failed = 0;
    for (const job of jobsResult.rows) {
        try {
            const result = await findMatchingCleaners(job, { autoAssign: true });
            if (result.autoAssigned) {
                assigned++;
            }
            else {
                failed++;
            }
        }
        catch (err) {
            logger_1.logger.error("job_matching_error", {
                jobId: job.id,
                error: err.message,
            });
            failed++;
        }
    }
    logger_1.logger.info("unassigned_jobs_processed", {
        processed: jobsResult.rows.length,
        assigned,
        failed,
    });
    return {
        processed: jobsResult.rows.length,
        assigned,
        failed,
    };
}
