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
import { getCleanerEarnings } from "../services/earningsService";
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
import {
  getCleanerHolidaySettings,
  updateCleanerHolidaySettings,
  listCleanerHolidayOverrides,
  upsertCleanerHolidayOverride,
} from "../services/holidayService";
// V1 CORE FEATURE: Reliability scoring (market safety mechanism)

const cleanerRouter = Router();

// All routes require authentication as cleaner
cleanerRouter.use(jwtAuthMiddleware);
cleanerRouter.use(requireRole("cleaner", "admin"));

/**
 * @swagger
 * /cleaner/profile:
 *   get:
 *     summary: Get cleaner profile and stats
 *     description: Get cleaner profile information including rates, bio, and statistics.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleaner profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id: { type: 'string', format: 'uuid' }
 *                     base_rate_cph: { type: 'number' }
 *                     deep_addon_cph: { type: 'number' }
 *                     moveout_addon_cph: { type: 'number' }
 *                     bio: { type: 'string', nullable: true }
 *                     tier: { type: 'string', enum: ['bronze', 'silver', 'gold', 'platinum'] }
 *                     reliability_score: { type: 'number' }
 *       404:
 *         description: Profile not found
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
 * @swagger
 * /cleaner/profile:
 *   patch:
 *     summary: Update cleaner profile
 *     description: Update cleaner profile information including rates and bio.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseRateCph:
 *                 type: number
 *                 description: Base rate per hour
 *               deepAddonCph:
 *                 type: number
 *                 description: Deep cleaning addon rate per hour
 *               moveoutAddonCph:
 *                 type: number
 *                 description: Move-out cleaning addon rate per hour
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: Cleaner bio
 *               serviceAreas:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Service area codes
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
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
 * @swagger
 * /cleaner/stripe/connect:
 *   post:
 *     summary: Create or get Stripe Connect onboarding link
 *     description: Create or retrieve Stripe Connect account onboarding link for receiving payouts.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stripe Connect onboarding link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Onboarding URL to redirect user to
 *                 accountId:
 *                   type: string
 *                   description: Stripe Connect account ID
 *       500:
 *         description: Failed to create Connect account
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
 * @swagger
 * /cleaner/stripe/status:
 *   get:
 *     summary: Get Stripe Connect account status
 *     description: Get the status of the Stripe Connect account for receiving payouts.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stripe Connect account status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   description: Whether account is connected
 *                 status:
 *                   type: string
 *                   enum: [pending, active, restricted]
 *                   description: Account status
 *                 chargesEnabled:
 *                   type: boolean
 *                 payoutsEnabled:
 *                   type: boolean
 *       500:
 *         description: Failed to get status
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
 * @swagger
 * /cleaner/stripe/dashboard:
 *   get:
 *     summary: Get Stripe Express dashboard link
 *     description: Get link to Stripe Express dashboard for managing payouts and account settings.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe Express dashboard URL
 *       404:
 *         description: No Stripe Connect account found (complete onboarding first)
 *       500:
 *         description: Failed to get dashboard link
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
 * @swagger
 * /cleaner/availability:
 *   get:
 *     summary: Get cleaner availability schedule
 *     description: Get the cleaner's weekly availability schedule.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 availability:
 *                   type: object
 *                   properties:
 *                     monday: { type: 'array', items: { type: 'object' } }
 *                     tuesday: { type: 'array', items: { type: 'object' } }
 *                     wednesday: { type: 'array', items: { type: 'object' } }
 *                     thursday: { type: 'array', items: { type: 'object' } }
 *                     friday: { type: 'array', items: { type: 'object' } }
 *                     saturday: { type: 'array', items: { type: 'object' } }
 *                     sunday: { type: 'array', items: { type: 'object' } }
 *       500:
 *         description: Failed to get availability
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
 * @swagger
 * /cleaner/availability:
 *   put:
 *     summary: Update cleaner availability schedule
 *     description: Update the cleaner's weekly availability schedule.
 *     tags: [Cleaners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monday:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     start: { type: 'string', format: 'time' }
 *                     end: { type: 'string', format: 'time' }
 *               tuesday: { type: 'array', items: { type: 'object' } }
 *               wednesday: { type: 'array', items: { type: 'object' } }
 *               thursday: { type: 'array', items: { type: 'object' } }
 *               friday: { type: 'array', items: { type: 'object' } }
 *               saturday: { type: 'array', items: { type: 'object' } }
 *               sunday: { type: 'array', items: { type: 'object' } }
 *     responses:
 *       200:
 *         description: Availability updated successfully
 *       400:
 *         description: Invalid input
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
 * GET /cleaner/holiday-settings
 * Get cleaner holiday settings (global defaults)
 */
