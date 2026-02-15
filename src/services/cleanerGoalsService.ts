// src/services/cleanerGoalsService.ts
// Cleaner goals, route optimization suggestions, and reliability breakdown

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { awardBonusCredits } from "./creditEconomyService";

// ============================================
// Types
// ============================================

export interface CleanerGoal {
  id: number;
  cleaner_id: string;
  goal_type: "jobs" | "earnings" | "rating";
  month: string;
  target_value: number;
  current_value: number;
  reward_credits: number;
  is_awarded: boolean;
  awarded_at: string | null;
  created_at: string;
  progress_percentage: number;
}

export interface RouteSuggestion {
  type: "cluster" | "gap_warning" | "open_slot";
  message: string;
  severity: "info" | "warning";
  job_ids?: string[];
  suggested_time?: string;
  estimated_travel_minutes?: number;
}

export interface ReliabilityBreakdown {
  current_score: number;
  tier: string;
  last_30_days: {
    on_time_checkins: number;
    late_checkins: number;
    no_shows: number;
    cancellations: number;
    incomplete_jobs: number;
    missing_photos: number;
    avg_rating: number;
    total_jobs: number;
  };
  score_components: {
    checkin_score: number;
    completion_score: number;
    rating_score: number;
    cancellation_penalty: number;
  };
  next_tier: {
    name: string | null;
    points_needed: number;
  };
}

// ============================================
// Goal Configuration
// ============================================

const GOAL_TEMPLATES = {
  STARTER: { target_jobs: 10, reward_credits: 50 },
  REGULAR: { target_jobs: 20, reward_credits: 150 },
  PRO: { target_jobs: 35, reward_credits: 300 },
  ELITE: { target_jobs: 50, reward_credits: 500 },
};

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 70,
  gold: 85,
  platinum: 95,
};

// ============================================
// Goals CRUD
// ============================================

/**
 * Create monthly goal for cleaner
 */
export async function createGoal(
  cleanerId: string,
  month: Date,
  goalType: "jobs" | "earnings" | "rating",
  targetValue: number,
  rewardCredits: number
): Promise<CleanerGoal> {
  const monthStr = month.toISOString().slice(0, 7) + "-01"; // YYYY-MM-01

  const result = await query<CleanerGoal>(
    `
      INSERT INTO cleaner_goals (cleaner_id, goal_type, month, target_value, reward_credits)
      VALUES ($1, $2, $3::date, $4, $5)
      ON CONFLICT (cleaner_id, goal_type, month) DO UPDATE
      SET target_value = EXCLUDED.target_value, reward_credits = EXCLUDED.reward_credits
      RETURNING *, 
        ROUND((current_value::float / NULLIF(target_value, 0) * 100)::numeric, 1) as progress_percentage
    `,
    [cleanerId, goalType, monthStr, targetValue, rewardCredits]
  );

  logger.info("goal_created", { cleanerId, goalType, month: monthStr, targetValue });

  return result.rows[0];
}

/**
 * Auto-create default monthly goals for cleaner
 */
export async function createDefaultMonthlyGoals(
  cleanerId: string,
  month?: Date
): Promise<CleanerGoal[]> {
  const targetMonth = month || new Date();

  // Check cleaner's level based on past performance
  const historyResult = await query<{ avg_jobs: string }>(
    `
      SELECT AVG(job_count)::text as avg_jobs
      FROM (
        SELECT COUNT(*) as job_count
        FROM jobs
        WHERE cleaner_id = $1 AND status = 'completed'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) DESC
        LIMIT 3
      ) monthly_jobs
    `,
    [cleanerId]
  );

  const avgJobs = Number(historyResult.rows[0]?.avg_jobs || 0);

  // Select appropriate goal template
  let template = GOAL_TEMPLATES.STARTER;
  if (avgJobs >= 40) template = GOAL_TEMPLATES.ELITE;
  else if (avgJobs >= 25) template = GOAL_TEMPLATES.PRO;
  else if (avgJobs >= 15) template = GOAL_TEMPLATES.REGULAR;

  const goal = await createGoal(
    cleanerId,
    targetMonth,
    "jobs",
    template.target_jobs,
    template.reward_credits
  );

  return [goal];
}

