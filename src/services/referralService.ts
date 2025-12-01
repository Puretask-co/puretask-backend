// src/services/referralService.ts
// Referral system for cleaners and clients

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { awardBonusCredits } from "./creditEconomyService";

// ============================================
// Configuration
// ============================================

export const REFERRAL_CONFIG = {
  DEFAULT_REFERRER_REWARD: 20,
  DEFAULT_REFEREE_REWARD: 10,
  JOBS_REQUIRED_TO_QUALIFY: 3,
  CODE_LENGTH: 8,
  QUALIFICATION_WINDOW_DAYS: 30,
};

// ============================================
// Types
// ============================================

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  type: string;
  reward_credits: number;
  referee_credits: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  status: string;
  referee_role: string;
  jobs_required: number;
  jobs_completed: number;
  referrer_reward: number;
  referee_reward: number;
  rewarded_at: string | null;
  created_at: string;
}

// ============================================
// Referral Code Management
// ============================================

/**
 * Generate a unique referral code for a user
 */
export async function generateReferralCode(
  userId: string,
  options?: {
    type?: string;
    rewardCredits?: number;
    refereeCredits?: number;
    maxUses?: number;
    expiresAt?: Date;
  }
): Promise<ReferralCode> {
  const {
    type = "standard",
    rewardCredits = REFERRAL_CONFIG.DEFAULT_REFERRER_REWARD,
    refereeCredits = REFERRAL_CONFIG.DEFAULT_REFEREE_REWARD,
    maxUses,
    expiresAt,
  } = options || {};

  // Check if user already has an active code
  const existingResult = await query<ReferralCode>(
    `SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = true`,
    [userId]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0];
  }

  // Generate unique code
  const code = await generateUniqueCode();

  const result = await query<ReferralCode>(
    `
      INSERT INTO referral_codes (user_id, code, type, reward_credits, referee_credits, max_uses, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [userId, code, type, rewardCredits, refereeCredits, maxUses ?? null, expiresAt?.toISOString() ?? null]
  );

  logger.info("referral_code_generated", { userId, code });

  return result.rows[0];
}

/**
 * Get user's referral code
 */
export async function getUserReferralCode(userId: string): Promise<ReferralCode | null> {
  const result = await query<ReferralCode>(
    `SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/**
 * Validate a referral code
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  code?: ReferralCode;
  reason?: string;
}> {
  const result = await query<ReferralCode>(
    `SELECT * FROM referral_codes WHERE code = $1`,
    [code.toUpperCase()]
  );

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
export async function applyReferralCode(
  refereeId: string,
  refereeRole: "client" | "cleaner",
  referralCode: string
): Promise<Referral | null> {
  // Validate code
  const validation = await validateReferralCode(referralCode);
  if (!validation.valid || !validation.code) {
    logger.warn("invalid_referral_code_used", { refereeId, referralCode, reason: validation.reason });
    return null;
  }

  const code = validation.code;

  // Don't allow self-referral
  if (code.user_id === refereeId) {
    logger.warn("self_referral_attempted", { refereeId, referralCode });
    return null;
  }

  // Check if referee already has a referral
  const existingReferral = await query<Referral>(
    `SELECT * FROM referrals WHERE referee_id = $1`,
    [refereeId]
  );

  if (existingReferral.rows.length > 0) {
    logger.warn("user_already_referred", { refereeId });
    return null;
  }

  // Create referral record
  const result = await query<Referral>(
    `
      INSERT INTO referrals (
        referrer_id, referee_id, referral_code, referee_role,
        jobs_required, referrer_reward, referee_reward
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      code.user_id,
      refereeId,
      code.code,
      refereeRole,
      REFERRAL_CONFIG.JOBS_REQUIRED_TO_QUALIFY,
      code.reward_credits,
      code.referee_credits,
    ]
  );

  // Increment code uses
  await query(
    `UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = $1`,
    [code.id]
  );

  // Award referee their bonus immediately
  await awardBonusCredits({
    userId: refereeId,
    amount: code.referee_credits,
    bonusType: "referral",
    source: `referral:${code.code}`,
  });

  logger.info("referral_applied", {
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
export async function checkReferralQualification(userId: string): Promise<void> {
  // Get pending referral for this user
  const referralResult = await query<Referral>(
    `SELECT * FROM referrals WHERE referee_id = $1 AND status = 'pending'`,
    [userId]
  );

  if (referralResult.rows.length === 0) return;

  const referral = referralResult.rows[0];

  // Count completed jobs since referral
  const jobsResult = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text as count
      FROM jobs
      WHERE ${referral.referee_role === 'client' ? 'client_id' : 'cleaner_id'} = $1
        AND status = 'completed'
        AND created_at >= $2
    `,
    [userId, referral.created_at]
  );

  const jobsCompleted = Number(jobsResult.rows[0]?.count || 0);

  // Update jobs completed count
  await query(
    `UPDATE referrals SET jobs_completed = $2 WHERE id = $1`,
    [referral.id, jobsCompleted]
  );

  // Check if qualified
  if (jobsCompleted >= referral.jobs_required) {
    await processReferralReward(referral.id);
  }
}

/**
 * Process referral reward
 */
async function processReferralReward(referralId: string): Promise<void> {
  const referralResult = await query<Referral>(
    `SELECT * FROM referrals WHERE id = $1 AND status = 'pending'`,
    [referralId]
  );

  if (referralResult.rows.length === 0) return;

  const referral = referralResult.rows[0];

  // Award referrer their bonus
  await awardBonusCredits({
    userId: referral.referrer_id,
    amount: referral.referrer_reward,
    bonusType: "referral",
    source: `referral:${referral.referral_code}:qualified`,
  });

  // Update referral status
  await query(
    `UPDATE referrals SET status = 'rewarded', rewarded_at = NOW() WHERE id = $1`,
    [referralId]
  );

  // Emit event
  await publishEvent({
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

  logger.info("referral_rewarded", {
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
export async function getUserReferralStats(userId: string): Promise<{
  code: string | null;
  totalReferrals: number;
  pendingReferrals: number;
  qualifiedReferrals: number;
  totalEarned: number;
}> {
  const code = await getUserReferralCode(userId);

  const statsResult = await query<{
    total: string;
    pending: string;
    qualified: string;
    earned: string;
  }>(
    `
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
        COUNT(*) FILTER (WHERE status = 'rewarded')::text as qualified,
        COALESCE(SUM(referrer_reward) FILTER (WHERE status = 'rewarded'), 0)::text as earned
      FROM referrals
      WHERE referrer_id = $1
    `,
    [userId]
  );

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
export async function getReferralLeaderboard(limit: number = 10): Promise<Array<{
  userId: string;
  email: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarned: number;
}>> {
  const result = await query<{
    referrer_id: string;
    email: string;
    total_referrals: string;
    successful_referrals: string;
    total_credits_earned: string;
  }>(
    `SELECT * FROM referral_leaderboard LIMIT $1`,
    [limit]
  );

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

async function generateUniqueCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
  let code: string;
  let attempts = 0;

  do {
    code = "";
    for (let i = 0; i < REFERRAL_CONFIG.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;

    // Check if exists
    const existing = await query(
      `SELECT id FROM referral_codes WHERE code = $1`,
      [code]
    );

    if (existing.rows.length === 0) {
      return code;
    }
  } while (attempts < 10);

  // Fallback: use UUID suffix
  return code + Date.now().toString(36).toUpperCase().slice(-4);
}

