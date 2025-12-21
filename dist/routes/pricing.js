"use strict";
// src/routes/pricing.ts
// V3 FEATURE: Tier-aware pricing routes
// Get price estimates before booking, show pricing breakdown
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../lib/logger");
const jwtAuth_1 = require("../middleware/jwtAuth");
const pricingService_1 = require("../services/pricingService");
const pricingRouter = (0, express_1.Router)();
// All routes require authentication (but not specific role)
pricingRouter.use(jwtAuth_1.jwtAuthMiddleware);
/**
 * GET /pricing/estimate
 * Get pricing estimate for a job before booking
 * Query params: hours, tier (optional), baseRate (optional), cleaningType (optional)
 */
pricingRouter.get("/estimate", async (req, res) => {
    try {
        // Parse query parameters manually (query params come as strings)
        const hours = req.query.hours ? Number(req.query.hours) : null;
        if (!hours || hours <= 0) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "hours query parameter is required and must be positive" },
            });
        }
        const tier = req.query.tier;
        if (tier && !["bronze", "silver", "gold", "platinum"].includes(tier)) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "tier must be bronze, silver, gold, or platinum" },
            });
        }
        const baseRate = req.query.baseRate ? Number(req.query.baseRate) : undefined;
        if (baseRate !== undefined && baseRate <= 0) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "baseRate must be positive if provided" },
            });
        }
        const cleaningType = req.query.cleaningType;
        if (cleaningType && !["basic", "deep", "moveout"].includes(cleaningType)) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "cleaningType must be basic, deep, or moveout" },
            });
        }
        // If tier is specified, return specific pricing
        if (tier) {
            const breakdown = (0, pricingService_1.calculateJobPricing)({
                cleanerTier: tier,
                baseHours: hours,
                baseRatePerHour: baseRate,
                cleaningType: cleaningType || "basic",
            });
            return res.json({
                tier,
                hours,
                breakdown,
                message: "Pricing estimate for specified tier",
            });
        }
        // If no tier specified, return range for all tiers
        const estimate = (0, pricingService_1.getPricingEstimate)(hours, baseRate);
        return res.json({
            hours,
            estimate: {
                minPrice: estimate.minPrice,
                maxPrice: estimate.maxPrice,
                minCredits: estimate.minCredits,
                maxCredits: estimate.maxCredits,
                breakdown: estimate.breakdown,
            },
            message: "Pricing estimate range across all tiers",
        });
    }
    catch (error) {
        logger_1.logger.error("pricing_estimate_failed", {
            error: error.message,
            query: req.query,
        });
        res.status(400).json({
            error: { code: "PRICING_ESTIMATE_FAILED", message: error.message },
        });
    }
});
/**
 * GET /pricing/tiers
 * Get tier price bands for display/configuration
 */
pricingRouter.get("/tiers", async (_req, res) => {
    try {
        const priceBands = (0, pricingService_1.getTierPriceBands)();
        res.json({
            priceBands,
            message: "Tier price bands configured",
        });
    }
    catch (error) {
        logger_1.logger.error("get_tier_price_bands_failed", {
            error: error.message,
        });
        res.status(500).json({
            error: { code: "GET_TIER_BANDS_FAILED", message: error.message },
        });
    }
});
exports.default = pricingRouter;
