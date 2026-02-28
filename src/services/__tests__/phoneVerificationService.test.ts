// src/services/__tests__/phoneVerificationService.test.ts
// Unit tests for phone verification service

import { beforeEach, vi } from "vitest";
import { sendOTP, verifyOTP } from "../phoneVerificationService";

const mockQueryFn = vi.hoisted(() => vi.fn());
const mockTwilioCreate = vi.hoisted(() => vi.fn());
vi.mock("../../db/client", () => ({ query: (...args: unknown[]) => mockQueryFn(...args) }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: mockTwilioCreate } })),
}));
vi.mock("../../config/env", () => ({
  env: {
    TWILIO_ACCOUNT_SID: "test-sid",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_FROM_NUMBER: "+1234567890",
    NODE_ENV: "test",
  },
}));
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("phoneVerificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendOTP", () => {
    it("generates and stores OTP", async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ id: "1" }] }); // INSERT OTP

      mockTwilioCreate.mockResolvedValueOnce({ sid: "test-sid" });

      const result = await sendOTP("user-123", "+11234567890");

      expect(result.success).toBe(true);
      expect(mockQueryFn).toHaveBeenCalled();
      expect(mockTwilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+11234567890",
          body: expect.stringContaining("verification code"),
        })
      );
    });

    it("validates phone number format", async () => {
      const result = await sendOTP("user-123", "invalid-phone");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid phone number");
    });

    it("handles Twilio errors gracefully", async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [{ id: "1" }] }); // INSERT OTP

      mockTwilioCreate.mockRejectedValueOnce(new Error("Twilio error"));

      // In test env, service returns success when OTP is stored (Twilio fail is non-fatal)
      const result = await sendOTP("user-123", "+11234567890");

      expect(result.success).toBe(true); // OTP stored, Twilio fail non-fatal in test
      expect(mockTwilioCreate).toHaveBeenCalled();
    });
  });

  describe("verifyOTP", () => {
    it("verifies correct OTP", async () => {
      mockQueryFn
        .mockResolvedValueOnce({
          rows: [
            {
              id: "1",
              otp_code: "123456",
              expires_at: new Date(Date.now() + 600000),
              verified_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE phone_verifications
        .mockResolvedValueOnce({ rows: [{ id: "1" }] }) // SELECT cleaner_profiles
        .mockResolvedValueOnce({ rows: [] }) // UPDATE cleaner_profiles
        .mockResolvedValueOnce({ rows: [] }); // UPDATE users

      const result = await verifyOTP("user-123", "+11234567890", "123456");

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it("rejects incorrect OTP", async () => {
      mockQueryFn.mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            otp_code: "123456",
            expires_at: new Date(Date.now() + 600000),
            verified_at: null,
          },
        ],
      });

      const result = await verifyOTP("user-123", "+11234567890", "wrong-code");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });

    it("rejects expired OTP", async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [] });

      const result = await verifyOTP("user-123", "+11234567890", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or expired");
    });

    it("rejects already verified OTP", async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [] });

      const result = await verifyOTP("user-123", "+11234567890", "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or expired");
    });
  });
});
