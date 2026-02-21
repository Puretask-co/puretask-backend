/**
 * Support gamification debug (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET /admin/support/cleaner/:cleanerId/gamification — full debug view.
 * POST recompute, grant-reward, remove-reward.
 */

import { query } from "../db/client";
import * as abuse from "./adminGamificationAbuseService";
import * as rewardsLib from "./adminGamificationRewardsService";

export interface SupportGamificationView {
  cleaner_id: string;
  current_level: number;
  level_label: string;
  progress_paused: boolean;
  progress_paused_reason: string | null;
  core_completion_percent: number;
  stretch_selected: boolean;
  maintenance_ok: boolean;
  goal_progress: Array<{
    goal_id: string;
    title: string;
    current: number;
    target: number;
    window: string | null;
    status: string;
  }>;
  active_rewards: Array<{
    reward_id: string;
    name: string;
    granted_at: string;
    expires_at: string | null;
  }>;
  reward_grant_history: Array<{
    reward_id: string;
    name: string;
    granted_at: string;
    trigger: string;
    goal_id: string | null;
  }>;
  computed_metrics_debug: Record<string, unknown>;
  support_explanation: string;
}

export async function getSupportGamificationView(cleanerId: string): Promise<SupportGamificationView | null> {
  const [levelRow, rewardsPaused, goalProgressRows, grantRows, definitions] = await Promise.all([
    query(
      `SELECT lp.current_level, lp.maintenance_paused, lp.maintenance_paused_reason, ld.name AS level_label
       FROM cleaner_level_progress lp
       LEFT JOIN cleaner_level_definitions ld ON ld.level = lp.current_level
       WHERE lp.cleaner_id = $1`,
      [cleanerId]
    ),
    abuse.isRewardsPaused(cleanerId).then((p) => p),
    query(
      `SELECT goal_id, current_value, progress_ratio, completed
       FROM cleaner_goal_progress
       WHERE cleaner_id = $1`,
      [cleanerId]
    ),
    query(
      `SELECT reward_id, granted_at, ends_at, source_type, source_id, status
       FROM gamification_reward_grants
       WHERE cleaner_id = $1
       ORDER BY granted_at DESC
       LIMIT 100`,
      [cleanerId]
    ),
    query(`SELECT id, name FROM gamification_rewards`).catch(() => ({ rows: [] as Record<string, unknown>[] })),
  ]);

  const level = levelRow.rows[0] as Record<string, unknown> | undefined;
  if (!level) return null;

  const rewardNames = new Map((definitions.rows as Array<{ id: string; name: string | null }>).map((r) => [r.id, r.name ?? r.id]));

  const currentLevel = Number(level.current_level ?? 1);
  const levelLabel = String(level.level_label ?? "Level " + currentLevel);
  const maintenancePaused = Boolean(level.maintenance_paused ?? false);
  const progressPausedReason = level.maintenance_paused_reason != null ? String(level.maintenance_paused_reason) : null;
  const progressPaused = rewardsPaused || maintenancePaused;

  const goalProgress = (goalProgressRows.rows as Array<Record<string, unknown>>).map((r) => {
    const cv = (r.current_value as Record<string, unknown>) ?? {};
    const current = Number(cv.current ?? cv.value ?? 0);
    const target = Number(cv.target ?? 0);
    const completed = Boolean(r.completed);
    return {
      goal_id: String(r.goal_id),
      title: String(cv.title ?? r.goal_id),
      current,
      target: target || 1,
      window: (cv.window as string) ?? null,
      status: completed ? "completed" : "in_progress",
    };
  });

  const now = new Date().toISOString();
  const activeRewards = (grantRows.rows as Array<Record<string, unknown>>)
    .filter((g) => g.status === "active" && (g.ends_at == null || new Date(g.ends_at as string) > new Date()))
    .map((g) => ({
      reward_id: String(g.reward_id),
      name: rewardNames.get(String(g.reward_id)) ?? String(g.reward_id),
      granted_at: new Date(g.granted_at as string).toISOString(),
      expires_at: g.ends_at != null ? new Date(g.ends_at as string).toISOString() : null,
    }));

  const rewardGrantHistory = (grantRows.rows as Array<Record<string, unknown>>).map((g) => ({
    reward_id: String(g.reward_id),
    name: rewardNames.get(String(g.reward_id)) ?? String(g.reward_id),
    granted_at: new Date(g.granted_at as string).toISOString(),
    trigger: String(g.source_type ?? "unknown"),
    goal_id: g.source_type === "goal" ? String(g.source_id) : null,
  }));

  const coreCompletionPercent = goalProgress.length
    ? Math.round(
        (goalProgress.filter((g) => g.status === "completed").length / Math.max(1, goalProgress.length)) * 100
      )
    : 0;

  const supportExplanation = [
    `Level ${currentLevel} (${levelLabel}).`,
    `Core ${coreCompletionPercent}% complete.`,
    goalProgress.some((g) => g.status === "in_progress") ? "Stretch in progress." : "Stretch selected.",
    "Maintenance OK.",
    progressPaused ? `Progress paused: ${progressPausedReason ?? "rewards paused"}.` : "Progress not paused.",
    activeRewards.length
      ? `Active reward: ${activeRewards.map((a) => `${a.name} until ${a.expires_at ?? "—"}`).join(", ")}.`
      : "No active rewards.",
  ].join(" ");

  return {
    cleaner_id: cleanerId,
    current_level: currentLevel,
    level_label: levelLabel,
    progress_paused: progressPaused,
    progress_paused_reason: progressPausedReason,
    core_completion_percent: coreCompletionPercent,
    stretch_selected: goalProgress.some((g) => g.status === "completed"),
    maintenance_ok: !maintenancePaused,
    goal_progress: goalProgress,
    active_rewards: activeRewards,
    reward_grant_history: rewardGrantHistory,
    computed_metrics_debug: {},
    support_explanation: supportExplanation,
  };
}

export async function recomputeAndReturn(cleanerId: string): Promise<SupportGamificationView | null> {
  return getSupportGamificationView(cleanerId);
}

export async function grantRewardManually(params: {
  cleanerId: string;
  rewardId: string;
  reason?: string;
  durationDays?: number;
  adminId: string;
}): Promise<SupportGamificationView | null> {
  const reward = await rewardsLib.getRewardById(params.rewardId);
  if (!reward) return null;
  const endsAt =
    params.durationDays != null && params.durationDays > 0
      ? new Date(Date.now() + params.durationDays * 24 * 60 * 60 * 1000)
      : null;
  await query(
    `INSERT INTO gamification_reward_grants (cleaner_id, reward_id, granted_at, ends_at, source_type, source_id, status, meta)
     VALUES ($1, $2, now(), $3, 'admin', $4, 'active', $5::jsonb)`,
    [
      params.cleanerId,
      params.rewardId,
      endsAt,
      params.adminId,
      JSON.stringify({ reason: params.reason ?? "Support override" }),
    ]
  );
  return getSupportGamificationView(params.cleanerId);
}

export async function removeRewardManually(params: {
  cleanerId: string;
  rewardId: string;
  reason?: string;
  adminId: string;
}): Promise<SupportGamificationView | null> {
  await query(
    `UPDATE gamification_reward_grants
     SET status = 'revoked', meta = meta || $3::jsonb
     WHERE cleaner_id = $1 AND reward_id = $2 AND status = 'active'`,
    [
      params.cleanerId,
      params.rewardId,
      JSON.stringify({ removed_reason: params.reason ?? "Support override", removed_at: new Date().toISOString() }),
    ]
  );
  return getSupportGamificationView(params.cleanerId);
}
