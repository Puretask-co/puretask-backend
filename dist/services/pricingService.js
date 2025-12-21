"use strict";
// src/services/pricingService.ts
// V3 FEATURE: Tier-aware pricing - Reward reliability with pricing
// Gold cleaners can command premium rates, Bronze has floor pricing
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_PRICE_BANDS = void 0;
exports.calculateJobPricing = calculateJobPricing;
exports.createPricingSnapshot = createPricingSnapshot;
exports.getTierPriceBands = getTierPriceBands;
exports.getPricingEstimate = getPricingEstimate;
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
exports.TIER_PRICE_BANDS = {
    bronze: {
        min: 20, // $20/hour floor
        max: 30, // $30/hour ceiling
        multiplier: 0.9, // 10% below standard (floor pricing)
    },
    silver: {
        min: 25, // $25/hour floor
        max: 35, // $35/hour ceiling
        multiplier: 1.0, // Standard pricing
    },
    gold: {
        min: 30, // $30/hour floor
        max: 45, // $45/hour ceiling
        multiplier: 1.15, // 15% premium
    },
    platinum: {
        min: 35, // $35/hour floor
        max: 50, // $50/hour ceiling
        multiplier: 1.25, // 25% premium
    },
};
// Standard base rate (used when tier is not specified)
const STANDARD_BASE_RATE_PER_HOUR = 30; // $30/hour standard
// Platform fee percentage (15% per policy)
const PLATFORM_FEE_PERCENT = env_1.env.PLATFORM_FEE_PERCENT || 15;
// ============================================
// Pricing Calculation
// ============================================
/**
 * Calculate tier-aware pricing for a job
 *
 * V3 FEATURE: Tier-based pricing rewards reliability
 * - Bronze: Floor pricing (minimum rates)
 * - Silver: Standard pricing
 * - Gold/Platinum: Premium pricing (can command higher rates)
 */
function calculateJobPricing(input) {
    const { cleanerTier, baseHours, cleaningType = "basic", baseRatePerHour } = input;
    // Get base rate (use provided or default based on cleaning type)
    const standardBaseRate = baseRatePerHour || STANDARD_BASE_RATE_PER_HOUR;
    // Get tier price band
    const tier = cleanerTier.toLowerCase();
    const priceBand = exports.TIER_PRICE_BANDS[tier] || exports.TIER_PRICE_BANDS["silver"]; // Default to silver if invalid tier
    // Calculate tier-adjusted rate per hour
    // Apply multiplier, then ensure it's within min/max bounds
    let tierAdjustedRatePerHour = standardBaseRate * priceBand.multiplier;
    tierAdjustedRatePerHour = Math.max(priceBand.min, Math.min(priceBand.max, tierAdjustedRatePerHour));
    // Calculate base price (before tier adjustment)
    const basePrice = standardBaseRate * baseHours;
    // Calculate tier-adjusted subtotal
    const subtotal = tierAdjustedRatePerHour * baseHours;
    // Calculate tier adjustment amount
    const tierAdjustment = subtotal - basePrice;
    // Calculate platform fee (15% of subtotal)
    const platformFee = (subtotal * PLATFORM_FEE_PERCENT) / 100;
    // Calculate total price
    const totalPrice = subtotal + platformFee;
    // Convert to credits (1 credit = $0.10, so divide by 0.1 or multiply by 10)
    // Using env.CENTS_PER_CREDIT: if 10 cents per credit, then 1 credit = $0.10
    const centsPerCredit = env_1.env.CENTS_PER_CREDIT || 10;
    const totalCredits = Math.round((totalPrice * 100) / centsPerCredit);
    const breakdown = {
        baseRatePerHour: standardBaseRate,
        tierAdjustedRatePerHour,
        basePrice,
        tierAdjustment,
        tierMultiplier: priceBand.multiplier,
        subtotal,
        platformFee,
        totalPrice,
        totalCredits,
    };
    logger_1.logger.info("pricing_calculated", {
        cleanerTier: tier,
        baseHours,
        baseRatePerHour: standardBaseRate,
        tierAdjustedRatePerHour,
        totalPrice,
        totalCredits,
    });
    return breakdown;
}
/**
 * Create a pricing snapshot for storage in database
 * This locks pricing at booking time to prevent pricing drift
 */
function createPricingSnapshot(input, breakdown) {
    return {
        baseRatePerHour: breakdown.baseRatePerHour,
        tierAdjustedRatePerHour: breakdown.tierAdjustedRatePerHour,
        baseHours: input.baseHours,
        basePrice: breakdown.basePrice,
        tierAdjustment: breakdown.tierAdjustment,
        tierMultiplier: breakdown.tierMultiplier,
        subtotal: breakdown.subtotal,
        platformFee: breakdown.platformFee,
        totalPrice: breakdown.totalPrice,
        totalCredits: breakdown.totalCredits,
        cleanerTier: input.cleanerTier,
        cleaningType: input.cleaningType,
        calculatedAt: new Date().toISOString(),
    };
}
/**
 * Get tier price bands for display/configuration
 */
function getTierPriceBands() {
    return exports.TIER_PRICE_BANDS;
}
/**
 * Get pricing estimate without cleaner tier (for pre-booking estimates)
 * Returns a range based on possible tiers
 */
function getPricingEstimate(baseHours, baseRatePerHour) {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    const breakdown = {};
    for (const tier of tiers) {
        breakdown[tier] = calculateJobPricing({
            cleanerTier: tier,
            baseHours,
            baseRatePerHour,
        });
    }
    const minPrice = breakdown.bronze.totalPrice;
    const maxPrice = breakdown.platinum.totalPrice;
    const centsPerCredit = env_1.env.CENTS_PER_CREDIT || 10;
    const minCredits = Math.round((minPrice * 100) / centsPerCredit);
    const maxCredits = Math.round((maxPrice * 100) / centsPerCredit);
    return {
        minPrice,
        maxPrice,
        minCredits,
        maxCredits,
        breakdown: breakdown,
    };
}
