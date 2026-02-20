import { withClient } from "../db/client";
import { AdminAuditService } from "./admin_audit_service";

/**
 * Governor config is intentionally JSON so you can tune without schema churn.
 * Keys you already use:
 * - visibility_cap_multiplier
 * - early_exposure_cap_minutes
 * - fee_discount_cap_percent
 * Optional:
 * - cash_rewards_enabled_override
 * - quality_strictness_multiplier
 */
export class AdminGovernorService {
  private audit = new AdminAuditService();

  async getRegionConfig(region_id: string) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT region_id, config, updated_at, updated_by
         FROM region_governor_config
         WHERE region_id=$1`,
        [region_id]
      );
      return rows?.[0] ?? { region_id, config: {} };
    });
  }

  async upsertRegionConfig(params: {
    actor_admin_user_id: string;
    region_id: string;
    config: any;
  }) {
    return await withClient(async (client) => {
      const before = await this.getRegionConfig(params.region_id);

      const { rows } = await client.query(
        `INSERT INTO region_governor_config (region_id, config, updated_by, updated_at)
         VALUES ($1,$2::jsonb,$3, now())
         ON CONFLICT (region_id)
         DO UPDATE SET config=EXCLUDED.config, updated_by=EXCLUDED.updated_by, updated_at=now()
         RETURNING region_id, config, updated_at, updated_by`,
        [params.region_id, JSON.stringify(params.config ?? {}), params.actor_admin_user_id]
      );

      await this.audit.log({
        actor_admin_user_id: params.actor_admin_user_id,
        action: "upsert_governor_config",
        entity_type: "region_governor_config",
        entity_id: params.region_id,
        before,
        after: rows?.[0],
        meta: { region_id: params.region_id }
      });

      return rows?.[0];
    });
  }
}
