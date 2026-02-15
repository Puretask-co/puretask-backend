// src/routes/onboardingReminders.ts
// Routes for onboarding reminder management

import { Router, Response } from "express";
import { requireAuth, requireAdmin, AuthedRequest } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import {
  sendOnboardingReminders,
  getAbandonedOnboardingCleaners,
} from "../services/onboardingReminderService";

const reminderRouter = Router();

reminderRouter.use(requireAuth);
reminderRouter.use(requireAdmin);

/**
 * @swagger
 * /admin/onboarding-reminders/send:
 *   post:
 *     summary: Send onboarding reminders
 *     description: Manually trigger sending reminders to abandoned cleaners (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hours_threshold:
 *                 type: integer
 *                 default: 24
 *                 description: Hours since last activity to consider abandoned
 *     responses:
 *       200:
 *         description: Reminders sent successfully
 *       403:
 *         description: Forbidden - admin only
 */
reminderRouter.post("/send", async (req: AuthedRequest, res: Response) => {
  try {
    const hoursThreshold = req.body.hours_threshold || 24;

    const result = await sendOnboardingReminders(hoursThreshold);

    res.json({
      success: result.success,
      message: `Sent ${result.count} reminder(s)`,
      count: result.count,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error("send_reminders_failed", { error: error.message });
    res.status(500).json({
      error: { code: "SEND_REMINDERS_FAILED", message: "Failed to send reminders" },
    });
  }
});

/**
 * @swagger
 * /admin/onboarding-reminders/abandoned:
 *   get:
 *     summary: Get abandoned onboarding cleaners
 *     description: Get list of cleaners with abandoned onboarding (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hours_threshold
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Hours since last activity to consider abandoned
 *     responses:
 *       200:
 *         description: List of abandoned cleaners
 *       403:
 *         description: Forbidden - admin only
 */
reminderRouter.get("/abandoned", async (req: AuthedRequest, res: Response) => {
  try {
    const hoursThreshold = req.query.hours_threshold ? Number(req.query.hours_threshold) : 24;

    const cleaners = await getAbandonedOnboardingCleaners(hoursThreshold);

    res.json({
      cleaners,
      count: cleaners.length,
    });
  } catch (error: any) {
    logger.error("get_abandoned_cleaners_failed", { error: error.message });
    res.status(500).json({
      error: { code: "GET_ABANDONED_FAILED", message: "Failed to get abandoned cleaners" },
    });
  }
});

export default reminderRouter;
