// src/services/cleanerLevelService.ts
// PureTask Cleaner Level System - behavior-driven gamification
// Levels = permission gates; Goals = real rewards (cash, visibility, fee reductions)

import { query, withTransaction } from "../db/client";
import { logger } from "../lib/logger";
import { awardBonusCredits } from "./creditEconomyService";
import { getLevelCopyForLevel } from "../config/cleanerLevels";
import { env } from "../config/env";

// ============================================
// Types
// ============================================

export interface LevelGoal {
  id: string;
  level: number;
  goalKey: string;
  goalType: "core" | "stretch" | "maintenance";
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  rewardType: string | null;
  rewardConfig: Record<string, unknown> | null;
  displayOrder: number;
  completed: boolean;
  completedAt: string | null;
  progress?: { current: number; target: number; unit: string };
}

export interface LevelProgress {
  cleanerId: string;
  currentLevel: number;
  levelName: string;
  levelReachedAt: string | null;
  maintenancePaused: boolean;
  goals: LevelGoal[];
  levelUpEligible: boolean;
  levelUpBlockers: string[];
  /** Placeholder: extra bookings attributed to active rewards this week */
  rewardAttribution?: { extraBookingsThisWeek: number };
  /** In-app copy for current level (cleaner-facing) */
  levelCopy?: {
    description: string;
    coreHelper?: string;
    stretchHelper?: string;
    maintenanceHelper?: string;
  };
}

// ============================================
// Level Progress
// ============================================

/**
 * Get full level progress for a cleaner
 */
export async function getLevelProgress(cleanerId: string): Promise<LevelProgress> {
  const [progressRow, goalsRows] = await Promise.all([
    query<{
      current_level: number;
      level_name: string;
      level_reached_at: string | null;
      maintenance_paused: boolean;
    }>(
      `SELECT lp.current_level, ld.name as level_name, lp.level_reached_at, lp.maintenance_paused
       FROM cleaner_level_progress lp
       JOIN cleaner_level_definitions ld ON ld.level = lp.current_level
       WHERE lp.cleaner_id = $1`,
      [cleanerId]
    ),
    query<{
      id: string;
      level: number;
      goal_key: string;
      goal_type: string;
      name: string;
      description: string | null;
      criteria: Record<string, unknown>;
      reward_type: string | null;
      reward_config: Record<string, unknown> | null;
      display_order: number;
      completed_at: string | null;
    }>(
      `SELECT g.id, g.level, g.goal_key, g.goal_type, g.name, g.description, g.criteria, g.reward_type, g.reward_config, g.display_order, c.completed_at
       FROM cleaner_level_goals g
       LEFT JOIN cleaner_goal_completions c ON c.cleaner_id = $1 AND c.level = g.level AND c.goal_key = g.goal_key
       WHERE g.level = (SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1)
         AND g.is_active = true
       ORDER BY g.goal_type, g.display_order`,
      [cleanerId, cleanerId]
    ),
  ]);

  if (progressRow.rows.length === 0) {
    await ensureLevelProgress(cleanerId);
    return getLevelProgress(cleanerId);
  }

  const progress = progressRow.rows[0];
  const level = progress.current_level;

  const goals: LevelGoal[] = await Promise.all(
    goalsRows.rows.map(async (r) => {
      const completed = !!r.completed_at;
      let progressInfo: { current: number; target: number; unit: string } | undefined;
      if (!completed) {
        const p = await evaluateGoalProgress(cleanerId, r.criteria);
        if (p) progressInfo = p;
      }
      return {
        id: r.id,
        level: r.level,
        goalKey: r.goal_key,
        goalType: r.goal_type as "core" | "stretch" | "maintenance",
        name: r.name,
        description: r.description,
        criteria: r.criteria,
        rewardType: r.reward_type,
        rewardConfig: r.reward_config,
        displayOrder: r.display_order,
        completed,
        completedAt: r.completed_at,
        progress: progressInfo,
      };
    })
  );

  const { eligible, blockers } = await checkLevelUpEligibility(cleanerId, level, goals);

  let rewardAttribution: { extraBookingsThisWeek: number } | undefined;
  try {
    rewardAttribution = await getRewardAttribution(cleanerId);
  } catch {
    // View may not exist before migration 044
  }

  const levelCopy = getLevelCopyForLevel(level);

  return {
    cleanerId,
    currentLevel: level,
    levelName: progress.level_name,
    levelReachedAt: progress.level_reached_at,
    maintenancePaused: progress.maintenance_paused,
    goals,
    levelUpEligible: eligible,
    levelUpBlockers: blockers,
    rewardAttribution,
    levelCopy,
  };
}

