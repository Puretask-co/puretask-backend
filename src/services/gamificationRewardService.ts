/**
 * PureTask Gamification — Reward Service
 * Handles choice reward selection and grant persistence.
 */

import { query, withTransaction } from "../db/client";
import type { PoolClient } from "pg";
import { getRewards, getChoiceRewardGroups, getReward } from "../config/cleanerLevels";
import { validateChoiceSelection, makeGrant, shouldGrant } from "../lib/gamification";
import type { RewardDefinition, RewardGrant } from "../lib/gamification/types";
import { CashBudgetService } from "./cashBudgetService";
import { isCashReward } from "./rewardKindHelpers";
import { getGoalDefinitions } from "./gamificationProgressionService";

const cashBudget = new CashBudgetService();

function toRewardDefinition(r: {
  id: string;
  kind: string;
  name: string;
  params: Record<string, unknown>;
  stacking_rule: string;
}): RewardDefinition {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    params: r.params ?? {},
    stacking_rule: (r.stacking_rule || "no_stack") as RewardDefinition["stacking_rule"],
  };
}

/**
 * Select a choice reward from an eligibility
 */
export async function selectChoiceReward(params: {
  cleanerId: string;
  eligibilityId: string;
  rewardId: string;
}): Promise<RewardGrant | null> {
  const { cleanerId, eligibilityId, rewardId } = params;

  const eligRows = await query<{
    id: string;
    choice_group_id: string;
    source_goal_id: string;
  }>(
    `SELECT id, choice_group_id, source_goal_id
     FROM gamification_choice_eligibilities
     WHERE id = $1 AND cleaner_id = $2 AND status = 'open'
       AND (expires_at IS NULL OR expires_at > now())`,
    [eligibilityId, cleanerId]
  );

  const elig = eligRows.rows[0];
  if (!elig) return null;

  const groups = getChoiceRewardGroups();
  const groupKey = Object.keys(groups).find((k) => groups[k].id === elig.choice_group_id);
  const choiceGroup = groupKey ? groups[groupKey] : null;

  if (!choiceGroup || !validateChoiceSelection(choiceGroup, rewardId)) {
    throw new Error("Invalid choice reward selection");
  }

  const rewardRaw = getReward(rewardId);
  if (!rewardRaw) throw new Error("Reward definition not found");

  const reward = toRewardDefinition(rewardRaw);

  return withTransaction(async (client) => {
    const existingRows = await client.query<{
      id: string;
      cleaner_id: string;
      reward_id: string;
      granted_at: Date;
      ends_at: Date | null;
      uses_remaining: number | null;
      source_type: string;
      source_id: string;
    }>(
      `SELECT id, cleaner_id, reward_id, granted_at, ends_at, uses_remaining, source_type, source_id
       FROM gamification_reward_grants
       WHERE cleaner_id = $1 AND reward_id = $2 AND status = 'active'
       ORDER BY granted_at DESC LIMIT 1`,
      [cleanerId, rewardId]
    );

    const existing = existingRows.rows[0]
      ? {
          grant_id: existingRows.rows[0].id,
          cleaner_id: existingRows.rows[0].cleaner_id,
          reward_id: existingRows.rows[0].reward_id,
          granted_at: existingRows.rows[0].granted_at.toISOString(),
          ends_at: existingRows.rows[0].ends_at?.toISOString() ?? null,
          uses_remaining: existingRows.rows[0].uses_remaining,
          source: {
            source_type: existingRows.rows[0].source_type as "goal" | "level" | "admin",
            source_id: existingRows.rows[0].source_id,
          },
        }
      : null;

    const decision = shouldGrant(reward, existing, new Date());

    if (decision.action === "skip") {
      await client.query(
        `UPDATE gamification_choice_eligibilities
         SET selected_reward_id = $1, selected_at = now(), status = 'selected'
         WHERE id = $2`,
        [rewardId, eligibilityId]
      );
      return existing;
    }

    if (decision.action === "extend" && existing) {
      if (decision.newEndsAt) {
        await client.query(
          `UPDATE gamification_reward_grants
           SET ends_at = $1, meta = jsonb_set(COALESCE(meta, '{}'), '{extended_at}', to_jsonb(now()::text))
           WHERE id = $2`,
          [decision.newEndsAt.toISOString(), existing.grant_id]
        );
      }
      if (decision.newUses !== undefined) {
        await client.query(
          `UPDATE gamification_reward_grants SET uses_remaining = $1 WHERE id = $2`,
          [decision.newUses, existing.grant_id]
        );
      }
      await client.query(
        `UPDATE gamification_choice_eligibilities
         SET selected_reward_id = $1, selected_at = now(), status = 'selected'
         WHERE id = $2`,
        [rewardId, eligibilityId]
      );
      return { ...existing, ends_at: decision.newEndsAt?.toISOString() ?? existing.ends_at };
    }

    const grant = makeGrant({
      cleaner_id: cleanerId,
      reward,
      source_type: "goal",
      source_id: elig.source_goal_id,
    });

    const { is_cash, amount_cents } = isCashReward(reward);
    if (is_cash) {
      const spendOk = await cashBudget.canSpend({ region_id: null, amount_cents });
      if (!spendOk.ok) {
        throw new Error(`Cash rewards temporarily paused: ${spendOk.reason ?? "budget exceeded"}`);
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
        elig.source_goal_id,
      ]
    );

    if (is_cash && amount_cents > 0) {
      await cashBudget.recordCashGrantWithClient(client, {
        cleaner_id: cleanerId,
        region_id: null,
        reward_id: rewardId,
        amount_cents,
        source_type: "choice",
        source_id: elig.source_goal_id,
      });
    }

    await client.query(
      `UPDATE gamification_choice_eligibilities
       SET selected_reward_id = $1, selected_at = now(), status = 'selected'
       WHERE id = $2`,
      [rewardId, eligibilityId]
    );

    return grant;
  });
}

