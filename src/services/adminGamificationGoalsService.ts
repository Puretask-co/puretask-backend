/**
 * Admin gamification goals library (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * CRUD for gamification_goals table.
 */

import { query } from "../db/client";

export type GoalType = "core" | "stretch" | "maintenance";

export interface GamificationGoal {
  id: string;
  title: string;
  description: string | null;
  level: number;
  type: GoalType;
  metric_key: string | null;
  operator: string | null;
  target: number | string | null;
  window: string | null;
  filters: Record<string, unknown> | null;
  enabled: boolean;
  effective_at: string | null;
  version: number;
  updated_at: string;
}

function rowToGoal(row: Record<string, unknown>): GamificationGoal {
  const target = row.target_display != null ? String(row.target_display) : (row.target as number | null);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    level: Number(row.level ?? 1),
    type: (row.type as GoalType) ?? "core",
    metric_key: row.metric_key != null ? String(row.metric_key) : null,
    operator: row.operator != null ? String(row.operator) : null,
    target: target ?? null,
    window: row.window != null ? String(row.window) : null,
    filters: (row.filters as Record<string, unknown>) ?? null,
    enabled: Boolean(row.enabled ?? true),
    effective_at: row.effective_at != null ? new Date(row.effective_at as string).toISOString() : null,
    version: Number(row.version ?? 1),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

export async function listGoals(filters: {
  level?: number;
  type?: GoalType;
  enabled?: boolean;
}): Promise<GamificationGoal[]> {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;
  if (filters.level != null) {
    conditions.push(`level = $${i++}`);
    params.push(filters.level);
  }
  if (filters.type != null) {
    conditions.push(`type = $${i++}`);
    params.push(filters.type);
  }
  if (filters.enabled != null) {
    conditions.push(`enabled = $${i++}`);
    params.push(filters.enabled);
  }
  const r = await query(
    `SELECT * FROM gamification_goals WHERE ${conditions.join(" AND ")} ORDER BY level, type, updated_at DESC`,
    params
  );
  return (r.rows as Record<string, unknown>[]).map(rowToGoal);
}

export async function getGoalById(id: string): Promise<GamificationGoal | null> {
  const r = await query(`SELECT * FROM gamification_goals WHERE id = $1`, [id]);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToGoal(row) : null;
}

export async function createGoal(body: Partial<GamificationGoal>): Promise<GamificationGoal> {
  const now = new Date().toISOString();
  const r = await query(
    `INSERT INTO gamification_goals (
      title, description, level, type, metric_key, operator, target, target_display, window, filters,
      enabled, effective_at, version, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::timestamptz, 1, now())
    RETURNING *`,
    [
      body.title ?? "",
      body.description ?? null,
      body.level ?? 1,
      body.type ?? "core",
      body.metric_key ?? null,
      body.operator ?? null,
      typeof body.target === "number" ? body.target : null,
      typeof body.target === "string" ? body.target : null,
      body.window ?? null,
      JSON.stringify(body.filters ?? {}),
      body.enabled !== false,
      body.effective_at ?? now,
    ]
  );
  return rowToGoal(r.rows[0] as Record<string, unknown>);
}

export async function updateGoal(id: string, body: Partial<GamificationGoal>): Promise<GamificationGoal | null> {
  const fields: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let i = 1;
  if (body.title !== undefined) {
    fields.push(`title = $${i++}`);
    params.push(body.title);
  }
  if (body.description !== undefined) {
    fields.push(`description = $${i++}`);
    params.push(body.description);
  }
  if (body.level !== undefined) {
    fields.push(`level = $${i++}`);
    params.push(body.level);
  }
  if (body.type !== undefined) {
    fields.push(`type = $${i++}`);
    params.push(body.type);
  }
  if (body.metric_key !== undefined) {
    fields.push(`metric_key = $${i++}`);
    params.push(body.metric_key);
  }
  if (body.operator !== undefined) {
    fields.push(`operator = $${i++}`);
    params.push(body.operator);
  }
  if (body.target !== undefined) {
    fields.push(`target = $${i++}`);
    params.push(typeof body.target === "number" ? body.target : null);
    fields.push(`target_display = $${i++}`);
    params.push(typeof body.target === "string" ? body.target : null);
  }
  if (body.window !== undefined) {
    fields.push(`window = $${i++}`);
    params.push(body.window);
  }
  if (body.filters !== undefined) {
    fields.push(`filters = $${i++}::jsonb`);
    params.push(JSON.stringify(body.filters));
  }
  if (body.enabled !== undefined) {
    fields.push(`enabled = $${i++}`);
    params.push(body.enabled);
  }
  if (body.effective_at !== undefined) {
    fields.push(`effective_at = $${i++}::timestamptz`);
    params.push(body.effective_at);
  }
  if (body.version !== undefined) {
    fields.push(`version = $${i++}`);
    params.push(body.version);
  }
  if (params.length === 0) return getGoalById(id);
  params.push(id);
  const r = await query(
    `UPDATE gamification_goals SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToGoal(row) : null;
}
