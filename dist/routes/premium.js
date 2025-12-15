"use strict";
// src/routes/premium.ts
// Premium features: Boosts, Rush Jobs, Subscriptions, Referrals
// V2 FEATURE — DISABLED FOR NOW
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const auth_1 = require("../middleware/auth");
const premiumService_1 = require("../services/premiumService");
const referralService_1 = require("../services/referralService");
const premiumRouter = (0, express_1.Router)();
// All routes require auth
premiumRouter.use(auth_1.authMiddleware);
// ============================================
// Boosts
// ============================================
/**
 * GET /premium/boosts/options
 * Get available boost options and pricing
 */
premiumRouter.get("/boosts/options", async (_req, res) => {
    res.json({
        options: Object.entries(premiumService_1.BOOST_CONFIG).map(([key, value]) => ({
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
premiumRouter.get("/boosts/active", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const boost = await (0, premiumService_1.getActiveBoost)(req.user.id);
        res.json({ boost });
    }
    catch (error) {
        logger_1.logger.error("get_active_boost_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_BOOST_FAILED", message: error.message } });
    }
});
/**
 * POST /premium/boosts/purchase
 * Purchase a boost
 */
const purchaseBoostSchema = zod_1.z.object({
    boostType: zod_1.z.enum(["STANDARD", "PREMIUM", "MEGA"]),
});
premiumRouter.post("/boosts/purchase", (0, validation_1.validateBody)(purchaseBoostSchema), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const boost = await (0, premiumService_1.purchaseBoost)(req.user.id, req.body.boostType);
        res.json({ boost });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("purchase_boost_failed", { error: err.message });
        res.status(err.statusCode || 500).json({
            error: { code: "PURCHASE_BOOST_FAILED", message: err.message },
        });
    }
});
// ============================================
// Rush Jobs
// ============================================
/**
 * POST /premium/rush/calculate
 * Calculate rush fee for a job
 */
const calculateRushSchema = zod_1.z.object({
    scheduledStartAt: zod_1.z.string().datetime(),
    baseCredits: zod_1.z.number().int().positive(),
});
premiumRouter.post("/rush/calculate", (0, validation_1.validateBody)(calculateRushSchema), async (req, res) => {
    try {
        const result = await (0, premiumService_1.calculateRushFee)(new Date(req.body.scheduledStartAt), req.body.baseCredits);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error("calculate_rush_failed", { error: error.message });
        res.status(500).json({ error: { code: "CALCULATE_RUSH_FAILED", message: error.message } });
    }
});
// ============================================
// Subscriptions
// ============================================
/**
 * POST /premium/subscriptions
 * Create a cleaning subscription
 */
const createSubscriptionSchema = zod_1.z.object({
    cleanerId: zod_1.z.string().uuid().optional(),
    frequency: zod_1.z.enum(["weekly", "biweekly", "monthly"]),
    dayOfWeek: zod_1.z.number().int().min(0).max(6).optional(),
    preferredTime: zod_1.z.string().optional(),
    address: zod_1.z.string().min(1),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    creditAmount: zod_1.z.number().int().positive(),
});
premiumRouter.post("/subscriptions", (0, validation_1.validateBody)(createSubscriptionSchema), async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const subscription = await (0, premiumService_1.createSubscription)({
            clientId: req.user.id,
            ...req.body,
        });
        res.json({ subscription });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("create_subscription_failed", { error: err.message });
        res.status(err.statusCode || 500).json({
            error: { code: "CREATE_SUBSCRIPTION_FAILED", message: err.message },
        });
    }
});
/**
 * GET /premium/subscriptions
 * Get client's subscriptions
 */
premiumRouter.get("/subscriptions", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const subscriptions = await (0, premiumService_1.getClientSubscriptions)(req.user.id);
        res.json({ subscriptions });
    }
    catch (error) {
        logger_1.logger.error("get_subscriptions_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_SUBSCRIPTIONS_FAILED", message: error.message } });
    }
});
/**
 * PATCH /premium/subscriptions/:id/status
 * Pause or resume subscription
 */
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "paused"]),
});
premiumRouter.patch("/subscriptions/:id/status", (0, validation_1.validateBody)(updateStatusSchema), async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const subscription = await (0, premiumService_1.updateSubscriptionStatus)(req.params.id, req.user.id, req.body.status);
        res.json({ subscription });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("update_subscription_failed", { error: err.message });
        res.status(err.statusCode || 500).json({
            error: { code: "UPDATE_SUBSCRIPTION_FAILED", message: err.message },
        });
    }
});
/**
 * DELETE /premium/subscriptions/:id
 * Cancel subscription
 */
premiumRouter.delete("/subscriptions/:id", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        await (0, premiumService_1.cancelSubscription)(req.params.id, req.user.id);
        res.json({ cancelled: true });
    }
    catch (error) {
        logger_1.logger.error("cancel_subscription_failed", { error: error.message });
        res.status(500).json({ error: { code: "CANCEL_SUBSCRIPTION_FAILED", message: error.message } });
    }
});
// ============================================
// Referrals
// ============================================
/**
 * GET /premium/referrals/code
 * Get or generate user's referral code
 */
premiumRouter.get("/referrals/code", async (req, res) => {
    try {
        let code = await (0, referralService_1.getUserReferralCode)(req.user.id);
        if (!code) {
            code = await (0, referralService_1.generateReferralCode)(req.user.id);
        }
        res.json({ code });
    }
    catch (error) {
        logger_1.logger.error("get_referral_code_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_CODE_FAILED", message: error.message } });
    }
});
/**
 * GET /premium/referrals/stats
 * Get user's referral stats
 */
premiumRouter.get("/referrals/stats", async (req, res) => {
    try {
        const stats = await (0, referralService_1.getUserReferralStats)(req.user.id);
        res.json({ stats });
    }
    catch (error) {
        logger_1.logger.error("get_referral_stats_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_STATS_FAILED", message: error.message } });
    }
});
/**
 * POST /premium/referrals/validate
 * Validate a referral code
 */
const validateCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
});
premiumRouter.post("/referrals/validate", (0, validation_1.validateBody)(validateCodeSchema), async (req, res) => {
    try {
        const result = await (0, referralService_1.validateReferralCode)(req.body.code);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error("validate_code_failed", { error: error.message });
        res.status(500).json({ error: { code: "VALIDATE_FAILED", message: error.message } });
    }
});
/**
 * GET /premium/referrals/leaderboard
 * Get referral leaderboard
 */
premiumRouter.get("/referrals/leaderboard", async (_req, res) => {
    try {
        const leaderboard = await (0, referralService_1.getReferralLeaderboard)(20);
        res.json({ leaderboard });
    }
    catch (error) {
        logger_1.logger.error("get_leaderboard_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_LEADERBOARD_FAILED", message: error.message } });
    }
});
exports.default = premiumRouter;
