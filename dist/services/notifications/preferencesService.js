"use strict";
// src/services/notifications/preferencesService.ts
// Notification preferences management
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
/**
 * Get notification preferences for a user
 * Creates default preferences if they don't exist
 */
async function getNotificationPreferences(userId) {
    let result = await (0, client_1.query)(`
      SELECT * FROM notification_preferences
      WHERE user_id = $1
    `, [userId]);
    if (result.rows.length === 0) {
        // Create default preferences
        const insertResult = await (0, client_1.query)(`
        INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, push_enabled)
        VALUES ($1, true, false, true)
        RETURNING *
      `, [userId]);
        return insertResult.rows[0];
    }
    return result.rows[0];
}
/**
 * Update notification preferences for a user
 */
async function updateNotificationPreferences(userId, updates) {
    // Ensure preferences exist
    await getNotificationPreferences(userId);
    // Build update query dynamically
    const updateFields = [];
    const values = [];
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
    const result = await (0, client_1.query)(`
      UPDATE notification_preferences
      SET ${updateFields.join(", ")}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `, values);
    if (result.rows.length === 0) {
        throw new Error("Failed to update notification preferences");
    }
    logger_1.logger.info("notification_preferences_updated", {
        userId,
        updates,
    });
    return result.rows[0];
}
