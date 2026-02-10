/**
 * PureTask Gamification — Process Cleaner Gamification Worker
 * Recomputes progression, updates level status, grants rewards.
 * Trigger: after job completion, rating, event ingestion, or cron.
 */

import { withTransaction } from "../../db/client";
import { isGamificationEnabled } from "../../lib/gamificationFeatureFlags";
import { getCleanerProgression, getGoalDefinitions } from "../../services/gamificationProgressionService";
import { expireRewards, expireChoices, computeChoiceExpiresAt } from "../../services/gamificationRewardService";
import { CashBudgetService } from "../../services/cashBudgetService";
import { isCashReward } from "../../services/rewardKindHelpers";
import { BadgeService } from "../../services/badgeService";
import { getRewards, getChoiceRewardGroups } from "../../config/cleanerLevels";
import { logger } from "../../lib/logger";
import { makeGrant, shouldGrant } from "../../lib/gamification";

const cashBudget = new CashBudgetService();
const badgeService = new BadgeService();

/**
 * Process gamification for a cleaner: recompute progress, update level, grant rewards
 */
export async function processCleanerGamification(cleanerId: string): Promise<void> {
  if (!(await isGamificationEnabled({ region_id: null }))) {
    logger.debug("gamification_skipped_disabled", { cleanerId });
    return;
  }

  // Step 8: Expire time-based rewards and choices (idempotent, safe to run before each process)
  await expireRewards();
  await expireChoices();

  await withTransaction(async (client) => {
    const levelRow = await client.query<{ current_level: number }>(
      `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (levelRow.rows.length === 0) {
      await client.query(
        `INSERT INTO cleaner_level_progress (cleaner_id, current_level)
         VALUES ($1, 1)
         ON CONFLICT (cleaner_id) DO NOTHING`,
        [cleanerId]
      );
      return;
    }

    const currentLevel = levelRow.rows[0].current_level;
    const { levelEval, goalProgress } = await getCleanerProgression(cleanerId, currentLevel);

    for (const gp of goalProgress) {
      await client.query(
        `INSERT INTO cleaner_goal_progress (cleaner_id, goal_id, current_value, progress_ratio, completed, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now())
         ON CONFLICT (cleaner_id, goal_id)
         DO UPDATE SET current_value = EXCLUDED.current_value, progress_ratio = EXCLUDED.progress_ratio, completed = EXCLUDED.completed, updated_at = now()`,
        [
          cleanerId,
          gp.goal_id,
          JSON.stringify({ value: gp.current_value, remaining: gp.remaining }),
          gp.progress_ratio,
          gp.complete,
        ]
      );
    }

    await client.query(
      `UPDATE cleaner_level_progress
       SET maintenance_paused = $2, maintenance_paused_reason = $3, updated_at = now()
       WHERE cleaner_id = $1`,
      [
        cleanerId,
        levelEval.paused,
        levelEval.pause_reasons.length > 0 ? levelEval.pause_reasons.join("; ") : null,
      ]
    );

    if (levelEval.eligible_for_level > currentLevel) {
      await client.query(
        `UPDATE cleaner_level_progress
         SET current_level = $2, level_reached_at = now(), updated_at = now()
         WHERE cleaner_id = $1`,
        [cleanerId, levelEval.eligible_for_level]
      );
      logger.info("cleaner_level_up", {
        cleanerId,
        fromLevel: currentLevel,
        toLevel: levelEval.eligible_for_level,
      });
    }

    for (const gp of goalProgress.filter((g) => g.complete && g.goal_id)) {
      await grantRewardsForGoal(client, cleanerId, gp.goal_id, currentLevel);
    }

    // Step 14: Award eligible badges from metric snapshot
    try {
      const metricSnapshot = await badgeService.buildMetricSnapshot(cleanerId);
      const { newly_awarded } = await badgeService.awardEligibleBadges({
        cleaner_id: cleanerId,
        metric_snapshot: metricSnapshot,
      });
      if (newly_awarded.length > 0) {
        logger.info("gamification_badges_awarded", { cleanerId, newly_awarded });
      }
    } catch (err) {
      logger.warn("gamification_badge_award_failed", { cleanerId, error: (err as Error).message });
    }
  });
}

async function grantRewardsForGoal(
  client: { query: (sql: string, args?: unknown[]) => Promise<{ rows: unknown[] }> },
  cleanerId: string,
  goalId: string,
  level: number
): Promise<void> {
  const goals = getGoalDefinitions();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal?.reward_ids?.length) return;

  const rewards = getRewards();
  const choiceGroups = getChoiceRewardGroups();

  for (const rewardId of goal.reward_ids) {
    const rewardRaw = rewards.find((r) => r.id === rewardId);
    if (!rewardRaw) continue;

    const reward = {
      id: rewardRaw.id,
      kind: rewardRaw.kind,
      name: rewardRaw.name,
      params: rewardRaw.params ?? {},
      stacking_rule: (rewardRaw.stacking_rule || "no_stack") as "no_stack" | "extend_duration" | "extend_uses",
    };

    const choiceGroup = Object.values(choiceGroups).find((g) => g.options.includes(rewardId));
    if (choiceGroup) {
      const existing = await client.query(
        `SELECT id, cleaner_id, reward_id, granted_at, ends_at, uses_remaining, source_type, source_id
         FROM gamification_reward_grants
         WHERE cleaner_id = $1 AND source_id = $2 AND status = 'active'
         LIMIT 1`,
        [cleanerId, goalId]
      );
      if (existing.rows.length > 0) continue;

      const eligCheck = await client.query(
        `SELECT 1 FROM gamification_choice_eligibilities
         WHERE cleaner_id = $1 AND source_goal_id = $2 AND status = 'open'
         LIMIT 1`,
        [cleanerId, goalId]
      );
      if (eligCheck.rows.length > 0) continue;

      const expiresAt = computeChoiceExpiresAt();
      await client.query(
        `INSERT INTO gamification_choice_eligibilities
         (cleaner_id, choice_group_id, source_goal_id, status, expires_at)
         VALUES ($1, $2, $3, 'open', $4)`,
        [cleanerId, choiceGroup.id, goalId, expiresAt]
      );
      continue;
    }

    const existingRows = await client.query(
      `SELECT id, cleaner_id, reward_id, granted_at, ends_at, uses_remaining, source_type, source_id
       FROM gamification_reward_grants
       WHERE cleaner_id = $1 AND reward_id = $2 AND status = 'active'
       ORDER BY granted_at DESC LIMIT 1`,
      [cleanerId, rewardId]
    );

    const existing = existingRows.rows[0]
      ? {
          grant_id: (existingRows.rows[0] as { id: string }).id,
          cleaner_id: cleanerId,
          reward_id: rewardId,
          granted_at: (existingRows.rows[0] as { granted_at: Date }).granted_at.toISOString(),
          ends_at: (existingRows.rows[0] as { ends_at: Date | null }).ends_at?.toISOString() ?? null,
          uses_remaining: (existingRows.rows[0] as { uses_remaining: number | null }).uses_remaining,
          source: {
            source_type: "goal" as const,
            source_id: goalId,
          },
        }
      : null;

    const decision = shouldGrant(reward, existing, new Date());
    if (decision.action === "skip") continue;

    const alreadyGrantedForGoal = await client.query(
      `SELECT 1 FROM gamification_reward_grants
       WHERE cleaner_id = $1 AND source_id = $2 AND source_type = 'goal' AND status = 'active'
       LIMIT 1`,
      [cleanerId, goalId]
    );
    if (alreadyGrantedForGoal.rows.length > 0 && decision.action === "grant") continue;

    const grant = makeGrant({
      cleaner_id: cleanerId,
      reward,
      source_type: "goal",
      source_id: goalId,
    });

    if (decision.action === "extend" && existing) {
      if ((decision as { newEndsAt?: Date }).newEndsAt) {
        await client.query(
          `UPDATE gamification_reward_grants SET ends_at = $1, meta = jsonb_set(COALESCE(meta, '{}'), '{extended_at}', to_jsonb(now()::text)) WHERE id = $2`,
          [(decision as { newEndsAt: Date }).newEndsAt.toISOString(), existing.grant_id]
        );
      }
      if ((decision as { newUses?: number }).newUses !== undefined) {
        await client.query(
          `UPDATE gamification_reward_grants SET uses_remaining = $1 WHERE id = $2`,
          [(decision as { newUses: number }).newUses, existing.grant_id]
        );
      }
    } else {
      const { is_cash, amount_cents } = isCashReward(reward);
      if (is_cash) {
        const spendOk = await cashBudget.canSpend({ region_id: null, amount_cents });
        if (!spendOk.ok) {
          logger.info("gamification_cash_blocked", {
            cleanerId,
            rewardId,
            goalId,
            reason: spendOk.reason,
          });
          continue;
        }
      }

      await client.query(
        `INSERT INTO gamification_reward_grants
         (id, cleaner_id, reward_id, granted_at, ends_at, uses_remaining, source_type, source_id, status, meta)
         VALUES ($1, $2, $3, $4, $5, $6, 'goal', $7, 'active', '{}'::jsonb)`,
        [
          grant.grant_id,
          grant.cleaner_id,
          grant.reward_id,
          grant.granted_at,
          grant.ends_at,
          grant.uses_remaining,
          goalId,
        ]
      );

      if (is_cash && amount_cents > 0) {
        await cashBudget.recordCashGrantWithClient(client, {
          cleaner_id: cleanerId,
          region_id: null,
          reward_id: rewardId,
          amount_cents,
          source_type: "goal",
          source_id: goalId,
        });
      }
    }
  }
}
