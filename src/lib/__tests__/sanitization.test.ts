// src/lib/__tests__/sanitization.test.ts
// Unit tests for input sanitization utilities

import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeSql,
} from "../sanitization";

describe("sanitization utilities", () => {
  describe("sanitizeHtml", () => {
    it("removes script tags", () => {
      const input = "<script>alert('xss')</script>Hello";
      const output = sanitizeHtml(input);
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("</script>");
      expect(output).toContain("Hello");
    });

    it("removes event handlers", () => {
      const input = "<div onclick=\"alert('xss')\">Click me</div>";
      const output = sanitizeHtml(input);
      expect(output).not.toContain("onclick");
    });

    it("removes javascript: protocol", () => {
      const input = "<a href=\"javascript:alert('xss')\">Link</a>";
      const output = sanitizeHtml(input);
      expect(output).not.toContain("javascript:");
    });

    it("preserves safe HTML", () => {
      const input = "<p>Hello <strong>world</strong></p>";
      const output = sanitizeHtml(input);
      expect(output).toContain("Hello");
      expect(output).toContain("world");
    });

    it("handles empty string", () => {
      expect(sanitizeHtml("")).toBe("");
    });
  });

  describe("sanitizeText", () => {
    it("removes all HTML tags", () => {
      const input = "<b>Bold</b> and <i>italic</i> text";
      const output = sanitizeText(input);
      expect(output).not.toContain("<");
      expect(output).not.toContain(">");
      expect(output).toContain("Bold");
      expect(output).toContain("italic");
    });

    it("preserves plain text", () => {
      const input = "Plain text without HTML";
      expect(sanitizeText(input)).toBe(input);
    });
  });

  describe("sanitizeEmail", () => {
    it("validates correct email format", () => {
      expect(sanitizeEmail("test@example.com")).toBe("test@example.com");
      expect(sanitizeEmail("user.name+tag@domain.co.uk")).toBe("user.name+tag@domain.co.uk");
    });

    it("normalizes invalid-looking emails (impl trims+lowercase only)", () => {
      // sanitizeEmail does trim+lowercase, does not validate format
      expect(sanitizeEmail("invalid-email")).toBe("invalid-email");
      expect(sanitizeEmail("  TEST@EXAMPLE.COM  ")).toBe("test@example.com");
    });

    it("trims whitespace", () => {
      expect(sanitizeEmail("  test@example.com  ")).toBe("test@example.com");
    });

    it("converts to lowercase", () => {
      expect(sanitizeEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
    });
  });

  describe("sanitizeUrl", () => {
    it("validates correct URL format", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
      expect(sanitizeUrl("http://example.com/path")).toContain("example.com");
    });

    it("rejects javascript: protocol", () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBe("");
    });

    it("rejects data: protocol", () => {
      expect(sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBe("");
    });

    it("rejects invalid URLs", () => {
      expect(sanitizeUrl("not-a-url")).toBe("");
      expect(sanitizeUrl("ftp://example.com")).toBe(""); // Only http/https allowed
    });
  });

  describe("sanitizePhone", () => {
    it("strips non-digit characters except leading +", () => {
      expect(sanitizePhone("(123) 456-7890")).toBe("1234567890");
      expect(sanitizePhone("+1-555-123-4567")).toBe("+15551234567");
    });

    it("preserves digits and leading plus", () => {
      const valid = sanitizePhone("1234567890");
      expect(valid).toBe("1234567890");
    });

    it("removes letters", () => {
      expect(sanitizePhone("abc123")).toBe("123");
    });
  });

  describe("sanitizeSql", () => {
    it("removes SQL injection patterns", () => {
      const malicious = "'; DROP TABLE users; --";
      const output = sanitizeSql(malicious);
      expect(output).not.toContain("--");
      expect(output).not.toContain(";");
      expect(output).not.toContain("'");
    });

    it("preserves safe text", () => {
      const safe = "SELECT * FROM users WHERE id = '123'";
      // Note: This is a basic check - in production, use parameterized queries
      const output = sanitizeSql(safe);
      expect(output).toBeTruthy();
    });
  });
});
