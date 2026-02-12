/**
 * Admin Audit Service (Step 10)
 * Immutable append-only audit log for gamification admin actions.
 */

import { query } from "../db/client";

export async function logAdminAudit(params: {
  actor_admin_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (actor_admin_user_id, action, entity_type, entity_id, before_state, after_state, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      params.actor_admin_user_id ?? null,
      params.action,
      params.entity_type,
      params.entity_id ?? null,
      params.before_state != null ? JSON.stringify(params.before_state) : null,
      params.after_state != null ? JSON.stringify(params.after_state) : null,
      JSON.stringify(params.meta ?? {}),
    ]
  );
}
