// src/lib/__tests__/tiers.test.ts
// Unit tests for tier utilities

import {
  toCanonicalTier,
  toLegacyTier,
  getTierFromScore,
  getTierConfig,
  getPayoutPercent,
  getCreditRateRange,
  isTierHigher,
  getNextTier,
  getPreviousTier,
  canPromoteToNextTier,
  shouldDemoteTier,
  formatTierDisplay,
  TIER_CONFIG,
} from "../tiers";

describe("tiers utilities", () => {
  describe("toCanonicalTier", () => {
    it("converts legacy bronze to Developing", () => {
      expect(toCanonicalTier("bronze")).toBe("Developing");
    });

    it("converts legacy silver to Semi Pro", () => {
      expect(toCanonicalTier("silver")).toBe("Semi Pro");
    });

    it("converts legacy gold to Pro", () => {
      expect(toCanonicalTier("gold")).toBe("Pro");
    });

    it("converts legacy platinum to Elite", () => {
      expect(toCanonicalTier("platinum")).toBe("Elite");
    });

    it("returns canonical tier as-is", () => {
      expect(toCanonicalTier("Developing")).toBe("Developing");
      expect(toCanonicalTier("Elite")).toBe("Elite");
    });

    it("handles null/undefined by returning Developing", () => {
      expect(toCanonicalTier(null)).toBe("Developing");
      expect(toCanonicalTier(undefined)).toBe("Developing");
    });

    it("handles case-insensitive input", () => {
      expect(toCanonicalTier("BRONZE")).toBe("Developing");
      expect(toCanonicalTier("Platinum")).toBe("Elite");
    });
  });

  describe("toLegacyTier", () => {
    it("converts canonical to legacy", () => {
      expect(toLegacyTier("Developing")).toBe("bronze");
      expect(toLegacyTier("Semi Pro")).toBe("silver");
      expect(toLegacyTier("Pro")).toBe("gold");
      expect(toLegacyTier("Elite")).toBe("platinum");
    });

    it("returns legacy tier as-is", () => {
      expect(toLegacyTier("bronze")).toBe("bronze");
      expect(toLegacyTier("platinum")).toBe("platinum");
    });

    it("handles null/undefined by returning bronze", () => {
      expect(toLegacyTier(null)).toBe("bronze");
      expect(toLegacyTier(undefined)).toBe("bronze");
    });
  });

  describe("getTierFromScore", () => {
    it("returns Elite for score >= 90", () => {
      expect(getTierFromScore(90)).toBe("Elite");
      expect(getTierFromScore(95)).toBe("Elite");
      expect(getTierFromScore(100)).toBe("Elite");
    });

    it("returns Pro for score 75-89", () => {
      expect(getTierFromScore(75)).toBe("Pro");
      expect(getTierFromScore(80)).toBe("Pro");
      expect(getTierFromScore(89)).toBe("Pro");
    });

    it("returns Semi Pro for score 60-74", () => {
      expect(getTierFromScore(60)).toBe("Semi Pro");
      expect(getTierFromScore(65)).toBe("Semi Pro");
      expect(getTierFromScore(74)).toBe("Semi Pro");
    });

    it("returns Developing for score < 60", () => {
      expect(getTierFromScore(0)).toBe("Developing");
      expect(getTierFromScore(30)).toBe("Developing");
      expect(getTierFromScore(59)).toBe("Developing");
    });
  });

  describe("getTierConfig", () => {
    it("returns correct config for canonical tier", () => {
      const config = getTierConfig("Elite");
      expect(config.canonical).toBe("Elite");
      expect(config.legacy).toBe("platinum");
      expect(config.payoutPercent).toBe(85);
    });

    it("returns correct config for legacy tier", () => {
      const config = getTierConfig("bronze");
      expect(config.canonical).toBe("Developing");
      expect(config.legacy).toBe("bronze");
    });

    it("handles null/undefined by returning Developing config", () => {
      const config = getTierConfig(null);
      expect(config.canonical).toBe("Developing");
    });
  });

  describe("getPayoutPercent", () => {
    it("returns correct payout percentage for each tier", () => {
      expect(getPayoutPercent("Developing")).toBe(80);
      expect(getPayoutPercent("Semi Pro")).toBe(82);
      expect(getPayoutPercent("Pro")).toBe(84);
      expect(getPayoutPercent("Elite")).toBe(85);
    });

    it("works with legacy tier names", () => {
      expect(getPayoutPercent("bronze")).toBe(80);
      expect(getPayoutPercent("platinum")).toBe(85);
    });
  });

  describe("getCreditRateRange", () => {
    it("returns correct rate range for each tier", () => {
      const developing = getCreditRateRange("Developing");
      expect(developing.min).toBe(150);
      expect(developing.max).toBe(350);

      const elite = getCreditRateRange("Elite");
      expect(elite.min).toBe(600);
      expect(elite.max).toBe(850);
    });
  });

  describe("isTierHigher", () => {
    it("returns true when tier1 is higher than tier2", () => {
      expect(isTierHigher("Elite", "Pro")).toBe(true);
      expect(isTierHigher("Pro", "Semi Pro")).toBe(true);
      expect(isTierHigher("Semi Pro", "Developing")).toBe(true);
    });

    it("returns false when tier1 is lower than tier2", () => {
      expect(isTierHigher("Developing", "Pro")).toBe(false);
      expect(isTierHigher("Semi Pro", "Elite")).toBe(false);
    });

    it("returns false when tiers are equal", () => {
      expect(isTierHigher("Pro", "Pro")).toBe(false);
    });
  });

  describe("getNextTier", () => {
    it("returns next tier for promotion", () => {
      expect(getNextTier("Developing")).toBe("Semi Pro");
      expect(getNextTier("Semi Pro")).toBe("Pro");
      expect(getNextTier("Pro")).toBe("Elite");
    });

    it("returns null for Elite (highest tier)", () => {
      expect(getNextTier("Elite")).toBeNull();
    });

    it("works with legacy tier names", () => {
      expect(getNextTier("bronze")).toBe("Semi Pro");
    });
  });

  describe("getPreviousTier", () => {
    it("returns previous tier for demotion", () => {
      expect(getPreviousTier("Elite")).toBe("Pro");
      expect(getPreviousTier("Pro")).toBe("Semi Pro");
      expect(getPreviousTier("Semi Pro")).toBe("Developing");
    });

    it("returns null for Developing (lowest tier)", () => {
      expect(getPreviousTier("Developing")).toBeNull();
    });
  });

  describe("canPromoteToNextTier", () => {
    it("returns true when score qualifies for next tier", () => {
      expect(canPromoteToNextTier("Developing", 60)).toBe(true); // Can promote to Semi Pro
      expect(canPromoteToNextTier("Semi Pro", 75)).toBe(true); // Can promote to Pro
      expect(canPromoteToNextTier("Pro", 90)).toBe(true); // Can promote to Elite
    });

    it("returns false when score does not qualify", () => {
      expect(canPromoteToNextTier("Developing", 59)).toBe(false);
      expect(canPromoteToNextTier("Semi Pro", 74)).toBe(false);
    });

    it("returns false for Elite (no next tier)", () => {
      expect(canPromoteToNextTier("Elite", 100)).toBe(false);
    });
  });

  describe("shouldDemoteTier", () => {
    it("returns true when score is below tier minimum", () => {
      expect(shouldDemoteTier("Pro", 74)).toBe(true); // Below Pro minimum (75)
      expect(shouldDemoteTier("Semi Pro", 59)).toBe(true); // Below Semi Pro minimum (60)
    });

    it("returns false when score meets tier minimum", () => {
      expect(shouldDemoteTier("Pro", 75)).toBe(false);
      expect(shouldDemoteTier("Elite", 90)).toBe(false);
    });
  });

  describe("formatTierDisplay", () => {
    it("returns canonical tier name", () => {
      expect(formatTierDisplay("bronze")).toBe("Developing");
      expect(formatTierDisplay("platinum")).toBe("Elite");
      expect(formatTierDisplay("Pro")).toBe("Pro");
    });
  });

  describe("TIER_CONFIG", () => {
    it("has correct configuration for all tiers", () => {
      expect(TIER_CONFIG["Developing"].payoutPercent).toBe(80);
      expect(TIER_CONFIG["Semi Pro"].payoutPercent).toBe(82);
      expect(TIER_CONFIG["Pro"].payoutPercent).toBe(84);
      expect(TIER_CONFIG["Elite"].payoutPercent).toBe(85);
    });

    it("has correct score ranges", () => {
      expect(TIER_CONFIG["Developing"].minScore).toBe(0);
      expect(TIER_CONFIG["Developing"].maxScore).toBe(59);
      expect(TIER_CONFIG["Elite"].minScore).toBe(90);
      expect(TIER_CONFIG["Elite"].maxScore).toBe(100);
    });
  });
});
