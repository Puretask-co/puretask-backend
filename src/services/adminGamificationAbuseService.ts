/**
 * Admin gamification abuse/fraud (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET /admin/gamification/abuse, POST .../abuse/:cleanerId/pause-rewards.
 */

import { query } from "../db/client";

export type AbuseSignalType = "spam_messages" | "login_farming" | "photo_timestamp" | "decline_abuse";
export type AbuseSeverity = "low" | "medium" | "high";

export interface AbuseSignalItem {
  id: string;
  cleaner_id: string;
  cleaner_name: string;
  type: AbuseSignalType;
  severity: AbuseSeverity;
  detail: string | null;
  detected_at: string;
}

export interface ListAbuseResponse {
  items: AbuseSignalItem[];
  pagination: { page: number; per_page: number; total: number };
}

export async function listAbuse(params: {
  type?: AbuseSignalType;
  page?: number;
  per_page?: number;
}): Promise<ListAbuseResponse> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.per_page ?? 20));
  const offset = (page - 1) * perPage;

  const conditions: string[] = ["1=1"];
  const queryParams: unknown[] = [];
  let i = 1;
  if (params.type) {
    conditions.push(`a.type = $${i++}`);
    queryParams.push(params.type);
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM abuse_signals a WHERE ${conditions.join(" AND ")}`,
    queryParams
  );
  const total = Number((countResult.rows[0] as { total: string }).total);

  const listParams = [...queryParams, perPage, offset];
  const listResult = await query(
    `SELECT a.id, a.cleaner_id, a.type, a.severity, a.detail, a.detected_at,
            COALESCE(u.display_name, u.email, u.id::text) AS cleaner_name
     FROM abuse_signals a
     LEFT JOIN users u ON u.id = a.cleaner_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY a.detected_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    listParams
  );

  const items: AbuseSignalItem[] = (listResult.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    cleaner_id: String(row.cleaner_id),
    cleaner_name: String(row.cleaner_name ?? "—"),
    type: row.type as AbuseSignalType,
    severity: row.severity as AbuseSeverity,
    detail: row.detail != null ? String(row.detail) : null,
    detected_at: new Date(row.detected_at as string).toISOString(),
  }));

  return {
    items,
    pagination: { page, per_page: perPage, total },
  };
}

export async function pauseRewardsForCleaner(params: {
  cleanerId: string;
  reason?: string | null;
  adminId: string;
}): Promise<void> {
  await query(
    `INSERT INTO cleaner_reward_pause (cleaner_id, reason, admin_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (cleaner_id)
     DO UPDATE SET reason = COALESCE(EXCLUDED.reason, cleaner_reward_pause.reason),
                   admin_id = EXCLUDED.admin_id`,
    [params.cleanerId, params.reason ?? null, params.adminId]
  );
}

export async function isRewardsPaused(cleanerId: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM cleaner_reward_pause WHERE cleaner_id = $1 AND (paused_until IS NULL OR paused_until > now())`,
    [cleanerId]
  );
  return r.rows.length > 0;
}
