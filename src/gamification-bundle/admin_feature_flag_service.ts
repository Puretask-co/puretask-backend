import { withClient } from "../db/client";
import { AdminAuditService } from "./admin_audit_service";

export class AdminFeatureFlagService {
  private audit = new AdminAuditService();

  async listFlags(key?: string | null, region_id?: string | null) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT *
         FROM admin_feature_flags
         WHERE ($1::text IS NULL OR key=$1)
           AND ($2::text IS NULL OR region_id IS NOT DISTINCT FROM $2)
         ORDER BY created_at DESC
         LIMIT 200`,
        [key ?? null, region_id ?? null]
      );
      return rows ?? [];
    });
  }

  async setFlag(params: {
    actor_admin_user_id: string;
    key: string;
    region_id?: string | null;
    enabled: boolean;
    variant?: string | null;
    config?: any;
    effective_at?: string | null;
  }) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO admin_feature_flags (key, region_id, enabled, variant, config, effective_at, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb, COALESCE($6::timestamptz, now()), $7)
         RETURNING *`,
        [
          params.key,
          params.region_id ?? null,
          params.enabled,
          params.variant ?? null,
          JSON.stringify(params.config ?? {}),
          params.effective_at ?? null,
          params.actor_admin_user_id
        ]
      );

      await this.audit.log({
        actor_admin_user_id: params.actor_admin_user_id,
        action: "set_feature_flag",
        entity_type: "admin_feature_flags",
        entity_id: rows?.[0]?.id,
        after: rows?.[0],
        meta: { key: params.key, region_id: params.region_id ?? null }
      });

      return rows?.[0];
    });
  }

  async getEffectiveFlag(key: string, region_id?: string | null) {
    return await withClient(async (client) => {
      // Region-specific wins, else global.
      const { rows } = await client.query(
        `SELECT *
         FROM admin_feature_flags
         WHERE key=$1 AND enabled=true
           AND (region_id IS NULL OR region_id IS NOT DISTINCT FROM $2)
           AND effective_at <= now()
         ORDER BY (CASE WHEN region_id IS NULL THEN 0 ELSE 1 END) DESC,
                  effective_at DESC
         LIMIT 1`,
        [key, region_id ?? null]
      );
      return rows?.[0] ?? null;
    });
  }
}
