import { withClient } from "../db/client";
import { AdminAuditService } from "./admin_audit_service";

export class AdminConfigService {
  private audit = new AdminAuditService();

  async getActiveConfig(config_type: string, region_id?: string | null) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT id, version, payload, effective_at
         FROM admin_config_versions
         WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2
           AND status='active'
         ORDER BY effective_at DESC, version DESC
         LIMIT 1`,
        [config_type, region_id ?? null]
      );
      return rows?.[0] ?? null;
    });
  }

  async listVersions(config_type: string, region_id?: string | null) {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT id, version, status, effective_at, change_summary, created_at, created_by
         FROM admin_config_versions
         WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2
         ORDER BY version DESC`,
        [config_type, region_id ?? null]
      );
      return rows ?? [];
    });
  }

  async createVersion(params: {
    actor_admin_user_id: string;
    config_type: "goals"|"rewards"|"governor"|"levels"|"full_bundle";
    region_id?: string | null;
    effective_at?: string | null;
    payload: any;
    change_summary: string;
    status?: "draft"|"active";
  }) {
    const status = params.status ?? "active";

    return await withClient(async (client) => {
      await client.query("BEGIN");

      const { rows: lastRows } = await client.query(
        `SELECT COALESCE(max(version),0)::int AS v
         FROM admin_config_versions
         WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2`,
        [params.config_type, params.region_id ?? null]
      );
      const nextVersion = (lastRows?.[0]?.v ?? 0) + 1;

      if (status === "active") {
        // Supersede previous active configs for same type/region
        await client.query(
          `UPDATE admin_config_versions
           SET status='superseded'
           WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2 AND status='active'`,
          [params.config_type, params.region_id ?? null]
        );
      }

      const { rows } = await client.query(
        `INSERT INTO admin_config_versions
          (config_type, version, region_id, status, effective_at, payload, change_summary, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6::jsonb,$7,$8)
         RETURNING id, version, status, effective_at`,
        [
          params.config_type,
          nextVersion,
          params.region_id ?? null,
          status,
          params.effective_at ?? null,
          JSON.stringify(params.payload),
          params.change_summary ?? "",
          params.actor_admin_user_id
        ]
      );

      await client.query("COMMIT");

      await this.audit.log({
        actor_admin_user_id: params.actor_admin_user_id,
        action: "create_config_version",
        entity_type: "admin_config_versions",
        entity_id: rows[0].id,
        after: rows[0],
        meta: { config_type: params.config_type, region_id: params.region_id ?? null }
      });

      return rows?.[0];
    });
  }

  async rollbackToVersion(params: {
    actor_admin_user_id: string;
    config_type: string;
    region_id?: string | null;
    version: number;
    change_summary?: string;
  }) {
    return await withClient(async (client) => {
      await client.query("BEGIN");

      const { rows: target } = await client.query(
        `SELECT id, payload
         FROM admin_config_versions
         WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2 AND version=$3`,
        [params.config_type, params.region_id ?? null, params.version]
      );
      if (!target?.length) {
        await client.query("ROLLBACK");
        throw new Error("target version not found");
      }

      // Supersede current active
      await client.query(
        `UPDATE admin_config_versions
         SET status='superseded'
         WHERE config_type=$1 AND region_id IS NOT DISTINCT FROM $2 AND status='active'`,
        [params.config_type, params.region_id ?? null]
      );

      // Create a new active version that copies payload (immutable history)
      const created = await this.createVersion({
        actor_admin_user_id: params.actor_admin_user_id,
        config_type: params.config_type as any,
        region_id: params.region_id ?? null,
        payload: target[0].payload,
        change_summary: params.change_summary ?? `rollback to version ${params.version}`,
        status: "active"
      });

      await client.query("COMMIT");

      await this.audit.log({
        actor_admin_user_id: params.actor_admin_user_id,
        action: "rollback_config",
        entity_type: "admin_config_versions",
        entity_id: created.id,
        meta: { rolled_back_to_version: params.version, config_type: params.config_type, region_id: params.region_id ?? null }
      });

      return created;
    });
  }
}
