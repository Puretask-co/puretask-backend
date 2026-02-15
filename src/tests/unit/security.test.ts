// src/tests/unit/security.test.ts
// Unit tests for security features

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sanitizeText,
  sanitizeHtml,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeObject,
  sanitizeByType,
} from "../../lib/sanitization";
import {
  generateCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
  csrfTokens,
} from "../../middleware/csrf";
import { retryWithBackoff, isNetworkError, getUserFriendlyError } from "../../lib/errorRecovery";

describe("Security - Sanitization", () => {
  describe("sanitizeText", () => {
    it("should remove HTML tags", () => {
      expect(sanitizeText("<script>alert('xss')</script>")).toBe("alert(&#x27;xss&#x27;)");
      expect(sanitizeText("<div>Hello</div>")).toBe("Hello");
    });

    it("should escape special characters", () => {
      expect(sanitizeText('"quotes"')).toBe("&quot;quotes&quot;");
      expect(sanitizeText("'apostrophe'")).toBe("&#x27;apostrophe&#x27;");
      expect(sanitizeText("&ampersand")).toBe("&amp;ampersand");
    });

    it("should normalize whitespace", () => {
      expect(sanitizeText("  multiple   spaces  ")).toBe("multiple spaces");
    });

    it("should handle non-string input", () => {
      expect(sanitizeText(null as any)).toBe(null);
      expect(sanitizeText(123 as any)).toBe(123);
    });
  });

  describe("sanitizeHtml", () => {
    it("should strip all HTML tags", () => {
      expect(sanitizeHtml("<script>alert('xss')</script>")).not.toContain("<script>");
      expect(sanitizeHtml("<div>Hello</div>")).toBe("Hello");
    });
  });

  describe("sanitizeEmail", () => {
    it("should trim and lowercase email", () => {
      expect(sanitizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
    });
  });

  describe("sanitizeUrl", () => {
    it("should validate and sanitize URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
    });

    it("should reject invalid protocols", () => {
      expect(sanitizeUrl("javascript:alert('xss')")).toBe("");
      expect(sanitizeUrl("file:///etc/passwd")).toBe("");
    });
  });

  describe("sanitizePhone", () => {
    it("should remove non-digit characters except +", () => {
      expect(sanitizePhone("(555) 123-4567")).toBe("5551234567");
      expect(sanitizePhone("+1-555-123-4567")).toBe("+15551234567");
    });
  });

  describe("sanitizeObject", () => {
    it("should sanitize nested objects", () => {
      const input = {
        name: "<script>alert('xss')</script>",
        email: "  Test@Example.COM  ",
        nested: {
          value: "<div>Hello</div>",
        },
      };

      const result = sanitizeObject(input);
      expect(result.name).not.toContain("<script>");
      expect(result.email).toBe("test@example.com");
      expect(result.nested.value).toBe("Hello");
    });

    it("should respect allowedFields", () => {
      const input = {
        allowed: "value",
        disallowed: "value",
      };

      const result = sanitizeObject(input, { allowedFields: ["allowed"] });
      expect(result.allowed).toBe("value");
      expect(result.disallowed).toBeUndefined();
    });
  });

  describe("sanitizeByType", () => {
    it("should sanitize by type", () => {
      expect(sanitizeByType("  Test@Example.COM  ", "email")).toBe("test@example.com");
      expect(sanitizeByType("<script>alert('xss')</script>", "text")).not.toContain("<script>");
      expect(sanitizeByType("(555) 123-4567", "phone")).toBe("5551234567");
    });
  });
});

describe("Security - CSRF", () => {
  const sessionId = "test-session-123";

  beforeEach(() => {
    csrfTokens.clear();
  });

  describe("generateCsrfToken", () => {
    it("should generate a valid UUID token", () => {
      const token = generateCsrfToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe("storeCsrfToken", () => {
    it("should store token for session", () => {
      const token = generateCsrfToken();
      storeCsrfToken(sessionId, token);

      const isValid = validateCsrfToken(sessionId, token);
      expect(isValid).toBe(true);
    });
  });

  describe("validateCsrfToken", () => {
    it("should validate correct token", () => {
      const token = generateCsrfToken();
      storeCsrfToken(sessionId, token);

      expect(validateCsrfToken(sessionId, token)).toBe(true);
    });

    it("should reject incorrect token", () => {
      const token = generateCsrfToken();
      storeCsrfToken(sessionId, token);

      expect(validateCsrfToken(sessionId, "wrong-token")).toBe(false);
    });

    it("should reject token for non-existent session", () => {
      expect(validateCsrfToken("non-existent", "token")).toBe(false);
    });
  });
});

describe("Error Recovery", () => {
  describe("isNetworkError", () => {
    it("should detect network errors", () => {
      expect(isNetworkError({ code: "ECONNRESET" })).toBe(true);
      expect(isNetworkError({ code: "ETIMEDOUT" })).toBe(true);
      expect(isNetworkError({ code: "ENOTFOUND" })).toBe(true);
      expect(isNetworkError({ code: "OTHER" })).toBe(false);
    });
  });

  describe("getUserFriendlyError", () => {
    it("should provide friendly network error messages", () => {
      const error = { code: "ECONNRESET" };
      const message = getUserFriendlyError(error);
      expect(message).toContain("Network connection");
    });

    it("should provide friendly timeout messages", () => {
      const error = { code: "ETIMEDOUT" };
      const message = getUserFriendlyError(error);
      expect(message).toContain("timed out");
    });

    it("should provide friendly server error messages", () => {
      const error = { status: 500 };
      const message = getUserFriendlyError(error);
      expect(message).toContain("Server error");
    });

    it("should provide friendly client error messages", () => {
      expect(getUserFriendlyError({ status: 401 })).toContain("Authentication");
      expect(getUserFriendlyError({ status: 403 })).toContain("permission");
      expect(getUserFriendlyError({ status: 404 })).toContain("not found");
      expect(getUserFriendlyError({ status: 429 })).toContain("Too many requests");
    });
  });

  describe("retryWithBackoff", () => {
    it("should retry on network errors", async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw { code: "ECONNRESET" };
        }
        return "success";
      };

      const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10 });
      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should not retry non-retryable errors", async () => {
      const fn = async () => {
        throw { code: "VALIDATION_ERROR" };
      };

      await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toHaveProperty(
        "code",
        "VALIDATION_ERROR"
      );
    });

    it("should throw after max retries", async () => {
      const fn = async () => {
        throw { code: "ECONNRESET" };
      };

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toHaveProperty("code", "ECONNRESET");
    });
  });
});
