/**
 * Admin audit log — append-only trail for admin actions (resolve dispute, override status, etc.).
 * Schema: admin_audit_log (019_comprehensive_schema_additions.sql): admin_user_id, action, entity_type, entity_id, old_values, new_values, reason.
 */

import { query } from "../db/client";

export interface AdminAuditLogParams {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log an admin action to admin_audit_log. Use for resolve dispute, override job status, and other sensitive ops.
 */
export async function logAdminAction(params: AdminAuditLogParams): Promise<void> {
  await query(
    `
      INSERT INTO admin_audit_log (
        admin_user_id, action, entity_type, entity_id,
        old_values, new_values, reason, ip_address, user_agent, metadata
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb)
    `,
    [
      params.adminUserId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.oldValues != null ? JSON.stringify(params.oldValues) : null,
      params.newValues != null ? JSON.stringify(params.newValues) : null,
      params.reason ?? null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}