async function ensureLevelProgress(cleanerId: string): Promise<void> {
  await query(
    `INSERT INTO cleaner_level_progress (cleaner_id, current_level)
     VALUES ($1, 1)
     ON CONFLICT (cleaner_id) DO NOTHING`,
    [cleanerId]
  );
}

// ============================================
// Goal Evaluation
// ============================================

async function evaluateGoalProgress(
  cleanerId: string,
  criteria: Record<string, unknown>
): Promise<{ current: number; target: number; unit: string } | undefined> {
  const type = criteria.type as string;
  if (!type) return undefined;

  switch (type) {
    case "jobs_completed": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed'`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "jobs" };
    }
    case "photos_approved":
    case "photos_uploaded": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT j.id)::text
         FROM jobs j
         JOIN job_photos jp ON jp.job_id = j.id
         WHERE j.cleaner_id = $1 AND j.status = 'completed'`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "jobs" };
    }
    case "photos_valid": {
      const min = (criteria.min as number) ?? 1;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM (
           SELECT j.id FROM jobs j
           WHERE j.cleaner_id = $1 AND j.status = 'completed'
             AND j.actual_start_at IS NOT NULL AND j.actual_end_at IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'before'
               AND p.created_at >= j.actual_start_at AND p.created_at <= j.actual_end_at
             )
             AND EXISTS (
               SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'after'
               AND p.created_at >= j.actual_start_at AND p.created_at <= j.actual_end_at
             )
         ) x`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "jobs" };
    }
    case "addons_completed": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed' AND (has_addons = true OR addons_count > 0)`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "jobs" };
    }
    case "messages_sent": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM messages WHERE sender_id = $1 AND sender_type = 'cleaner'`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "messages" };
    }
    case "five_star_ratings": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND rating = 5`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "ratings" };
    }
    case "jobs_accepted": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status IN ('accepted','on_my_way','in_progress','awaiting_approval','completed')`,
        [cleanerId]
      );
      return { current: parseInt(r.rows[0]?.count || "0", 10), target: min, unit: "jobs" };
    }
    case "clock_in_out": {
      const min = (criteria.min as number) ?? 1;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs j
         WHERE j.cleaner_id = $1 AND j.status = 'completed'
           AND EXISTS (
             SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true
           )
           AND EXISTS (
             SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_out' AND c.is_within_radius = true
           )`,
        [cleanerId]
      );
      let count = parseInt(r.rows[0]?.count || "0", 10);
      if (count < min) {
        const r2 = await query<{ count: string }>(
          `SELECT COUNT(*)::text FROM jobs
           WHERE cleaner_id = $1 AND status = 'completed'
             AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM job_checkins WHERE job_id = jobs.id)`,
          [cleanerId]
        );
        count += parseInt(r2.rows[0]?.count || "0", 10);
      }
      return { current: count, target: min, unit: "jobs" };
    }
    default:
      return undefined;
  }
}

/**
 * Evaluate if a goal is complete (for a given criteria)
 */
