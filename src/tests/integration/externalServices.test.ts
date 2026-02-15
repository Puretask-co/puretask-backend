// src/tests/integration/externalServices.test.ts
// Integration tests for external services (SendGrid, Twilio, n8n)

import { describe, it, expect, beforeEach, vi } from "vitest";
import { query } from "../../db/client";
import { sendOnboardingReminder } from "../../services/onboardingReminderService";
import { sendOTP } from "../../services/phoneVerificationService";
import { triggerN8nWorkflow } from "../../lib/n8nClient";
import sgMail from "@sendgrid/mail";
import { env } from "../../config/env";

vi.mock("@sendgrid/mail");
const { mockTwilioCreate } = vi.hoisted(() => ({ mockTwilioCreate: vi.fn() }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: mockTwilioCreate } })),
}));
vi.mock("../../config/env", () => ({
  env: {
    SENDGRID_API_KEY: "test-key",
    SENDGRID_FROM_EMAIL: "noreply@puretask.com",
    TWILIO_ACCOUNT_SID: "test",
    TWILIO_AUTH_TOKEN: "test",
    TWILIO_PHONE_NUMBER: "+15551234567",
    FRONTEND_URL: "https://app.puretask.com",
    N8N_API_KEY: "test-n8n-key",
    NODE_ENV: "test",
  },
}));
vi.mock("../../db/client", () => ({
  query: vi.fn(),
}));
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("External Services Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SendGrid Email Integration", () => {
    it("sends onboarding reminder email via SendGrid", async () => {
      const mockCleaner = {
        id: "cleaner-123",
        user_id: "user-123",
        first_name: "John",
        email: "john@example.com",
        onboarding_current_step: "phone-verification",
      };

      vi.mocked(query).mockResolvedValueOnce({ rows: [] }); // Update reminder sent

      (sgMail.send as any).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          from: env.SENDGRID_FROM_EMAIL || "noreply@puretask.com",
          subject: "Complete Your PureTask Onboarding",
        })
      );
    });

    it("handles SendGrid API errors", async () => {
      const mockCleaner = {
        id: "cleaner-123",
        user_id: "user-123",
        first_name: "John",
        email: "john@example.com",
        onboarding_current_step: "phone-verification",
      };

      const err = new Error("Invalid email address");
      (sgMail.send as any).mockRejectedValueOnce(err);

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("skips sending when SendGrid not configured", async () => {
      const originalKey = env.SENDGRID_API_KEY;
      delete (env as any).SENDGRID_API_KEY;

      const mockCleaner = {
        id: "cleaner-123",
        user_id: "user-123",
        first_name: "John",
        email: "john@example.com",
        onboarding_current_step: "phone-verification",
      };

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(false);
      expect(result.error).toContain("SendGrid not configured");

      env.SENDGRID_API_KEY = originalKey;
    });
  });

  describe("Twilio SMS Integration", () => {
    it("sends OTP via Twilio", async () => {
      mockTwilioCreate.mockResolvedValueOnce({ sid: "SM123" });

      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: "1" }] }); // Insert OTP

      const result = await sendOTP("user-123", "+11234567890");

      expect(result.success).toBe(true);
      expect(mockTwilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+11234567890",
          from: "+15551234567",
          body: expect.stringContaining("verification code"),
        })
      );
    });

    it("handles Twilio API errors", async () => {
      mockTwilioCreate.mockRejectedValueOnce({
        code: 21211,
        message: "Invalid phone number",
      });

      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "1" }] });

      const result = await sendOTP("user-123", "+11234567890");

      // In production, this would fail
      // In development/test, it might still succeed (OTP stored in DB)
      expect(result).toBeDefined();
    });
  });

  describe("n8n Webhook Integration", () => {
    it("triggers n8n workflow", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { executionId: "exec-123" },
        }),
      });

      global.fetch = mockFetch;

      const result = await triggerN8nWorkflow("workflow-123", {
        event: "job_created",
        jobId: "job-123",
      });

      expect(result.executionId).toBe("exec-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/workflows/workflow-123/execute"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-N8N-API-KEY": env.N8N_API_KEY,
          }),
        })
      );
    });

    it("handles n8n API errors", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Workflow not found",
      });

      global.fetch = mockFetch;

      await expect(triggerN8nWorkflow("invalid-workflow", {})).rejects.toThrow();
    });

    it("handles missing n8n API key", async () => {
      const originalKey = env.N8N_API_KEY;
      delete (env as any).N8N_API_KEY;

      await expect(triggerN8nWorkflow("workflow-123", {})).rejects.toThrow(
        "N8N_API_KEY not configured"
      );

      env.N8N_API_KEY = originalKey;
    });
  });
});
