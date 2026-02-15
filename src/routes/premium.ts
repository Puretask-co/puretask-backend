// src/routes/premium.ts
// Premium features: Boosts, Rush Jobs, Subscriptions, Referrals
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
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
premiumRouter.use(requireAuth);

// ============================================
// Boosts
// ============================================

/**
 * @swagger
 * /premium/boosts/options:
 *   get:
 *     summary: Get boost options
 *     description: Get available boost options and pricing for cleaners.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Boost options
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
 * @swagger
 * /premium/boosts/active:
 *   get:
 *     summary: Get active boost
 *     description: Get cleaner's currently active boost.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active boost
 *       403:
 *         description: Forbidden - cleaners only
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
    res
      .status(500)
      .json({ error: { code: "GET_BOOST_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /premium/boosts/purchase:
 *   post:
 *     summary: Purchase boost
 *     description: Purchase a boost to increase job visibility.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - boostType
 *             properties:
 *               boostType:
 *                 type: string
 *                 enum: [STANDARD, PREMIUM, MEGA]
 *     responses:
 *       200:
 *         description: Boost purchased
 *       403:
 *         description: Forbidden - cleaners only
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
 * @swagger
 * /premium/rush/calculate:
 *   post:
 *     summary: Calculate rush fee
 *     description: Calculate rush fee for a job based on scheduled start time.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduledStartAt
 *               - baseCredits
 *             properties:
 *               scheduledStartAt:
 *                 type: string
 *                 format: date-time
 *               baseCredits:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Rush fee calculation
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
      res
        .status(500)
        .json({ error: { code: "CALCULATE_RUSH_FAILED", message: (error as Error).message } });
    }
  }
);

// ============================================
// Subscriptions
// ============================================

/**
 * @swagger
 * /premium/subscriptions:
 *   post:
 *     summary: Create subscription
 *     description: Create a recurring cleaning subscription.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frequency
 *               - address
 *               - creditAmount
 *             properties:
 *               cleanerId: { type: 'string', format: 'uuid' }
 *               frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] }
 *               dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 }
 *               preferredTime: { type: 'string' }
 *               address: { type: 'string' }
 *               latitude: { type: 'number' }
 *               longitude: { type: 'number' }
 *               creditAmount: { type: 'integer', minimum: 1 }
 *     responses:
 *       200:
 *         description: Subscription created
 *       403:
 *         description: Forbidden - clients only
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
 * @swagger
 * /premium/subscriptions:
 *   get:
 *     summary: Get subscriptions
 *     description: Get all subscriptions for the current client.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(500)
      .json({ error: { code: "GET_SUBSCRIPTIONS_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /premium/subscriptions/{id}/status:
 *   patch:
 *     summary: Update subscription status
 *     description: Pause or resume a subscription.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused]
 *     responses:
 *       200:
 *         description: Subscription status updated
 *       403:
 *         description: Forbidden - clients only
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
 * @swagger
 * /premium/subscriptions/{id}:
 *   delete:
 *     summary: Cancel subscription
 *     description: Cancel a subscription.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(500)
      .json({ error: { code: "CANCEL_SUBSCRIPTION_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Referrals
// ============================================

/**
 * @swagger
 * /premium/referrals/code:
 *   get:
 *     summary: Get referral code
 *     description: Get or generate user's referral code.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code: { type: 'string' }
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
 * @swagger
 * /premium/referrals/stats:
 *   get:
 *     summary: Get referral stats
 *     description: Get user's referral statistics.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral statistics
 */
premiumRouter.get("/referrals/stats", async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await getUserReferralStats(req.user!.id);
    res.json({ stats });
  } catch (error) {
    logger.error("get_referral_stats_failed", { error: (error as Error).message });
    res
      .status(500)
      .json({ error: { code: "GET_STATS_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /premium/referrals/validate:
 *   post:
 *     summary: Validate referral code
 *     description: Validate a referral code.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code: { type: 'string' }
 *     responses:
 *       200:
 *         description: Referral code validation result
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
      res
        .status(500)
        .json({ error: { code: "VALIDATE_FAILED", message: (error as Error).message } });
    }
  }
);

/**
 * @swagger
 * /premium/referrals/leaderboard:
 *   get:
 *     summary: Get referral leaderboard
 *     description: Get referral leaderboard showing top referrers.
 *     tags: [Premium]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral leaderboard
 */
premiumRouter.get("/referrals/leaderboard", async (_req: AuthedRequest, res: Response) => {
  try {
    const leaderboard = await getReferralLeaderboard(20);
    res.json({ leaderboard });
  } catch (error) {
    logger.error("get_leaderboard_failed", { error: (error as Error).message });
    res
      .status(500)
      .json({ error: { code: "GET_LEADERBOARD_FAILED", message: (error as Error).message } });
  }
});

export default premiumRouter;
