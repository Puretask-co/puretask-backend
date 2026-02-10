/**
 * Admin Budget Service (Step 10)
 * Cash caps and emergency kill switches for reward granting.
 */

import { query, withTransaction } from "../db/client";
import { logAdminAudit } from "./adminAuditService";

const GLOBAL_KEY = "__global__";

export async function getRewardBudget(
  scope: "global" | "region",
  regionId?: string | null
): Promise<{
  id: string;
  scope: string;
  region_id: string | null;
  cash_cap_daily_cents: number;
  cash_cap_monthly_cents: number;
  cash_rewards_enabled: boolean;
  emergency_disable_all_rewards: boolean;
  updated_at: Date;
} | null> {
  const rid = scope === "global" ? GLOBAL_KEY : (regionId ?? GLOBAL_KEY);
  const r = await query(
    `SELECT * FROM admin_reward_budget
     WHERE scope = $1 AND region_id = $2
     LIMIT 1`,
    [scope, rid]
  );
  return r.rows[0] ?? null;
}

export async function upsertRewardBudget(params: {
  actorId: string;
  scope: "global" | "region";
  regionId?: string | null;
  cash_cap_daily_cents: number;
  cash_cap_monthly_cents: number;
  cash_rewards_enabled: boolean;
  emergency_disable_all_rewards: boolean;
}): Promise<unknown> {
  const rid = params.scope === "global" ? GLOBAL_KEY : (params.regionId ?? GLOBAL_KEY);

  return withTransaction(async (client) => {
    const before = await getRewardBudget(params.scope, params.regionId);

    const inserted = await client.query(
      `INSERT INTO admin_reward_budget
        (scope, region_id, cash_cap_daily_cents, cash_cap_monthly_cents,
         cash_rewards_enabled, emergency_disable_all_rewards, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (scope, region_id)
       DO UPDATE SET
         cash_cap_daily_cents = EXCLUDED.cash_cap_daily_cents,
         cash_cap_monthly_cents = EXCLUDED.cash_cap_monthly_cents,
         cash_rewards_enabled = EXCLUDED.cash_rewards_enabled,
         emergency_disable_all_rewards = EXCLUDED.emergency_disable_all_rewards,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [
        params.scope,
        rid,
        params.cash_cap_daily_cents,
        params.cash_cap_monthly_cents,
        params.cash_rewards_enabled,
        params.emergency_disable_all_rewards,
        params.actorId,
      ]
    );

    const row = inserted.rows[0];
    await logAdminAudit({
      actor_admin_user_id: params.actorId,
      action: "upsert_reward_budget",
      entity_type: "admin_reward_budget",
      entity_id: row?.id,
      before_state: before,
      after_state: row,
      meta: { scope: params.scope, region_id: params.regionId ?? null },
    });

    return row;
  });
}
