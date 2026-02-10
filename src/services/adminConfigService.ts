/**
 * Admin Config Service (Step 10)
 * Versioned goals/rewards/levels/governor configs with effective_at and rollback.
 */

import { query, withTransaction } from "../db/client";
import { logAdminAudit } from "./adminAuditService";

export type ConfigType = "goals" | "rewards" | "governor" | "levels" | "full_bundle";

export async function getActiveConfig(
  configType: ConfigType,
  regionId?: string | null
): Promise<{ id: string; version: number; payload: unknown; effective_at: Date } | null> {
  const r = await query<{ id: string; version: number; payload: unknown; effective_at: Date }>(
    regionId
      ? `SELECT id, version, payload, effective_at
         FROM admin_config_versions
         WHERE config_type = $1 AND region_id = $2
           AND status = 'active' AND effective_at <= now()
         ORDER BY effective_at DESC, version DESC
         LIMIT 1`
      : `SELECT id, version, payload, effective_at
         FROM admin_config_versions
         WHERE config_type = $1 AND region_id IS NULL
           AND status = 'active' AND effective_at <= now()
         ORDER BY effective_at DESC, version DESC
         LIMIT 1`,
    regionId ? [configType, regionId] : [configType]
  );
  return r.rows[0] ?? null;
}

export async function listConfigVersions(
  configType: ConfigType,
  regionId?: string | null
): Promise<
  Array<{
    id: string;
    version: number;
    status: string;
    effective_at: Date;
    change_summary: string;
    created_at: Date;
    created_by: string | null;
  }>
> {
  const r = await query(
    regionId
      ? `SELECT id, version, status, effective_at, change_summary, created_at, created_by
         FROM admin_config_versions
         WHERE config_type = $1 AND region_id = $2
         ORDER BY version DESC`
      : `SELECT id, version, status, effective_at, change_summary, created_at, created_by
         FROM admin_config_versions
         WHERE config_type = $1 AND region_id IS NULL
         ORDER BY version DESC`,
    regionId ? [configType, regionId] : [configType]
  );
  return r.rows as Array<{
    id: string;
    version: number;
    status: string;
    effective_at: Date;
    change_summary: string;
    created_at: Date;
    created_by: string | null;
  }>;
}

export async function createConfigVersion(params: {
  actorId: string;
  configType: ConfigType;
  regionId?: string | null;
  effectiveAt?: string | null;
  payload: unknown;
  changeSummary: string;
  status?: "draft" | "active";
}): Promise<{ id: string; version: number; status: string; effective_at: Date }> {
  const status = params.status ?? "active";

  return withTransaction(async (client) => {
    const lastVer = params.regionId
      ? await client.query<{ v: number }>(
          `SELECT COALESCE(MAX(version), 0)::int AS v
           FROM admin_config_versions
           WHERE config_type = $1 AND region_id = $2`,
          [params.configType, params.regionId]
        )
      : await client.query<{ v: number }>(
          `SELECT COALESCE(MAX(version), 0)::int AS v
           FROM admin_config_versions
           WHERE config_type = $1 AND region_id IS NULL`,
          [params.configType]
        );
    const nextVersion = (lastVer.rows[0]?.v ?? 0) + 1;

    if (status === "active") {
      if (params.regionId) {
        await client.query(
          `UPDATE admin_config_versions SET status = 'superseded'
           WHERE config_type = $1 AND region_id = $2 AND status = 'active'`,
          [params.configType, params.regionId]
        );
      } else {
        await client.query(
          `UPDATE admin_config_versions SET status = 'superseded'
           WHERE config_type = $1 AND region_id IS NULL AND status = 'active'`,
          [params.configType]
        );
      }
    }

    const inserted = await client.query<{ id: string; version: number; status: string; effective_at: Date }>(
      `INSERT INTO admin_config_versions
        (config_type, version, region_id, status, effective_at, payload, change_summary, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6::jsonb, $7, $8)
       RETURNING id, version, status, effective_at`,
      [
        params.configType,
        nextVersion,
        params.regionId ?? null,
        status,
        params.effectiveAt ?? null,
        JSON.stringify(params.payload),
        params.changeSummary ?? "",
        params.actorId,
      ]
    );

    const row = inserted.rows[0]!;
    await logAdminAudit({
      actor_admin_user_id: params.actorId,
      action: "create_config_version",
      entity_type: "admin_config_versions",
      entity_id: row.id,
      after_state: row,
      meta: { config_type: params.configType, region_id: params.regionId ?? null },
    });

    return row;
  });
}

export async function rollbackToVersion(params: {
  actorId: string;
  configType: ConfigType;
  regionId?: string | null;
  version: number;
  changeSummary?: string;
}): Promise<{ id: string; version: number }> {
  const target = params.regionId
    ? await query<{ id: string; payload: unknown }>(
        `SELECT id, payload FROM admin_config_versions
         WHERE config_type = $1 AND region_id = $2 AND version = $3`,
        [params.configType, params.regionId, params.version]
      )
    : await query<{ id: string; payload: unknown }>(
        `SELECT id, payload FROM admin_config_versions
         WHERE config_type = $1 AND region_id IS NULL AND version = $3`,
        [params.configType, params.version]
      );

  if (!target.rows[0]) {
    throw new Error("Target version not found");
  }

  const created = await createConfigVersion({
    actorId: params.actorId,
    configType: params.configType,
    regionId: params.regionId,
    payload: target.rows[0].payload,
    changeSummary: params.changeSummary ?? `Rollback to version ${params.version}`,
    status: "active",
  });

  await logAdminAudit({
    actor_admin_user_id: params.actorId,
    action: "rollback_config",
    entity_type: "admin_config_versions",
    entity_id: created.id,
    meta: {
      rolled_back_to_version: params.version,
      config_type: params.configType,
      region_id: params.regionId ?? null,
    },
  });

  return created;
}
