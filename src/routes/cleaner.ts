// src/routes/cleaner.ts
// Cleaner-specific routes (onboarding, profile, availability)

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
import {
  createStripeConnectAccount,
  getStripeConnectStatus,
  getStripeDashboardLink,
  updateCleanerProfile,
  updateCleanerAvailability,
  getCleanerAvailability,
  getCleanerProfile,
} from "../services/cleanerOnboardingService";
import { getCleanerPayouts } from "../services/payoutsService";
import {
  getTimeOff,
  addTimeOff,
  deleteTimeOff,
  getServiceAreas,
  addServiceArea,
  deleteServiceArea,
  getPreferences,
  setPreferences,
  getCleanerSchedule,
} from "../services/availabilityService";
// V1 CORE FEATURE: Reliability scoring (market safety mechanism)

const cleanerRouter = Router();

// All routes require authentication as cleaner
cleanerRouter.use(jwtAuthMiddleware);
cleanerRouter.use(requireRole("cleaner", "admin"));

/**
 * GET /cleaner/profile
 * Get cleaner profile and stats
 */
cleanerRouter.get(
  "/profile",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const profile = await getCleanerProfile(req.user!.id);

      if (!profile) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
        });
      }

      res.json({ profile });
    } catch (error) {
      logger.error("get_cleaner_profile_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_PROFILE_FAILED", message: "Failed to get profile" },
      });
    }
  }
);

/**
 * PATCH /cleaner/profile
 * Update cleaner profile
 */
const updateProfileSchema = z.object({
  baseRateCph: z.number().positive().optional(),
  deepAddonCph: z.number().positive().optional(),
  moveoutAddonCph: z.number().positive().optional(),
  bio: z.string().max(500).optional(),
  serviceAreas: z.array(z.string()).optional(),
});

cleanerRouter.patch(
  "/profile",
  validateBody(updateProfileSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const user = await updateCleanerProfile(req.user!.id, req.body);

      res.json({
        profile: {
          id: user.id,
          baseRateCph: user.base_rate_cph,
          deepAddonCph: user.deep_addon_cph,
          moveoutAddonCph: user.moveout_addon_cph,
        },
      });
    } catch (error) {
      logger.error("update_cleaner_profile_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(400).json({
        error: { code: "UPDATE_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * POST /cleaner/stripe/connect
 * Create or get Stripe Connect onboarding link
 */
cleanerRouter.post(
  "/stripe/connect",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const result = await createStripeConnectAccount(req.user!.id);
      res.json(result);
    } catch (error) {
      logger.error("stripe_connect_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "CONNECT_FAILED", message: "Failed to create Connect account" },
      });
    }
  }
);

/**
 * GET /cleaner/stripe/status
 * Get Stripe Connect account status
 */
cleanerRouter.get(
  "/stripe/status",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const status = await getStripeConnectStatus(req.user!.id);
      res.json(status);
    } catch (error) {
      logger.error("get_stripe_status_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_STATUS_FAILED", message: "Failed to get status" },
      });
    }
  }
);

/**
 * GET /cleaner/stripe/dashboard
 * Get Stripe Express dashboard link
 */
cleanerRouter.get(
  "/stripe/dashboard",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const url = await getStripeDashboardLink(req.user!.id);
      res.json({ url });
    } catch (error) {
      logger.error("get_stripe_dashboard_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });

      if ((error as Error).message === "No Stripe Connect account found") {
        return res.status(404).json({
          error: { code: "NO_ACCOUNT", message: "Complete onboarding first" },
        });
      }

      res.status(500).json({
        error: { code: "GET_DASHBOARD_FAILED", message: "Failed to get dashboard link" },
      });
    }
  }
);

/**
 * GET /cleaner/availability
 * Get cleaner availability schedule
 */
cleanerRouter.get(
  "/availability",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const availability = await getCleanerAvailability(req.user!.id);
      res.json({ availability });
    } catch (error) {
      logger.error("get_availability_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_AVAILABILITY_FAILED", message: "Failed to get availability" },
      });
    }
  }
);

/**
 * PUT /cleaner/availability
 * Update cleaner availability schedule
 */
const availabilitySchema = z.object({
  monday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  tuesday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  wednesday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  thursday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  friday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  saturday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  sunday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
});

cleanerRouter.put(
  "/availability",
  validateBody(availabilitySchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      await updateCleanerAvailability(req.user!.id, req.body);
      res.json({ success: true, availability: req.body });
    } catch (error) {
      logger.error("update_availability_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(400).json({
        error: { code: "UPDATE_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * GET /cleaner/payouts
 * Get payout history
 */
cleanerRouter.get(
  "/payouts",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const payouts = await getCleanerPayouts(
        req.user!.id,
        parseInt(limit as string, 10)
      );
      res.json({ payouts });
    } catch (error) {
      logger.error("get_payouts_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_PAYOUTS_FAILED", message: "Failed to get payouts" },
      });
    }
  }
);

// ============================================
// Time Off Management
// ============================================

/**
 * GET /cleaner/time-off
 * Get time off entries
 */
