"use strict";
// src/routes/credits.ts
// Credits purchase and wallet routes
// Matches 001_init.sql + 002_supplementary.sql schema
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const jwtAuth_1 = require("../middleware/jwtAuth");
const creditsPurchaseService_1 = require("../services/creditsPurchaseService");
const creditsService_1 = require("../services/creditsService");
const creditsRouter = (0, express_1.Router)();
// All routes require authentication
creditsRouter.use(jwtAuth_1.jwtAuthMiddleware);
/**
 * GET /credits/packages
 * Get available credit packages
 */
creditsRouter.get("/packages", (req, res) => {
    const packages = (0, creditsPurchaseService_1.getCreditPackages)();
    res.json({ packages });
});
/**
 * GET /credits/balance
 * Get current credit balance
 */
creditsRouter.get("/balance", (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const balance = await (0, creditsService_1.getUserBalance)(req.user.id);
        res.json({ balance });
    }
    catch (error) {
        logger_1.logger.error("get_balance_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_BALANCE_FAILED", message: "Failed to get balance" },
        });
    }
});
/**
 * POST /credits/checkout
 * Create checkout session for credit purchase
 */
const checkoutSchema = zod_1.z.object({
    packageId: zod_1.z.string(),
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
});
creditsRouter.post("/checkout", (0, jwtAuth_1.requireRole)("client"), (0, validation_1.validateBody)(checkoutSchema), async (req, res) => {
    try {
        const { packageId, successUrl, cancelUrl } = req.body;
        const session = await (0, creditsPurchaseService_1.createCreditCheckoutSession)({
            userId: req.user.id,
            packageId,
            successUrl,
            cancelUrl,
        });
        res.json(session);
    }
    catch (error) {
        logger_1.logger.error("checkout_creation_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        if (error.message === "Invalid credit package") {
            return res.status(400).json({
                error: { code: "INVALID_PACKAGE", message: "Invalid credit package" },
            });
        }
        res.status(500).json({
            error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout" },
        });
    }
});
/**
 * GET /credits/history
 * Get credit transaction history
 */
creditsRouter.get("/history", (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const { limit = "50" } = req.query;
        const history = await (0, creditsService_1.getCreditHistory)(req.user.id, parseInt(limit, 10));
        res.json({ transactions: history });
    }
    catch (error) {
        logger_1.logger.error("get_history_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_HISTORY_FAILED", message: "Failed to get history" },
        });
    }
});
/**
 * GET /credits/purchases
 * Get credit purchase history
 */
creditsRouter.get("/purchases", (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const { limit = "50" } = req.query;
        const purchases = await (0, creditsPurchaseService_1.getPurchaseHistory)(req.user.id, parseInt(limit, 10));
        res.json({ purchases });
    }
    catch (error) {
        logger_1.logger.error("get_purchases_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_PURCHASES_FAILED", message: "Failed to get purchases" },
        });
    }
});
exports.default = creditsRouter;
