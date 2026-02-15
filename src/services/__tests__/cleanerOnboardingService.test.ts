// src/services/__tests__/cleanerOnboardingService.test.ts
// Unit tests for cleaner onboarding service

import { beforeEach, vi } from "vitest";
import {
  saveAgreements,
  saveBasicInfo,
  saveServiceAreas,
  saveAvailability,
  saveRates,
  completeOnboarding,
  getOnboardingProgress,
} from "../cleanerOnboardingService";
import { query } from "../../db/client";

vi.mock("../../db/client");
vi.mock("../fileUploadService");
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("cleanerOnboardingService", () => {
  const mockCleanerId = "cleaner-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveAgreements", () => {
    it("saves agreements when both are accepted", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await saveAgreements(mockCleanerId, {
        terms_of_service: true,
        independent_contractor: true,
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("rejects when agreements are not both accepted", async () => {
      const result = await saveAgreements(mockCleanerId, {
        terms_of_service: true,
        independent_contractor: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Both agreements");
    });
  });

  describe("saveBasicInfo", () => {
    it("saves basic info to profile", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({ rows: [{ id: mockCleanerId }] });

      const result = await saveBasicInfo(mockCleanerId, {
        first_name: "John",
        last_name: "Doe",
        bio: "Experienced cleaner with 5 years of experience",
        professional_headline: "Professional House Cleaner",
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("validates minimum bio length", async () => {
      const result = await saveBasicInfo(mockCleanerId, {
        first_name: "John",
        last_name: "Doe",
        bio: "Short", // Too short
        professional_headline: "Cleaner",
      });

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain("bio");
    });
  });

  describe("saveServiceAreas", () => {
    it("saves service areas and travel radius", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await saveServiceAreas(mockCleanerId, {
        zip_codes: ["10001", "10002", "10003"],
        travel_radius_km: 25,
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("requires at least one zip code", async () => {
      const result = await saveServiceAreas(mockCleanerId, {
        zip_codes: [],
        travel_radius_km: 25,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("zip code");
    });

    it("validates travel radius range", async () => {
      const result = await saveServiceAreas(mockCleanerId, {
        zip_codes: ["10001"],
        travel_radius_km: 100, // Too large
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("radius");
    });
  });

  describe("saveAvailability", () => {
    it("saves availability blocks", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await saveAvailability(mockCleanerId, [
        { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_active: true },
        { day_of_week: 2, start_time: "09:00", end_time: "17:00", is_active: true },
      ]);

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("requires at least one availability block", async () => {
      const result = await saveAvailability(mockCleanerId, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain("availability");
    });
  });

  describe("saveRates", () => {
    it("saves hourly rate and travel radius", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({ rows: [{ id: mockCleanerId }] });

      const result = await saveRates(mockCleanerId, {
        hourly_rate_credits: 300,
        travel_radius_km: 20,
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("validates hourly rate range", async () => {
      const result = await saveRates(mockCleanerId, {
        hourly_rate_credits: 50, // Too low
        travel_radius_km: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate");
    });
  });

  describe("completeOnboarding", () => {
    it("marks onboarding as complete", async () => {
      const mockQuery = query as any;
      // Mock progress check
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            progress: {
              completed: 10,
              total: 10,
              percentage: 100,
            },
          },
        ],
      });
      // Mock update
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await completeOnboarding(mockCleanerId);

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it("rejects if not all steps complete", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            progress: {
              completed: 5,
              total: 10,
              percentage: 50,
            },
          },
        ],
      });

      const result = await completeOnboarding(mockCleanerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("complete");
    });
  });

  describe("getOnboardingProgress", () => {
    it("returns progress with current step", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            progress: {
              completed: 3,
              total: 10,
              percentage: 30,
              steps: {
                agreements: true,
                basic_info: true,
                phone_verified: true,
              },
            },
            onboarding_current_step: "face-verification",
          },
        ],
      });

      const result = await getOnboardingProgress(mockCleanerId);

      expect(result).toBeDefined();
      expect(result.current_step).toBe("face-verification");
      expect(result.completed).toBe(3);
    });
  });
});
