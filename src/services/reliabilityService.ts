// src/services/reliabilityService.ts
// Cleaner reliability score calculation and management
// V1 CORE FEATURE: Market safety mechanism - MUST BE ENABLED

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { isTierLocked, createTierLock, createAuditLog, CREDIT_ECONOMY_CONFIG } from "./creditEconomyService";

// ============================================
// Types
// ============================================

export interface CleanerStats {
  completed_jobs: number;
  cancelled_jobs: number;
  disputed_jobs: number;
  avg_rating: number | null;
  total_jobs: number;
}

export interface ReliabilityUpdate {
  cleanerId: string;
  previousScore: number;
  newScore: number;
  stats: CleanerStats;
}

// ============================================
// Stats Computation
// ============================================

/**
 * Compute cleaner stats from the last 90 days
 */
export async function computeCleanerStats(cleanerId: string): Promise<CleanerStats> {
  const result = await query<{
    completed_jobs: string;
    cancelled_jobs: string;
    disputed_jobs: string;
    avg_rating: string | null;
    total_jobs: string;
  }>(
    `
      WITH cleaner_jobs AS (
        SELECT *
        FROM jobs
        WHERE cleaner_id = $1
          AND created_at >= NOW() - INTERVAL '90 days'
      )
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::text AS completed_jobs,
        COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled_jobs,
        COUNT(*) FILTER (WHERE status = 'disputed')::text AS disputed_jobs,
        AVG(rating)::text AS avg_rating,
        COUNT(*)::text AS total_jobs
      FROM cleaner_jobs
    `,
    [cleanerId]
  );

  const row = result.rows[0];

  return {
    completed_jobs: parseInt(row?.completed_jobs || "0", 10),
    cancelled_jobs: parseInt(row?.cancelled_jobs || "0", 10),
    disputed_jobs: parseInt(row?.disputed_jobs || "0", 10),
    avg_rating: row?.avg_rating ? parseFloat(row.avg_rating) : null,
    total_jobs: parseInt(row?.total_jobs || "0", 10),
  };
}

/**
 * Get photo compliance stats for a cleaner
 * Per Photo Proof policy: Photo compliance boosts reliability by +10 points
 * 
 * Note: Calculates compliance from job_photos table directly
 * (photo_compliance table/view may not exist in all environments)
 */
