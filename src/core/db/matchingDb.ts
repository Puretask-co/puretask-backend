// src/core/db/matchingDb.ts
// Database layer for Matching System (Tasks 5.1-5.2)

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { ReliabilityTier } from '../scoring';

// ============================================
// Types
// ============================================

export interface CleanerCandidate {
  id: number;
  tier: ReliabilityTier;
  reliabilityScore: number;
  lowFlexibilityBadge: boolean;
  baseLat: number;
  baseLng: number;
  maxRadiusKm: number;
  isActive: boolean;
  isSuspended: boolean;
  maxJobsPerDay: number | null;
  jobsCountForDay: number;
  availableAtTime: boolean;
  supportsBasic: boolean;
  supportsDeep: boolean;
  supportsMoveOut: boolean;
  supportsRecurring: boolean;
  acceptsHighRiskClients: boolean;
  hasGoodHistoryWithClient: boolean;
}

export interface JobMatchingContext {
  jobId: number;
  clientId: number;
  jobLat: number;
  jobLng: number;
  jobType: 'basic' | 'deep' | 'move_out' | 'recurring';
  requestedStart: Date;
  requestedEnd: Date;
}

// ============================================
// 5.1 - Get Candidates for Job
// ============================================

/**
 * Task 5.1: db.cleaners.getCandidatesForJob(jobLat, jobLng, requestedStart, jobType)
 * 
 * Retrieves candidate cleaners filtered by:
 * - Location (within travel radius)
 * - Availability (no conflicts, within working hours)
 * - Capacity (not over max jobs per day)
 * - Job type support
 * - Active status (not suspended)
 */
export async function getCandidatesForJob(
  context: JobMatchingContext,
  clientId: number
): Promise<CleanerCandidate[]> {
  const {
    jobLat,
    jobLng,
    jobType,
    requestedStart,
    requestedEnd,
  } = context;

  const dayOfWeek = requestedStart.getDay();
  const startTimeStr = requestedStart.toTimeString().substring(0, 5);
  const endTimeStr = requestedEnd.toTimeString().substring(0, 5);
  const dateStr = requestedStart.toISOString().split('T')[0];

  // This is a complex query that:
  // 1. Filters by active status
  // 2. Filters by availability (weekly blocks)
  // 3. Filters by no overlapping jobs
  // 4. Filters by no blackout periods
  // 5. Calculates distance (using Haversine approximation)
  // 6. Checks for repeat client history
  // 7. Gets job count for today

  const result = await query<any>(
    `WITH candidate_cleaners AS (
      SELECT 
        u.id,
        cp.reliability_score,
        cp.tier,
        cp.latitude as base_lat,
        cp.longitude as base_lng,
        COALESCE(cp.travel_radius_km, 50) as max_radius_km,
        cp.is_available as is_active,
        false as is_suspended,
        cp.max_jobs_per_day,
        COALESCE(cfp.low_flexibility_active, false) as low_flexibility_badge,
        COALESCE(cp.accepts_high_risk, false) as accepts_high_risk_clients,
        
        -- Calculate approximate distance using Haversine
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians($1)) * cos(radians(cp.latitude)) * 
            cos(radians(cp.longitude) - radians($2)) + 
            sin(radians($1)) * sin(radians(cp.latitude))
          ))
        )) as distance_km,
        
        -- Check for repeat client history
        EXISTS (
          SELECT 1 FROM jobs j2 
          WHERE j2.cleaner_id = u.id 
          AND j2.client_id = $9
          AND j2.status = 'completed'
          AND j2.rating >= 4
        ) as has_good_history
        
      FROM users u
      JOIN cleaner_profiles cp ON cp.user_id = u.id
      LEFT JOIN cleaner_flex_profiles cfp ON cfp.cleaner_id = u.id
      WHERE u.role = 'cleaner'
      AND cp.is_available = true
      
      -- Within weekly availability
      AND EXISTS (
        SELECT 1 FROM availability_blocks ab
        WHERE ab.cleaner_id = u.id
        AND ab.day_of_week = $3
        AND ab.start_time <= $4::time
        AND ab.end_time >= $5::time
      )
      
      -- No overlapping jobs
      AND NOT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.cleaner_id = u.id
        AND j.status NOT IN ('cancelled', 'completed')
        AND j.scheduled_start_at < $7
        AND j.scheduled_end_at > $6
      )
      
      -- No blackout periods
      AND NOT EXISTS (
        SELECT 1 FROM blackout_periods bp
        WHERE bp.cleaner_id = u.id
        AND bp.start_ts < $7
        AND bp.end_ts > $6
      )
    ),
    with_job_counts AS (
      SELECT 
        cc.*,
        (
          SELECT COUNT(*) FROM jobs j
          WHERE j.cleaner_id = cc.id
          AND DATE(j.scheduled_start_at) = $8::date
          AND j.status NOT IN ('cancelled')
        ) as jobs_count_for_day
      FROM candidate_cleaners cc
      WHERE cc.distance_km <= cc.max_radius_km  -- Within travel radius
    )
    SELECT * FROM with_job_counts
    WHERE (max_jobs_per_day IS NULL OR jobs_count_for_day < max_jobs_per_day)
    ORDER BY reliability_score DESC`,
    [
      jobLat,                         // $1
      jobLng,                         // $2
      dayOfWeek,                      // $3
      startTimeStr,                   // $4
      endTimeStr,                     // $5
      requestedStart.toISOString(),   // $6
      requestedEnd.toISOString(),     // $7
      dateStr,                        // $8
      String(clientId),               // $9
    ]
  );

  return result.rows.map(row => ({
    id: Number(row.id),
    tier: mapTierFromDb(row.tier),
    reliabilityScore: Number(row.reliability_score || 70),
    lowFlexibilityBadge: row.low_flexibility_badge,
    baseLat: Number(row.base_lat || 0),
    baseLng: Number(row.base_lng || 0),
    maxRadiusKm: Number(row.max_radius_km || 50),
    isActive: row.is_active,
    isSuspended: row.is_suspended,
    maxJobsPerDay: row.max_jobs_per_day ? Number(row.max_jobs_per_day) : null,
    jobsCountForDay: Number(row.jobs_count_for_day || 0),
    availableAtTime: true, // Already filtered
    supportsBasic: true,   // TODO: Add job type support columns
    supportsDeep: true,
    supportsMoveOut: true,
    supportsRecurring: true,
    acceptsHighRiskClients: row.accepts_high_risk_clients,
    hasGoodHistoryWithClient: row.has_good_history,
  }));
}