export async function evaluateGoalComplete(
  cleanerId: string,
  criteria: Record<string, unknown>
): Promise<boolean> {
  const type = criteria.type as string;
  if (!type) return false;

  switch (type) {
    case "jobs_completed": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed'`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "photos_uploaded":
    case "photos_approved": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT j.id)::text
         FROM jobs j
         JOIN job_photos jp ON jp.job_id = j.id
         WHERE j.cleaner_id = $1 AND j.status = 'completed'`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "photos_valid": {
      const min = (criteria.min as number) ?? 1;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM (
           SELECT j.id FROM jobs j
           WHERE j.cleaner_id = $1 AND j.status = 'completed'
             AND j.actual_start_at IS NOT NULL AND j.actual_end_at IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'before'
               AND p.created_at >= j.actual_start_at AND p.created_at <= j.actual_end_at
             )
             AND EXISTS (
               SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'after'
               AND p.created_at >= j.actual_start_at AND p.created_at <= j.actual_end_at
             )
         ) x`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "addons_completed": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed' AND (has_addons = true OR addons_count > 0)`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "clock_in_out": {
      const min = (criteria.min as number) ?? 1;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs j
         WHERE j.cleaner_id = $1 AND j.status = 'completed'
           AND EXISTS (
             SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true
           )
           AND EXISTS (
             SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_out' AND c.is_within_radius = true
           )`,
        [cleanerId]
      );
      const withCheckins = parseInt(r.rows[0]?.count || "0", 10);
      if (withCheckins >= min) return true;
      const r2 = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed'
           AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM job_checkins WHERE job_id = jobs.id)`,
        [cleanerId]
      );
      return withCheckins + parseInt(r2.rows[0]?.count || "0", 10) >= min;
    }
    case "jobs_accepted": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status IN ('accepted','on_my_way','in_progress','awaiting_approval','completed')`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "messages_sent": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM messages WHERE sender_id = $1 AND sender_type = 'cleaner'`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "five_star_rating": {
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND rating = 5`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= 1;
    }
    case "five_star_ratings": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND rating = 5`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "no_reschedules": {
      const jobs = (criteria.jobs as number) ?? 5;
      const r = await query<{ rescheduled: string }>(
        `SELECT COUNT(*)::text FROM job_events je
         JOIN jobs j ON j.id = je.job_id
         WHERE j.cleaner_id = $1 AND je.event_type::text LIKE '%reschedule%'
           AND j.id IN (
             SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
             ORDER BY created_at DESC LIMIT $2
           )`,
        [cleanerId, jobs]
      );
      return parseInt(r.rows[0]?.rescheduled || "0", 10) === 0;
    }
    case "no_no_shows":
    case "no_no_shows_lifetime": {
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'cancelled'
           AND EXISTS (SELECT 1 FROM job_events je WHERE je.job_id = jobs.id AND je.event_type = 'job_no_show_warning')`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) === 0;
    }
    case "on_time": {
      const min = (criteria.min as number) ?? 0;
      const earlyMin = env.ON_TIME_EARLY_MINUTES ?? 15;
      const lateMin = env.ON_TIME_LATE_MINUTES ?? 15;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs j
         JOIN job_checkins c ON c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true
         WHERE j.cleaner_id = $1 AND j.status = 'completed'
           AND c.created_at >= j.scheduled_start_at - $2 * INTERVAL '1 minute'
           AND c.created_at <= j.scheduled_start_at + $3 * INTERVAL '1 minute'`,
        [cleanerId, earlyMin, lateMin]
      );
      const withCheckins = parseInt(r.rows[0]?.count || "0", 10);
      if (withCheckins >= min) return true;
      const r2 = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs j
         JOIN job_events je ON je.job_id = j.id AND je.event_type = 'job.checked_in'
         WHERE j.cleaner_id = $1 AND j.status = 'completed'
           AND NOT EXISTS (SELECT 1 FROM job_checkins WHERE job_id = j.id AND type = 'check_in')
           AND je.created_at >= j.scheduled_start_at - $2 * INTERVAL '1 minute'
           AND je.created_at <= j.scheduled_start_at + $3 * INTERVAL '1 minute'`,
        [cleanerId, earlyMin, lateMin]
      );
      return withCheckins + parseInt(r2.rows[0]?.count || "0", 10) >= min;
    }
    case "on_time_rate": {
      const min = (criteria.min as number) ?? 90;
      const earlyMin = env.ON_TIME_EARLY_MINUTES ?? 15;
      const lateMin = env.ON_TIME_LATE_MINUTES ?? 15;
      const r = await query<{ total: string; on_time: string }>(
        `WITH ev AS (
           SELECT j.id,
             (c.created_at >= j.scheduled_start_at - $2 * INTERVAL '1 minute'
              AND c.created_at <= j.scheduled_start_at + $3 * INTERVAL '1 minute') as ok
           FROM jobs j
           JOIN job_checkins c ON c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true
           WHERE j.cleaner_id = $1 AND j.status = 'completed'
         )
         SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE ok)::text as on_time FROM ev`,
        [cleanerId, earlyMin, lateMin]
      );
      let total = parseInt(r.rows[0]?.total || "0", 10);
      let onTime = parseInt(r.rows[0]?.on_time || "0", 10);
      if (total === 0) {
        const r2 = await query<{ total: string; on_time: string }>(
          `WITH ev AS (
             SELECT j.id,
               (je.created_at >= j.scheduled_start_at - $2 * INTERVAL '1 minute'
                AND je.created_at <= j.scheduled_start_at + $3 * INTERVAL '1 minute') as ok
             FROM jobs j
             JOIN job_events je ON je.job_id = j.id AND je.event_type = 'job.checked_in'
             WHERE j.cleaner_id = $1 AND j.status = 'completed'
               AND NOT EXISTS (SELECT 1 FROM job_checkins WHERE job_id = j.id AND type = 'check_in')
           )
           SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE ok)::text as on_time FROM ev`,
          [cleanerId, earlyMin, lateMin]
        );
        total = parseInt(r2.rows[0]?.total || "0", 10);
        onTime = parseInt(r2.rows[0]?.on_time || "0", 10);
      }
      return total === 0 || (onTime / total) * 100 >= min;
    }
    case "basic_cleanings": {
      const min = (criteria.min as number) ?? 0;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND (cleaning_type = 'basic' OR cleaning_type IS NULL)`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "deep_and_basic": {
      const deep = (criteria.deep as number) ?? 0;
      const basic = (criteria.basic as number) ?? 0;
      const [dr, br] = await Promise.all([
        query<{ count: string }>(
          `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND cleaning_type = 'deep'`,
          [cleanerId]
        ),
        query<{ count: string }>(
          `SELECT COUNT(*)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND (cleaning_type = 'basic' OR cleaning_type IS NULL)`,
          [cleanerId]
        ),
      ]);
      return (
        parseInt(dr.rows[0]?.count || "0", 10) >= deep &&
        parseInt(br.rows[0]?.count || "0", 10) >= basic
      );
    }
    case "avg_rating": {
      const min = (criteria.min as number) ?? 4.5;
      const days = criteria.days as number | undefined;
      const r = days
        ? await query<{ avg: string }>(
            `SELECT COALESCE(AVG(rating), 0)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed' AND created_at >= NOW() - $2 * INTERVAL '1 day'`,
            [cleanerId, days]
          )
        : await query<{ avg: string }>(
            `SELECT COALESCE(AVG(rating), 0)::text FROM jobs WHERE cleaner_id = $1 AND status = 'completed'`,
            [cleanerId]
          );
      return parseFloat(r.rows[0]?.avg || "0") >= min;
    }
    case "no_cancellations": {
      const jobs = (criteria.jobs as number) ?? 5;
      const r = await query<{ cancelled: string }>(
        `SELECT COUNT(*)::text FROM (
           SELECT id FROM jobs WHERE cleaner_id = $1 AND status IN ('completed','cancelled')
           ORDER BY created_at DESC LIMIT $2
         ) sub
         JOIN jobs j ON j.id = sub.id
         WHERE j.status = 'cancelled'`,
        [cleanerId, jobs]
      );
      return parseInt(r.rows[0]?.cancelled || "0", 10) === 0;
    }
    case "no_cancellations_days": {
      const days = (criteria.days as number) ?? 7;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'cancelled' AND updated_at >= NOW() - INTERVAL '1 day' * $2`,
        [cleanerId, days]
      );
      return parseInt(r.rows[0]?.count || "0", 10) === 0;
    }
    case "no_disputes":
    case "no_disputes_in_jobs":
    case "no_disputes_days": {
      if (criteria.jobs) {
        const jobs = criteria.jobs as number;
        const r = await query<{ disputed: string }>(
          `SELECT COUNT(*)::text FROM (
             SELECT j.id FROM jobs j
             LEFT JOIN disputes d ON d.job_id = j.id AND d.status != 'open'
             WHERE j.cleaner_id = $1 AND j.status IN ('completed','disputed','cancelled')
             ORDER BY j.created_at DESC LIMIT $2
           ) sub
           JOIN disputes d ON d.job_id = sub.id`,
          [cleanerId, jobs]
        );
        return parseInt(r.rows[0]?.disputed || "0", 10) === 0;
      }
      if (criteria.days) {
        const days = criteria.days as number;
        const r = await query<{ count: string }>(
          `SELECT COUNT(*)::text FROM disputes d
           JOIN jobs j ON j.id = d.job_id
           WHERE j.cleaner_id = $1 AND d.created_at >= NOW() - INTERVAL '1 day' * $2`,
          [cleanerId, days]
        );
        return parseInt(r.rows[0]?.count || "0", 10) === 0;
      }
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM disputes d JOIN jobs j ON j.id = d.job_id WHERE j.cleaner_id = $1`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) === 0;
    }
    case "no_losing_disputes_15":
    case "losing_disputes_lt":
    case "losing_disputes_le1_50": {
      const jobs = (criteria.jobs as number) ?? 50;
      const max = (criteria.max as number) ?? 3;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM disputes d
         JOIN jobs j ON j.id = d.job_id
         WHERE j.cleaner_id = $1 AND d.status = 'resolved_refund'
           AND d.job_id IN (
             SELECT id FROM jobs WHERE cleaner_id = $1 ORDER BY created_at DESC LIMIT $2
           )`,
        [cleanerId, jobs]
      );
      return parseInt(r.rows[0]?.count || "0", 10) <= max;
    }
    case "lifetime_losing_dispute_rate": {
      const maxPercent = (criteria.max_percent as number) ?? 5;
      const r = await query<{ total: string; losing: string }>(
        `SELECT
           (SELECT COUNT(*) FROM jobs WHERE cleaner_id = $1 AND status IN ('completed','cancelled','disputed'))::text as total,
           (SELECT COUNT(*) FROM disputes d JOIN jobs j ON j.id = d.job_id WHERE j.cleaner_id = $1 AND d.status = 'resolved_refund')::text as losing`,
        [cleanerId, cleanerId]
      );
      const total = parseInt(r.rows[0]?.total || "0", 10);
      const losing = parseInt(r.rows[0]?.losing || "0", 10);
      return total === 0 || (losing / total) * 100 < maxPercent;
    }
    case "login_streak": {
      const days = (criteria.days as number) ?? 14;
      const r = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT login_date)::text as count
         FROM cleaner_login_days
         WHERE cleaner_id = $1
           AND login_date >= CURRENT_DATE - ($2 - 1) * INTERVAL '1 day'
           AND login_date <= CURRENT_DATE`,
        [cleanerId, days]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= days;
    }
    case "login_count": {
      const min = (criteria.min as number) ?? 21;
      const r = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT login_date)::text FROM cleaner_login_days WHERE cleaner_id = $1`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "jobs_in_period": {
      const count = (criteria.count as number) ?? 5;
      const periodDays = (criteria.days as number) ?? 7;
      const r = await query<{ cnt: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed'
           AND created_at >= NOW() - INTERVAL '1 day' * $2`,
        [cleanerId, periodDays]
      );
      return parseInt(r.rows[0]?.cnt || "0", 10) >= count;
    }
    case "no_policy_violations":
    case "account_verified": {
      return true;
    }
    case "no_late_over": {
      return true;
    }
    case "no_last_minute_cancel": {
      return true;
    }
    case "active_weekly": {
      const r = await query<{ last: string }>(
        `SELECT COALESCE(MAX(login_date)::text, '1970-01-01') FROM cleaner_login_days WHERE cleaner_id = $1`,
        [cleanerId]
      );
      const last = r.rows[0]?.last ? new Date(r.rows[0].last) : new Date(0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return last >= weekAgo;
    }
    case "months_active": {
      const min = (criteria.min as number) ?? 12;
      const r = await query<{ months: string }>(
        `SELECT EXTRACT(MONTH FROM AGE(NOW(), MIN(created_at)))::text FROM jobs WHERE cleaner_id = $1`,
        [cleanerId]
      );
      const months = parseFloat(r.rows[0]?.months || "0");
      return months >= min;
    }
    case "reliability_percentile":
    case "reliability_percentile_max":
    case "top_10_reliability": {
      const maxPercentile = (criteria.max_percentile as number) ?? 10;
      const r = await query<{ percentile: string }>(
        `WITH scores AS (
           SELECT user_id, reliability_score,
             NTILE(100) OVER (ORDER BY reliability_score DESC) as pct
           FROM cleaner_profiles
         )
         SELECT pct::text FROM scores WHERE user_id = $1`,
        [cleanerId]
      );
      const pct = parseInt(r.rows[0]?.percentile || "100", 10);
      return pct <= maxPercentile;
    }
    case "early_evening_job": {
      const min = (criteria.min as number) ?? 1;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed'
           AND (EXTRACT(HOUR FROM scheduled_start_at) < 8 OR EXTRACT(HOUR FROM scheduled_start_at) >= 20)`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "weekend_early_jobs": {
      const min = (criteria.min as number) ?? 5;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM jobs
         WHERE cleaner_id = $1 AND status = 'completed'
           AND (EXTRACT(DOW FROM scheduled_start_at) IN (0,6) OR EXTRACT(HOUR FROM scheduled_start_at) < 9)`,
        [cleanerId]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= min;
    }
    case "on_time_rate_last_n": {
      const min = (criteria.min as number) ?? 80;
      const jobs = (criteria.jobs as number) ?? 30;
      const earlyMin = env.ON_TIME_EARLY_MINUTES ?? 15;
      const lateMin = env.ON_TIME_LATE_MINUTES ?? 15;
      let r = await query<{ total: string; on_time: string }>(
        `WITH last_n AS (
           SELECT j.id,
             (c.created_at >= j.scheduled_start_at - $3 * INTERVAL '1 minute'
              AND c.created_at <= j.scheduled_start_at + $4 * INTERVAL '1 minute') as ok
           FROM jobs j
           JOIN job_checkins c ON c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true
           AND j.id IN (SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT $2)
         )
         SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE ok)::text as on_time FROM last_n`,
        [cleanerId, jobs, earlyMin, lateMin]
      );
      let total = parseInt(r.rows[0]?.total || "0", 10);
      let onTime = parseInt(r.rows[0]?.on_time || "0", 10);
      if (total === 0) {
        r = await query<{ total: string; on_time: string }>(
          `WITH last_n AS (
             SELECT j.id,
               (je.created_at >= j.scheduled_start_at - $3 * INTERVAL '1 minute'
                AND je.created_at <= j.scheduled_start_at + $4 * INTERVAL '1 minute') as ok
             FROM jobs j
             JOIN job_events je ON je.job_id = j.id AND je.event_type = 'job.checked_in'
             AND j.id IN (SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT $2)
             AND NOT EXISTS (SELECT 1 FROM job_checkins WHERE job_id = j.id AND type = 'check_in')
           )
           SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE ok)::text as on_time FROM last_n`,
          [cleanerId, jobs, earlyMin, lateMin]
        );
        total = parseInt(r.rows[0]?.total || "0", 10);
        onTime = parseInt(r.rows[0]?.on_time || "0", 10);
      }
      return total === 0 || total < jobs || (onTime / total) * 100 >= min;
    }
    case "repeat_clients": {
      const clients = (criteria.clients as number) ?? 2;
      const minJobs = (criteria.min_jobs as number) ?? 3;
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM (
           SELECT client_id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
           GROUP BY client_id HAVING COUNT(*) >= $2
         ) x`,
        [cleanerId, minJobs]
      );
      return parseInt(r.rows[0]?.count || "0", 10) >= clients;
    }
    default:
      return false;
  }
}

// ============================================
// Level Up & Rewards
// ============================================

async function checkLevelUpEligibility(
  cleanerId: string,
  level: number,
  goals: LevelGoal[]
): Promise<{ eligible: boolean; blockers: string[] }> {
  const core = goals.filter((g) => g.goalType === "core");
  const stretch = goals.filter((g) => g.goalType === "stretch");
  const maintenance = goals.filter((g) => g.goalType === "maintenance");

  const blockers: string[] = [];
  const allCore = core.every((g) => g.completed);
  const oneStretch = stretch.some((g) => g.completed);
  const allMaintenance = maintenance.length === 0 || maintenance.every((g) => g.completed);

  if (!allCore) blockers.push("Complete all core goals");
  if (!oneStretch) blockers.push("Complete at least one stretch goal");
  if (!allMaintenance) blockers.push("Meet all maintenance rules");

  const progressRow = await query<{ maintenance_paused: boolean }>(
    `SELECT maintenance_paused FROM cleaner_level_progress WHERE cleaner_id = $1`,
    [cleanerId]
  );
  if (progressRow.rows[0]?.maintenance_paused)
    blockers.push("Maintenance paused - restore compliance");

  return {
    eligible: allCore && oneStretch && allMaintenance && !progressRow.rows[0]?.maintenance_paused,
    blockers,
  };
}

/**
 * Check and process level-up, grant rewards for newly completed goals
 * Call this after job completion, rating, etc.
 */
export async function checkAndProcessGoals(cleanerId: string): Promise<{
  newCompletions: string[];
  leveledUp: boolean;
}> {
  const newCompletions: string[] = [];
  const rewardsToGrant: Array<{
    goalKey: string;
    rewardType: string;
    config: Record<string, unknown>;
  }> = [];
  let leveledUp = false;
  let level = 1;

  await withTransaction(async (client) => {
    const progressResult = await client.query<{ current_level: number }>(
      `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );
    if (progressResult.rows.length === 0) return;
    level = progressResult.rows[0].current_level;

    const goalsResult = await client.query<{
      id: string;
      goal_key: string;
      goal_type: string;
      criteria: Record<string, unknown>;
      reward_type: string | null;
      reward_config: Record<string, unknown> | null;
    }>(
      `SELECT g.id, g.goal_key, g.goal_type, g.criteria, g.reward_type, g.reward_config
       FROM cleaner_level_goals g
       WHERE g.level = $1 AND g.is_active = true
         AND NOT EXISTS (SELECT 1 FROM cleaner_goal_completions c WHERE c.cleaner_id = $2 AND c.level = g.level AND c.goal_key = g.goal_key)`,
      [level, cleanerId]
    );

    for (const goal of goalsResult.rows) {
      const complete = await evaluateGoalComplete(cleanerId, goal.criteria);
      if (complete) {
        await client.query(
          `INSERT INTO cleaner_goal_completions (cleaner_id, level, goal_key) VALUES ($1, $2, $3)
           ON CONFLICT (cleaner_id, level, goal_key) DO NOTHING`,
          [cleanerId, level, goal.goal_key]
        );
        newCompletions.push(goal.goal_key);
        if (goal.reward_type) {
          rewardsToGrant.push({
            goalKey: goal.goal_key,
            rewardType: goal.reward_type,
            config: goal.reward_config || {},
          });
        }
      }
    }

    const progress = await getLevelProgress(cleanerId);
    const { eligible } = await checkLevelUpEligibility(cleanerId, level, progress.goals);
    if (eligible && level < 10) {
      await client.query(
        `UPDATE cleaner_level_progress SET current_level = $2, level_reached_at = NOW(), updated_at = NOW() WHERE cleaner_id = $1`,
        [cleanerId, level + 1]
      );
      leveledUp = true;
      logger.info("cleaner_level_up", { cleanerId, fromLevel: level, toLevel: level + 1 });
    }
  });

  for (const r of rewardsToGrant) {
    await grantReward(cleanerId, level, r.goalKey, r.rewardType, r.config);
  }

  return { newCompletions, leveledUp };
}

