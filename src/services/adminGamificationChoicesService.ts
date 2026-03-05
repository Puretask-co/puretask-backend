/**
 * Admin gamification choice reward groups (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * CRUD for gamification_choice_groups table.
 */

import { query } from "../db/client";
import * as rewardsLib from "./adminGamificationRewardsService";

export interface GamificationChoiceGroup {
  id: string;
  title: string;
  reward_ids: string[];
  eligibility_window_days: number;
  expires_at: string | null;
  enabled: boolean;
  updated_at: string;
}

function rowToChoice(row: Record<string, unknown>): GamificationChoiceGroup {
  const rewardIds = row.reward_ids;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    reward_ids: Array.isArray(rewardIds) ? rewardIds.map(String) : [],
    eligibility_window_days: Number(row.eligibility_window_days ?? 14),
    expires_at: row.expires_at != null ? new Date(row.expires_at as string).toISOString() : null,
    enabled: Boolean(row.enabled ?? true),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

export async function listChoiceGroups(): Promise<GamificationChoiceGroup[]> {
  const r = await query(`SELECT * FROM gamification_choice_groups ORDER BY updated_at DESC`);
  return (r.rows as Record<string, unknown>[]).map(rowToChoice);
}

export async function getChoiceGroupById(id: string): Promise<GamificationChoiceGroup | null> {
  const r = await query(`SELECT * FROM gamification_choice_groups WHERE id = $1`, [id]);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToChoice(row) : null;
}

export async function createChoiceGroup(body: Partial<GamificationChoiceGroup>): Promise<GamificationChoiceGroup> {
  const rewardIds = Array.isArray(body.reward_ids) ? body.reward_ids : [];
  const ok = await rewardsLib.rewardIdsExist(rewardIds);
  if (!ok) throw new Error("One or more reward_ids do not exist");
  const r = await query(
    `INSERT INTO gamification_choice_groups (title, reward_ids, eligibility_window_days, expires_at, enabled)
     VALUES ($1, $2::jsonb, $3, $4::timestamptz, $5)
     RETURNING *`,
    [
      body.title ?? "",
      JSON.stringify(rewardIds),
      body.eligibility_window_days ?? 14,
      body.expires_at ?? null,
      body.enabled !== false,
    ]
  );
  return rowToChoice(r.rows[0] as Record<string, unknown>);
}

export async function updateChoiceGroup(
  id: string,
  body: Partial<GamificationChoiceGroup>
): Promise<GamificationChoiceGroup | null> {
  if (body.reward_ids !== undefined) {
    const ok = await rewardsLib.rewardIdsExist(body.reward_ids);
    if (!ok) throw new Error("One or more reward_ids do not exist");
  }
  const fields: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let i = 1;
  if (body.title !== undefined) {
    fields.push(`title = $${i++}`);
    params.push(body.title);
  }
  if (body.reward_ids !== undefined) {
    fields.push(`reward_ids = $${i++}::jsonb`);
    params.push(JSON.stringify(body.reward_ids));
  }
  if (body.eligibility_window_days !== undefined) {
    fields.push(`eligibility_window_days = $${i++}`);
    params.push(body.eligibility_window_days);
  }
  if (body.expires_at !== undefined) {
    fields.push(`expires_at = $${i++}::timestamptz`);
    params.push(body.expires_at);
  }
  if (body.enabled !== undefined) {
    fields.push(`enabled = $${i++}`);
    params.push(body.enabled);
  }
  if (params.length === 0) return getChoiceGroupById(id);
  params.push(id);
  const r = await query(
    `UPDATE gamification_choice_groups SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    params
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToChoice(row) : null;
}
