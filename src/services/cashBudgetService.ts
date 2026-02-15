/**
 * Cash Budget Service (Step 13)
 * Enforces admin_reward_budget caps and kill switches for cash rewards.
 */

import type { PoolClient } from "pg";
import { query, withTransaction } from "../db/client";
import { isGamificationCashEnabled } from "../lib/gamificationFeatureFlags";

const GLOBAL_KEY = "__global__";

export class CashBudgetService {
  async isCashRewardAllowed(params: { region_id?: string | null }): Promise<{
    allowed: boolean;
    reason?: string;
    effective: {
      emergency_disable_all_rewards: boolean;
      cash_rewards_enabled: boolean;
      cash_cap_daily_cents: number;
      cash_cap_monthly_cents: number;
    };
  }> {
    const regionId = params.region_id ?? null;

    // Step 21: Feature flag gate
    const cashEnabled = await isGamificationCashEnabled({ region_id: regionId });
    if (!cashEnabled) {
      return {
        allowed: false,
        reason: "gamification_cash_disabled",
        effective: {
          emergency_disable_all_rewards: false,
          cash_rewards_enabled: false,
          cash_cap_daily_cents: 0,
          cash_cap_monthly_cents: 0,
        },
      };
    }

    const global = await this.getBudgetRow("global", null);
    const regional = regionId ? await this.getBudgetRow("region", regionId) : null;

    const row = regional ?? global;
    const effective = {
      emergency_disable_all_rewards: Boolean(row?.emergency_disable_all_rewards ?? false),
      cash_rewards_enabled: Boolean(row?.cash_rewards_enabled ?? true),
      cash_cap_daily_cents: Number(row?.cash_cap_daily_cents ?? 0),
      cash_cap_monthly_cents: Number(row?.cash_cap_monthly_cents ?? 0),
    };

    if (effective.emergency_disable_all_rewards) {
      return { allowed: false, reason: "emergency_disable_all_rewards", effective };
    }
    if (!effective.cash_rewards_enabled) {
      return { allowed: false, reason: "cash_rewards_disabled", effective };
    }
    return { allowed: true, effective };
  }

  async canSpend(params: { region_id?: string | null; amount_cents: number }): Promise<{
    ok: boolean;
    reason?: string;
    remaining_daily_cents?: number;
    remaining_monthly_cents?: number;
  }> {
    const regionId = params.region_id ?? null;
    const allow = await this.isCashRewardAllowed({ region_id: regionId });
    if (!allow.allowed) return { ok: false, reason: allow.reason };

    const dailyCap = allow.effective.cash_cap_daily_cents;
    const monthlyCap = allow.effective.cash_cap_monthly_cents;

    if (dailyCap <= 0 && monthlyCap <= 0) {
      return { ok: false, reason: "cash_caps_zero" };
    }

    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    );
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

    const [usedDaily, usedMonthly] = await Promise.all([
      this.getSpendCents({ scope: regionId ? "region" : "global", regionId, since: dayStart }),
      this.getSpendCents({ scope: regionId ? "region" : "global", regionId, since: monthStart }),
    ]);

    const remainingDaily =
      dailyCap > 0 ? Math.max(dailyCap - usedDaily, 0) : Number.POSITIVE_INFINITY;
    const remainingMonthly =
      monthlyCap > 0 ? Math.max(monthlyCap - usedMonthly, 0) : Number.POSITIVE_INFINITY;

    if (params.amount_cents > remainingDaily) {
      return {
        ok: false,
        reason: "daily_cap_exceeded",
        remaining_daily_cents: remainingDaily,
        remaining_monthly_cents: remainingMonthly,
      };
    }
    if (params.amount_cents > remainingMonthly) {
      return {
        ok: false,
        reason: "monthly_cap_exceeded",
        remaining_daily_cents: remainingDaily,
        remaining_monthly_cents: remainingMonthly,
      };
    }

    return {
      ok: true,
      remaining_daily_cents: remainingDaily,
      remaining_monthly_cents: remainingMonthly,
    };
  }

  async recordCashGrant(params: {
    cleaner_id: string;
    region_id?: string | null;
    reward_id: string;
    amount_cents: number;
    source_type: "goal" | "level" | "admin" | "choice";
    source_id: string;
    meta?: Record<string, unknown>;
  }): Promise<{ recorded: boolean }> {
    try {
      return await withTransaction((client) => this.recordCashGrantWithClient(client, params));
    } catch {
      return { recorded: false };
    }
  }

  /**
   * Record cash grant using an existing transaction client.
   * Use when already inside a transaction (e.g. worker, selectChoiceReward).
   */
  async recordCashGrantWithClient(
    client: PoolClient,
    params: {
      cleaner_id: string;
      region_id?: string | null;
      reward_id: string;
      amount_cents: number;
      source_type: "goal" | "level" | "admin" | "choice";
      source_id: string;
      meta?: Record<string, unknown>;
    }
  ): Promise<{ recorded: boolean }> {
    const existing = await client.query(
      `SELECT id FROM gamification_cash_reward_ledger
       WHERE cleaner_id = $1 AND reward_id = $2 AND source_type = $3 AND source_id = $4`,
      [params.cleaner_id, params.reward_id, params.source_type, params.source_id]
    );
    if ((existing.rowCount ?? 0) > 0) return { recorded: false };

    await client.query(
      `INSERT INTO gamification_cash_reward_ledger
        (cleaner_id, region_id, reward_id, amount_cents, source_type, source_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        params.cleaner_id,
        params.region_id ?? null,
        params.reward_id,
        params.amount_cents,
        params.source_type,
        params.source_id,
        JSON.stringify(params.meta ?? {}),
      ]
    );
    return { recorded: true };
  }

  private async getBudgetRow(
    scope: "global" | "region",
    regionId: string | null
  ): Promise<Record<string, unknown> | null> {
    try {
      const rid = scope === "global" ? GLOBAL_KEY : (regionId ?? GLOBAL_KEY);
      const r = await query<Record<string, unknown>>(
        `SELECT * FROM admin_reward_budget
         WHERE scope = $1 AND region_id = $2
         LIMIT 1`,
        [scope, rid]
      );
      return r.rows[0] ?? null;
    } catch {
      return null;
    }
  }

  private async getSpendCents(params: {
    scope: "global" | "region";
    regionId: string | null;
    since: Date;
  }): Promise<number> {
    try {
      const regionFilter =
        params.scope === "global" ? "region_id IS NULL" : "region_id IS NOT DISTINCT FROM $2";
      const args =
        params.scope === "global"
          ? [params.since.toISOString()]
          : [params.since.toISOString(), params.regionId];

      const r = await query(
        `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS spend
         FROM gamification_cash_reward_ledger
         WHERE granted_at >= $1::timestamptz AND ${regionFilter}`,
        args
      );
      return Number((r.rows[0] as { spend: string })?.spend ?? 0);
    } catch {
      return 0;
    }
  }
}
