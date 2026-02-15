// src/lib/__tests__/n8nClient.test.ts
// Unit tests for n8n client (config, event forward, webhook send)

import { beforeEach, afterEach, vi } from "vitest";

const { mockPostJson, mockLogger } = vi.hoisted(() => ({
  mockPostJson: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../config/env", () => ({
  env: {
    N8N_WEBHOOK_URL: "",
    N8N_API_KEY: "",
    N8N_BASE_URL: "",
  },
}));
vi.mock("../httpClient", () => ({
  postJson: (...args: unknown[]) => mockPostJson(...args),
}));
vi.mock("../logger", () => ({
  logger: mockLogger,
}));

// Import after mocks so n8nClient uses mocked env and postJson
import {
  isN8nWebhookConfigured,
  isN8nApiConfigured,
  isN8nConfigured,
  forwardEventToN8nWebhook,
  sendN8nWebhook,
  testN8nConnection,
  type N8nEventPayload,
} from "../n8nClient";
import { env } from "../../config/env";

describe("n8nClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).N8N_WEBHOOK_URL = "";
    (env as any).N8N_API_KEY = "";
  });

  afterEach(() => {
    (env as any).N8N_WEBHOOK_URL = "";
    (env as any).N8N_API_KEY = "";
  });

  describe("isN8nWebhookConfigured", () => {
    it("returns false when N8N_WEBHOOK_URL is not set", () => {
      expect(isN8nWebhookConfigured()).toBe(false);
    });
    it("returns true when N8N_WEBHOOK_URL is set", () => {
      (env as any).N8N_WEBHOOK_URL = "https://n8n.example.com/webhook";
      expect(isN8nWebhookConfigured()).toBe(true);
    });
  });

  describe("isN8nApiConfigured", () => {
    it("returns false when N8N_API_KEY is not set", () => {
      expect(isN8nApiConfigured()).toBe(false);
    });
    it("returns true when N8N_API_KEY is set", () => {
      (env as any).N8N_API_KEY = "secret-key";
      expect(isN8nApiConfigured()).toBe(true);
    });
  });

  describe("isN8nConfigured", () => {
    it("returns false when neither webhook nor API is configured", () => {
      expect(isN8nConfigured()).toBe(false);
    });
    it("returns true when only webhook is configured", () => {
      (env as any).N8N_WEBHOOK_URL = "https://n8n.example.com/webhook";
      expect(isN8nConfigured()).toBe(true);
    });
    it("returns true when only API is configured", () => {
      (env as any).N8N_API_KEY = "key";
      expect(isN8nConfigured()).toBe(true);
    });
  });

  describe("forwardEventToN8nWebhook", () => {
    const payload: N8nEventPayload = {
      jobId: "job-uuid",
      actorType: "client",
      actorId: "client-uuid",
      eventName: "job_completed",
      payload: { foo: "bar" },
      timestamp: "2026-01-31T12:00:00.000Z",
    };

    it("does not call postJson when N8N_WEBHOOK_URL is not set", async () => {
      await forwardEventToN8nWebhook(payload);
      expect(mockPostJson).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith("n8n_webhook_not_configured", {
        eventName: "job_completed",
      });
    });

    it("calls postJson with URL and payload when N8N_WEBHOOK_URL is set", async () => {
      (env as any).N8N_WEBHOOK_URL = "https://n8n.example.com/hook";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPostJson as vi.Mock<any>).mockResolvedValueOnce(undefined);

      await forwardEventToN8nWebhook(payload);

      expect(mockPostJson).toHaveBeenCalledTimes(1);
      expect(mockPostJson).toHaveBeenCalledWith("https://n8n.example.com/hook", payload);
      expect(mockLogger.info).toHaveBeenCalledWith("n8n_event_forwarded", {
        eventName: "job_completed",
        jobId: "job-uuid",
      });
    });

    it("throws when postJson fails and N8N_WEBHOOK_URL is set", async () => {
      (env as any).N8N_WEBHOOK_URL = "https://n8n.example.com/hook";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPostJson as vi.Mock<any>).mockRejectedValueOnce(new Error("Network error"));

      await expect(forwardEventToN8nWebhook(payload)).rejects.toThrow("Network error");
      expect(mockLogger.error).toHaveBeenCalledWith("n8n_forward_failed", expect.any(Object));
    });
  });

  describe("sendN8nWebhook", () => {
    it("calls postJson with given url and body", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPostJson as vi.Mock<any>).mockResolvedValueOnce(undefined);
      const url = "https://custom.example.com/trigger";
      const body = { action: "sync", id: "123" };

      await sendN8nWebhook(url, body);

      expect(mockPostJson).toHaveBeenCalledTimes(1);
      expect(mockPostJson).toHaveBeenCalledWith(url, body);
    });
  });

  describe("testN8nConnection", () => {
    it("returns connected: false when N8N_API_KEY is not set", async () => {
      const result = await testN8nConnection();
      expect(result).toEqual({
        connected: false,
        error: "N8N_API_KEY not configured",
      });
    });
  });
});
