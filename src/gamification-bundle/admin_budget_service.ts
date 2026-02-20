import { withClient } from "../db/client";
import { AdminAuditService } from "./admin_audit_service";

export class AdminBudgetService {
  private audit = new AdminAuditService();

  async getBudget(scope: "global"|"region", region_id?: string | null) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT *
         FROM admin_reward_budget
         WHERE scope=$1 AND COALESCE(region_id,'__global__')=COALESCE($2,'__global__')
         LIMIT 1`,
        [scope, region_id ?? null]
      );
      return rows?.[0] ?? null;
    });
  }

  async upsertBudget(params: {
    actor_admin_user_id: string;
    scope: "global"|"region";
    region_id?: string | null;
    cash_cap_daily_cents: number;
    cash_cap_monthly_cents: number;
    cash_rewards_enabled: boolean;
    emergency_disable_all_rewards: boolean;
  }) {
    return await withClient(async (client) => {
      const before = await this.getBudget(params.scope, params.region_id ?? null);

      const { rows } = await client.query(
        `INSERT INTO admin_reward_budget
          (scope, region_id, cash_cap_daily_cents, cash_cap_monthly_cents, cash_rewards_enabled, emergency_disable_all_rewards, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (scope, COALESCE(region_id,'__global__'))
         DO UPDATE SET cash_cap_daily_cents=EXCLUDED.cash_cap_daily_cents,
                       cash_cap_monthly_cents=EXCLUDED.cash_cap_monthly_cents,
                       cash_rewards_enabled=EXCLUDED.cash_rewards_enabled,
                       emergency_disable_all_rewards=EXCLUDED.emergency_disable_all_rewards,
                       updated_by=EXCLUDED.updated_by,
                       updated_at=now()
         RETURNING *`,
        [
          params.scope,
          params.region_id ?? null,
          params.cash_cap_daily_cents,
          params.cash_cap_monthly_cents,
          params.cash_rewards_enabled,
          params.emergency_disable_all_rewards,
          params.actor_admin_user_id
        ]
      );

      await this.audit.log({
        actor_admin_user_id: params.actor_admin_user_id,
        action: "upsert_reward_budget",
        entity_type: "admin_reward_budget",
        entity_id: rows?.[0]?.id,
        before,
        after: rows?.[0],
        meta: { scope: params.scope, region_id: params.region_id ?? null }
      });

      return rows?.[0];
    });
  }
}
