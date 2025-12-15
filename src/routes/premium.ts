// src/routes/premium.ts
// Premium features: Boosts, Rush Jobs, Subscriptions, Referrals
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { authMiddleware, AuthedRequest } from "../middleware/auth";
import {
  purchaseBoost,
  getActiveBoost,
  calculateRushFee,
  createSubscription,
  getClientSubscriptions,
  updateSubscriptionStatus,
  cancelSubscription,
  BOOST_CONFIG,
} from "../services/premiumService";
import {
  generateReferralCode,
  getUserReferralCode,
  getUserReferralStats,
  validateReferralCode,
  getReferralLeaderboard,
} from "../services/referralService";

const premiumRouter = Router();

// All routes require auth
premiumRouter.use(authMiddleware);

// ============================================
// Boosts
// ============================================

/**
 * GET /premium/boosts/options
 * Get available boost options and pricing
 */
premiumRouter.get("/boosts/options", async (_req: AuthedRequest, res: Response) => {
  res.json({
    options: Object.entries(BOOST_CONFIG).map(([key, value]) => ({
      type: key.toLowerCase(),
      credits: value.credits,
      multiplier: value.multiplier,
      durationHours: value.durationHours,
    })),
  });
});

/**
 * GET /premium/boosts/active
 * Get cleaner's active boost
 */
premiumRouter.get("/boosts/active", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const boost = await getActiveBoost(req.user.id);
    res.json({ boost });
  } catch (error) {
    logger.error("get_active_boost_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_BOOST_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /premium/boosts/purchase
 * Purchase a boost
 */
const purchaseBoostSchema = z.object({
  boostType: z.enum(["STANDARD", "PREMIUM", "MEGA"]),
});

premiumRouter.post(
  "/boosts/purchase",
  validateBody(purchaseBoostSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      const boost = await purchaseBoost(req.user.id, req.body.boostType);
      res.json({ boost });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("purchase_boost_failed", { error: err.message });
      res.status(err.statusCode || 500).json({
        error: { code: "PURCHASE_BOOST_FAILED", message: err.message },
      });
    }
  }
);

// ============================================
// Rush Jobs
// ============================================

/**
 * POST /premium/rush/calculate
 * Calculate rush fee for a job
 */
const calculateRushSchema = z.object({
  scheduledStartAt: z.string().datetime(),
  baseCredits: z.number().int().positive(),
});

premiumRouter.post(
  "/rush/calculate",
  validateBody(calculateRushSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await calculateRushFee(
        new Date(req.body.scheduledStartAt),
        req.body.baseCredits
      );
      res.json(result);
    } catch (error) {
      logger.error("calculate_rush_failed", { error: (error as Error).message });
      res.status(500).json({ error: { code: "CALCULATE_RUSH_FAILED", message: (error as Error).message } });
    }
  }
);

// ============================================
// Subscriptions
// ============================================

/**
 * POST /premium/subscriptions
 * Create a cleaning subscription
 */
const createSubscriptionSchema = z.object({
  cleanerId: z.string().uuid().optional(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  preferredTime: z.string().optional(),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  creditAmount: z.number().int().positive(),
});

premiumRouter.post(
  "/subscriptions",
  validateBody(createSubscriptionSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      const subscription = await createSubscription({
        clientId: req.user.id,
        ...req.body,
      });
      res.json({ subscription });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("create_subscription_failed", { error: err.message });
      res.status(err.statusCode || 500).json({
        error: { code: "CREATE_SUBSCRIPTION_FAILED", message: err.message },
      });
    }
  }
);

/**
 * GET /premium/subscriptions
 * Get client's subscriptions
 */
premiumRouter.get("/subscriptions", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    const subscriptions = await getClientSubscriptions(req.user.id);
    res.json({ subscriptions });
  } catch (error) {
    logger.error("get_subscriptions_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_SUBSCRIPTIONS_FAILED", message: (error as Error).message } });
  }
});

/**
 * PATCH /premium/subscriptions/:id/status
 * Pause or resume subscription
 */
const updateStatusSchema = z.object({
  status: z.enum(["active", "paused"]),
});

premiumRouter.patch(
  "/subscriptions/:id/status",
  validateBody(updateStatusSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      const subscription = await updateSubscriptionStatus(
        req.params.id,
        req.user.id,
        req.body.status
      );
      res.json({ subscription });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("update_subscription_failed", { error: err.message });
      res.status(err.statusCode || 500).json({
        error: { code: "UPDATE_SUBSCRIPTION_FAILED", message: err.message },
      });
    }
  }
);

/**
 * DELETE /premium/subscriptions/:id
 * Cancel subscription
 */
premiumRouter.delete("/subscriptions/:id", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    await cancelSubscription(req.params.id, req.user.id);
    res.json({ cancelled: true });
  } catch (error) {
    logger.error("cancel_subscription_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "CANCEL_SUBSCRIPTION_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Referrals
// ============================================

/**
 * GET /premium/referrals/code
 * Get or generate user's referral code
 */
premiumRouter.get("/referrals/code", async (req: AuthedRequest, res: Response) => {
  try {
    let code = await getUserReferralCode(req.user!.id);
    if (!code) {
      code = await generateReferralCode(req.user!.id);
    }
    res.json({ code });
  } catch (error) {
    logger.error("get_referral_code_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_CODE_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /premium/referrals/stats
 * Get user's referral stats
 */
premiumRouter.get("/referrals/stats", async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await getUserReferralStats(req.user!.id);
    res.json({ stats });
  } catch (error) {
    logger.error("get_referral_stats_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_STATS_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /premium/referrals/validate
 * Validate a referral code
 */
const validateCodeSchema = z.object({
  code: z.string().min(1),
});

premiumRouter.post(
  "/referrals/validate",
  validateBody(validateCodeSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await validateReferralCode(req.body.code);
      res.json(result);
    } catch (error) {
      logger.error("validate_code_failed", { error: (error as Error).message });
      res.status(500).json({ error: { code: "VALIDATE_FAILED", message: (error as Error).message } });
    }
  }
);

/**
 * GET /premium/referrals/leaderboard
 * Get referral leaderboard
 */
premiumRouter.get("/referrals/leaderboard", async (_req: AuthedRequest, res: Response) => {
  try {
    const leaderboard = await getReferralLeaderboard(20);
    res.json({ leaderboard });
  } catch (error) {
    logger.error("get_leaderboard_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_LEADERBOARD_FAILED", message: (error as Error).message } });
  }
});

export default premiumRouter;