/**
 * Get cleaner's goals for a month
 */
export async function getCleanerGoals(cleanerId: string, month?: Date): Promise<CleanerGoal[]> {
  const monthStr = month
    ? month.toISOString().slice(0, 7) + "-01"
    : new Date().toISOString().slice(0, 7) + "-01";

  const result = await query<CleanerGoal>(
    `
      SELECT *,
        ROUND((current_value::float / NULLIF(target_value, 0) * 100)::numeric, 1) as progress_percentage
      FROM cleaner_goals
      WHERE cleaner_id = $1 AND month = $2::date
      ORDER BY goal_type
    `,
    [cleanerId, monthStr]
  );

  return result.rows;
}

/**
 * Update goal progress (called when job completes)
 */
export async function updateGoalProgress(cleanerId: string): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

  // Get completed jobs this month
  const jobsResult = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text as count
      FROM jobs
      WHERE cleaner_id = $1
        AND status = 'completed'
        AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', $2::date)
    `,
    [cleanerId, currentMonth]
  );

  const completedJobs = Number(jobsResult.rows[0]?.count || 0);

  // Update jobs goal
  await query(
    `
      UPDATE cleaner_goals
      SET current_value = $3
      WHERE cleaner_id = $1 AND month = $2::date AND goal_type = 'jobs'
    `,
    [cleanerId, currentMonth, completedJobs]
  );

  // Check if any goals are now completed
  await checkAndAwardGoals(cleanerId, currentMonth);
}

/**
 * Check and award completed goals
 */
async function checkAndAwardGoals(cleanerId: string, month: string): Promise<void> {
  const result = await query<CleanerGoal>(
    `
      SELECT * FROM cleaner_goals
      WHERE cleaner_id = $1
        AND month = $2::date
        AND current_value >= target_value
        AND is_awarded = false
    `,
    [cleanerId, month]
  );

  for (const goal of result.rows) {
    // Award credits
    await awardBonusCredits({
      userId: cleanerId,
      amount: goal.reward_credits,
      bonusType: "goal",
      source: `goal:${goal.goal_type}:${goal.month}`,
    });

    // Mark as awarded
    await query(`UPDATE cleaner_goals SET is_awarded = true, awarded_at = NOW() WHERE id = $1`, [
      goal.id,
    ]);

    logger.info("goal_achieved", {
      cleanerId,
      goalId: goal.id,
      goalType: goal.goal_type,
      rewardCredits: goal.reward_credits,
    });
  }
}

// ============================================
// Route Suggestions
// ============================================

/**
 * Get route optimization suggestions for a day
 */
export async function getRouteSuggestions(
  cleanerId: string,
  date: Date
): Promise<RouteSuggestion[]> {
  const dateStr = date.toISOString().split("T")[0];

  // Get cleaner's jobs for the day with locations
  const jobsResult = await query<{
    id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    postal_code: string | null;
  }>(
    `
      SELECT j.id, j.scheduled_start_at, j.scheduled_end_at, j.address, 
             j.latitude, j.longitude, p.postal_code
      FROM jobs j
      LEFT JOIN properties p ON p.id = j.property_id
      WHERE j.cleaner_id = $1
        AND j.status NOT IN ('cancelled', 'completed')
        AND j.scheduled_start_at::date = $2::date
      ORDER BY j.scheduled_start_at
    `,
    [cleanerId, dateStr]
  );

  const jobs = jobsResult.rows;
  const suggestions: RouteSuggestion[] = [];

  if (jobs.length < 2) {
    return suggestions;
  }

  // Analyze gaps between jobs
  for (let i = 0; i < jobs.length - 1; i++) {
    const currentJob = jobs[i];
    const nextJob = jobs[i + 1];

    const currentEnd = new Date(currentJob.scheduled_end_at);
    const nextStart = new Date(nextJob.scheduled_start_at);
    const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

    // Calculate estimated travel time (rough estimate based on ZIP codes or distance)
    const estimatedTravel = estimateTravelTime(currentJob, nextJob);

    if (gapMinutes < estimatedTravel + 15) {
      // Gap too short
      suggestions.push({
        type: "gap_warning",
        message: `Only ${Math.round(gapMinutes)} min between jobs at ${currentJob.address.split(",")[0]} and ${nextJob.address.split(",")[0]}. Estimated travel: ${estimatedTravel} min.`,
        severity: "warning",
        job_ids: [currentJob.id, nextJob.id],
        estimated_travel_minutes: estimatedTravel,
      });
    } else if (gapMinutes > estimatedTravel + 90) {
      // Large gap - suggest filling
      const suggestedTime = new Date(currentEnd.getTime() + (estimatedTravel + 30) * 60 * 1000);
      suggestions.push({
        type: "open_slot",
        message: `${Math.round(gapMinutes - estimatedTravel)} min open between jobs. Consider accepting a job starting around ${suggestedTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`,
        severity: "info",
        job_ids: [currentJob.id, nextJob.id],
        suggested_time: suggestedTime.toISOString(),
      });
    }
  }

  // Check for clustering opportunities
  const zipGroups = groupJobsByZip(jobs);
  for (const [zip, zipJobs] of Object.entries(zipGroups)) {
    if (zipJobs.length >= 2) {
      // Check if they're not consecutive
      const indices = zipJobs.map((j) => jobs.findIndex((jj) => jj.id === j.id));
      const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);

      if (!isConsecutive) {
        suggestions.push({
          type: "cluster",
          message: `You have ${zipJobs.length} jobs in ZIP ${zip} that could be scheduled together for less travel.`,
          severity: "info",
          job_ids: zipJobs.map((j) => j.id),
        });
      }
    }
  }

  return suggestions;
}

/**
 * Estimate travel time between two jobs (simplified)
 */
function estimateTravelTime(
  job1: { latitude: number | null; longitude: number | null; postal_code: string | null },
  job2: { latitude: number | null; longitude: number | null; postal_code: string | null }
): number {
  // If we have coordinates, calculate distance
  if (job1.latitude && job1.longitude && job2.latitude && job2.longitude) {
    const distance = haversineDistance(
      job1.latitude,
      job1.longitude,
      job2.latitude,
      job2.longitude
    );
    // Assume 25 mph average in city
    return Math.ceil((distance / 25) * 60) + 5; // +5 min buffer
  }

  // If same ZIP, assume 10 min
  if (job1.postal_code && job1.postal_code === job2.postal_code) {
    return 10;
  }

  // Default assumption: 20 min
  return 20;
}

/**
 * Calculate haversine distance in miles
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
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
 * Group jobs by ZIP code
 */
function groupJobsByZip(
  jobs: Array<{ id: string; postal_code: string | null }>
): Record<string, Array<{ id: string }>> {
  const groups: Record<string, Array<{ id: string }>> = {};
  for (const job of jobs) {
    if (job.postal_code) {
      if (!groups[job.postal_code]) {
        groups[job.postal_code] = [];
      }
      groups[job.postal_code].push({ id: job.id });
    }
  }
  return groups;
}

// ============================================
// Reliability Breakdown
// ============================================

/**
 * Get detailed reliability breakdown for a cleaner
 */
export async function getReliabilityBreakdown(cleanerId: string): Promise<ReliabilityBreakdown> {
  // Get current score and tier
  const profileResult = await query<{ reliability_score: string; tier: string }>(
    `SELECT reliability_score::text, tier FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const profile = profileResult.rows[0];
  const currentScore = Number(profile?.reliability_score || 100);
  const tier = profile?.tier || "bronze";

  // Get last 30 days stats
  const statsResult = await query<{
    total_jobs: string;
    on_time: string;
    late: string;
    no_shows: string;
    cancellations: string;
    incomplete: string;
    missing_photos: string;
    avg_rating: string;
  }>(
    `
      WITH job_stats AS (
        SELECT
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE je.check_in_on_time = true) as on_time,
          COUNT(*) FILTER (WHERE je.check_in_on_time = false) as late,
          COUNT(*) FILTER (WHERE j.status = 'cancelled' AND j.cleaner_id = $1) as cancellations,
          COUNT(*) FILTER (WHERE j.status = 'disputed') as incomplete,
          AVG(j.rating) as avg_rating
        FROM jobs j
        LEFT JOIN LATERAL (
          SELECT 
            (je.created_at <= j.scheduled_start_at + INTERVAL '15 minutes') as check_in_on_time
          FROM job_events je
          WHERE je.job_id = j.id AND je.event_type = 'job.checked_in'
          LIMIT 1
        ) je ON true
        WHERE j.cleaner_id = $1
          AND j.created_at >= NOW() - INTERVAL '30 days'
      ),
      photo_stats AS (
        SELECT COUNT(DISTINCT j.id) as missing_photos
        FROM jobs j
        WHERE j.cleaner_id = $1
          AND j.status = 'completed'
          AND j.created_at >= NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM job_photos jp WHERE jp.job_id = j.id AND jp.type = 'after'
          )
      )
      SELECT
        js.total_jobs::text,
        COALESCE(js.on_time, 0)::text as on_time,
        COALESCE(js.late, 0)::text as late,
        0::text as no_shows,
        COALESCE(js.cancellations, 0)::text as cancellations,
        COALESCE(js.incomplete, 0)::text as incomplete,
        COALESCE(ps.missing_photos, 0)::text as missing_photos,
        COALESCE(js.avg_rating, 0)::text as avg_rating
      FROM job_stats js, photo_stats ps
    `,
    [cleanerId]
  );

  const stats = statsResult.rows[0];

  // Calculate score components
  const totalJobs = Number(stats?.total_jobs || 0);
  const onTime = Number(stats?.on_time || 0);
  const late = Number(stats?.late || 0);
  const cancellations = Number(stats?.cancellations || 0);
  const avgRating = Number(stats?.avg_rating || 0);

  const checkinScore = totalJobs > 0 ? (onTime / (onTime + late)) * 100 : 100;
  const completionScore = totalJobs > 0 ? ((totalJobs - cancellations) / totalJobs) * 100 : 100;
  const ratingScore = avgRating > 0 ? avgRating * 20 : 100; // Convert 5-star to 100
  const cancellationPenalty = cancellations * 5;

  // Determine next tier
  const tiers = Object.entries(TIER_THRESHOLDS).sort((a, b) => b[1] - a[1]);
  const currentTierIndex = tiers.findIndex(([t]) => t === tier);
  const nextTier = currentTierIndex > 0 ? tiers[currentTierIndex - 1] : null;

  return {
    current_score: currentScore,
    tier,
    last_30_days: {
      on_time_checkins: Number(stats?.on_time || 0),
      late_checkins: Number(stats?.late || 0),
      no_shows: Number(stats?.no_shows || 0),
      cancellations: Number(stats?.cancellations || 0),
      incomplete_jobs: Number(stats?.incomplete || 0),
      missing_photos: Number(stats?.missing_photos || 0),
      avg_rating: avgRating,
      total_jobs: totalJobs,
    },
    score_components: {
      checkin_score: Math.round(checkinScore * 10) / 10,
      completion_score: Math.round(completionScore * 10) / 10,
      rating_score: Math.round(ratingScore * 10) / 10,
      cancellation_penalty: cancellationPenalty,
    },
    next_tier: {
      name: nextTier?.[0] || null,
      points_needed: nextTier ? Math.max(0, nextTier[1] - currentScore) : 0,
    },
  };
}