/**
 * Get active rewards for a cleaner
 */
export async function getActiveRewards(cleanerId: string) {
  const r = await query(
    `SELECT * FROM gamification_active_rewards
     WHERE cleaner_id = $1
     ORDER BY granted_at DESC`,
    [cleanerId]
  );
  return r.rows;
}

/** Default TTL in days for unclaimed choice eligibilities */
const CHOICE_TTL_DAYS = 14;

/**
 * Get open choice eligibilities for a cleaner (Step 8)
 */
export async function getOpenChoiceEligibilities(cleanerId: string) {
  const r = await query<{
    id: string;
    choice_group_id: string;
    source_goal_id: string;
    earned_at: Date;
    expires_at: Date | null;
  }>(
    `SELECT id, choice_group_id, source_goal_id, earned_at, expires_at
     FROM gamification_choice_eligibilities
     WHERE cleaner_id = $1 AND status = 'open'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY earned_at DESC`,
    [cleanerId]
  );
  return r.rows;
}

/**
 * Expire time-based rewards (ends_at passed) — Step 8
 */
export async function expireRewards(): Promise<number> {
  const r = await query(
    `UPDATE gamification_reward_grants
     SET status = 'expired'
     WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at < now()
     RETURNING id`
  );
  return r.rows.length;
}

/**
 * Expire unclaimed choices (expires_at passed) — Step 8
 */
export async function expireChoices(): Promise<number> {
  const r = await query(
    `UPDATE gamification_choice_eligibilities
     SET status = 'expired'
     WHERE status = 'open' AND expires_at IS NOT NULL AND expires_at < now()
     RETURNING id`
  );
  return r.rows.length;
}

/**
 * Compute expires_at for a new choice eligibility (Step 8)
 */
export function computeChoiceExpiresAt(ttlDays = CHOICE_TTL_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() + ttlDays);
  return d;
}

