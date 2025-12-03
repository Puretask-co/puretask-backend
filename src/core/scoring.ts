// src/core/scoring.ts
// Scoring helpers for risk and reliability calculations

import { ClientRiskScore, CleanerMetrics } from './types';

// ============================================
// Risk Score Helpers
// ============================================

export type RiskBand = 'normal' | 'mild' | 'elevated' | 'high' | 'critical';

/**
 * Compute risk band from score
 * 0-9: normal
 * 10-19: mild
 * 20-39: elevated
 * 40-59: high
 * 60-100: critical
 */
export function computeRiskBand(score: number): RiskBand {
  if (score <= 9) return 'normal';
  if (score <= 19) return 'mild';
  if (score <= 39) return 'elevated';
  if (score <= 59) return 'high';
  return 'critical';
}

// ============================================
// Reliability Score Helpers
// ============================================

export type ReliabilityTier = 'Developing' | 'Semi Pro' | 'Pro' | 'Elite';

/**
 * Compute reliability tier from score
 * 0-59: Developing
 * 60-74: Semi Pro
 * 75-89: Pro
 * 90-100: Elite
 */
export function computeReliabilityTier(score: number): ReliabilityTier {
  if (score < 60) return 'Developing';
  if (score < 75) return 'Semi Pro';
  if (score < 90) return 'Pro';
  return 'Elite';
}

/**
 * Clamp a score between min and max
 */
export function clampScore(score: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, score));
}

/**
 * Compute reliability base points from metrics
 * 
 * Weights (per spec):
 * - Attendance: 25 points
 * - Punctuality: 20 points
 * - Photo compliance: 15 points
 * - Communication: 10 points
 * - Completion: 10 points
 * - Ratings: 10 points
 * Total: 90 points max (base behavior score)
 */
export function computeReliabilityBasePoints(metrics: CleanerMetrics): number {
  const {
    totalJobsWindow,
    attendedJobs,
    onTimeCheckins,
    photoCompliantJobs,
    communicationOkJobs,
    completionOkJobs,
    ratingsSum,
    ratingsCount,
  } = metrics;

  if (totalJobsWindow === 0) {
    // New cleaner baseline
    return 70;
  }

  const attendanceRate = attendedJobs / totalJobsWindow; // 0–1
  const onTimeRate = attendedJobs ? onTimeCheckins / attendedJobs : 1;
  const photoRate = totalJobsWindow ? photoCompliantJobs / totalJobsWindow : 1;
  const commRate = totalJobsWindow ? communicationOkJobs / totalJobsWindow : 1;
  const completionRate = totalJobsWindow ? completionOkJobs / totalJobsWindow : 1;
  const avgRating = ratingsCount ? ratingsSum / ratingsCount : 5;

  let score = 0;

  // Attendance (0-25 points)
  score += attendanceRate * 25;
  
  // Punctuality (0-20 points)
  score += onTimeRate * 20;
  
  // Photo compliance (0-15 points)
  score += photoRate * 15;
  
  // Communication (0-10 points)
  score += commRate * 10;
  
  // Completion (0-10 points)
  score += completionRate * 10;

  // Ratings: map 1–5 stars to 0–10 points
  // 3.0 → 0, 4.0 → 5, 5.0 → 10
  const normalizedRating = clampScore((avgRating - 3) / 2, 0, 1);
  score += normalizedRating * 10;

  return score;
}

/**
 * Get payout percentage based on tier
 * Per Terms of Service:
 * - Bronze (Developing): 80%
 * - Silver (Semi Pro): 82%
 * - Gold (Pro): 84%
 * - Platinum (Elite): 85%
 */
export function getPayoutPercentForTier(tier: ReliabilityTier): number {
  switch (tier) {
    case 'Elite': return 85;
    case 'Pro': return 84;
    case 'Semi Pro': return 82;
    case 'Developing': return 80;
    default: return 80;
  }
}

/**
 * Get credit rate range for tier (credits per hour)
 * - Developing: 150-350
 * - Semi Pro: 350-450
 * - Pro: 450-600
 * - Elite: 600-850
 */
export function getCreditRateRangeForTier(tier: ReliabilityTier): { min: number; max: number } {
  switch (tier) {
    case 'Elite': return { min: 600, max: 850 };
    case 'Pro': return { min: 450, max: 600 };
    case 'Semi Pro': return { min: 350, max: 450 };
    case 'Developing': return { min: 150, max: 350 };
    default: return { min: 150, max: 350 };
  }
}

