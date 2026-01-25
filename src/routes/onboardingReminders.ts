// src/routes/onboardingReminders.ts
// Routes for onboarding reminder management

import { Router, Response } from "express";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
import { logger } from "../lib/logger";
import { sendOnboardingReminders, getAbandonedOnboardingCleaners } from "../services/onboardingReminderService";

const reminderRouter = Router();

// All routes require admin authentication
reminderRouter.use(jwtAuthMiddleware);
reminderRouter.use(requireRole("admin"));

/**
 * POST /admin/onboarding-reminders/send
 * Manually trigger sending reminders to abandoned cleaners
 */
reminderRouter.post("/send", async (req: JWTAuthedRequest, res: Response) => {
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
 * GET /admin/onboarding-reminders/abandoned
 * Get list of cleaners with abandoned onboarding
 */
reminderRouter.get("/abandoned", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const hoursThreshold = req.query.hours_threshold
      ? Number(req.query.hours_threshold)
      : 24;

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
