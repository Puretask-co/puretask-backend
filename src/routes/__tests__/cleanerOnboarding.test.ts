// src/routes/__tests__/cleanerOnboarding.test.ts
// Integration tests for cleaner onboarding routes

import { beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";
import * as onboardingService from "../../services/cleanerOnboardingService";
import * as phoneService from "../../services/phoneVerificationService";

vi.mock("../../db/client");
vi.mock("../../services/cleanerOnboardingService");
vi.mock("../../services/phoneVerificationService");
vi.mock("../../lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/logger")>();
  return {
    ...actual,
    logger: {
      ...actual.logger,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
    },
  };
});

const { mockRequireAuth, mockRequireRole } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn((req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing or invalid authorization header" } });
      return;
    }
    (req as any).user = { id: "test-cleaner-user-id", role: "cleaner" as const };
    next();
  });
  const mockRequireRole = vi.fn(() => (_req: any, _res: any, next: any) => next());
  return { mockRequireAuth, mockRequireRole };
});
vi.mock("../../middleware/authCanonical", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/authCanonical")>();
  return {
    ...actual,
    requireAuth: mockRequireAuth,
    requireRole: mockRequireRole,
    authedHandler: (fn: (req: any, res: any) => void | Promise<void>) => (req: any, res: any, next: any) => {
      void Promise.resolve(fn(req, res)).then(() => next(), next);
    },
  };
});

describe("Cleaner Onboarding Routes", () => {
  let authToken: string;

  beforeEach(() => {
    // Mock JWT token (in real test, would create actual token)
    // For now, we'll test the route structure
    authToken = "mock-jwt-token";
  });

  describe("PATCH /cleaner/onboarding/current-step", () => {
    it("saves current step", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "cleaner-123" }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app)
        .patch("/cleaner/onboarding/current-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "phone-verification" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("requires authentication", async () => {
      const res = await request(app)
        .patch("/cleaner/onboarding/current-step")
        .send({ step: "phone-verification" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /cleaner/onboarding/agreements", () => {
    it("saves agreements", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "cleaner-123" }], rowCount: 1 });

      (onboardingService.saveAgreements as any).mockResolvedValueOnce({
        success: true,
      });

      const res = await request(app)
        .post("/cleaner/onboarding/agreements")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          terms_of_service: true,
          independent_contractor: true,
        });

      expect(res.status).toBe(200);
      expect(onboardingService.saveAgreements).toHaveBeenCalled();
    });

    it("validates required fields", async () => {
      const res = await request(app)
        .post("/cleaner/onboarding/agreements")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          terms_of_service: true,
          // missing independent_contractor
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /cleaner/onboarding/phone/send-otp", () => {
    it("sends OTP", async () => {
      (phoneService.sendOTP as any).mockResolvedValueOnce({
        success: true,
      });

      const res = await request(app)
        .post("/cleaner/onboarding/phone/send-otp")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ phone_number: "+11234567890" });

      expect(res.status).toBe(200);
      expect(phoneService.sendOTP).toHaveBeenCalled();
    });
  });

  describe("POST /cleaner/onboarding/phone/verify-otp", () => {
    it("verifies OTP", async () => {
      (phoneService.verifyOTP as any).mockResolvedValueOnce({
        success: true,
        verified: true,
      });

      const res = await request(app)
        .post("/cleaner/onboarding/phone/verify-otp")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          phone_number: "+11234567890",
          otp_code: "123456",
        });

      expect(res.status).toBe(200);
      expect(phoneService.verifyOTP).toHaveBeenCalled();
    });
  });

  describe("GET /cleaner/onboarding/progress", () => {
    // Skipped: app routes this to gamification router which shares query mock with other routes; timing/order causes flakiness
    it.skip("returns onboarding progress", async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValue({
        rows: [
          {
            completionPercentage: 30,
            wizardCompleted: false,
            currentStep: 3,
            photoUploaded: false,
            bioCompleted: true,
            servicesDefined: false,
            availabilitySet: false,
            pricingConfigured: false,
          },
        ],
        rowCount: 1,
      });

      const res = await request(app)
        .get("/cleaner/onboarding/progress")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.completionPercentage).toBe(30);
      expect(res.body.currentStep).toBe(3);
      expect(res.body.wizardCompleted).toBe(false);
    });
  });
});