async function grantReward(
  cleanerId: string,
  level: number,
  goalKey: string,
  rewardType: string,
  config: Record<string, unknown>
): Promise<void> {
  const now = new Date();
  let expiresAt: Date | null = null;

  switch (rewardType) {
    case "cash_bonus": {
      const cents = (config.amount_cents as number) ?? 0;
      if (cents > 0) {
        const credits = Math.round(cents / 100);
        await awardBonusCredits({
          userId: cleanerId,
          amount: credits,
          bonusType: "level_goal",
          source: `level:${level}:${goalKey}`,
        });
      }
      break;
    }
    case "priority_visibility": {
      const hours = (config.hours as number) ?? 48;
      const days = (config.days as number) ?? Math.ceil(hours / 24);
      expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      await query(
        `INSERT INTO cleaner_active_boosts (cleaner_id, boost_type, multiplier, expires_at, source_goal_key, source_level)
         VALUES ($1, 'priority_visibility', 1.2, $2, $3, $4)`,
        [cleanerId, expiresAt, goalKey, level]
      );
      break;
    }
    case "ranking_boost":
    case "escrow_reduction":
    case "platform_fee":
    case "early_access":
    case "instant_payout":
    case "ranking_multiplier":
      break;
    default:
      break;
  }

  await query(
    `INSERT INTO cleaner_rewards_granted (cleaner_id, level, goal_key, reward_type, reward_config, expires_at, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'active')`,
    [cleanerId, level, goalKey, rewardType, JSON.stringify(config), expiresAt]
  );

  logger.info("level_goal_reward_granted", { cleanerId, level, goalKey, rewardType });
}

