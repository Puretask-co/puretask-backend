// src/services/jobMatchingService.ts
// Job matching algorithm - Auto-assign cleaners to jobs

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { isCleanerAvailableForSlot, getPreferences } from "./availabilityService";
import { Job, CleanerProfile } from "../types/db";

// ============================================
// Types
// ============================================

export interface CleanerCandidate {
  cleanerId: string;
  email: string;
  tier: string;
  reliabilityScore: number;
  hourlyRateCredits: number;
  distanceMiles: number | null;
  score: number;  // Computed match score
  reasons: string[];  // Why this score
}

export interface MatchResult {
  jobId: string;
  candidates: CleanerCandidate[];
  bestMatch: CleanerCandidate | null;
  autoAssigned: boolean;
  reason: string;
}

export interface MatchingWeights {
  reliability: number;
  tier: number;
  distance: number;
  priceMatch: number;
  pastJobs: number;
  responseRate: number;
}

// Default weights for scoring
const DEFAULT_WEIGHTS: MatchingWeights = {
  reliability: 0.30,    // 30% weight on reliability
  tier: 0.20,          // 20% weight on tier
  distance: 0.15,      // 15% weight on distance
  priceMatch: 0.15,    // 15% weight on price match
  pastJobs: 0.10,      // 10% weight on past jobs with client
  responseRate: 0.10,  // 10% weight on response rate
};

// Tier rankings for scoring
const TIER_SCORES: Record<string, number> = {
  platinum: 100,
  gold: 80,
  silver: 60,
  bronze: 40,
};

// ============================================
// Core Matching Algorithm
// ============================================

/**
 * Find matching cleaners for a job
 */
export async function findMatchingCleaners(
  job: Job,
  options: {
    limit?: number;
    minReliability?: number;
    weights?: Partial<MatchingWeights>;
    autoAssign?: boolean;
  } = {}
): Promise<MatchResult> {
  const {
    limit = 10,
    minReliability = 50,
    weights = {},
    autoAssign = false,
  } = options;

  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };

  logger.info("job_matching_started", {
    jobId: job.id,
    scheduledStart: job.scheduled_start_at,
    address: job.address,
  });

  // Step 1: Get all active cleaners with their profiles
  const cleanersResult = await query<{
    user_id: string;
    email: string;
    tier: string;
    reliability_score: number;
    hourly_rate_credits: number;
    latitude: number | null;
    longitude: number | null;
  }>(
    `
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
    `,
    [minReliability]
  );

  const candidates: CleanerCandidate[] = [];

  // Step 2: Filter by availability and score each cleaner
  for (const cleaner of cleanersResult.rows) {
    const startAt = new Date(job.scheduled_start_at);
    const endAt = new Date(job.scheduled_end_at);

    // Check availability
    const isAvailable = await isCleanerAvailableForSlot(cleaner.user_id, startAt, endAt);
    if (!isAvailable) continue;

    // Check preferences match
    const prefs = await getPreferences(cleaner.user_id);
    const jobDurationHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);

    if (prefs) {
      if (jobDurationHours < prefs.min_job_duration_h) continue;
      if (jobDurationHours > prefs.max_job_duration_h) continue;
    }

    // Calculate distance (simplified - would use real geocoding in production)
    const distanceMiles = calculateDistance(
      job.latitude,
      job.longitude,
      cleaner.latitude,
      cleaner.longitude
    );

    // Get past jobs with this client
    const pastJobsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM jobs WHERE client_id = $1 AND cleaner_id = $2 AND status = 'completed'`,
      [job.client_id, cleaner.user_id]
    );
    const pastJobsCount = Number(pastJobsResult.rows[0]?.count || 0);

    // Calculate response rate (jobs accepted / jobs offered in last 30 days)
    const responseRateResult = await query<{ offered: string; accepted: string }>(
      `
        SELECT 
          COUNT(*) as offered,
          COUNT(*) FILTER (WHERE status != 'cancelled') as accepted
        FROM jobs
        WHERE cleaner_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
      `,
      [cleaner.user_id]
    );
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
    logger.info("job_auto_assigned", {
      jobId: job.id,
      cleanerId: bestMatch.cleanerId,
      score: bestMatch.score,
    });
  }

  const result: MatchResult = {
    jobId: job.id,
    candidates: topCandidates,
    bestMatch,
    autoAssigned,
    reason: autoAssigned
      ? `Auto-assigned to ${bestMatch!.email} with score ${bestMatch!.score}`
      : candidates.length === 0
      ? "No available cleaners found"
      : `Found ${candidates.length} candidates, best score: ${bestMatch?.score || 0}`,
  };

  logger.info("job_matching_completed", {
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
function calculateMatchScore(params: {
  reliability: number;
  tier: string;
  distance: number | null;
  hourlyRate: number;
  jobRate: number;
  pastJobs: number;
  responseRate: number;
  weights: MatchingWeights;
}): { score: number; reasons: string[] } {
  const { reliability, tier, distance, hourlyRate, jobRate, pastJobs, responseRate, weights } = params;
  const reasons: string[] = [];

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
  const score =
    reliabilityScore * weights.reliability +
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
function calculateDistance(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }

  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Assign a cleaner to a job
 */
export async function assignCleanerToJob(jobId: string, cleanerId: string): Promise<void> {
  await query(
    `UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [jobId, cleanerId]
  );

  // Log the assignment event
  await query(
    `
      INSERT INTO job_events (job_id, actor_type, actor_id, event_type, payload)
      VALUES ($1, 'system', NULL, 'job.auto_assigned', $2::jsonb)
    `,
    [jobId, JSON.stringify({ cleanerId, assignedBy: "matching_algorithm" })]
  );
}

