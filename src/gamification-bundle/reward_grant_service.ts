import { withClient } from "../db/client";
import config from "../config/config.json";

/**
 * RewardGrantService
 * - Idempotently grants rewards when goals complete
 * - Creates choice eligibilities for choice_group rewards
 * - Applies stacking rules: "ignore", "extend", "stack_uses"
 *
 * Assumes config has:
 * - rewards: [{ id, kind, params, duration_days?, uses?, stacking }]
 * - goals: [{ id, reward_ids?, choice_group_id? }]
 */

type AnyJson = Record<string, any>;

export class RewardGrantService {
  private rewardsById: Map<string, AnyJson> = new Map();
  private goalsById: Map<string, AnyJson> = new Map();

  constructor() {
    for (const r of (config as any).rewards ?? []) this.rewardsById.set(r.id, r);
    for (const g of (config as any).goals ?? []) this.goalsById.set(g.id, g);
  }

  /**
   * Called after recompute: pass all completed goals for the cleaner, for this level or all levels.
   * This function will:
   * - grant rewards for newly completed goals (idempotent by uq_reward_grants_source)
   * - open choice eligibility if the goal has choice_group_id
   */
  async grantForCompletedGoals(cleaner_id: string, completed_goal_ids: string[]) {
    if (!completed_goal_ids?.length) return;

    for (const goal_id of completed_goal_ids) {
      const goal = this.goalsById.get(goal_id);
      if (!goal) continue;

      // Choice reward path
      if (goal.choice_group_id) {
        await this.openChoiceEligibility(cleaner_id, goal.choice_group_id, goal_id);
        continue;
      }

      // Direct rewards path
      const rewardIds: string[] = goal.reward_ids ?? [];
      for (const reward_id of rewardIds) {
        await this.grantReward(cleaner_id, reward_id, "goal", goal_id, { goal_id });
      }
    }
  }

  /**
   * Grant a reward with stacking behavior.
   * - ignore: do nothing if an active grant exists for same reward_id
   * - extend: if active grant exists with ends_at, extend by duration_days
   * - stack_uses: if active grant exists with uses_remaining, add uses
   * Permanent rewards should have ends_at null and will be unique (uq_reward_grants_permanent_once from Step 6).
   */
  async grantReward(cleaner_id: string, reward_id: string, source_type: "goal"|"level"|"admin", source_id: string, meta: AnyJson) {
    const reward = this.rewardsById.get(reward_id);
    if (!reward) return;

    const durationDays: number | null = reward.duration_days ?? null;
    const uses: number | null = reward.uses ?? null;
    const stacking: "ignore"|"extend"|"stack_uses" = reward.stacking ?? "ignore";

    await withClient(async (client) => {
      // Idempotent check by source (unique index uq_reward_grants_source)
      // If already granted for this source, do nothing.
      const existing = await client.query(
        `SELECT id, ends_at, uses_remaining, status
         FROM gamification_reward_grants
         WHERE cleaner_id=$1 AND reward_id=$2 AND source_type=$3 AND source_id=$4`,
        [cleaner_id, reward_id, source_type, source_id]
      );
      if (existing.rowCount > 0) return;

      // Check active grant for stacking logic
      const active = await client.query(
        `SELECT id, ends_at, uses_remaining
         FROM gamification_reward_grants
         WHERE cleaner_id=$1 AND reward_id=$2 AND status='active'
         ORDER BY granted_at DESC
         LIMIT 1`,
        [cleaner_id, reward_id]
      );

      // Compute new ends_at / uses_remaining
      let ends_at: string | null = null;
      let uses_remaining: number | null = uses ?? null;

      if (durationDays != null) {
        // default ends_at = now + durationDays
        ends_at = new Date(Date.now() + durationDays*24*60*60*1000).toISOString();
      }

      if (active.rowCount > 0) {
        const a = active.rows[0];

        if (stacking === "ignore") {
          // If there is already an active grant of the same reward, do not grant a new one.
          return;
        }

        if (stacking === "extend" && a.ends_at) {
          const base = new Date(a.ends_at).getTime();
          const extended = base + (durationDays ?? 0)*24*60*60*1000;
          // Update existing grant end time, then record a new row (for audit) as expired/ignored? We keep it simple:
          await client.query(
            `UPDATE gamification_reward_grants
             SET ends_at = to_timestamp($1/1000.0)
             WHERE id=$2`,
            [extended, a.id]
          );
          // Also record the grant event (as audit) with status='revoked'? That complicates.
          // We'll instead insert a normal row but mark status='revoked' and meta.note='extended existing grant'.
          await client.query(
            `INSERT INTO gamification_reward_grants (cleaner_id, reward_id, source_type, source_id, status, meta)
             VALUES ($1,$2,$3,$4,'revoked',$5::jsonb)`,
            [cleaner_id, reward_id, source_type, source_id, JSON.stringify({ ...meta, note: "extended_existing_grant" })]
          );
          return;
        }

        if (stacking === "stack_uses" && a.uses_remaining != null && uses_remaining != null) {
          const newUses = Number(a.uses_remaining) + Number(uses_remaining);
          await client.query(
            `UPDATE gamification_reward_grants
             SET uses_remaining=$1
             WHERE id=$2`,
            [newUses, a.id]
          );
          await client.query(
            `INSERT INTO gamification_reward_grants (cleaner_id, reward_id, source_type, source_id, status, meta)
             VALUES ($1,$2,$3,$4,'revoked',$5::jsonb)`,
            [cleaner_id, reward_id, source_type, source_id, JSON.stringify({ ...meta, note: "stacked_uses_existing_grant" })]
          );
          return;
        }
      }

      // Insert new active grant
      await client.query(
        `INSERT INTO gamification_reward_grants
          (cleaner_id, reward_id, ends_at, uses_remaining, source_type, source_id, status, meta)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7::jsonb)`,
        [cleaner_id, reward_id, ends_at, uses_remaining, source_type, source_id, JSON.stringify(meta ?? {})]
      );
    });
  }

