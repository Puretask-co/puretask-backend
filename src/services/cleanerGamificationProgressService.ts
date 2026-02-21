/**
 * Cleaner-facing gamification progress and goals (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET /cleaner/goals, GET /cleaner/progress.
 */

import { query } from "../db/client";
import * as abuse from "./adminGamificationAbuseService";
import { getActiveRewards } from "./gamificationRewardService";

export interface CleanerGoalItem {
  id: string;
  type: string;
  title: string;
  current: number;
  target: number;
  window: string | null;
}

export async function getCleanerGoalsWithProgress(cleanerId: string): Promise<CleanerGoalItem[]> {
  const [levelRow, goalsRows, progressRows] = await Promise.all([
    query(
      `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
      [cleanerId]
    ),
    query(
      `SELECT id, title, type, level, metric_key, operator, target, target_display, window
       FROM gamification_goals
       WHERE enabled = true
       ORDER BY level, type`,
      []
    ).catch(() => ({ rows: [] as Record<string, unknown>[] })),
    query(
      `SELECT goal_id, current_value, progress_ratio, completed
       FROM cleaner_goal_progress
       WHERE cleaner_id = $1`,
      [cleanerId]
    ),
  ]);

  const currentLevel = (levelRow.rows[0] as { current_level: number } | undefined)?.current_level ?? 1;
  const goals = (goalsRows.rows as Record<string, unknown>[]).filter(
    (g) => Number(g.level) === currentLevel
  );
  if (goals.length === 0) {
    const anyLevel = await query(
      `SELECT id, title, type, metric_key, operator, target, target_display, window
       FROM gamification_goals
       WHERE enabled = true AND level = $1
       ORDER BY type`,
      [currentLevel]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    goals.push(...(anyLevel.rows as Record<string, unknown>[]));
  }

  const progressByGoal = new Map(
    (progressRows.rows as Array<Record<string, unknown>>).map((r) => {
      const cv = (r.current_value as Record<string, unknown>) ?? {};
      return [
        String(r.goal_id),
        {
          current: Number(cv.current ?? cv.value ?? 0),
          target: Number(cv.target ?? 0),
          completed: Boolean(r.completed),
        },
      ];
    })
  );

  return goals.map((g) => {
    const prog = progressByGoal.get(String(g.id)) ?? { current: 0, target: 0 };
    const targetVal = g.target_display != null ? Number(g.target) || 0 : Number(g.target) || 0;
    return {
      id: String(g.id),
      type: String(g.type ?? "core"),
      title: String(g.title ?? ""),
      current: prog.current,
      target: prog.target || targetVal || 1,
      window: g.window != null ? String(g.window) : null,
    };
  });
}

export interface CleanerProgressSummary {
  current_level: number;
  level_label: string;
  core_completion_percent: number;
  stretch_selected: boolean;
  maintenance_ok: boolean;
  progress_paused: boolean;
  progress_paused_reason: string | null;
  active_rewards: Array<{
    reward_id: string;
    name: string;
    effect?: string;
    expires_at: string | null;
    days_remaining: number | null;
  }>;
}

export async function getCleanerProgressSummary(cleanerId: string): Promise<CleanerProgressSummary | null> {
  const [levelRow, paused, rewards, goalProgress] = await Promise.all([
    query(
      `SELECT lp.current_level, lp.maintenance_paused, lp.maintenance_paused_reason, ld.name AS level_label
       FROM cleaner_level_progress lp
       LEFT JOIN cleaner_level_definitions ld ON ld.level = lp.current_level
       WHERE lp.cleaner_id = $1`,
      [cleanerId]
    ),
    abuse.isRewardsPaused(cleanerId),
    getActiveRewards(cleanerId),
    query(
      `SELECT goal_id, completed FROM cleaner_goal_progress WHERE cleaner_id = $1`,
      [cleanerId]
    ),
  ]);

  const row = levelRow.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const currentLevel = Number(row.current_level ?? 1);
  const levelLabel = String(row.level_label ?? "Level " + currentLevel);
  const maintenancePaused = Boolean(row.maintenance_paused ?? false);
  const progressPausedReason = row.maintenance_paused_reason != null ? String(row.maintenance_paused_reason) : null;
  const progressPaused = paused || maintenancePaused;

  const completedCount = (goalProgress.rows as Array<{ completed: boolean }>).filter((r) => r.completed).length;
  const totalGoals = goalProgress.rows.length;
  const coreCompletionPercent = totalGoals ? Math.round((completedCount / totalGoals) * 100) : 0;

  const now = new Date();
  const activeRewards = rewards.map((r) => {
    const endsAt = r.ends_at ? new Date(r.ends_at) : null;
    const daysRemaining = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null;
    return {
      reward_id: r.reward_id,
      name: r.name ?? r.reward_id,
      effect: (r.meta as Record<string, unknown>)?.effect as string | undefined,
      expires_at: r.ends_at ?? null,
      days_remaining: daysRemaining,
    };
  });

  return {
    current_level: currentLevel,
    level_label: levelLabel,
    core_completion_percent: coreCompletionPercent,
    stretch_selected: completedCount > 0,
    maintenance_ok: !maintenancePaused,
    progress_paused: progressPaused,
    progress_paused_reason: progressPausedReason,
    active_rewards: activeRewards,
  };
}
