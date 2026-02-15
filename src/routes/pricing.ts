// src/routes/pricing.ts
// V3 FEATURE: Tier-aware pricing routes
// Get price estimates before booking, show pricing breakdown

import { Router, Response } from "express";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import {
  calculateJobPricing,
  getPricingEstimate,
  getTierPriceBands,
} from "../services/pricingService";

const pricingRouter = Router();

pricingRouter.use(requireAuth);

/**
 * @swagger
 * /pricing/estimate:
 *   get:
 *     summary: Get pricing estimate
 *     description: Get pricing estimate for a job before booking. Can return specific tier pricing or range across all tiers.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         required: true
 *         schema:
 *           type: number
 *         description: Number of hours
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [bronze, silver, gold, platinum]
 *       - in: query
 *         name: baseRate
 *         schema:
 *           type: number
 *       - in: query
 *         name: cleaningType
 *         schema:
 *           type: string
 *           enum: [basic, deep, moveout]
 *     responses:
 *       200:
 *         description: Pricing estimate
 *       400:
 *         description: Invalid parameters
 */
pricingRouter.get("/estimate", async (req: AuthedRequest, res: Response) => {
  try {
    // Parse query parameters manually (query params come as strings)
    const hours = req.query.hours ? Number(req.query.hours) : null;
    if (!hours || hours <= 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "hours query parameter is required and must be positive",
        },
      });
    }

    const tier = req.query.tier as "bronze" | "silver" | "gold" | "platinum" | undefined;
    if (tier && !["bronze", "silver", "gold", "platinum"].includes(tier)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "tier must be bronze, silver, gold, or platinum",
        },
      });
    }

    const baseRate = req.query.baseRate ? Number(req.query.baseRate) : undefined;
    if (baseRate !== undefined && baseRate <= 0) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "baseRate must be positive if provided" },
      });
    }

    const cleaningType = req.query.cleaningType as "basic" | "deep" | "moveout" | undefined;
    if (cleaningType && !["basic", "deep", "moveout"].includes(cleaningType)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "cleaningType must be basic, deep, or moveout",
        },
      });
    }

    // If tier is specified, return specific pricing
    if (tier) {
      const breakdown = calculateJobPricing({
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
    const estimate = getPricingEstimate(hours, baseRate);

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
  } catch (error) {
    logger.error("pricing_estimate_failed", {
      error: (error as Error).message,
      query: req.query,
    });
    res.status(400).json({
      error: { code: "PRICING_ESTIMATE_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * @swagger
 * /pricing/tiers:
 *   get:
 *     summary: Get tier price bands
 *     description: Get tier price bands for display and configuration.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tier price bands
 */
pricingRouter.get("/tiers", async (_req: AuthedRequest, res: Response) => {
  try {
    const priceBands = getTierPriceBands();
    res.json({
      priceBands,
      message: "Tier price bands configured",
    });
  } catch (error) {
    logger.error("get_tier_price_bands_failed", {
      error: (error as Error).message,
    });
    res.status(500).json({
      error: { code: "GET_TIER_BANDS_FAILED", message: (error as Error).message },
    });
  }
});

export default pricingRouter;
