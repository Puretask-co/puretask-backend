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
      res.json({ payouts: payouts.rows });
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

export default cleanerRouter;

