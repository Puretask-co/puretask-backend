// src/lib/__tests__/errorRecovery.test.ts
// Unit tests for error recovery utilities

import { beforeEach, vi } from "vitest";
import {
  retryWithBackoff,
  isNetworkError,
  isOffline,
  getUserFriendlyError,
} from "../errorRecovery";

describe("errorRecovery utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("retryWithBackoff", () => {
    it("succeeds on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await retryWithBackoff(fn, { maxRetries: 3 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds", async () => {
      const err = new Error("Connection reset") as Error & { code: string };
      err.code = "ECONNRESET";
      const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("success");

      const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("fails after max attempts", async () => {
      const err = new Error("Connection reset") as Error & { code: string };
      err.code = "ECONNRESET";
      const fn = vi.fn().mockRejectedValue(err);

      await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelay: 1 })).rejects.toThrow(
        "Connection reset"
      );
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("uses exponential backoff", async () => {
      const err1 = new Error("Error 1") as Error & { code: string };
      err1.code = "ETIMEDOUT";
      const err2 = new Error("Error 2") as Error & { code: string };
      err2.code = "ETIMEDOUT";
      const fn = vi
        .fn()
        .mockRejectedValueOnce(err1)
        .mockRejectedValueOnce(err2)
        .mockResolvedValueOnce("success");

      const startTime = Date.now();
      await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 50 });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(80); // 50 + 100 backoff
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not retry non-network errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Validation error"));

      await expect(retryWithBackoff(fn, { maxRetries: 3, retryableErrors: [] })).rejects.toThrow(
        "Validation error"
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("isNetworkError", () => {
    it("detects network errors", () => {
      const networkError = new Error("Connection reset") as Error & { code: string };
      networkError.code = "ECONNRESET";
      expect(isNetworkError(networkError)).toBe(true);
    });

    it("detects timeout errors", () => {
      const timeoutError = new Error("Request timeout") as Error & { code: string };
      timeoutError.code = "ETIMEDOUT";
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it("detects ECONNREFUSED errors", () => {
      const error: any = new Error("Connection refused");
      error.code = "ECONNREFUSED";
      expect(isNetworkError(error)).toBe(true);
    });

    it("returns false for non-network errors", () => {
      const validationError = new Error("Invalid input");
      expect(isNetworkError(validationError)).toBe(false);
    });
  });

  describe("isOffline", () => {
    it("detects offline status", () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      expect(isOffline()).toBe(true);
    });

    it("detects online status", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      expect(isOffline()).toBe(false);
    });
  });

  describe("getUserFriendlyError", () => {
    it("returns user-friendly message for network errors", () => {
      const error = new Error("Connection reset") as Error & { code: string };
      error.code = "ECONNRESET";
      const message = getUserFriendlyError(error);
      expect(message.toLowerCase()).toContain("network");
    });

    it("returns user-friendly message for timeout errors", () => {
      const error = new Error("Request timeout") as Error & { code: string };
      error.code = "ETIMEDOUT";
      const message = getUserFriendlyError(error);
      expect(message).toContain("timed out");
    });

    it("returns generic message for unknown errors", () => {
      const error = new Error("Unknown error");
      const message = getUserFriendlyError(error);
      expect(message).toBeTruthy();
      expect(typeof message).toBe("string");
    });
  });
});
