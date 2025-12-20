// src/services/pricingService.ts
// V3 FEATURE: Tier-aware pricing - Reward reliability with pricing
// Gold cleaners can command premium rates, Bronze has floor pricing

import { logger } from "../lib/logger";
import { env } from "../config/env";

// ============================================
// Tier Price Bands (per hour)
// ============================================

export interface TierPriceBand {
  min: number; // Minimum rate per hour (floor)
  max: number; // Maximum rate per hour (ceiling)
  multiplier: number; // Multiplier for base rate (1.0 = standard, >1.0 = premium)
}

export const TIER_PRICE_BANDS: Record<string, TierPriceBand> = {
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
const PLATFORM_FEE_PERCENT = env.PLATFORM_FEE_PERCENT || 15;

// ============================================
// Types
// ============================================

export interface PricingCalculationInput {
  cleanerTier: string; // "bronze" | "silver" | "gold" | "platinum"
  baseHours: number; // Estimated hours for the job
  cleaningType?: "basic" | "deep" | "moveout"; // Optional: affects base rate
  baseRatePerHour?: number; // Optional: override base rate
}

export interface PricingBreakdown {
  baseRatePerHour: number;
  tierAdjustedRatePerHour: number;
  basePrice: number; // baseHours × baseRatePerHour
  tierAdjustment: number; // Premium or discount amount
  tierMultiplier: number;
  subtotal: number; // basePrice + tierAdjustment
  platformFee: number; // Platform fee (15% of subtotal)
  totalPrice: number; // subtotal + platformFee
  totalCredits: number; // Total price in credits (divide by CENTS_PER_CREDIT / 100)
}

export interface PricingSnapshot {
  baseRatePerHour: number;
  tierAdjustedRatePerHour: number;
  baseHours: number;
  basePrice: number;
  tierAdjustment: number;
  tierMultiplier: number;
  subtotal: number;
  platformFee: number;
  totalPrice: number;
  totalCredits: number;
  cleanerTier: string;
  cleaningType?: string;
  calculatedAt: string; // ISO timestamp
}

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
export function calculateJobPricing(input: PricingCalculationInput): PricingBreakdown {
  const { cleanerTier, baseHours, cleaningType = "basic", baseRatePerHour } = input;

  // Get base rate (use provided or default based on cleaning type)
  const standardBaseRate = baseRatePerHour || STANDARD_BASE_RATE_PER_HOUR;
  
  // Get tier price band
  const tier = cleanerTier.toLowerCase();
  const priceBand = TIER_PRICE_BANDS[tier] || TIER_PRICE_BANDS["silver"]; // Default to silver if invalid tier

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
  const centsPerCredit = env.CENTS_PER_CREDIT || 10;
  const totalCredits = Math.round((totalPrice * 100) / centsPerCredit);

  const breakdown: PricingBreakdown = {
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

  logger.info("pricing_calculated", {
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
export function createPricingSnapshot(
  input: PricingCalculationInput,
  breakdown: PricingBreakdown
): PricingSnapshot {
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
export function getTierPriceBands(): Record<string, TierPriceBand> {
  return TIER_PRICE_BANDS;
}

/**
 * Get pricing estimate without cleaner tier (for pre-booking estimates)
 * Returns a range based on possible tiers
 */
export function getPricingEstimate(baseHours: number, baseRatePerHour?: number): {
  minPrice: number;
  maxPrice: number;
  minCredits: number;
  maxCredits: number;
  breakdown: {
    bronze: PricingBreakdown;
    silver: PricingBreakdown;
    gold: PricingBreakdown;
    platinum: PricingBreakdown;
  };
} {
  const tiers = ["bronze", "silver", "gold", "platinum"] as const;
  const breakdown: Record<string, PricingBreakdown> = {};

  for (const tier of tiers) {
    breakdown[tier] = calculateJobPricing({
      cleanerTier: tier,
      baseHours,
      baseRatePerHour,
    });
  }

  const minPrice = breakdown.bronze.totalPrice;
  const maxPrice = breakdown.platinum.totalPrice;

  const centsPerCredit = env.CENTS_PER_CREDIT || 10;
  const minCredits = Math.round((minPrice * 100) / centsPerCredit);
  const maxCredits = Math.round((maxPrice * 100) / centsPerCredit);

  return {
    minPrice,
    maxPrice,
    minCredits,
    maxCredits,
    breakdown: breakdown as {
      bronze: PricingBreakdown;
      silver: PricingBreakdown;
      gold: PricingBreakdown;
      platinum: PricingBreakdown;
    },
  };
}

