import { withClient } from "../db/client";

export class AdminAuditService {
  async log(params: {
    actor_admin_user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    before?: any;
    after?: any;
    meta?: any;
  }) {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO admin_audit_log (actor_admin_user_id, action, entity_type, entity_id, before, after, meta)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
        [
          params.actor_admin_user_id ?? null,
          params.action,
          params.entity_type,
          params.entity_id ?? null,
          JSON.stringify(params.before ?? null),
          JSON.stringify(params.after ?? null),
          JSON.stringify(params.meta ?? {})
        ]
      );
    });
  }
}
