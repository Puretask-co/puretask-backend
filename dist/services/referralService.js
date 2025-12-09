"use strict";
// src/services/referralService.ts
// Referral system for cleaners and clients
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFERRAL_CONFIG = void 0;
exports.generateReferralCode = generateReferralCode;
exports.getUserReferralCode = getUserReferralCode;
exports.validateReferralCode = validateReferralCode;
exports.applyReferralCode = applyReferralCode;
exports.checkReferralQualification = checkReferralQualification;
exports.getUserReferralStats = getUserReferralStats;
exports.getReferralLeaderboard = getReferralLeaderboard;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const creditEconomyService_1 = require("./creditEconomyService");
// ============================================
// Configuration
// ============================================
exports.REFERRAL_CONFIG = {
    DEFAULT_REFERRER_REWARD: 20,
    DEFAULT_REFEREE_REWARD: 10,
    JOBS_REQUIRED_TO_QUALIFY: 3,
    CODE_LENGTH: 8,
    QUALIFICATION_WINDOW_DAYS: 30,
};
// ============================================
// Referral Code Management
// ============================================
/**
 * Generate a unique referral code for a user
 */
async function generateReferralCode(userId, options) {
    const { type = "standard", rewardCredits = exports.REFERRAL_CONFIG.DEFAULT_REFERRER_REWARD, refereeCredits = exports.REFERRAL_CONFIG.DEFAULT_REFEREE_REWARD, maxUses, expiresAt, } = options || {};
    // Check if user already has an active code
    const existingResult = await (0, client_1.query)(`SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = true`, [userId]);
    if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
    }
    // Generate unique code
    const code = await generateUniqueCode();
    const result = await (0, client_1.query)(`
      INSERT INTO referral_codes (user_id, code, type, reward_credits, referee_credits, max_uses, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, code, type, rewardCredits, refereeCredits, maxUses ?? null, expiresAt?.toISOString() ?? null]);
    logger_1.logger.info("referral_code_generated", { userId, code });
    return result.rows[0];
}
/**
 * Get user's referral code
 */
async function getUserReferralCode(userId) {
    const result = await (0, client_1.query)(`SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`, [userId]);
    return result.rows[0] ?? null;
}
/**
 * Validate a referral code
 */
async function validateReferralCode(code) {
    const result = await (0, client_1.query)(`SELECT * FROM referral_codes WHERE code = $1`, [code.toUpperCase()]);
    if (result.rows.length === 0) {
        return { valid: false, reason: "Code not found" };
    }
    const referralCode = result.rows[0];
    if (!referralCode.is_active) {
        return { valid: false, reason: "Code is no longer active" };
    }
    if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
        return { valid: false, reason: "Code has expired" };
    }
    if (referralCode.max_uses && referralCode.uses_count >= referralCode.max_uses) {
        return { valid: false, reason: "Code has reached maximum uses" };
    }
    return { valid: true, code: referralCode };
}
// ============================================
// Referral Processing
// ============================================
/**
 * Apply referral code during registration
 */
async function applyReferralCode(refereeId, refereeRole, referralCode) {
    // Validate code
    const validation = await validateReferralCode(referralCode);
    if (!validation.valid || !validation.code) {
        logger_1.logger.warn("invalid_referral_code_used", { refereeId, referralCode, reason: validation.reason });
        return null;
    }
    const code = validation.code;
    // Don't allow self-referral
    if (code.user_id === refereeId) {
        logger_1.logger.warn("self_referral_attempted", { refereeId, referralCode });
        return null;
    }
    // Check if referee already has a referral
    const existingReferral = await (0, client_1.query)(`SELECT * FROM referrals WHERE referee_id = $1`, [refereeId]);
    if (existingReferral.rows.length > 0) {
        logger_1.logger.warn("user_already_referred", { refereeId });
        return null;
    }
    // Create referral record
    const result = await (0, client_1.query)(`
      INSERT INTO referrals (
        referrer_id, referee_id, referral_code, referee_role,
        jobs_required, referrer_reward, referee_reward
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
        code.user_id,
        refereeId,
        code.code,
        refereeRole,
        exports.REFERRAL_CONFIG.JOBS_REQUIRED_TO_QUALIFY,
        code.reward_credits,
        code.referee_credits,
    ]);
    // Increment code uses
    await (0, client_1.query)(`UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = $1`, [code.id]);
    // Award referee their bonus immediately
    await (0, creditEconomyService_1.awardBonusCredits)({
        userId: refereeId,
        amount: code.referee_credits,
        bonusType: "referral",
        source: `referral:${code.code}`,
    });
    logger_1.logger.info("referral_applied", {
        referrerId: code.user_id,
        refereeId,
        code: code.code,
        refereeReward: code.referee_credits,
    });
    return result.rows[0];
}
/**
 * Check and process referral qualification when job completes
 */
