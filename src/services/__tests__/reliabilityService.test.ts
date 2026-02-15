// src/services/__tests__/reliabilityService.test.ts
// Unit tests for reliability service

import { beforeEach, vi } from "vitest";
import {
  computeCleanerStats,
  getPhotoComplianceStats,
  computeReliabilityScoreFromStats,
  getTierFromScore,
  updateCleanerReliability,
} from "../reliabilityService";
import { query } from "../../db/client";

vi.mock("../../db/client");
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("../creditEconomyService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../creditEconomyService")>();
  return {
    ...actual,
    isTierLocked: vi.fn().mockResolvedValue(false),
    createTierLock: vi.fn(),
    createAuditLog: vi.fn(),
  };
});

describe("reliabilityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeCleanerStats", () => {
    it("calculates cleaner stats from last 90 days", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            completed_jobs: "10",
            cancelled_jobs: "2",
            disputed_jobs: "1",
            avg_rating: "4.5",
            total_jobs: "13",
          },
        ],
      });

      const stats = await computeCleanerStats("cleaner-123");

      expect(stats.completed_jobs).toBe(10);
      expect(stats.cancelled_jobs).toBe(2);
      expect(stats.disputed_jobs).toBe(1);
      expect(stats.avg_rating).toBe(4.5);
      expect(stats.total_jobs).toBe(13);
    });

    it("handles null ratings", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            completed_jobs: "0",
            cancelled_jobs: "0",
            disputed_jobs: "0",
            avg_rating: null,
            total_jobs: "0",
          },
        ],
      });

      const stats = await computeCleanerStats("cleaner-123");

      expect(stats.avg_rating).toBeNull();
    });
  });

  describe("getPhotoComplianceStats", () => {
    it("calculates photo compliance rate", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total: "10",
            compliant: "9",
          },
        ],
      });

      const stats = await getPhotoComplianceStats("cleaner-123");

      expect(stats.totalJobs).toBe(10);
      expect(stats.compliantJobs).toBe(9);
      expect(stats.complianceRate).toBe(0.9);
      expect(stats.bonusEligible).toBe(true);
    });

    it("returns false for bonus eligibility when compliance < 90%", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            total: "10",
            compliant: "8",
          },
        ],
      });

      const stats = await getPhotoComplianceStats("cleaner-123");

      expect(stats.complianceRate).toBe(0.8);
      expect(stats.bonusEligible).toBe(false);
    });
  });

  describe("computeReliabilityScoreFromStats", () => {
    it("calculates score from stats", () => {
      const stats = {
        completed_jobs: 10,
        cancelled_jobs: 1,
        disputed_jobs: 0,
        avg_rating: 4.5,
        total_jobs: 11,
      };

      const score = computeReliabilityScoreFromStats(stats, true);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("getTierFromScore", () => {
    it("returns correct tier for score", () => {
      expect(getTierFromScore(50)).toBe("bronze");
      expect(getTierFromScore(70)).toBe("silver");
      expect(getTierFromScore(85)).toBe("gold");
      expect(getTierFromScore(95)).toBe("platinum");
    });
  });
});
