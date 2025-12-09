"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_TIER_ORDER = exports.TIER_ORDER = exports.TIER_CONFIG = void 0;
exports.toCanonicalTier = toCanonicalTier;
exports.toLegacyTier = toLegacyTier;
exports.getTierFromScore = getTierFromScore;
exports.getLegacyTierFromScore = getLegacyTierFromScore;
exports.getTierConfig = getTierConfig;
exports.getPayoutPercent = getPayoutPercent;
exports.getCreditRateRange = getCreditRateRange;
exports.isTierHigher = isTierHigher;
exports.getNextTier = getNextTier;
exports.getPreviousTier = getPreviousTier;
exports.canPromoteToNextTier = canPromoteToNextTier;
exports.shouldDemoteTier = shouldDemoteTier;
exports.formatTierDisplay = formatTierDisplay;
/**
 * Complete tier configuration
 */
exports.TIER_CONFIG = {
    'Developing': {
        canonical: 'Developing',
        legacy: 'bronze',
        minScore: 0,
        maxScore: 59,
        payoutPercent: 80,
        creditRateMin: 150,
        creditRateMax: 350,
    },
    'Semi Pro': {
        canonical: 'Semi Pro',
        legacy: 'silver',
        minScore: 60,
        maxScore: 74,
        payoutPercent: 82,
        creditRateMin: 350,
        creditRateMax: 450,
    },
    'Pro': {
        canonical: 'Pro',
        legacy: 'gold',
        minScore: 75,
        maxScore: 89,
        payoutPercent: 84,
        creditRateMin: 450,
        creditRateMax: 600,
    },
    'Elite': {
        canonical: 'Elite',
        legacy: 'platinum',
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
const LEGACY_TO_CANONICAL = {
    'bronze': 'Developing',
    'silver': 'Semi Pro',
    'gold': 'Pro',
    'platinum': 'Elite',
};
/**
 * Mapping from canonical to legacy tier names
 */
const CANONICAL_TO_LEGACY = {
    'Developing': 'bronze',
    'Semi Pro': 'silver',
    'Pro': 'gold',
    'Elite': 'platinum',
};
/**
 * Convert any tier name to canonical format
 * Handles null/undefined, legacy names, and already canonical names
 */
function toCanonicalTier(tier) {
    if (!tier)
        return 'Developing';
    const normalized = tier.toLowerCase().replace('_', ' ').trim();
    // Check if it's a legacy tier
    if (normalized in LEGACY_TO_CANONICAL) {
        return LEGACY_TO_CANONICAL[normalized];
    }
    // Check if it's already canonical
    switch (normalized) {
        case 'elite': return 'Elite';
        case 'pro': return 'Pro';
        case 'semi pro': return 'Semi Pro';
        case 'developing': return 'Developing';
        default: return 'Developing';
    }
}
/**
 * Convert any tier name to legacy format (for DB compatibility)
 */
function toLegacyTier(tier) {
    if (!tier)
        return 'bronze';
    const normalized = tier.toLowerCase().replace('_', ' ').trim();
    // Check if it's already legacy
    if (normalized in LEGACY_TO_CANONICAL) {
        return normalized;
    }
    // Convert from canonical
    switch (normalized) {
        case 'elite': return 'platinum';
        case 'pro': return 'gold';
        case 'semi pro': return 'silver';
        case 'developing': return 'bronze';
        default: return 'bronze';
    }
}
/**
 * Get tier from reliability score
 */
function getTierFromScore(score) {
    if (score >= 90)
        return 'Elite';
    if (score >= 75)
        return 'Pro';
    if (score >= 60)
        return 'Semi Pro';
    return 'Developing';
}
/**
 * Get legacy tier from reliability score
 */
function getLegacyTierFromScore(score) {
    return toLegacyTier(getTierFromScore(score));
}
/**
 * Get tier configuration by any tier name
 */
function getTierConfig(tier) {
    const canonical = toCanonicalTier(tier);
    return exports.TIER_CONFIG[canonical];
}
/**
 * Get payout percentage for a tier
 */
function getPayoutPercent(tier) {
    return getTierConfig(tier).payoutPercent;
}
/**
 * Get credit rate range for a tier
 */
function getCreditRateRange(tier) {
    const config = getTierConfig(tier);
    return { min: config.creditRateMin, max: config.creditRateMax };
}
/**
 * Check if tier1 is higher than tier2
 */
function isTierHigher(tier1, tier2) {
    const order = ['Developing', 'Semi Pro', 'Pro', 'Elite'];
    const idx1 = order.indexOf(toCanonicalTier(tier1));
    const idx2 = order.indexOf(toCanonicalTier(tier2));
    return idx1 > idx2;
}
/**
 * Get next tier (for promotion)
 */
function getNextTier(tier) {
    const order = ['Developing', 'Semi Pro', 'Pro', 'Elite'];
    const current = toCanonicalTier(tier);
    const idx = order.indexOf(current);
    if (idx >= order.length - 1)
        return null;
    return order[idx + 1];
}
/**
 * Get previous tier (for demotion)
 */
function getPreviousTier(tier) {
    const order = ['Developing', 'Semi Pro', 'Pro', 'Elite'];
    const current = toCanonicalTier(tier);
    const idx = order.indexOf(current);
    if (idx <= 0)
        return null;
    return order[idx - 1];
}
/**
 * Check if score qualifies for tier promotion
 */
function canPromoteToNextTier(currentTier, score) {
    const nextTier = getNextTier(currentTier);
    if (!nextTier)
        return false;
    return score >= exports.TIER_CONFIG[nextTier].minScore;
}
/**
 * Check if score requires tier demotion
 */
function shouldDemoteTier(currentTier, score) {
    const current = toCanonicalTier(currentTier);
    return score < exports.TIER_CONFIG[current].minScore;
}
/**
 * Format tier for display (always canonical)
 */
function formatTierDisplay(tier) {
    return toCanonicalTier(tier);
}
/**
 * All canonical tier names in order (lowest to highest)
 */
exports.TIER_ORDER = ['Developing', 'Semi Pro', 'Pro', 'Elite'];
/**
 * All legacy tier names in order (lowest to highest)
 */
exports.LEGACY_TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