async function checkReferralQualification(userId) {
    // Get pending referral for this user
    const referralResult = await (0, client_1.query)(`SELECT * FROM referrals WHERE referee_id = $1 AND status = 'pending'`, [userId]);
    if (referralResult.rows.length === 0)
        return;
    const referral = referralResult.rows[0];
    // Count completed jobs since referral
    const jobsResult = await (0, client_1.query)(`
      SELECT COUNT(*)::text as count
      FROM jobs
      WHERE ${referral.referee_role === 'client' ? 'client_id' : 'cleaner_id'} = $1
        AND status = 'completed'
        AND created_at >= $2
    `, [userId, referral.created_at]);
    const jobsCompleted = Number(jobsResult.rows[0]?.count || 0);
    // Update jobs completed count
    await (0, client_1.query)(`UPDATE referrals SET jobs_completed = $2 WHERE id = $1`, [referral.id, jobsCompleted]);
    // Check if qualified
    if (jobsCompleted >= referral.jobs_required) {
        await processReferralReward(referral.id);
    }
}
/**
 * Process referral reward
 */
async function processReferralReward(referralId) {
    const referralResult = await (0, client_1.query)(`SELECT * FROM referrals WHERE id = $1 AND status = 'pending'`, [referralId]);
    if (referralResult.rows.length === 0)
        return;
    const referral = referralResult.rows[0];
    // Award referrer their bonus
    await (0, creditEconomyService_1.awardBonusCredits)({
        userId: referral.referrer_id,
        amount: referral.referrer_reward,
        bonusType: "referral",
        source: `referral:${referral.referral_code}:qualified`,
    });
    // Update referral status
    await (0, client_1.query)(`UPDATE referrals SET status = 'rewarded', rewarded_at = NOW() WHERE id = $1`, [referralId]);
    // Emit event
    await (0, events_1.publishEvent)({
        jobId: "", // No specific job
        actorType: "system",
        eventName: "referral.rewarded",
        payload: {
            referralId,
            referrerId: referral.referrer_id,
            refereeId: referral.referee_id,
            reward: referral.referrer_reward,
        },
    });
    logger_1.logger.info("referral_rewarded", {
        referralId,
        referrerId: referral.referrer_id,
        refereeId: referral.referee_id,
        reward: referral.referrer_reward,
    });
}
// ============================================
// Stats & Leaderboard
// ============================================
/**
 * Get user's referral stats
 */
async function getUserReferralStats(userId) {
    const code = await getUserReferralCode(userId);
    const statsResult = await (0, client_1.query)(`
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
        COUNT(*) FILTER (WHERE status = 'rewarded')::text as qualified,
        COALESCE(SUM(referrer_reward) FILTER (WHERE status = 'rewarded'), 0)::text as earned
      FROM referrals
      WHERE referrer_id = $1
    `, [userId]);
    const stats = statsResult.rows[0];
    return {
        code: code?.code ?? null,
        totalReferrals: Number(stats?.total || 0),
        pendingReferrals: Number(stats?.pending || 0),
        qualifiedReferrals: Number(stats?.qualified || 0),
        totalEarned: Number(stats?.earned || 0),
    };
}
/**
 * Get referral leaderboard
 */
async function getReferralLeaderboard(limit = 10) {
    const result = await (0, client_1.query)(`SELECT * FROM referral_leaderboard LIMIT $1`, [limit]);
    return result.rows.map((row) => ({
        userId: row.referrer_id,
        email: row.email,
        totalReferrals: Number(row.total_referrals),
        successfulReferrals: Number(row.successful_referrals),
        totalEarned: Number(row.total_credits_earned),
    }));
}
// ============================================
// Helpers
// ============================================
async function generateUniqueCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
    let code;
    let attempts = 0;
    do {
        code = "";
        for (let i = 0; i < exports.REFERRAL_CONFIG.CODE_LENGTH; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        attempts++;
        // Check if exists
        const existing = await (0, client_1.query)(`SELECT id FROM referral_codes WHERE code = $1`, [code]);
        if (existing.rows.length === 0) {
            return code;
        }
    } while (attempts < 10);
    // Fallback: use UUID suffix
    return code + Date.now().toString(36).toUpperCase().slice(-4);
}
