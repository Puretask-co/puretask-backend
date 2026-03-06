// src/lib/__tests__/communicationValidation.test.ts
// Unit tests for src/lib/communicationValidation.ts

import { describe, it, expect, vi } from "vitest";
import {
  VALID_TEMPLATE_ENV_VARS,
  CommunicationPayloadSchema,
  validateEmailPayload,
  validateTemplateKey,
  createCommunicationPayload,
  getEventNameFromTemplateKey,
  TEMPLATE_TO_EVENT_MAP,
} from "../communicationValidation";

vi.mock("../../config/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    JWT_SECRET: "test-secret",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    N8N_WEBHOOK_SECRET: "n8n_x",
    NODE_ENV: "test",
    JWT_EXPIRES_IN: "30d",
    BCRYPT_SALT_ROUNDS: 10,
  },
}));

// =====================================================================
// VALID_TEMPLATE_ENV_VARS
// =====================================================================

describe("VALID_TEMPLATE_ENV_VARS", () => {
  it("contains SENDGRID and SMS templates", () => {
    const sendgrid = VALID_TEMPLATE_ENV_VARS.filter((v) => v.startsWith("SENDGRID_"));
    const sms = VALID_TEMPLATE_ENV_VARS.filter((v) => v.startsWith("SMS_"));
    expect(sendgrid.length).toBeGreaterThan(0);
    expect(sms.length).toBeGreaterThan(0);
  });

  it("includes expected critical templates", () => {
    expect(VALID_TEMPLATE_ENV_VARS).toContain("SENDGRID_TEMPLATE_USER_WELCOME");
    expect(VALID_TEMPLATE_ENV_VARS).toContain("SENDGRID_TEMPLATE_USER_PASSWORD_RESET");
    expect(VALID_TEMPLATE_ENV_VARS).toContain("SMS_TEMPLATE_EMERGENCY");
  });
});

// =====================================================================
// CommunicationPayloadSchema
// =====================================================================