cleanerRouter.get("/time-off", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const timeOff = await getTimeOff(req.user!.id, true);
    res.json({ timeOff });
  } catch (error) {
    logger.error("get_time_off_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_TIME_OFF_FAILED", message: "Failed to get time off" },
    });
  }
});

/**
 * POST /cleaner/time-off
 * Add time off
 */
const addTimeOffSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  allDay: z.boolean().optional().default(true),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  reason: z.string().optional(),
});

cleanerRouter.post(
  "/time-off",
  validateBody(addTimeOffSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeOff = await addTimeOff({
        cleanerId: req.user!.id,
        ...req.body,
      });
      res.status(201).json({ timeOff });
    } catch (error) {
      logger.error("add_time_off_failed", { error: (error as Error).message });
      res.status(400).json({
        error: { code: "ADD_TIME_OFF_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * DELETE /cleaner/time-off/:id
 * Delete time off entry
 */
cleanerRouter.delete("/time-off/:id", async (req: JWTAuthedRequest, res: Response) => {
  try {
    await deleteTimeOff(req.user!.id, req.params.id);
    res.json({ deleted: true });
  } catch (error) {
    logger.error("delete_time_off_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "DELETE_TIME_OFF_FAILED", message: "Failed to delete" },
    });
  }
});

// ============================================
// Service Areas
// ============================================

/**
 * GET /cleaner/service-areas
 * Get service areas
 */
cleanerRouter.get("/service-areas", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const areas = await getServiceAreas(req.user!.id);
    res.json({ serviceAreas: areas });
  } catch (error) {
    logger.error("get_service_areas_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_AREAS_FAILED", message: "Failed to get areas" },
    });
  }
});

/**
 * POST /cleaner/service-areas
 * Add service area
 */
const addServiceAreaSchema = z.object({
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  radiusMiles: z.number().int().positive().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

cleanerRouter.post(
  "/service-areas",
  validateBody(addServiceAreaSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const area = await addServiceArea({
        cleanerId: req.user!.id,
        ...req.body,
      });
      res.status(201).json({ serviceArea: area });
    } catch (error) {
      logger.error("add_service_area_failed", { error: (error as Error).message });
      res.status(400).json({
        error: { code: "ADD_AREA_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * DELETE /cleaner/service-areas/:id
 * Delete service area
 */
cleanerRouter.delete("/service-areas/:id", async (req: JWTAuthedRequest, res: Response) => {
  try {
    await deleteServiceArea(req.user!.id, req.params.id);
    res.json({ deleted: true });
  } catch (error) {
    logger.error("delete_service_area_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "DELETE_AREA_FAILED", message: "Failed to delete" },
    });
  }
});

// ============================================
// Preferences
// ============================================

/**
 * GET /cleaner/preferences
 * Get cleaner preferences
 */
cleanerRouter.get("/preferences", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const preferences = await getPreferences(req.user!.id);
    res.json({ preferences });
  } catch (error) {
    logger.error("get_preferences_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_PREFS_FAILED", message: "Failed to get preferences" },
    });
  }
});

/**
 * PUT /cleaner/preferences
 * Update cleaner preferences
 */
const updatePreferencesSchema = z.object({
  max_jobs_per_day: z.number().int().min(1).max(20).optional(),
  min_job_duration_h: z.number().min(0.5).max(8).optional(),
  max_job_duration_h: z.number().min(1).max(12).optional(),
  accepts_pets: z.boolean().optional(),
  accepts_deep_clean: z.boolean().optional(),
  accepts_move_out: z.boolean().optional(),
  has_own_supplies: z.boolean().optional(),
  has_vehicle: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

cleanerRouter.put(
  "/preferences",
  validateBody(updatePreferencesSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const preferences = await setPreferences(req.user!.id, req.body);
      res.json({ preferences });
    } catch (error) {
      logger.error("update_preferences_failed", { error: (error as Error).message });
      res.status(400).json({
        error: { code: "UPDATE_PREFS_FAILED", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Schedule View
// ============================================

/**
 * GET /cleaner/schedule/:date
 * Get cleaner's schedule for a specific date
 */
cleanerRouter.get("/schedule/:date", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: { code: "INVALID_DATE", message: "Invalid date format" },
      });
    }

    const schedule = await getCleanerSchedule(req.user!.id, date);
    res.json({ date: req.params.date, schedule });
  } catch (error) {
    logger.error("get_schedule_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_SCHEDULE_FAILED", message: "Failed to get schedule" },
    });
  }
});

// ============================================
// Reliability Score (V1 CORE FEATURE)
// ============================================
cleanerRouter.get("/reliability", requireRole("cleaner"), async (req: JWTAuthedRequest, res: Response) => {
  try {
    const { getCleanerReliabilityInfo } = await import("../services/reliabilityService");
    const reliability = await getCleanerReliabilityInfo(req.user!.id);
    res.json({ reliability });
  } catch (error) {
    logger.error("get_reliability_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_RELIABILITY_FAILED", message: "Failed to get reliability" },
    });
  }
});

export default cleanerRouter;

