"use strict";
// src/routes/notifications.ts
// Notification preferences API routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const zod_1 = require("zod");
const logger_1 = require("../lib/logger");
const notifications_1 = require("../services/notifications");
const client_1 = require("../db/client");
const notificationsRouter = (0, express_1.Router)();
// All routes require authentication
notificationsRouter.use(auth_1.authMiddleware);
/**
 * GET /notifications/preferences
 * Get current user's notification preferences
 */
notificationsRouter.get("/preferences", async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = await (0, notifications_1.getNotificationPreferences)(userId);
        res.json({ preferences });
    }
    catch (error) {
        logger_1.logger.error("get_notification_preferences_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_PREFERENCES_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * PUT /notifications/preferences
 * Update notification preferences
 */
const updatePreferencesSchema = zod_1.z.object({
    email: zod_1.z.boolean().optional(),
    sms: zod_1.z.boolean().optional(),
    push: zod_1.z.boolean().optional(),
    jobUpdates: zod_1.z.boolean().optional(),
    marketing: zod_1.z.boolean().optional(),
    payoutAlerts: zod_1.z.boolean().optional(),
});
notificationsRouter.put("/preferences", (0, validation_1.validateBody)(updatePreferencesSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = await (0, notifications_1.updateNotificationPreferences)(userId, req.body);
        logger_1.logger.info("notification_preferences_updated", {
            userId,
            preferences: req.body,
        });
        res.json({ preferences });
    }
    catch (error) {
        logger_1.logger.error("update_notification_preferences_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "UPDATE_PREFERENCES_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * POST /notifications/push-token
 * Register a push notification token
 */
const registerPushTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    platform: zod_1.z.enum(["ios", "android", "web"]).optional(),
});
notificationsRouter.post("/push-token", (0, validation_1.validateBody)(registerPushTokenSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { token, platform } = req.body;
        // Update user's push token
        await (0, client_1.query)(`
          UPDATE users
          SET push_token = $1,
              updated_at = NOW()
          WHERE id = $2
        `, [token, userId]);
        logger_1.logger.info("push_token_registered", {
            userId,
            platform,
            tokenPrefix: token.substring(0, 10) + "...",
        });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error("register_push_token_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "REGISTER_PUSH_TOKEN_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * DELETE /notifications/push-token
 * Remove push notification token (logout)
 */
notificationsRouter.delete("/push-token", async (req, res) => {
    try {
        const userId = req.user.id;
        await (0, client_1.query)(`
          UPDATE users
          SET push_token = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [userId]);
        logger_1.logger.info("push_token_removed", { userId });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error("remove_push_token_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "REMOVE_PUSH_TOKEN_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /notifications/history
 * Get notification history for current user
 */
notificationsRouter.get("/history", async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = "50", offset = "0" } = req.query;
        const result = await (0, client_1.query)(`
          SELECT id, type, channel, success, created_at
          FROM notification_log
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `, [userId, parseInt(limit, 10), parseInt(offset, 10)]);
        res.json({
            notifications: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        logger_1.logger.error("get_notification_history_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_HISTORY_FAILED",
                message: error.message,
            },
        });
    }
});
exports.default = notificationsRouter;