// ============================================
// Login Recording (for streaks)
// ============================================

/**
 * Record a login for streak tracking. Call on cleaner login.
 * NOTE: For anti-gaming, consider using recordMeaningfulAction instead when the
 * session includes a meaningful action (accept job, send message, etc).
 */
export async function recordCleanerLogin(cleanerId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO cleaner_login_days (cleaner_id, login_date) VALUES ($1, $2::date)
     ON CONFLICT (cleaner_id, login_date) DO NOTHING`,
    [cleanerId, today]
  );
  await checkAndProcessGoals(cleanerId);
}

/**
 * Record a meaningful action (for login streak anti-gaming).
 * Call when cleaner: accepts job, sends message, uploads photos, etc.
 * Ensures that day counts for streak goals that require meaningful engagement.
 */
export async function recordMeaningfulAction(cleanerId: string, actionType: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO cleaner_meaningful_actions (cleaner_id, action_date, action_type)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (cleaner_id, action_date, action_type) DO NOTHING`,
    [cleanerId, today, actionType]
  );
  // Ensure login day is recorded so streak counts
  await recordCleanerLogin(cleanerId);
}

/**
 * Get reward attribution stats (placeholder).
 * Returns estimated extra bookings from active rewards this week.
 * TODO: Implement by correlating boost activation with new bookings.
 */
export async function getRewardAttribution(
  cleanerId: string
): Promise<{ extraBookingsThisWeek: number }> {
  const r = await query<{ count: string }>(
    `SELECT COALESCE(SUM(extra_bookings_attributed), 0)::text
     FROM cleaner_boost_attribution_placeholder
     WHERE cleaner_id = $1`,
    [cleanerId]
  );
  const count = parseInt(r.rows[0]?.count || "0", 10);
  return { extraBookingsThisWeek: count };
}
