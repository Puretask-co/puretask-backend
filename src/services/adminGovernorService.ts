/**
 * Admin Governor Service (Step 10)
 * Per-region governor config (visibility cap, early exposure cap, fee discount cap).
 */

import { query } from "../db/client";
import { logAdminAudit } from "./adminAuditService";

export async function getRegionGovernorConfig(regionId: string): Promise<{
  region_id: string;
  config: Record<string, unknown>;
  updated_at: Date;
}> {
  const r = await query(
    `SELECT region_id, config, updated_at
     FROM region_governor_config
     WHERE region_id = $1`,
    [regionId]
  );
  if (!r.rows[0]) {
    return { region_id: regionId, config: {}, updated_at: new Date() };
  }
  return r.rows[0] as { region_id: string; config: Record<string, unknown>; updated_at: Date };
}

export async function upsertRegionGovernorConfig(params: {
  actorId: string;
  regionId: string;
  config: Record<string, unknown>;
}): Promise<{ region_id: string; config: Record<string, unknown>; updated_at: Date }> {
  const before = await getRegionGovernorConfig(params.regionId);

  const r = await query(
    `INSERT INTO region_governor_config (region_id, config, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (region_id)
     DO UPDATE SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING region_id, config, updated_at`,
    [params.regionId, JSON.stringify(params.config ?? {}), params.actorId]
  );

  const row = r.rows[0] as { region_id: string; config: Record<string, unknown>; updated_at: Date };

  await logAdminAudit({
    actor_admin_user_id: params.actorId,
    action: "upsert_governor_config",
    entity_type: "region_governor_config",
    entity_id: params.regionId,
    before_state: before,
    after_state: row,
    meta: { region_id: params.regionId },
  });

  return row;
}