  async openChoiceEligibility(cleaner_id: string, choice_group_id: string, source_goal_id: string) {
    // Default TTL: 14 days (config knob)
    const ttlDays = (config as any).choice_ttl_days ?? 14;
    const expiresAt = new Date(Date.now() + ttlDays*24*60*60*1000).toISOString();

    await withClient(async (client) => {
      // Idempotent: only one open per goal (uq_choice_open_per_goal)
      const existing = await client.query(
        `SELECT id FROM gamification_choice_eligibilities
         WHERE cleaner_id=$1 AND source_goal_id=$2 AND status='open'`,
        [cleaner_id, source_goal_id]
      );
      if (existing.rowCount > 0) return;

      await client.query(
        `INSERT INTO gamification_choice_eligibilities
          (cleaner_id, choice_group_id, source_goal_id, earned_at, status, expires_at)
         VALUES ($1,$2,$3, now(), 'open', $4::timestamptz)`,
        [cleaner_id, choice_group_id, source_goal_id, expiresAt]
      );
    });
  }

  async selectChoiceReward(cleaner_id: string, eligibility_id: string, reward_id: string) {
    const reward = this.rewardsById.get(reward_id);
    if (!reward) throw new Error("invalid reward_id");

    await withClient(async (client) => {
      await client.query("BEGIN");

      const elig = await client.query(
        `SELECT id, choice_group_id, source_goal_id, status, expires_at
         FROM gamification_choice_eligibilities
         WHERE id=$1 AND cleaner_id=$2
         FOR UPDATE`,
        [eligibility_id, cleaner_id]
      );

      if (elig.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new Error("eligibility not found");
      }

      const row = elig.rows[0];
      if (row.status !== "open") {
        await client.query("ROLLBACK");
        throw new Error("eligibility not open");
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        await client.query(
          `UPDATE gamification_choice_eligibilities SET status='expired' WHERE id=$1`,
          [eligibility_id]
        );
        await client.query("COMMIT");
        throw new Error("eligibility expired");
      }

      // Mark selected
      await client.query(
        `UPDATE gamification_choice_eligibilities
         SET status='selected', selected_reward_id=$1, selected_at=now()
         WHERE id=$2`,
        [reward_id, eligibility_id]
      );

      // Grant reward from choice selection
      await client.query("COMMIT");
    });

    // Grant after commit (safe, idempotent by source)
    await this.grantReward(cleaner_id, reward_id, "goal", `choice:${eligibility_id}`, { choice_eligibility_id: eligibility_id });
  }

  async expireChoices() {
    await withClient(async (client) => {
      await client.query(
        `UPDATE gamification_choice_eligibilities
         SET status='expired'
         WHERE status='open' AND expires_at IS NOT NULL AND expires_at < now()`
      );
    });
  }

  async expireRewards() {
    await withClient(async (client) => {
      await client.query(
        `UPDATE gamification_reward_grants
         SET status='expired'
         WHERE status='active' AND ends_at IS NOT NULL AND ends_at < now()`
      );
    });
  }
}
