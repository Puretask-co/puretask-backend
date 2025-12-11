// src/services/notifications/preferencesService.ts
// Notification preferences management

import { query } from "../../db/client";
import { logger } from "../../lib/logger";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesInput {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  jobUpdates?: boolean;
  marketing?: boolean;
  payoutAlerts?: boolean;
}

/**
 * Get notification preferences for a user
 * Creates default preferences if they don't exist
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const result = await query<NotificationPreferences>(
    `
      SELECT * FROM notification_preferences
      WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    // Create default preferences
    const insertResult = await query<NotificationPreferences>(
      `
        INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, push_enabled)
        VALUES ($1, true, false, true)
        RETURNING *
      `,
      [userId]
    );
    return insertResult.rows[0];
  }

  return result.rows[0];
}

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: UpdatePreferencesInput
): Promise<NotificationPreferences> {
  // Ensure preferences exist
  await getNotificationPreferences(userId);

  // Build update query dynamically
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.email !== undefined) {
    updateFields.push(`email_enabled = $${paramIndex}`);
    values.push(updates.email);
    paramIndex++;
  }

  if (updates.sms !== undefined) {
    updateFields.push(`sms_enabled = $${paramIndex}`);
    values.push(updates.sms);
    paramIndex++;
  }

  if (updates.push !== undefined) {
    updateFields.push(`push_enabled = $${paramIndex}`);
    values.push(updates.push);
    paramIndex++;
  }

  if (updateFields.length === 0) {
    // No updates, just return current preferences
    return getNotificationPreferences(userId);
  }

  // Add updated_at and user_id
  updateFields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query<NotificationPreferences>(
    `
      UPDATE notification_preferences
      SET ${updateFields.join(", ")}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `,
    values
  );

  if (result.rows.length === 0) {
    throw new Error("Failed to update notification preferences");
  }

  logger.info("notification_preferences_updated", {
    userId,
    updates,
  });

  return result.rows[0];
}