describe("CommunicationPayloadSchema", () => {
  const validEmail = {
    templateEnvVar: "SENDGRID_TEMPLATE_USER_WELCOME",
    templateId: "d-abc123",
    to_email: "user@example.com",
    channel: "email",
    dynamic_data: { name: "Alice" },
  };

  const validSms = {
    templateEnvVar: "SMS_TEMPLATE_EMERGENCY",
    templateId: "sms-tpl-1",
    to_phone: "+15551234567",
    channel: "sms",
    dynamic_data: { message: "Alert!" },
  };

  it("accepts a valid email payload", () => {
    expect(CommunicationPayloadSchema.safeParse(validEmail).success).toBe(true);
  });

  it("accepts a valid SMS payload", () => {
    expect(CommunicationPayloadSchema.safeParse(validSms).success).toBe(true);
  });

  it("defaults priority to 'normal' when omitted", () => {
    const result = CommunicationPayloadSchema.safeParse(validEmail);
    expect(result.success && result.data.priority).toBe("normal");
  });

  it("accepts 'high' priority", () => {
    const result = CommunicationPayloadSchema.safeParse({ ...validEmail, priority: "high" });
    expect(result.success && result.data.priority).toBe("high");
  });

  it("rejects invalid templateEnvVar", () => {
    const result = CommunicationPayloadSchema.safeParse({
      ...validEmail,
      templateEnvVar: "INVALID_TEMPLATE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email address", () => {
    const result = CommunicationPayloadSchema.safeParse({ ...validEmail, to_email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid channel", () => {
    const result = CommunicationPayloadSchema.safeParse({ ...validEmail, channel: "push" });
    expect(result.success).toBe(false);
  });

  it("rejects missing templateId", () => {
    const { templateId: _, ...rest } = validEmail;
    const result = CommunicationPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing dynamic_data", () => {
    const { dynamic_data: _, ...rest } = validEmail;
    const result = CommunicationPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// =====================================================================
// validateEmailPayload
// =====================================================================

describe("validateEmailPayload", () => {
  const validEmailPayload = {
    templateEnvVar: "SENDGRID_TEMPLATE_USER_WELCOME",
    templateId: "d-abc123",
    to_email: "user@example.com",
    channel: "email",
    dynamic_data: { name: "Alice" },
  };

  const validSmsPayload = {
    templateEnvVar: "SMS_TEMPLATE_EMERGENCY",
    templateId: "sms-tpl-1",
    to_phone: "+15551234567",
    channel: "sms",
    dynamic_data: {},
  };

  it("returns validated payload for a valid email payload", () => {
    const result = validateEmailPayload(validEmailPayload);
    expect(result.channel).toBe("email");
    expect(result.to_email).toBe("user@example.com");
  });

  it("returns validated payload for a valid SMS payload", () => {
    const result = validateEmailPayload(validSmsPayload);
    expect(result.channel).toBe("sms");
  });

  it("throws for invalid schema", () => {
    expect(() => validateEmailPayload({ channel: "email" })).toThrow("Invalid email payload");
  });

  it("throws when email channel is missing to_email", () => {
    const { to_email: _, ...rest } = validEmailPayload;
    expect(() => validateEmailPayload(rest)).toThrow("Email channel requires to_email field");
  });

  it("throws when SMS channel is missing to_phone", () => {
    const { to_phone: _, ...rest } = validSmsPayload;
    expect(() => validateEmailPayload(rest)).toThrow("SMS channel requires to_phone field");
  });

  it("throws when email channel uses SMS template", () => {
    expect(() =>
      validateEmailPayload({
        ...validEmailPayload,
        templateEnvVar: "SMS_TEMPLATE_EMERGENCY",
      })
    ).toThrow("Email channel requires SENDGRID_TEMPLATE_*");
  });

  it("throws when SMS channel uses SENDGRID template", () => {
    expect(() =>
      validateEmailPayload({
        ...validSmsPayload,
        templateEnvVar: "SENDGRID_TEMPLATE_USER_WELCOME",
      })
    ).toThrow("SMS channel requires SMS_TEMPLATE_*");
  });
});

// =====================================================================
// validateTemplateKey
// =====================================================================

describe("validateTemplateKey", () => {
  it("converts email.client.job_booked to correct env var", () => {
    const result = validateTemplateKey("email.client.job_booked");
    expect(result).toBe("SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED");
  });

  it("converts email.user.welcome to correct env var", () => {
    expect(validateTemplateKey("email.user.welcome")).toBe("SENDGRID_TEMPLATE_USER_WELCOME");
  });

  it("converts email.user.password_reset to correct env var", () => {
    expect(validateTemplateKey("email.user.password_reset")).toBe(
      "SENDGRID_TEMPLATE_USER_PASSWORD_RESET"
    );
  });

  it("converts sms.user.emergency to SMS_TEMPLATE_EMERGENCY", () => {
    expect(validateTemplateKey("sms.user.emergency")).toBe("SMS_TEMPLATE_EMERGENCY");
  });

  it("converts sms.user.job_reminder to SMS_TEMPLATE_JOB_REMINDER", () => {
    expect(validateTemplateKey("sms.user.job_reminder")).toBe("SMS_TEMPLATE_JOB_REMINDER");
  });

  it("throws for key with fewer than 3 parts", () => {
    expect(() => validateTemplateKey("email.client")).toThrow("Invalid template key format");
  });

  it("throws for key that maps to unknown env var", () => {
    expect(() => validateTemplateKey("email.client.nonexistent_action")).toThrow(
      "Invalid template key"
    );
  });
});

// =====================================================================
// createCommunicationPayload
// =====================================================================

describe("createCommunicationPayload", () => {
  it("creates a valid email payload", () => {
    const payload = createCommunicationPayload({
      templateKey: "email.user.welcome",
      templateId: "d-welcome",
      to_email: "alice@example.com",
      channel: "email",
      dynamic_data: { name: "Alice" },
    });
    expect(payload.templateEnvVar).toBe("SENDGRID_TEMPLATE_USER_WELCOME");
    expect(payload.to_email).toBe("alice@example.com");
    expect(payload.channel).toBe("email");
    expect(payload.priority).toBe("normal");
  });

  it("creates a valid SMS payload", () => {
    const payload = createCommunicationPayload({
      templateKey: "sms.user.emergency",
      templateId: "sms-emergency",
      to_phone: "+15559876543",
      channel: "sms",
      dynamic_data: { message: "Urgent!" },
    });
    expect(payload.templateEnvVar).toBe("SMS_TEMPLATE_EMERGENCY");
    expect(payload.to_phone).toBe("+15559876543");
  });

  it("applies custom priority", () => {
    const payload = createCommunicationPayload({
      templateKey: "email.user.welcome",
      templateId: "d-welcome",
      to_email: "alice@example.com",
      channel: "email",
      priority: "high",
      dynamic_data: {},
    });
    expect(payload.priority).toBe("high");
  });

  it("throws for invalid template key", () => {
    expect(() =>
      createCommunicationPayload({
        templateKey: "email.bad.key",
        templateId: "d-x",
        to_email: "a@b.com",
        channel: "email",
        dynamic_data: {},
      })
    ).toThrow("Invalid template key");
  });

  it("throws when to_email is missing for email channel", () => {
    expect(() =>
      createCommunicationPayload({
        templateKey: "email.user.welcome",
        templateId: "d-welcome",
        channel: "email",
        dynamic_data: {},
      })
    ).toThrow("Email channel requires to_email field");
  });
});

// =====================================================================
// getEventNameFromTemplateKey
// =====================================================================

describe("getEventNameFromTemplateKey", () => {
  it("returns mapped event name for known keys", () => {
    expect(getEventNameFromTemplateKey("email.client.job_booked")).toBe("job.booked");
    expect(getEventNameFromTemplateKey("email.user.welcome")).toBe("user.registered");
    expect(getEventNameFromTemplateKey("sms.user.emergency")).toBe("communication.sms");
  });

  it("returns fallback for unknown keys (uses first segment)", () => {
    expect(getEventNameFromTemplateKey("email.unknown.action")).toBe("communication.email");
    expect(getEventNameFromTemplateKey("sms.unknown.action")).toBe("communication.sms");
  });

  it("covers all keys in TEMPLATE_TO_EVENT_MAP", () => {
    for (const [key, event] of Object.entries(TEMPLATE_TO_EVENT_MAP)) {
      expect(getEventNameFromTemplateKey(key)).toBe(event);
    }
  });
});
