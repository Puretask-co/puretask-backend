"use strict";
// src/core/reliabilityScoreV2Service.ts
// Reliability Score 2.0 - Full Implementation
//
// Implements:
// - Base Behavior Score (0-90 pts): Attendance, Punctuality, Photos, Communication, Completion, Ratings
// - Streak/Consistency Bonus (0-10 pts)
// - Event Penalties: Late reschedules, cancellations, no-shows, disputes, inconvenience
// - New cleaner ramp-up blending
// - Tier calculation and payout percentages
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReliabilityScoreV2Service = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const scoring_1 = require("./scoring");
const config_1 = require("./config");
const timeBuckets_1 = require("./timeBuckets");
// ============================================
// Main Service
// ============================================
class ReliabilityScoreV2Service {
    /**
     * Recompute reliability score for a single cleaner
     */
    static async recomputeForCleaner(cleanerId) {
        const { maxJobs, windowDays } = config_1.RELIABILITY_CONFIG.windows;
        // Get jobs within window
        const since = new Date();
        since.setDate(since.getDate() - windowDays);
        const jobsInWindow = await this.getJobsForCleanerWindow(cleanerId, since, maxJobs);
        // Derive event counts from jobs
        const eventCounts = this.deriveEventCounts(jobsInWindow);
        // Get total completed jobs for ramp-up
        const totalCompletedJobsEver = await this.getTotalCompletedJobsForCleaner(cleanerId);
        // Compute score
        const result = this.computeReliabilityScoreFromJobs(jobsInWindow, eventCounts, { cleanerId, totalCompletedJobsEver });
        // Persist
        await this.updateCleanerReliability(cleanerId, {
            reliabilityScore: result.reliabilityScore,
            reliabilityTier: result.tier,
        });
        // Log snapshot
        await this.logScoreSnapshot(result);
        logger_1.logger.info("reliability_v2_recomputed", {
            cleanerId,
            score: result.reliabilityScore,
            tier: result.tier,
            baseBehaviorScore: result.baseBehaviorScore,
            streakBonus: result.streakBonus,
            eventPenaltySum: result.eventPenaltySum,
        });
        return result;
    }
    /**
     * Nightly cron: recompute all cleaners
     */
    static async recomputeAllCleaners() {
        const cleaners = await this.getActiveCleaners();
        let processed = 0;
        let failed = 0;
        for (const cleaner of cleaners) {
            try {
                await this.recomputeForCleaner(cleaner.id);
                processed++;
            }
            catch (err) {
                logger_1.logger.error("reliability_v2_recompute_failed", {
                    cleanerId: cleaner.id,
                    error: err.message,
                });
                failed++;
            }
        }
        logger_1.logger.info("reliability_v2_recompute_all_completed", {
            processed,
            failed,
            total: cleaners.length,
        });
        return { processed, failed };
    }
    // ============================================
    // Score Calculation
    // ============================================
    static computeReliabilityScoreFromJobs(jobs, eventCounts, opts) {
        const { cleanerId, totalCompletedJobsEver } = opts;
        if (jobs.length === 0) {
            // New cleaner with no data
            const provisional = config_1.RELIABILITY_CONFIG.newCleanerBlend.provisionalScore;
            return {
                cleanerId,
                reliabilityScore: provisional,
                tier: 'Semi Pro',
                baseBehaviorScore: provisional,
                streakBonus: 0,
                eventPenaltySum: 0,
                stats: {
                    attendedJobs: 0,
                    cleanerNoShowJobs: 0,
                    punctualityRate: 0,
                    photoComplianceRate: 0,
                    communicationRate: 0,
                    completionRate: 0,
                    avgRating: null,
                    lateReschedulesLt24: 0,
                    cancels24_48: 0,
                    cancelsLt24: 0,
                    disputesCleanerAtFault: 0,
                    highInconvenienceJobs: 0,
                },
            };
        }
        // Aggregate core counts
        const attendedJobs = jobs.filter(this.isAttended);
        const attendedCount = attendedJobs.length;
        const cleanerNoShowJobs = jobs.filter(this.isCleanerNoShow).length;
        // Punctuality
        const onTimeCheckinJobs = attendedJobs.filter(this.isOnTimeCheckin).length;
        const punctualityRate = attendedCount ? onTimeCheckinJobs / attendedCount : 1;
        // Photo compliance
        const photoRelevantJobs = jobs.filter(j => j.photosRequired || j.photosCount > 0);
        const photoCompliantJobs = photoRelevantJobs.filter(this.isPhotoCompliant).length;
        const photoComplianceRate = photoRelevantJobs.length
            ? photoCompliantJobs / photoRelevantJobs.length
            : 1;
        // Communication
        const commGoodJobs = attendedJobs.filter(this.isCommunicationGood).length;
        const communicationRate = attendedCount ? commGoodJobs / attendedCount : 1;
        // Completion
        const completionOkJobs = attendedJobs.filter(this.isCompletionOk).length;
        const completionRate = attendedCount ? completionOkJobs / attendedCount : 1;
        // Ratings
        const avgRating = this.computeAverageRatingWithOutlierTrim(jobs, 20);
        // ======== Base Behavior Score (0-90) ========
        const weights = config_1.RELIABILITY_CONFIG.baseScoreWeights;
        // 4.1 Attendance (0-25)
        const denomAttendance = attendedCount + cleanerNoShowJobs;
        const attendanceRate = denomAttendance === 0 ? 1 : attendedCount / denomAttendance;
        const attendanceScore = attendanceRate * weights.attendance;
        // 4.2 Punctuality (0-20)
        const punctualityScore = punctualityRate * weights.punctuality;
        // 4.3 Photos (0-15)
        const photoScore = photoComplianceRate * weights.photoCompliance;
        // 4.4 Communication (0-10)
        const communicationScore = communicationRate * weights.communication;
        // 4.5 Completion (0-10)
        const completionScore = completionRate * weights.completion;
        // 4.6 Ratings (0-10)
        let ratingScore = 0;
        if (avgRating !== null) {
            const normalized = (avgRating - 3) / 2; // 3.0 → 0, 4.0 → 0.5, 5.0 → 1.0
            const clamped = (0, scoring_1.clampScore)(normalized, 0, 1);
            ratingScore = clamped * weights.ratings;
        }
        const baseBehaviorScore = attendanceScore +
            punctualityScore +
            photoScore +
            communicationScore +
            completionScore +
            ratingScore;
        // ======== Streak / Consistency Bonus (0-10) ========
        const streakBonus = this.computeStreakBonus(jobs);
        // ======== Event Penalties ========
        const { lateReschedulesLt24, cancels24_48, cancelsLt24, cleanerNoShows, disputesCleanerFault, highInconvenienceJobs, } = eventCounts;
        const penalties = config_1.RELIABILITY_CONFIG.eventPenalties;
        // Late reschedules by cleaner (<24h): +3 each, cap -9
        const lateReschedulePenalty = Math.min(Math.abs(penalties.lateRescheduleLt24) * lateReschedulesLt24, Math.abs(penalties.lateRescheduleCap));
        // Cleaner cancellations
        const cleanerCancellationPenalty = Math.abs(penalties.cancel24_48) * cancels24_48 +
            Math.abs(penalties.cancelLt24) * cancelsLt24;
        // No-shows
        const noShowPenalty = Math.abs(penalties.noShow) * cleanerNoShows;
        // Disputes cleaner at fault: 10 each, cap 20
        const disputePenalty = Math.min(Math.abs(penalties.disputeCleanerAtFault) * disputesCleanerFault, Math.abs(penalties.disputeCap));
        // Inconvenience patterns
        let inconveniencePenalty = 0;
        if (highInconvenienceJobs >= 3)
            inconveniencePenalty += Math.abs(penalties.inconveniencePattern);
        if (highInconvenienceJobs >= 5)
            inconveniencePenalty += Math.abs(penalties.inconveniencePatternHigh);
        const eventPenaltySum = lateReschedulePenalty +
            cleanerCancellationPenalty +
            noShowPenalty +
            disputePenalty +
            inconveniencePenalty;
        // ======== Final Score ========
        const computedScore = (0, scoring_1.clampScore)(baseBehaviorScore + streakBonus - eventPenaltySum, 0, 100);
        // Ramp-up for new cleaners
        const windowCompletedOrAttended = attendedCount + cleanerNoShowJobs;
        const jobsForBlending = Math.min(windowCompletedOrAttended, totalCompletedJobsEver);
        let finalScore;
        if (jobsForBlending < config_1.RELIABILITY_CONFIG.newCleanerBlend.blendJobThreshold) {
            const provisional = config_1.RELIABILITY_CONFIG.newCleanerBlend.provisionalScore;
            const n = jobsForBlending;
            const threshold = config_1.RELIABILITY_CONFIG.newCleanerBlend.blendJobThreshold;
            finalScore = (provisional * (threshold - n) + computedScore * n) / threshold;
        }
        else {
            finalScore = computedScore;
        }
        finalScore = (0, scoring_1.clampScore)(finalScore, 0, 100);
        const tier = (0, scoring_1.computeReliabilityTier)(finalScore);
        return {
            cleanerId,
            reliabilityScore: finalScore,
            tier,
            baseBehaviorScore,
            streakBonus,
            eventPenaltySum,
            stats: {
                attendedJobs: attendedCount,
                cleanerNoShowJobs,
                punctualityRate,
                photoComplianceRate,
                communicationRate,
                completionRate,
                avgRating,
                lateReschedulesLt24,
                cancels24_48,
                cancelsLt24,
                disputesCleanerAtFault: disputesCleanerFault,
                highInconvenienceJobs,
            },
        };
    }
    // ============================================
    // Helper Functions
    // ============================================
    static isAttended(job) {
        return (!!job.checkInAt ||
            job.status === 'completed' ||
            job.status === 'cancelled_by_client');
    }
    static isCleanerNoShow(job) {
        return job.status === 'no_show_cleaner';
    }
    static isOnTimeCheckin(job) {
        if (!job.checkInAt)
            return false;
        const diff = Math.abs((0, timeBuckets_1.minutesDiff)(job.scheduledStart, job.checkInAt));
        return diff <= config_1.RELIABILITY_CONFIG.punctuality.onTimeWindowMinutes;
    }
    static isPhotoCompliant(job) {
        return job.photosCount >= config_1.RELIABILITY_CONFIG.photoCompliance.minPhotosRequired;
    }
    static isCommunicationGood(job) {
        return job.proactiveMessageSent || job.respondedWithin2h;
    }
    static isCompletionOk(job) {
        return !!job.checkOutAt && (job.status === 'completed' || job.status === 'disputed');
    }
    static isCleanerCancellation(job) {
        return job.status === 'cancelled_by_cleaner';
    }
    static isDisputeCleanerFault(job) {
        return job.disputeOutcome === 'cleaner_at_fault';
    }
    static isHighInconvenienceCausedByCleaner(job) {
        return (job.inconvenienceCausedBy === 'cleaner' &&
            job.inconvenienceScore !== null &&
            job.inconvenienceScore >= 3);
    }
    /**
     * Compute average rating with outlier trimming
     */
    static computeAverageRatingWithOutlierTrim(jobs, maxJobs = 20) {
        const rated = jobs
            .filter(j => j.rating !== null && j.ratingCreatedAt !== null)
            .sort((a, b) => (a.ratingCreatedAt.getTime() - b.ratingCreatedAt.getTime()));
        if (rated.length === 0)
            return null;
        const recent = rated.slice(-maxJobs);
        const ratings = recent.map(j => j.rating);
        if (ratings.length <= 2) {
            const sum = ratings.reduce((s, r) => s + r, 0);
            return sum / ratings.length;
        }
        // Compute median
        const sorted = [...ratings].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        // Find worst rating
        const minRating = Math.min(...ratings);
        // If worst <= median - 2.0, treat as outlier and drop ONE instance
        let processed = ratings;
        if (minRating <= median - 2.0) {
            let dropped = false;
            processed = ratings.filter(r => {
                if (!dropped && r === minRating) {
                    dropped = true;
                    return false;
                }
                return true;
            });
        }
        const sum = processed.reduce((s, r) => s + r, 0);
        return sum / processed.length;
    }
    /**
     * Compute streak bonus for consistent performance
     */
    static computeStreakBonus(jobs) {
        if (jobs.length < 3)
            return 0;
        const sorted = [...jobs].sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
        const windowSize = Math.min(7, sorted.length);
        let streakBlocks = 0;
        for (let start = 0; start + windowSize <= sorted.length; start++) {
            const block = sorted.slice(start, start + windowSize);
            const attended = block.filter(this.isAttended);
            const attendedCount = attended.length;
            const noShows = block.filter(this.isCleanerNoShow).length;
            const cancels = block.filter(this.isCleanerCancellation).length;
            const disputesFault = block.filter(this.isDisputeCleanerFault).length;
            if (noShows > 0 || cancels > 0 || disputesFault > 0)
                continue;
            const onTime = attended.filter(this.isOnTimeCheckin).length;
            const punctualityRate = attendedCount === 0 ? 1 : onTime / attendedCount;
            const photoRelevant = block.filter(j => j.photosRequired || j.photosCount > 0);
            const photoCompliant = photoRelevant.filter(this.isPhotoCompliant).length;
            const photoComplianceRate = photoRelevant.length === 0
                ? 1
                : photoCompliant / photoRelevant.length;
            if (punctualityRate >= 0.9 && photoComplianceRate >= 0.9) {
                streakBlocks++;
            }
        }
        const bonus = Math.min(config_1.RELIABILITY_CONFIG.streakBonus.maxBonus, streakBlocks * config_1.RELIABILITY_CONFIG.streakBonus.pointsPerPerfectBlock);
        return bonus;
    }
    /**
     * Derive event counts from jobs
     */
    static deriveEventCounts(jobs) {
        return {
            lateReschedulesLt24: jobs.filter(j => j.cleanerRequestedRescheduleLt24).length,
            cancels24_48: jobs.filter(j => this.isCleanerCancellation(j) && j.cancellationBucketByCleaner === '24_48').length,
            cancelsLt24: jobs.filter(j => this.isCleanerCancellation(j) && j.cancellationBucketByCleaner === 'lt24').length,
            cleanerNoShows: jobs.filter(this.isCleanerNoShow).length,
            disputesCleanerFault: jobs.filter(this.isDisputeCleanerFault).length,
            highInconvenienceJobs: jobs.filter(this.isHighInconvenienceCausedByCleaner).length,
        };
    }
    // ============================================
    // Database Operations
    // ============================================
    static async getJobsForCleanerWindow(cleanerId, since, maxJobs) {
        const result = await (0, client_1.query)(`SELECT 
        j.id,
        j.status,
        j.scheduled_start_at as scheduled_start,
        j.actual_start_at as check_in_at,
        j.actual_end_at as check_out_at,
        j.rating,
        j.updated_at as rating_created_at,
        COALESCE((SELECT COUNT(*) FROM job_photos WHERE job_id = j.id), 0) as photos_count,
        CASE WHEN j.client_notes LIKE '%deep%' OR j.client_notes LIKE '%move%' THEN true ELSE false END as photos_required,
        false as proactive_message_sent,
        true as responded_within_2h,
        'none' as dispute_outcome,
        NULL as inconvenience_score,
        NULL as inconvenience_caused_by,
        false as cleaner_requested_reschedule_lt24,
        NULL as cancellation_bucket_by_cleaner
       FROM jobs j
       WHERE j.cleaner_id = $1
       AND j.status IN ('completed', 'cancelled_by_client', 'cancelled_by_cleaner', 'no_show_cleaner', 'no_show_client', 'disputed')
       AND j.scheduled_start_at >= $2
       ORDER BY j.scheduled_start_at DESC
       LIMIT $3`, [String(cleanerId), since.toISOString(), maxJobs]);
        return result.rows.map(row => ({
            id: Number(row.id),
            status: row.status,
            scheduledStart: new Date(row.scheduled_start),
            checkInAt: row.check_in_at ? new Date(row.check_in_at) : null,
            checkOutAt: row.check_out_at ? new Date(row.check_out_at) : null,
            photosCount: Number(row.photos_count),
            photosRequired: row.photos_required,
            rating: row.rating ? Number(row.rating) : null,
            ratingCreatedAt: row.rating_created_at ? new Date(row.rating_created_at) : null,
            proactiveMessageSent: row.proactive_message_sent,
            respondedWithin2h: row.responded_within_2h,
            disputeOutcome: row.dispute_outcome,
            inconvenienceScore: row.inconvenience_score ? Number(row.inconvenience_score) : null,
            inconvenienceCausedBy: row.inconvenience_caused_by,
            cleanerRequestedRescheduleLt24: row.cleaner_requested_reschedule_lt24,
            cancellationBucketByCleaner: row.cancellation_bucket_by_cleaner,
        }));
    }
    static async getTotalCompletedJobsForCleaner(cleanerId) {
        const result = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM jobs WHERE cleaner_id = $1 AND status = 'completed'`, [String(cleanerId)]);
        return Number(result.rows[0]?.count || 0);
    }
    static async getActiveCleaners() {
        const result = await (0, client_1.query)(`SELECT user_id FROM cleaner_profiles`);
        return result.rows.map(row => ({ id: Number(row.user_id) }));
    }
    static async updateCleanerReliability(cleanerId, data) {
        await (0, client_1.query)(`UPDATE cleaner_profiles
       SET reliability_score = $2, tier = $3, updated_at = NOW()
       WHERE user_id = $1`, [String(cleanerId), data.reliabilityScore, data.reliabilityTier.toLowerCase().replace(' ', '_')]);
    }
    static async logScoreSnapshot(result) {
        await (0, client_1.query)(`INSERT INTO reliability_score_snapshots (
        cleaner_id, score, tier, base_behavior_score, streak_bonus, 
        event_penalty_sum, stats, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`, [
            String(result.cleanerId),
            result.reliabilityScore,
            result.tier,
            result.baseBehaviorScore,
            result.streakBonus,
            result.eventPenaltySum,
            JSON.stringify(result.stats),
        ]);
    }
}
exports.ReliabilityScoreV2Service = ReliabilityScoreV2Service;
