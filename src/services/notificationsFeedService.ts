import { query } from "../db/client";

export async function getNotificationsFeed(userId: string, limit: number) {
  const result = await query(
    `SELECT id, type, channel, status, created_at
     FROM notification_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(
    (r: { id: string; type: string; channel: string; status: string; created_at: string }) => ({
      id: r.id,
      type: r.type,
      channel: r.channel,
      success: r.status === "sent",
      created_at: r.created_at,
    })
  );
}

export async function getNotificationUnreadCount(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM notification_log WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function setPushToken(userId: string, token: string | null): Promise<void> {
  await query(
    `
      UPDATE users
      SET push_token = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [token, userId]
  );
}

export async function getNotificationHistory(userId: string, limit: number, offset: number) {
  return query(
    `
      SELECT id, type, channel, success, created_at
      FROM notification_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
}