/**
 * Grant rewards for a single completed goal (used by worker and bundle adapter).
 * Call within an existing transaction.
 */
export async function grantRewardsForGoal(
  client: PoolClient,
  cleanerId: string,
  goalId: string
): Promise<void> {
  const goals = getGoalDefinitions();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal?.reward_ids?.length) return;

  const rewards = getRewards();
  const choiceGroups = getChoiceRewardGroups();

  for (const rewardId of goal.reward_ids) {
    const rewardRaw = rewards.find((r) => r.id === rewardId);
    if (!rewardRaw) continue;

    const reward = toRewardDefinition(rewardRaw);

    const choiceGroup = Object.values(choiceGroups).find((g) => g.options.includes(rewardId));
    if (choiceGroup) {
      const existing = await client.query(
        `SELECT id FROM gamification_reward_grants
         WHERE cleaner_id = $1 AND source_id = $2 AND status = 'active' LIMIT 1`,
        [cleanerId, goalId]
      );
      if (existing.rows.length > 0) continue;

      const eligCheck = await client.query(
        `SELECT 1 FROM gamification_choice_eligibilities
         WHERE cleaner_id = $1 AND source_goal_id = $2 AND status = 'open' LIMIT 1`,
        [cleanerId, goalId]
      );
      if (eligCheck.rows.length > 0) continue;

      await client.query(
        `INSERT INTO gamification_choice_eligibilities
         (cleaner_id, choice_group_id, source_goal_id, status, expires_at)
         VALUES ($1, $2, $3, 'open', $4)`,
        [cleanerId, choiceGroup.id, goalId, computeChoiceExpiresAt()]
      );
      continue;
    }

    const existingRows = await client.query(
      `SELECT id, granted_at, ends_at, uses_remaining
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
          ends_at:
            (existingRows.rows[0] as { ends_at: Date | null }).ends_at?.toISOString() ?? null,
          uses_remaining: (existingRows.rows[0] as { uses_remaining: number | null }).uses_remaining,
          source: { source_type: "goal" as const, source_id: goalId },
        }
      : null;

    const decision = shouldGrant(reward, existing, new Date());
    if (decision.action === "skip") continue;

    const alreadyGranted = await client.query(
      `SELECT 1 FROM gamification_reward_grants
       WHERE cleaner_id = $1 AND source_id = $2 AND source_type = 'goal' AND status = 'active' LIMIT 1`,
      [cleanerId, goalId]
    );
    if (alreadyGranted.rows.length > 0 && decision.action === "grant") continue;

    const grant = makeGrant({
      cleaner_id: cleanerId,
      reward,
      source_type: "goal",
      source_id: goalId,
    });

    if (decision.action === "extend" && existing) {
      if (decision.newEndsAt) {
        await client.query(
          `UPDATE gamification_reward_grants SET ends_at = $1, meta = jsonb_set(COALESCE(meta, '{}'), '{extended_at}', to_jsonb(now()::text)) WHERE id = $2`,
          [decision.newEndsAt.toISOString(), existing.grant_id]
        );
      }
      if (decision.newUses !== undefined) {
        await client.query(
          `UPDATE gamification_reward_grants SET uses_remaining = $1 WHERE id = $2`,
          [decision.newUses, existing.grant_id]
        );
      }
    } else {
      const { is_cash, amount_cents } = isCashReward(reward);
      if (is_cash) {
        const spendOk = await cashBudget.canSpend({ region_id: null, amount_cents });
        if (!spendOk.ok) continue;
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

/**
 * Grant rewards for multiple completed goals (bundle-style API).
 * Runs in a single transaction.
 */
export async function grantForCompletedGoals(
  cleanerId: string,
  completedGoalIds: string[]
): Promise<void> {
  if (!completedGoalIds?.length) return;
  await withTransaction(async (client) => {
    for (const goalId of completedGoalIds) {
      await grantRewardsForGoal(client, cleanerId, goalId);
    }
  });
}
