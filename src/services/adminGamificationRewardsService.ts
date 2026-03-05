/**
 * Admin gamification rewards library (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * CRUD for gamification_rewards table (definitions, not grants).
 */

import { query } from "../db/client";

export interface GamificationReward {
  id: string;
  kind: string;
  name: string | null;
  duration_days: number | null;
  usage_limit: number | null;
  stacking: string | null;
  permanent: boolean;
  enabled: boolean;
  updated_at: string;
}

function rowToReward(row: Record<string, unknown>): GamificationReward {
  return {
    id: String(row.id),
    kind: String(row.kind ?? ""),
    name: row.name != null ? String(row.name) : null,
    duration_days: row.duration_days != null ? Number(row.duration_days) : null,
    usage_limit: row.usage_limit != null ? Number(row.usage_limit) : null,
    stacking: row.stacking != null ? String(row.stacking) : null,
    permanent: Boolean(row.permanent ?? false),
    enabled: Boolean(row.enabled ?? true),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

export async function listRewards(): Promise<GamificationReward[]> {
  const r = await query(`SELECT * FROM gamification_rewards ORDER BY kind, updated_at DESC`);
  return (r.rows as Record<string, unknown>[]).map(rowToReward);
}

export async function getRewardById(id: string): Promise<GamificationReward | null> {
  const r = await query(`SELECT * FROM gamification_rewards WHERE id = $1`, [id]);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToReward(row) : null;
}

export async function createReward(body: Partial<GamificationReward>): Promise<GamificationReward> {
  const r = await query(
    `INSERT INTO gamification_rewards (kind, name, duration_days, usage_limit, stacking, permanent, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.kind ?? "visibility",
      body.name ?? null,
      body.duration_days ?? null,
      body.usage_limit ?? null,
      body.stacking ?? null,
      body.permanent ?? false,
      body.enabled !== false,
    ]
  );
  return rowToReward(r.rows[0] as Record<string, unknown>);
}

export async function updateReward(id: string, body: Partial<GamificationReward>): Promise<GamificationReward | null> {
  const fields: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let i = 1;
  if (body.kind !== undefined) {
    fields.push(`kind = $${i++}`);
    params.push(body.kind);
  }
  if (body.name !== undefined) {
    fields.push(`name = $${i++}`);
    params.push(body.name);
  }
  if (body.duration_days !== undefined) {
    fields.push(`duration_days = $${i++}`);
    params.push(body.duration_days);
  }
  if (body.usage_limit !== undefined) {
    fields.push(`usage_limit = $${i++}`);
    params.push(body.usage_limit);
  }
  if (body.stacking !== undefined) {
    fields.push(`stacking = $${i++}`);
    params.push(body.stacking);
  }
  if (body.permanent !== undefined) {
    fields.push(`permanent = $${i++}`);
    params.push(body.permanent);
  }
  if (body.enabled !== undefined) {
    fields.push(`enabled = $${i++}`);
    params.push(body.enabled);
  }
  if (params.length === 0) return getRewardById(id);
  params.push(id);
  const r = await query(
    `UPDATE gamification_rewards SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToReward(row) : null;
}

export async function rewardIdsExist(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const r = await query(
    `SELECT COUNT(*) AS c FROM gamification_rewards WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return Number((r.rows[0] as { c: string }).c) === ids.length;
}