// ============================================
// Broadcast & Offer System
// ============================================

/**
 * Broadcast job to multiple cleaners
 */
export async function broadcastJobToCleaners(
  job: Job,
  cleanerIds: string[],
  expiresInMinutes: number = 30
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  for (const cleanerId of cleanerIds) {
    await query(
      `
        INSERT INTO job_offers (job_id, cleaner_id, expires_at, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (job_id, cleaner_id) DO UPDATE
        SET expires_at = EXCLUDED.expires_at, status = 'pending'
      `,
      [job.id, cleanerId, expiresAt.toISOString()]
    );
  }

  logger.info("job_broadcast", {
    jobId: job.id,
    cleanerCount: cleanerIds.length,
    expiresAt,
  });
}

/**
 * Cleaner accepts a job offer
 */
export async function acceptJobOffer(
  jobId: string,
  cleanerId: string
): Promise<{ success: boolean; reason: string }> {
  // Check if offer is still valid
  const offerResult = await query<{ status: string; expires_at: string }>(
    `SELECT status, expires_at FROM job_offers WHERE job_id = $1 AND cleaner_id = $2`,
    [jobId, cleanerId]
  );

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
  const jobResult = await query<{ cleaner_id: string | null; status: string }>(
    `SELECT cleaner_id, status FROM jobs WHERE id = $1`,
    [jobId]
  );

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
  await query(
    `UPDATE job_offers SET status = 'accepted' WHERE job_id = $1 AND cleaner_id = $2`,
    [jobId, cleanerId]
  );

  // Decline all other offers for this job
  await query(
    `UPDATE job_offers SET status = 'declined_by_system' WHERE job_id = $1 AND cleaner_id != $2 AND status = 'pending'`,
    [jobId, cleanerId]
  );

  logger.info("job_offer_accepted", { jobId, cleanerId });

  return { success: true, reason: "Job assigned successfully" };
}

/**
 * Cleaner declines a job offer
 */
export async function declineJobOffer(
  jobId: string,
  cleanerId: string,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE job_offers SET status = 'declined', decline_reason = $3 WHERE job_id = $1 AND cleaner_id = $2`,
    [jobId, cleanerId, reason ?? null]
  );

  logger.info("job_offer_declined", { jobId, cleanerId, reason });
}

// ============================================
// Auto-Assignment Worker Logic
// ============================================

/**
 * Process unassigned jobs and try to match them
 */
export async function processUnassignedJobs(): Promise<{
  processed: number;
  assigned: number;
  failed: number;
}> {
  // Get jobs that need assignment
  const jobsResult = await query<Job>(
    `
      SELECT * FROM jobs
      WHERE status = 'requested'
        AND cleaner_id IS NULL
        AND scheduled_start_at > NOW() + INTERVAL '2 hours'
      ORDER BY scheduled_start_at ASC
      LIMIT 50
    `
  );

  let assigned = 0;
  let failed = 0;

  for (const job of jobsResult.rows) {
    try {
      const result = await findMatchingCleaners(job, { autoAssign: true });
      if (result.autoAssigned) {
        assigned++;
      } else {
        failed++;
      }
    } catch (err) {
      logger.error("job_matching_error", {
        jobId: job.id,
        error: (err as Error).message,
      });
      failed++;
    }
  }

  logger.info("unassigned_jobs_processed", {
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

