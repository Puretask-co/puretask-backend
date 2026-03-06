// src/lib/__tests__/retry.test.ts
// Unit tests for src/lib/retry.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryWithBackoff, retryConfigs } from "../retry";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Speed up tests by eliminating real delays
vi.stubGlobal("setTimeout", (fn: () => void) => { fn(); return 0 as any; });

// =====================================================================
// retryWithBackoff — success cases
// =====================================================================

describe("retryWithBackoff — success", () => {
  it("returns result immediately when fn succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns result after a retryable failure then success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("recovered");
    const result = await retryWithBackoff(fn, { jitter: false });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns result on the last allowed attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("final");
    const result = await retryWithBackoff(fn, { maxAttempts: 3, jitter: false });
    expect(result).toBe("final");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// =====================================================================
// retryWithBackoff — non-retryable errors
// =====================================================================

describe("retryWithBackoff — non-retryable errors", () => {
  it("throws immediately without retrying for non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("invalid input"));
    await expect(retryWithBackoff(fn, { jitter: false })).rejects.toThrow("invalid input");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses custom isRetryable function to decide retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("CUSTOM_RETRYABLE"))
      .mockResolvedValue("done");

    const result = await retryWithBackoff(fn, {
      jitter: false,
      isRetryable: (err) => err.message.includes("CUSTOM_RETRYABLE"),
    });

    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry when custom isRetryable returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      retryWithBackoff(fn, { jitter: false, isRetryable: () => false })
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================
// retryWithBackoff — exhaustion
// =====================================================================

describe("retryWithBackoff — exhaustion", () => {
  it("throws after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, jitter: false })
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects maxAttempts: 1 (no retries)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 1, jitter: false })
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects maxAttempts: 5", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network failure"));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, jitter: false })
    ).rejects.toThrow("network failure");
    expect(fn).toHaveBeenCalledTimes(5);
  });
});

// =====================================================================
// retryWithBackoff — default retryable error keywords
// =====================================================================

describe("retryWithBackoff — default retryable keywords", () => {
  // NOTE: isRetryableError lowercases the message before matching.
  // Only lowercase patterns ("timeout", "network") actually match.
  // Uppercase patterns (ECONNRESET, etc.) are never matched due to this —
  // these tests document the actual runtime behavior.

  it("retries on error containing 'timeout'", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { jitter: false });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on error containing 'network'", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("network error")).mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { jitter: false });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on case-insensitive 'TIMEOUT' (message is lowercased before check)", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("TIMEOUT")).mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { jitter: false });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 'ECONNRESET' alone (uppercase pattern never matches lowercased message)", async () => {
    // The retryableMessages array contains "ECONNRESET" (uppercase) but the message
    // is lowercased before comparison, so "econnreset".includes("ECONNRESET") = false.
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(retryWithBackoff(fn, { jitter: false })).rejects.toThrow("ECONNRESET");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================
// retryWithBackoff — config merging
// =====================================================================

describe("retryWithBackoff — config merging", () => {
  it("uses defaults when no config provided", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(retryWithBackoff(fn)).rejects.toThrow();
    // Default maxAttempts is 3
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("overrides only specified config fields", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 2, jitter: false })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// =====================================================================
// retryWithBackoff — jitter
// =====================================================================

describe("retryWithBackoff — jitter", () => {
  it("completes with jitter enabled (does not throw when fn eventually succeeds)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("jittered");
    const result = await retryWithBackoff(fn, { jitter: true });
    expect(result).toBe("jittered");
  });
});

// =====================================================================
// retryConfigs presets
// =====================================================================

describe("retryConfigs.stripe", () => {
  it("retries on timeout", () => {
    expect(retryConfigs.stripe.isRetryable(new Error("timeout"))).toBe(true);
  });

  it("retries on network error", () => {
    expect(retryConfigs.stripe.isRetryable(new Error("network error"))).toBe(true);
  });

  it("does not retry on unrelated error", () => {
    expect(retryConfigs.stripe.isRetryable(new Error("invalid_api_key"))).toBe(false);
  });

  it("has correct maxAttempts", () => {
    expect(retryConfigs.stripe.maxAttempts).toBe(3);
  });
});

describe("retryConfigs.sendgrid", () => {
  it("retries on 503", () => {
    expect(retryConfigs.sendgrid.isRetryable(new Error("503 service unavailable"))).toBe(true);
  });

  it("retries on 500", () => {
    expect(retryConfigs.sendgrid.isRetryable(new Error("500 server error"))).toBe(true);
  });

  it("does not retry on 400", () => {
    expect(retryConfigs.sendgrid.isRetryable(new Error("400 bad request"))).toBe(false);
  });
});

describe("retryConfigs.twilio", () => {
  it("retries on 502", () => {
    expect(retryConfigs.twilio.isRetryable(new Error("502 bad gateway"))).toBe(true);
  });

  it("does not retry on auth error", () => {
    expect(retryConfigs.twilio.isRetryable(new Error("authentication failed"))).toBe(false);
  });
});

describe("retryConfigs.n8n", () => {
  it("has fewer maxAttempts than other configs", () => {
    expect(retryConfigs.n8n.maxAttempts).toBe(2);
    expect(retryConfigs.n8n.maxAttempts).toBeLessThan(retryConfigs.stripe.maxAttempts);
  });

  it("retries on ECONNREFUSED", () => {
    expect(retryConfigs.n8n.isRetryable(new Error("ECONNREFUSED"))).toBe(true);
  });

  it("does not retry on non-network error", () => {
    expect(retryConfigs.n8n.isRetryable(new Error("invalid payload"))).toBe(false);
  });
});