/**
 * Map database tier string to ReliabilityTier type
 */
function mapTierFromDb(tier: string | null): ReliabilityTier {
  if (!tier) return 'Developing';
  switch (tier.toLowerCase().replace('_', ' ')) {
    case 'elite': return 'Elite';
    case 'pro': return 'Pro';
    case 'semi pro': case 'semi_pro': return 'Semi Pro';
    default: return 'Developing';
  }
}

// ============================================
// Match Recommendations Logging
// ============================================

/**
 * Log match recommendations for analytics
 */
export async function logMatchRecommendation(data: {
  jobId: number;
  clientId: number;
  cleanerId: number;
  matchScore: number;
  rank: number;
  breakdown: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO match_recommendations (
      job_id, client_id, cleaner_id, match_score, rank, breakdown, generated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
    [
      String(data.jobId),
      String(data.clientId),
      String(data.cleanerId),
      data.matchScore,
      data.rank,
      JSON.stringify(data.breakdown),
    ]
  );
}

/**
 * Get match history for a job
 */
export async function getMatchHistoryForJob(jobId: number): Promise<Array<{
  cleanerId: number;
  matchScore: number;
  rank: number;
  generatedAt: Date;
}>> {
  const result = await query<any>(
    `SELECT cleaner_id, match_score, rank, generated_at
     FROM match_recommendations
     WHERE job_id = $1
     ORDER BY rank ASC`,
    [String(jobId)]
  );

  return result.rows.map(row => ({
    cleanerId: Number(row.cleaner_id),
    matchScore: Number(row.match_score),
    rank: Number(row.rank),
    generatedAt: new Date(row.generated_at),
  }));
}

// ============================================
// Auto-Assign Support
// ============================================

/**
 * Assign a cleaner to a job
 */
export async function assignCleanerToJob(
  jobId: number,
  cleanerId: number,
  matchScore?: number
): Promise<void> {
  await query(
    `UPDATE jobs
     SET cleaner_id = $2, status = 'accepted', updated_at = NOW()
     WHERE id = $1`,
    [String(jobId), String(cleanerId)]
  );

  logger.info("cleaner_assigned_to_job", {
    jobId,
    cleanerId,
    matchScore,
  });
}

/**
 * Get job with client profile for matching
 */
export async function getJobWithClientProfile(jobId: number): Promise<{
  jobId: number;
  clientId: number;
  jobLat: number;
  jobLng: number;
  jobType: 'basic' | 'deep' | 'move_out' | 'recurring';
  requestedStart: Date;
  requestedEnd: Date;
  clientRiskScore: number;
  clientRiskBand: string;
  clientFlexScore: number;
} | null> {
  const result = await query<any>(
    `SELECT 
      j.id as job_id,
      j.client_id,
      j.latitude as job_lat,
      j.longitude as job_lng,
      COALESCE(j.job_type, 'basic') as job_type,
      j.scheduled_start_at as requested_start,
      j.scheduled_end_at as requested_end,
      COALESCE(crs.risk_score, 0) as client_risk_score,
      COALESCE(crs.risk_band, 'normal') as client_risk_band,
      COALESCE(cfp.flex_score, 0.5) as client_flex_score
     FROM jobs j
     LEFT JOIN client_risk_scores crs ON crs.client_id = j.client_id
     LEFT JOIN client_flex_profiles cfp ON cfp.client_id = j.client_id
     WHERE j.id = $1`,
    [String(jobId)]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    jobId: Number(row.job_id),
    clientId: Number(row.client_id),
    jobLat: Number(row.job_lat || 0),
    jobLng: Number(row.job_lng || 0),
    jobType: row.job_type,
    requestedStart: new Date(row.requested_start),
    requestedEnd: new Date(row.requested_end),
    clientRiskScore: Number(row.client_risk_score),
    clientRiskBand: row.client_risk_band,
    clientFlexScore: Number(row.client_flex_score),
  };
}

