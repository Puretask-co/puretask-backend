/**
 * Admin Feature Flag Service (Step 10)
 * A/B toggles and feature flags by region.
 */

import { query } from "../db/client";
import { logAdminAudit } from "./adminAuditService";

export async function listFeatureFlags(
  key?: string | null,
  regionId?: string | null
): Promise<Array<Record<string, unknown>>> {
  const r = await query(
    `SELECT *
     FROM admin_feature_flags
     WHERE ($1::text IS NULL OR key = $1)
       AND ($2::text IS NULL OR region_id IS NOT DISTINCT FROM $2)
     ORDER BY created_at DESC
     LIMIT 200`,
    [key ?? null, regionId ?? null]
  );
  return r.rows as Array<Record<string, unknown>>;
}

export async function setFeatureFlag(params: {
  actorId: string;
  key: string;
  regionId?: string | null;
  enabled: boolean;
  variant?: string | null;
  config?: Record<string, unknown>;
  effectiveAt?: string | null;
}): Promise<Record<string, unknown>> {
  const r = await query(
    `INSERT INTO admin_feature_flags (key, region_id, enabled, variant, config, effective_at, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6::timestamptz, now()), $7)
     RETURNING *`,
    [
      params.key,
      params.regionId ?? null,
      params.enabled,
      params.variant ?? null,
      JSON.stringify(params.config ?? {}),
      params.effectiveAt ?? null,
      params.actorId,
    ]
  );

  const row = r.rows[0] as Record<string, unknown>;

  await logAdminAudit({
    actor_admin_user_id: params.actorId,
    action: "set_feature_flag",
    entity_type: "admin_feature_flags",
    entity_id: row?.id as string,
    after_state: row,
    meta: { key: params.key, region_id: params.regionId ?? null },
  });

  return row;
}

export async function getEffectiveFeatureFlag(
  key: string,
  regionId?: string | null
): Promise<Record<string, unknown> | null> {
  const r = await query(
    `SELECT *
     FROM admin_feature_flags
     WHERE key = $1 AND enabled = true
       AND (region_id IS NULL OR region_id IS NOT DISTINCT FROM $2)
       AND effective_at <= now()
     ORDER BY (CASE WHEN region_id IS NULL THEN 0 ELSE 1 END) DESC,
              effective_at DESC
     LIMIT 1`,
    [key, regionId ?? null]
  );
  return (r.rows[0] as Record<string, unknown>) ?? null;
}
