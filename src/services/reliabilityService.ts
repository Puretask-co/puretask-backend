// src/services/reliabilityService.ts
// Cleaner reliability score calculation and management

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { isTierLocked, createTierLock, createAuditLog } from "./creditEconomyService";

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
 * Compute reliability score from stats
 * 
 * Algorithm:
 * - Base score: 100
 * - Penalize cancellations: up to -40 points
 * - Penalize disputes: up to -30 points
 * - Adjust for rating: -10 to +10 points based on average rating
 * - Clamp final score between 0 and 100
 */
export function computeReliabilityScoreFromStats(stats: CleanerStats): number {
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
 */
export async function updateCleanerReliability(
  cleanerId: string,
  reason: string = "job_completed"
): Promise<ReliabilityUpdate> {
  // Get current score and tier
  const currentResult = await query<{ reliability_score: number; tier: string }>(
    `SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const previousScore = currentResult.rows[0]?.reliability_score ?? 100;
  const previousTier = currentResult.rows[0]?.tier ?? "bronze";

  // Compute new stats and score
  const stats = await computeCleanerStats(cleanerId);
  let newScore = computeReliabilityScoreFromStats(stats);
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

  return {
    score: profileResult.rows[0].reliability_score,
    tier: profileResult.rows[0].tier,
    stats,
  };
}

