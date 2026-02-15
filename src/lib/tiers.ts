// src/lib/tiers.ts
// Standardized tier naming for PureTask platform
//
// CANONICAL TIER NAMES (use these in new code):
// - Developing (0-59 reliability score)
// - Semi Pro (60-74 reliability score)
// - Pro (75-89 reliability score)
// - Elite (90-100 reliability score)
//
// LEGACY TIER NAMES (still supported in DB):
// - bronze → Developing
// - silver → Semi Pro
// - gold → Pro
// - platinum → Elite

/**
 * Canonical tier names used in PureTask
 */
export type ReliabilityTier = "Developing" | "Semi Pro" | "Pro" | "Elite";

/**
 * Legacy tier names (for backward compatibility)
 */
export type LegacyTier = "bronze" | "silver" | "gold" | "platinum";

/**
 * All possible tier names (canonical or legacy)
 */
export type AnyTier = ReliabilityTier | LegacyTier;

/**
 * Tier configuration
 */
export interface TierConfig {
  canonical: ReliabilityTier;
  legacy: LegacyTier;
  minScore: number;
  maxScore: number;
  payoutPercent: number;
  creditRateMin: number;
  creditRateMax: number;
}

/**
 * Complete tier configuration
 */
export const TIER_CONFIG: Record<ReliabilityTier, TierConfig> = {
  Developing: {
    canonical: "Developing",
    legacy: "bronze",
    minScore: 0,
    maxScore: 59,
    payoutPercent: 80,
    creditRateMin: 150,
    creditRateMax: 350,
  },
  "Semi Pro": {
    canonical: "Semi Pro",
    legacy: "silver",
    minScore: 60,
    maxScore: 74,
    payoutPercent: 82,
    creditRateMin: 350,
    creditRateMax: 450,
  },
  Pro: {
    canonical: "Pro",
    legacy: "gold",
    minScore: 75,
    maxScore: 89,
    payoutPercent: 84,
    creditRateMin: 450,
    creditRateMax: 600,
  },
  Elite: {
    canonical: "Elite",
    legacy: "platinum",
    minScore: 90,
    maxScore: 100,
    payoutPercent: 85,
    creditRateMin: 600,
    creditRateMax: 850,
  },
};

/**
 * Mapping from legacy to canonical tier names
 */
const LEGACY_TO_CANONICAL: Record<LegacyTier, ReliabilityTier> = {
  bronze: "Developing",
  silver: "Semi Pro",
  gold: "Pro",
  platinum: "Elite",
};

/**
 * Mapping from canonical to legacy tier names
 */
const CANONICAL_TO_LEGACY: Record<ReliabilityTier, LegacyTier> = {
  Developing: "bronze",
  "Semi Pro": "silver",
  Pro: "gold",
  Elite: "platinum",
};

/**
 * Convert any tier name to canonical format
 * Handles null/undefined, legacy names, and already canonical names
 */
export function toCanonicalTier(tier: string | null | undefined): ReliabilityTier {
  if (!tier) return "Developing";

  const normalized = tier.toLowerCase().replace("_", " ").trim();

  // Check if it's a legacy tier
  if (normalized in LEGACY_TO_CANONICAL) {
    return LEGACY_TO_CANONICAL[normalized as LegacyTier];
  }

  // Check if it's already canonical
  switch (normalized) {
    case "elite":
      return "Elite";
    case "pro":
      return "Pro";
    case "semi pro":
      return "Semi Pro";
    case "developing":
      return "Developing";
    default:
      return "Developing";
  }
}

/**
 * Convert any tier name to legacy format (for DB compatibility)
 */
export function toLegacyTier(tier: string | null | undefined): LegacyTier {
  if (!tier) return "bronze";

  const normalized = tier.toLowerCase().replace("_", " ").trim();

  // Check if it's already legacy
  if (normalized in LEGACY_TO_CANONICAL) {
    return normalized as LegacyTier;
  }

  // Convert from canonical
  switch (normalized) {
    case "elite":
      return "platinum";
    case "pro":
      return "gold";
    case "semi pro":
      return "silver";
    case "developing":
      return "bronze";
    default:
      return "bronze";
  }
}

/**
 * Get tier from reliability score
 */
export function getTierFromScore(score: number): ReliabilityTier {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Pro";
  if (score >= 60) return "Semi Pro";
  return "Developing";
}

/**
 * Get legacy tier from reliability score
 */
export function getLegacyTierFromScore(score: number): LegacyTier {
  return toLegacyTier(getTierFromScore(score));
}

/**
 * Get tier configuration by any tier name
 */
export function getTierConfig(tier: string | null | undefined): TierConfig {
  const canonical = toCanonicalTier(tier);
  return TIER_CONFIG[canonical];
}

/**
 * Get payout percentage for a tier
 */
export function getPayoutPercent(tier: string | null | undefined): number {
  return getTierConfig(tier).payoutPercent;
}

/**
 * Get credit rate range for a tier
 */
export function getCreditRateRange(tier: string | null | undefined): { min: number; max: number } {
  const config = getTierConfig(tier);
  return { min: config.creditRateMin, max: config.creditRateMax };
}

/**
 * Check if tier1 is higher than tier2
 */
export function isTierHigher(
  tier1: string | null | undefined,
  tier2: string | null | undefined
): boolean {
  const order: ReliabilityTier[] = ["Developing", "Semi Pro", "Pro", "Elite"];
  const idx1 = order.indexOf(toCanonicalTier(tier1));
  const idx2 = order.indexOf(toCanonicalTier(tier2));
  return idx1 > idx2;
}

/**
 * Get next tier (for promotion)
 */
export function getNextTier(tier: string | null | undefined): ReliabilityTier | null {
  const order: ReliabilityTier[] = ["Developing", "Semi Pro", "Pro", "Elite"];
  const current = toCanonicalTier(tier);
  const idx = order.indexOf(current);
  if (idx >= order.length - 1) return null;
  return order[idx + 1];
}

/**
 * Get previous tier (for demotion)
 */
export function getPreviousTier(tier: string | null | undefined): ReliabilityTier | null {
  const order: ReliabilityTier[] = ["Developing", "Semi Pro", "Pro", "Elite"];
  const current = toCanonicalTier(tier);
  const idx = order.indexOf(current);
  if (idx <= 0) return null;
  return order[idx - 1];
}

/**
 * Check if score qualifies for tier promotion
 */
export function canPromoteToNextTier(
  currentTier: string | null | undefined,
  score: number
): boolean {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return false;
  return score >= TIER_CONFIG[nextTier].minScore;
}

/**
 * Check if score requires tier demotion
 */
export function shouldDemoteTier(currentTier: string | null | undefined, score: number): boolean {
  const current = toCanonicalTier(currentTier);
  return score < TIER_CONFIG[current].minScore;
}

/**
 * Format tier for display (always canonical)
 */
export function formatTierDisplay(tier: string | null | undefined): string {
  return toCanonicalTier(tier);
}

/**
 * All canonical tier names in order (lowest to highest)
 */
export const TIER_ORDER: readonly ReliabilityTier[] = [
  "Developing",
  "Semi Pro",
  "Pro",
  "Elite",
] as const;

/**
 * All legacy tier names in order (lowest to highest)
 */
export const LEGACY_TIER_ORDER: readonly LegacyTier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
] as const;
