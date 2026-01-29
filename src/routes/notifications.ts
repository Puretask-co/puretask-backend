// src/routes/notifications.ts
// Notification preferences API routes

import { Router, Response } from "express";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../middleware/jwtAuth";
import { validateBody } from "../lib/validation";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notifications";
import { query } from "../db/client";

const notificationsRouter = Router();

// All routes require authentication
notificationsRouter.use(jwtAuthMiddleware);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get notifications feed
 *     description: Get notifications feed for the current user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications feed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: 'array', items: { type: 'object' } }
 *                 unread_count: { type: 'integer' }
 */
notificationsRouter.get("/", async (_req: JWTAuthedRequest, res: Response) => {
  res.json({ data: [], unread_count: 0 });
});

/**
 * GET /notifications/unread-count
 * Return unread count (placeholder)
 */
notificationsRouter.get("/unread-count", async (_req: JWTAuthedRequest, res: Response) => {
  res.json({ count: 0 });
});

/**
 * PATCH /notifications/:id/read
 * Mark one notification as read (placeholder)
 */
notificationsRouter.patch("/:id/read", async (_req: JWTAuthedRequest, res: Response) => {
  res.json({ success: true });
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read (placeholder)
 */
notificationsRouter.post("/read-all", async (_req: JWTAuthedRequest, res: Response) => {
  res.json({ success: true });
});

/**
 * DELETE /notifications/:id
 * Delete notification (placeholder)
 */
notificationsRouter.delete("/:id", async (_req: JWTAuthedRequest, res: Response) => {
  res.json({ success: true });
});

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     description: Get current user's notification preferences.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences
 */
notificationsRouter.get(
  "/preferences",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const preferences = await getNotificationPreferences(userId);
      res.json({ preferences });
    } catch (error) {
      logger.error("get_notification_preferences_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "GET_PREFERENCES_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     description: Update user's notification preferences.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: 'boolean' }
 *               sms: { type: 'boolean' }
 *               push: { type: 'boolean' }
 *               jobUpdates: { type: 'boolean' }
 *               marketing: { type: 'boolean' }
 *               payoutAlerts: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Preferences updated
 */
const updatePreferencesSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
  jobUpdates: z.boolean().optional(),
  marketing: z.boolean().optional(),
  payoutAlerts: z.boolean().optional(),
});

notificationsRouter.put(
  "/preferences",
  validateBody(updatePreferencesSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const preferences = await updateNotificationPreferences(userId, req.body);

      logger.info("notification_preferences_updated", {
        userId,
        preferences: req.body,
      });

      res.json({ preferences });
    } catch (error) {
      logger.error("update_notification_preferences_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "UPDATE_PREFERENCES_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * POST /notifications/push-token
 * Register a push notification token
 */
const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

notificationsRouter.post(
  "/push-token",
  validateBody(registerPushTokenSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { token, platform } = req.body;

      // Update user's push token
      await query(
        `
          UPDATE users
          SET push_token = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [token, userId]
      );

      logger.info("push_token_registered", {
        userId,
        platform,
        tokenPrefix: token.substring(0, 10) + "...",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("register_push_token_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "REGISTER_PUSH_TOKEN_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * DELETE /notifications/push-token
 * Remove push notification token (logout)
 */
notificationsRouter.delete(
  "/push-token",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      await query(
        `
          UPDATE users
          SET push_token = NULL,
              updated_at = NOW()
          WHERE id = $1
        `,
        [userId]
      );

      logger.info("push_token_removed", { userId });

      res.json({ success: true });
    } catch (error) {
      logger.error("remove_push_token_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "REMOVE_PUSH_TOKEN_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * GET /notifications/history
 * Get notification history for current user
 */
notificationsRouter.get(
  "/history",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { limit = "50", offset = "0" } = req.query;

      const result = await query(
        `
          SELECT id, type, channel, success, created_at
          FROM notification_log
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [userId, parseInt(limit as string, 10), parseInt(offset as string, 10)]
      );

      res.json({
        notifications: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      logger.error("get_notification_history_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "GET_HISTORY_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

export default notificationsRouter;

