// src/core/db/reliabilityDb.ts
// Database layer for Reliability Score Engine (Tasks 1.1-1.5)

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { ReliabilityTier } from '../scoring';

// ============================================
// Types
// ============================================

export interface CleanerMetricsRecord {
  cleanerId: number;
  totalJobsWindow: number;
  attendedJobs: number;
  noShowJobs: number;
  onTimeCheckins: number;
  photoCompliantJobs: number;
  communicationOkJobs: number;
  completionOkJobs: number;
  ratingsSum: number;
  ratingsCount: number;
  updatedAt: Date;
}

export interface CleanerEventRecord {
  id: number;
  cleanerId: number;
  jobId: number | null;
  eventType: string;
  weight: number;
  createdAt: Date;
  metadata: Record<string, any> | null;
}

// ============================================
// 1.1 - Get Cleaner Metrics
// ============================================

/**
 * Task 1.1: db.cleanerMetrics.getByCleanerId(cleanerId)
 * 
 * Retrieves pre-aggregated metrics for a cleaner's rolling window
 * (last 30 jobs or 60 days).
 * 
 * If no record exists, computes it on-the-fly from jobs table.
 */
export async function getCleanerMetricsById(cleanerId: number): Promise<CleanerMetricsRecord> {
  // First try to get from pre-aggregated table
  const cached = await query<any>(
    `SELECT * FROM cleaner_metrics WHERE cleaner_id = $1`,
    [String(cleanerId)]
  );

  if (cached.rows.length > 0) {
    const row = cached.rows[0];
    return {
      cleanerId: Number(row.cleaner_id),
      totalJobsWindow: Number(row.total_jobs_window || 0),
      attendedJobs: Number(row.attended_jobs || 0),
      noShowJobs: Number(row.no_show_jobs || 0),
      onTimeCheckins: Number(row.on_time_checkins || 0),
      photoCompliantJobs: Number(row.photo_compliant_jobs || 0),
      communicationOkJobs: Number(row.communication_ok_jobs || 0),
      completionOkJobs: Number(row.completion_ok_jobs || 0),
      ratingsSum: Number(row.ratings_sum || 0),
      ratingsCount: Number(row.ratings_count || 0),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Compute from jobs table (rolling 60 days, max 30 jobs)
  const computed = await computeCleanerMetrics(cleanerId);
  
  // Cache the result
  await upsertCleanerMetrics(computed);
  
  return computed;
}

/**
 * Compute cleaner metrics from jobs table
 */
async function computeCleanerMetrics(cleanerId: number): Promise<CleanerMetricsRecord> {
  const result = await query<any>(
    `WITH recent_jobs AS (
      SELECT 
        j.*,
        (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id) as photo_count
      FROM jobs j
      WHERE j.cleaner_id = $1
        AND j.status IN ('completed', 'cancelled_by_client', 'cancelled_by_cleaner', 'no_show_cleaner', 'no_show_client', 'disputed')
        AND j.scheduled_start_at >= NOW() - INTERVAL '60 days'
      ORDER BY j.scheduled_start_at DESC
      LIMIT 30
    )
    SELECT
      COUNT(*)::int as total_jobs,
      COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled_by_client'))::int as attended_jobs,
      COUNT(*) FILTER (WHERE status = 'no_show_cleaner')::int as no_show_jobs,
      COUNT(*) FILTER (WHERE 
        actual_start_at IS NOT NULL 
        AND ABS(EXTRACT(EPOCH FROM (actual_start_at - scheduled_start_at))/60) <= 15
      )::int as on_time_checkins,
      COUNT(*) FILTER (WHERE photo_count >= 3)::int as photo_compliant_jobs,
      COUNT(*) FILTER (WHERE status = 'completed')::int as communication_ok_jobs,
      COUNT(*) FILTER (WHERE actual_end_at IS NOT NULL AND status IN ('completed', 'disputed'))::int as completion_ok_jobs,
      COALESCE(SUM(rating) FILTER (WHERE rating IS NOT NULL), 0) as ratings_sum,
      COUNT(*) FILTER (WHERE rating IS NOT NULL)::int as ratings_count
    FROM recent_jobs`,
    [String(cleanerId)]
  );

  const row = result.rows[0] || {};
  
  return {
    cleanerId,
    totalJobsWindow: Number(row.total_jobs || 0),
    attendedJobs: Number(row.attended_jobs || 0),
    noShowJobs: Number(row.no_show_jobs || 0),
    onTimeCheckins: Number(row.on_time_checkins || 0),
    photoCompliantJobs: Number(row.photo_compliant_jobs || 0),
    communicationOkJobs: Number(row.communication_ok_jobs || 0),
    completionOkJobs: Number(row.completion_ok_jobs || 0),
    ratingsSum: Number(row.ratings_sum || 0),
    ratingsCount: Number(row.ratings_count || 0),
    updatedAt: new Date(),
  };
}

/**
 * Upsert cleaner metrics cache
 */
async function upsertCleanerMetrics(metrics: CleanerMetricsRecord): Promise<void> {
  await query(
    `INSERT INTO cleaner_metrics (
      cleaner_id, total_jobs_window, attended_jobs, no_show_jobs,
      on_time_checkins, photo_compliant_jobs, communication_ok_jobs,
      completion_ok_jobs, ratings_sum, ratings_count, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (cleaner_id) DO UPDATE SET
      total_jobs_window = $2,
      attended_jobs = $3,
      no_show_jobs = $4,
      on_time_checkins = $5,
      photo_compliant_jobs = $6,
      communication_ok_jobs = $7,
      completion_ok_jobs = $8,
      ratings_sum = $9,
      ratings_count = $10,
      updated_at = NOW()`,
    [
      String(metrics.cleanerId),
      metrics.totalJobsWindow,
      metrics.attendedJobs,
      metrics.noShowJobs,
      metrics.onTimeCheckins,
      metrics.photoCompliantJobs,
      metrics.communicationOkJobs,
      metrics.completionOkJobs,
      metrics.ratingsSum,
      metrics.ratingsCount,
    ]
  );
}

// ============================================
// 1.2 - Sum Event Weights Since
// ============================================

/**
 * Task 1.2: db.cleanerEvents.sumWeightsSince(cleanerId, days)
 * 
 * Returns sum of all event weights (penalties/bonuses) for a cleaner
 * within the last N days.
 */
export async function sumCleanerEventWeightsSince(
  cleanerId: number,
  days: number
): Promise<number> {
  const result = await query<{ sum: string }>(
    `SELECT COALESCE(SUM(weight), 0)::text as sum
     FROM cleaner_events
     WHERE cleaner_id = $1
     AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [String(cleanerId), days]
  );
  
  return Number(result.rows[0]?.sum || 0);
}

// ============================================
// 1.3 - Count Weekly Streaks
// ============================================

/**
 * Task 1.3: db.cleanerWeeklyStreaks.countStreaks(cleanerId, maxWeeks)
 * 
 * Counts how many "perfect weeks" the cleaner has had recently.
 * A perfect week = no cancellations, no no-shows, punctuality >= 90%, photo compliance >= 90%
 */
export async function countCleanerWeeklyStreaks(
  cleanerId: number,
  maxWeeks: number = 5
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM cleaner_weekly_streaks
     WHERE cleaner_id = $1
     AND is_streak = true
     ORDER BY week_start DESC
     LIMIT $2`,
    [String(cleanerId), maxWeeks]
  );
  
  return Number(result.rows[0]?.count || 0);
}

/**
 * Compute and record weekly streak status for a cleaner
 * Called by weekly cron job
 */
export async function updateCleanerWeeklyStreak(
  cleanerId: number,
  weekStart: Date
): Promise<boolean> {
  // Get jobs for this week
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const result = await query<any>(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'cancelled_by_cleaner')::int as cancels,
      COUNT(*) FILTER (WHERE status = 'no_show_cleaner')::int as no_shows,
      COUNT(*) FILTER (WHERE 
        actual_start_at IS NOT NULL 
        AND ABS(EXTRACT(EPOCH FROM (actual_start_at - scheduled_start_at))/60) <= 15
      )::float / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled_by_client')), 0) as punctuality_rate,
      COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM job_photos WHERE job_id = jobs.id) >= 3)::float 
        / NULLIF(COUNT(*), 0) as photo_rate
     FROM jobs
     WHERE cleaner_id = $1
     AND scheduled_start_at >= $2
     AND scheduled_start_at < $3`,
    [String(cleanerId), weekStart.toISOString(), weekEnd.toISOString()]
  );

  const row = result.rows[0] || {};
  
  const isStreak = 
    Number(row.cancels || 0) === 0 &&
    Number(row.no_shows || 0) === 0 &&
    (row.punctuality_rate === null || Number(row.punctuality_rate) >= 0.9) &&
    (row.photo_rate === null || Number(row.photo_rate) >= 0.9);

  await query(
    `INSERT INTO cleaner_weekly_streaks (cleaner_id, week_start, is_streak, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (cleaner_id, week_start) DO UPDATE SET is_streak = $3`,
    [String(cleanerId), weekStart.toISOString().split('T')[0], isStreak]
  );

  return isStreak;
}

// ============================================
// 1.4 - Update Cleaner Reliability
// ============================================

/**
 * Task 1.4: db.cleaners.updateReliability(cleanerId, { reliabilityScore, reliabilityTier })
 * 
 * Updates the cleaner's reliability score and tier in their profile.
 */
export async function updateCleanerReliability(
  cleanerId: number,
  data: { reliabilityScore: number; reliabilityTier: ReliabilityTier }
): Promise<void> {
  const tierValue = data.reliabilityTier.toLowerCase().replace(' ', '_');
  
  await query(
    `UPDATE cleaner_profiles
     SET reliability_score = $2, tier = $3, updated_at = NOW()
     WHERE user_id = $1`,
    [String(cleanerId), data.reliabilityScore, tierValue]
  );

  logger.info("cleaner_reliability_updated", {
    cleanerId,
    reliabilityScore: data.reliabilityScore,
    reliabilityTier: data.reliabilityTier,
  });
}

// ============================================
// 1.5 - Count Jobs for Cleaner
// ============================================

/**
 * Task 1.5: db.jobs.countForCleaner(cleanerId)
 * 
 * Returns the total number of completed jobs for a cleaner (all time).
 * Used for new cleaner ramp-up logic.
 */
export async function countJobsForCleaner(cleanerId: number): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM jobs
     WHERE cleaner_id = $1
     AND status = 'completed'`,
    [String(cleanerId)]
  );
  
  return Number(result.rows[0]?.count || 0);
}

// ============================================
// Additional Helper Functions
// ============================================

/**
 * Insert a cleaner event (penalty or bonus)
 */
export async function insertCleanerEvent(event: {
  cleanerId: number;
  jobId?: number | null;
  eventType: string;
  weight: number;
  metadata?: Record<string, any>;
}): Promise<number> {
  const result = await query<{ id: string }>(
    `INSERT INTO cleaner_events (cleaner_id, job_id, event_type, weight, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     RETURNING id`,
    [
      String(event.cleanerId),
      event.jobId ? String(event.jobId) : null,
      event.eventType,
      event.weight,
      JSON.stringify(event.metadata || {}),
    ]
  );
  
  return Number(result.rows[0].id);
}

/**
 * Get all active cleaners for daily recompute
 */
export async function getActiveCleaners(): Promise<{ id: number }[]> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM cleaner_profiles WHERE is_available = true`
  );
  
  return result.rows.map(row => ({ id: Number(row.user_id) }));
}

/**
 * Refresh metrics cache for a cleaner (called after job completion)
 */
export async function refreshCleanerMetrics(cleanerId: number): Promise<void> {
  const metrics = await computeCleanerMetrics(cleanerId);
  await upsertCleanerMetrics(metrics);
}