export async function getPhotoComplianceStats(cleanerId: string): Promise<{
  totalJobs: number;
  compliantJobs: number;
  complianceRate: number;
  bonusEligible: boolean;
}> {
  try {
    // Try to use photo_compliance table/view if it exists
    const result = await query<{
      total: string;
      compliant: string;
    }>(
      `
        SELECT 
          COUNT(DISTINCT j.id)::text as total,
          COUNT(DISTINCT pc.job_id)::text as compliant
        FROM jobs j
        LEFT JOIN photo_compliance pc ON pc.job_id = j.id AND pc.meets_minimum = true
        WHERE j.cleaner_id = $1
          AND j.status = 'completed'
          AND j.created_at >= NOW() - INTERVAL '90 days'
      `,
      [cleanerId]
    );

    const total = Number(result.rows[0]?.total || 0);
    const compliant = Number(result.rows[0]?.compliant || 0);
    const complianceRate = total > 0 ? compliant / total : 0;
    
    // Eligible for bonus if compliance rate >= 90%
    return {
      totalJobs: total,
      compliantJobs: compliant,
      complianceRate,
      bonusEligible: complianceRate >= 0.9,
    };
  } catch (error: any) {
    // If photo_compliance table doesn't exist, calculate from job_photos directly
    if (error?.code === '42P01' || error?.message?.includes('photo_compliance')) {
      logger.warn("photo_compliance_table_missing", {
        cleanerId,
        message: "photo_compliance table not found, calculating from job_photos",
      });
      
      // Fallback: calculate compliance from job_photos table
      // A job is compliant if it has at least one 'after' photo
      const fallbackResult = await query<{
        total: string;
        compliant: string;
      }>(
        `
          SELECT 
            COUNT(DISTINCT j.id)::text as total,
            COUNT(DISTINCT CASE WHEN jp.id IS NOT NULL THEN j.id END)::text as compliant
          FROM jobs j
          LEFT JOIN job_photos jp ON jp.job_id = j.id AND jp.type = 'after'
          WHERE j.cleaner_id = $1
            AND j.status = 'completed'
            AND j.created_at >= NOW() - INTERVAL '90 days'
        `,
        [cleanerId]
      );

      const total = Number(fallbackResult.rows[0]?.total || 0);
      const compliant = Number(fallbackResult.rows[0]?.compliant || 0);
      const complianceRate = total > 0 ? compliant / total : 0;
      
      return {
        totalJobs: total,
        compliantJobs: compliant,
        complianceRate,
        bonusEligible: complianceRate >= 0.9,
      };
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Compute reliability score from stats
 * 
 * Algorithm:
 * - Base score: 100
 * - Penalize cancellations: up to -40 points
 * - Penalize disputes: up to -30 points
 * - Adjust for rating: -10 to +10 points based on average rating
 * - Completion rate bonus: up to +10 points
 * - Photo compliance bonus: +10 points (per Photo Proof policy)
 * - Clamp final score between 0 and 100
 */
export function computeReliabilityScoreFromStats(
  stats: CleanerStats, 
  photoComplianceBonus: boolean = false
): number {
  const totalJobs = stats.completed_jobs + stats.cancelled_jobs + stats.disputed_jobs;

  // New cleaners start at 100
  if (totalJobs === 0) return 100;

  const cancellationRate = stats.cancelled_jobs / totalJobs;
  const disputeRate = stats.disputed_jobs / totalJobs;
  const avgRating = stats.avg_rating ?? 5; // Default to 5 if no ratings

  let score = 100;

  // Penalize cancellations (up to 40 points)
  score -= Math.min(40, Math.round(cancellationRate * 100));

  // Penalize disputes (up to 30 points)
  score -= Math.min(30, Math.round(disputeRate * 100));

  // Reward/penalize based on rating
  // Rating 5 = +10, Rating 4 = 0, Rating 3 = -10, etc.
  const ratingDelta = avgRating - 4;
  score += Math.round(ratingDelta * 10);

  // Completion rate bonus (up to 10 points for high completion)
  const completionRate = stats.completed_jobs / Math.max(1, totalJobs);
  score += Math.round(completionRate * 10);

  // Photo compliance bonus (per Photo Proof policy: +10 points)
  if (photoComplianceBonus) {
    score += CREDIT_ECONOMY_CONFIG.PHOTO_COMPLIANCE_BONUS;
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine tier based on reliability score
 */
export function getTierFromScore(score: number): string {
  if (score >= 95) return "platinum";
  if (score >= 85) return "gold";
  if (score >= 70) return "silver";
  return "bronze";
}

// ============================================
// Score Update Functions
// ============================================

/**
 * Update a single cleaner's reliability score
 * 
 * Features:
 * - Tier lock protection: can't demote tier within 7 days of promotion
 * - Records history for audit trail
 * - Creates tier lock on promotion
 * - Photo compliance bonus (+10 points per Photo Proof policy)
 */
export async function updateCleanerReliability(
  cleanerId: string,
  reason: string = "job_completed"
): Promise<ReliabilityUpdate> {
  // Get current score and tier
  // Handle case where reliability_score column might not exist
  let previousScore = 100;
  let previousTier = "bronze";
  
  try {
    const currentResult = await query<{ reliability_score: number; tier: string }>(
      `SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`,
      [cleanerId]
    );
    previousScore = currentResult.rows[0]?.reliability_score ?? 100;
    previousTier = currentResult.rows[0]?.tier ?? "bronze";
  } catch (error: any) {
    // If column doesn't exist, use defaults
    if (error?.code === '42703' && error?.message?.includes('reliability_score')) {
      logger.warn("reliability_score_column_missing_on_read", {
        cleanerId,
        message: "reliability_score column not found, using defaults",
      });
      const currentResult = await query<{ tier: string }>(
        `SELECT tier FROM cleaner_profiles WHERE user_id = $1`,
        [cleanerId]
      );
      previousTier = currentResult.rows[0]?.tier ?? "bronze";
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // Compute new stats and score
  const stats = await computeCleanerStats(cleanerId);
  
  // Check photo compliance for bonus (per Photo Proof policy: +10 points)
  const photoStats = await getPhotoComplianceStats(cleanerId);
  const photoBonus = photoStats.bonusEligible;
  
  const newScore = computeReliabilityScoreFromStats(stats, photoBonus);
  let newTier = getTierFromScore(newScore);

  // Check tier lock - prevent demotion during lock period
  const tierLocked = await isTierLocked(cleanerId);
  const tierOrder = ["bronze", "silver", "gold", "platinum"];
  const previousTierIndex = tierOrder.indexOf(previousTier);
  const newTierIndex = tierOrder.indexOf(newTier);

  if (tierLocked && newTierIndex < previousTierIndex) {
    // Keep the locked tier, but update score
    newTier = previousTier;
    logger.info("tier_demotion_blocked_by_lock", {
      cleanerId,
      attemptedTier: getTierFromScore(newScore),
      lockedTier: previousTier,
    });
  }

  // Check for promotion - create tier lock
  if (newTierIndex > previousTierIndex) {
    await createTierLock(cleanerId, newTier, "promotion");
  }

  // Update profile
  // Handle case where reliability_score column might not exist (schema migration issue)
  try {
    await query(
      `
        UPDATE cleaner_profiles
        SET reliability_score = $2,
            tier = $3,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [cleanerId, newScore, newTier]
    );
  } catch (error: any) {
    // If column doesn't exist (error code 42703 = undefined column), try without reliability_score
    if (error?.code === '42703' && error?.message?.includes('reliability_score')) {
      logger.warn("reliability_score_column_missing", {
        cleanerId,
        message: "reliability_score column not found, updating tier only",
      });
      // Fallback: update tier only
      await query(
        `
          UPDATE cleaner_profiles
          SET tier = $2,
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [cleanerId, newTier]
      );
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // Record history
  await query(
    `
      INSERT INTO reliability_history (cleaner_id, old_score, new_score, old_tier, new_tier, reason, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      cleanerId,
      previousScore,
      newScore,
      previousTier,
      newTier,
      reason,
      JSON.stringify({ stats, tierLocked }),
    ]
  );

  logger.info("reliability_updated", {
    cleanerId,
    previousScore,
    newScore,
    previousTier,
    newTier,
    tierLocked,
    stats,
    photoComplianceBonus: photoBonus,
    photoComplianceRate: photoStats.complianceRate,
  });

  return {
    cleanerId,
    previousScore,
    newScore,
    stats,
  };
}

/**
 * Recalculate reliability for all cleaners
 * Used by nightly worker
 */
export async function recalcAllCleanersReliability(): Promise<{
  processed: number;
  failed: number;
  updates: ReliabilityUpdate[];
}> {
  const cleaners = await query<{ user_id: string }>(
    `SELECT user_id FROM cleaner_profiles`
  );

  const updates: ReliabilityUpdate[] = [];
  let processed = 0;
  let failed = 0;

  for (const cleaner of cleaners.rows) {
    try {
      const update = await updateCleanerReliability(cleaner.user_id);
      updates.push(update);
      processed++;
    } catch (err) {
      logger.error("reliability_bulk_failed", {
        cleanerId: cleaner.user_id,
        error: (err as Error).message,
      });
      failed++;
    }
  }

  logger.info("reliability_bulk_completed", {
    processed,
    failed,
    total: cleaners.rows.length,
  });

  return { processed, failed, updates };
}

/**
 * Get cleaner reliability info
 */
export async function getCleanerReliabilityInfo(cleanerId: string): Promise<{
  score: number;
  tier: string;
  stats: CleanerStats;
}> {
  const profileResult = await query<{ reliability_score: number; tier: string }>(
    `SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  if (profileResult.rows.length === 0) {
    throw Object.assign(new Error("Cleaner profile not found"), { statusCode: 404 });
  }

  const stats = await computeCleanerStats(cleanerId);

  // reliability_score may come back as string from DB, ensure it's a number
  const score = typeof profileResult.rows[0].reliability_score === 'string' 
    ? parseFloat(profileResult.rows[0].reliability_score) 
    : profileResult.rows[0].reliability_score;

  return {
    score: score,
    tier: profileResult.rows[0].tier,
    stats,
  };
}