cleanerRouter.get(
  "/holiday-settings",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const settings = await getCleanerHolidaySettings(req.user!.id);
      res.json({ settings });
    } catch (error) {
      logger.error("get_holiday_settings_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_HOLIDAY_SETTINGS_FAILED", message: "Failed to get holiday settings" },
      });
    }
  }
);

const holidaySettingsSchema = z.object({
  available_on_federal_holidays: z.boolean().optional(),
  holiday_rate_enabled: z.boolean().optional(),
  holiday_rate_multiplier: z.number().min(1).max(2).optional(),
});

/**
 * PUT /cleaner/holiday-settings
 * Update cleaner holiday settings (global defaults)
 */
cleanerRouter.put(
  "/holiday-settings",
  validateBody(holidaySettingsSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const settings = await updateCleanerHolidaySettings(req.user!.id, req.body);
      res.json({ settings });
    } catch (error) {
      logger.error("update_holiday_settings_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(400).json({
        error: { code: "UPDATE_HOLIDAY_SETTINGS_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * GET /cleaner/holiday-overrides
 * List cleaner holiday overrides within a date range
 */
cleanerRouter.get(
  "/holiday-overrides",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const from = (req.query.from as string) ?? new Date().toISOString().slice(0, 10);
      const toDate = new Date(from);
      toDate.setDate(toDate.getDate() + 365);
      const to = (req.query.to as string) ?? toDate.toISOString().slice(0, 10);

      const overrides = await listCleanerHolidayOverrides({
        cleanerId: req.user!.id,
        from,
        to,
      });

      res.json({ overrides, range: { from, to } });
    } catch (error) {
      logger.error("list_holiday_overrides_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "LIST_HOLIDAY_OVERRIDES_FAILED", message: "Failed to list holiday overrides" },
      });
    }
  }
);

const holidayOverrideSchema = z.object({
  available: z.boolean(),
  start_time_local: z.string().optional().nullable(),
  end_time_local: z.string().optional().nullable(),
  use_holiday_rate: z.boolean().optional().nullable(),
  min_job_hours: z.number().min(0.5).max(24).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * PUT /cleaner/holiday-overrides/:date
 * Upsert cleaner override for a specific holiday date
 */
cleanerRouter.put(
  "/holiday-overrides/:date",
  validateBody(holidayOverrideSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const holidayDate = req.params.date;

      const override = await upsertCleanerHolidayOverride({
        cleanerId: req.user!.id,
        holidayDate,
        available: req.body.available,
        startTimeLocal: req.body.start_time_local ?? null,
        endTimeLocal: req.body.end_time_local ?? null,
        useHolidayRate: req.body.use_holiday_rate ?? null,
        minJobHours: req.body.min_job_hours ?? null,
        notes: req.body.notes ?? null,
      });

      res.json({ override });
    } catch (error) {
      logger.error("upsert_holiday_override_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status((error as any).statusCode ?? 400).json({
        error: { code: (error as any).code ?? "UPDATE_HOLIDAY_OVERRIDE_FAILED", message: (error as Error).message },
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

// ============================================
// Earnings Dashboard (V3 FEATURE)
// ============================================

/**
 * GET /cleaner/earnings
 * V3 FEATURE: Get cleaner earnings dashboard - simple, user-friendly view
 * Shows pending earnings, paid out, and next payout date
 */
cleanerRouter.get("/earnings", requireRole("cleaner"), async (req: JWTAuthedRequest, res: Response) => {
  try {
    const earnings = await getCleanerEarnings(req.user!.id);
    res.json({ earnings });
  } catch (error) {
    logger.error("get_cleaner_earnings_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_EARNINGS_FAILED", message: "Failed to get earnings" },
    });
  }
});

export default cleanerRouter;

