// src/lib/__tests__/logRedaction.test.ts
// Unit tests for src/lib/logRedaction.ts

import { describe, it, expect } from "vitest";
import {
  hashEmail,
  redactSensitiveFields,
  redactHeaders,
  redactRequestBody,
} from "../logRedaction";

// =====================================================================
// hashEmail
// =====================================================================

describe("hashEmail", () => {
  it("preserves the domain", () => {
    const result = hashEmail("user@example.com");
    expect(result).toMatch(/@example\.com$/);
  });

  it("replaces the local part with a hash", () => {
    const result = hashEmail("user@example.com");
    expect(result.split("@")[0]).not.toBe("user");
  });

  it("produces an 8-char base64 local part", () => {
    const result = hashEmail("user@example.com");
    expect(result.split("@")[0].length).toBe(8);
  });

  it("returns the input unchanged if no @ symbol", () => {
    expect(hashEmail("notanemail")).toBe("notanemail");
  });

  it("returns the input unchanged for empty string", () => {
    expect(hashEmail("")).toBe("");
  });

  it("returns the input unchanged for non-string input", () => {
    expect(hashEmail(null as any)).toBe(null);
  });

  it("produces the same hash for the same email", () => {
    expect(hashEmail("alice@test.com")).toBe(hashEmail("alice@test.com"));
  });

  it("produces different hashes for different local parts", () => {
    const h1 = hashEmail("alice@test.com");
    const h2 = hashEmail("bob@test.com");
    expect(h1.split("@")[0]).not.toBe(h2.split("@")[0]);
  });
});

// =====================================================================
// redactSensitiveFields — field name detection
// =====================================================================

describe("redactSensitiveFields — sensitive field names", () => {
  it("redacts password fields", () => {
    const result = redactSensitiveFields({ password: "secret123" });
    expect(result.password).toBe("[REDACTED]");
  });

  it("redacts token fields", () => {
    expect(redactSensitiveFields({ token: "abc" }).token).toBe("[REDACTED]");
    expect(redactSensitiveFields({ authToken: "abc" }).authToken).toBe("[REDACTED]");
  });

  it("redacts secret fields", () => {
    expect(redactSensitiveFields({ secret: "xyz" }).secret).toBe("[REDACTED]");
    expect(redactSensitiveFields({ jwt_secret: "xyz" }).jwt_secret).toBe("[REDACTED]");
  });

  it("redacts authorization fields", () => {
    expect(redactSensitiveFields({ authorization: "Bearer abc" }).authorization).toBe("[REDACTED]");
  });

  it("redacts api_key and apikey fields", () => {
    expect(redactSensitiveFields({ api_key: "key" }).api_key).toBe("[REDACTED]");
    expect(redactSensitiveFields({ apikey: "key" }).apikey).toBe("[REDACTED]");
  });

  it("redacts credit_card and card_number fields", () => {
    expect(redactSensitiveFields({ credit_card: "4111111111111111" }).credit_card).toBe("[REDACTED]");
    expect(redactSensitiveFields({ card_number: "4111" }).card_number).toBe("[REDACTED]");
  });

  it("redacts ssn and social_security fields", () => {
    expect(redactSensitiveFields({ ssn: "123-45-6789" }).ssn).toBe("[REDACTED]");
    expect(redactSensitiveFields({ social_security: "123" }).social_security).toBe("[REDACTED]");
  });

  it("is case-insensitive for field names", () => {
    expect(redactSensitiveFields({ PASSWORD: "x" }).PASSWORD).toBe("[REDACTED]");
    expect(redactSensitiveFields({ Token: "x" }).Token).toBe("[REDACTED]");
  });

  it("preserves non-sensitive fields", () => {
    const result = redactSensitiveFields({ name: "Alice", age: 30, active: true });
    expect(result.name).toBe("Alice");
    expect(result.age).toBe(30);
    expect(result.active).toBe(true);
  });
});

// =====================================================================
// redactSensitiveFields — special field handling
// =====================================================================

describe("redactSensitiveFields — email handling", () => {
  it("hashes email values", () => {
    const result = redactSensitiveFields({ email: "user@example.com" });
    expect(result.email).toMatch(/@example\.com$/);
    expect(result.email).not.toBe("user@example.com");
  });
});

describe("redactSensitiveFields — address handling", () => {
  it("redacts street but keeps city/state when comma-separated", () => {
    const result = redactSensitiveFields({ address: "123 Main St, Springfield, IL" });
    expect(result.address).toMatch(/^\[REDACTED_ADDRESS\]/);
    expect(result.address).toContain("Springfield");
  });

  it("fully redacts address with no commas", () => {
    const result = redactSensitiveFields({ address: "123 Main St" });
    expect(result.address).toBe("[REDACTED_ADDRESS]");
  });
});

describe("redactSensitiveFields — phone handling", () => {
  it("keeps last 4 digits of phone numbers", () => {
    const result = redactSensitiveFields({ phone: "555-867-5309" });
    expect(result.phone).toBe("***-***-5309");
  });

  it("redacts phoneNumber field", () => {
    const result = redactSensitiveFields({ phoneNumber: "5558675309" });
    expect(result.phoneNumber).toBe("***-***-5309");
  });

  it("fully redacts short phone numbers", () => {
    const result = redactSensitiveFields({ phone: "123" });
    expect(result.phone).toBe("[REDACTED]");
  });
});

// =====================================================================
// redactSensitiveFields — string value scanning
// =====================================================================

describe("redactSensitiveFields — secret pattern detection in values", () => {
  it("redacts Stripe live secret keys", () => {
    const result = redactSensitiveFields({ note: "sk_live_" + "a".repeat(24) });
    expect(result.note).toBe("[REDACTED_SECRET]");
  });

  it("redacts Stripe test secret keys", () => {
    const result = redactSensitiveFields({ note: "sk_test_" + "a".repeat(24) });
    expect(result.note).toBe("[REDACTED_SECRET]");
  });

  it("redacts Stripe webhook secrets", () => {
    const result = redactSensitiveFields({ note: "whsec_" + "a".repeat(32) });
    expect(result.note).toBe("[REDACTED_SECRET]");
  });

  it("redacts long alphanumeric tokens (>20 chars)", () => {
    // Use a neutral key name so field-name check doesn't trigger first
    const result = redactSensitiveFields({ callbackUrl: "a".repeat(21) });
    expect(result.callbackUrl).toBe("[REDACTED_TOKEN]");
  });

  it("does not redact short safe strings", () => {
    const result = redactSensitiveFields({ status: "active" });
    expect(result.status).toBe("active");
  });

  it("does not redact strings with spaces (not token-shaped)", () => {
    const result = redactSensitiveFields({ description: "This is a normal description text here" });
    expect(result.description).toBe("This is a normal description text here");
  });
});

// =====================================================================
// redactSensitiveFields — recursion
// =====================================================================

describe("redactSensitiveFields — recursion", () => {
  it("recursively redacts nested objects", () => {
    const result = redactSensitiveFields({ user: { password: "secret", name: "Alice" } });
    expect(result.user.password).toBe("[REDACTED]");
    expect(result.user.name).toBe("Alice");
  });

  it("recursively handles deeply nested objects", () => {
    const result = redactSensitiveFields({ a: { b: { c: { password: "x" } } } });
    expect(result.a.b.c.password).toBe("[REDACTED]");
  });

  it("stops recursion at maxDepth", () => {
    const deep = { a: { b: { c: { d: { e: { password: "x" } } } } } };
    // maxDepth=2 should stop before reaching password
    const result = redactSensitiveFields(deep, 2);
    // Should not throw, and top-level structure is preserved
    expect(result.a).toBeDefined();
  });

  it("handles arrays of objects", () => {
    const result = redactSensitiveFields({ items: [{ password: "x" }, { name: "Bob" }] });
    expect(result.items[0].password).toBe("[REDACTED]");
    expect(result.items[1].name).toBe("Bob");
  });

  it("handles arrays of primitives unchanged", () => {
    const result = redactSensitiveFields({ tags: ["active", "verified"] });
    expect(result.tags).toEqual(["active", "verified"]);
  });

  it("returns non-object input unchanged", () => {
    expect(redactSensitiveFields(null as any)).toBeNull();
    expect(redactSensitiveFields("string" as any)).toBe("string");
  });

  it("preserves numeric values", () => {
    const result = redactSensitiveFields({ amount: 100, count: 5 });
    expect(result.amount).toBe(100);
    expect(result.count).toBe(5);
  });
});

// =====================================================================
// redactHeaders
// =====================================================================

describe("redactHeaders", () => {
  it("redacts authorization header", () => {
    const result = redactHeaders({ authorization: "Bearer token123" });
    expect(result.authorization).toBe("[REDACTED]");
  });

  it("redacts cookie header", () => {
    const result = redactHeaders({ cookie: "session=abc123" });
    expect(result.cookie).toBe("[REDACTED]");
  });

  it("redacts x-api-key header", () => {
    const result = redactHeaders({ "x-api-key": "mykey" });
    expect(result["x-api-key"]).toBe("[REDACTED]");
  });

  it("redacts x-auth-token header", () => {
    const result = redactHeaders({ "x-auth-token": "mytoken" });
    expect(result["x-auth-token"]).toBe("[REDACTED]");
  });

  it("is case-insensitive for header names", () => {
    const result = redactHeaders({ Authorization: "Bearer xyz" });
    expect(result.Authorization).toBe("[REDACTED]");
  });

  it("preserves non-sensitive headers", () => {
    const result = redactHeaders({
      "content-type": "application/json",
      "x-request-id": "abc-123",
    });
    expect(result["content-type"]).toBe("application/json");
    expect(result["x-request-id"]).toBe("abc-123");
  });

  it("handles empty headers object", () => {
    expect(redactHeaders({})).toEqual({});
  });
});

// =====================================================================
// redactRequestBody
// =====================================================================

describe("redactRequestBody", () => {
  it("redacts sensitive fields from request body", () => {
    const result = redactRequestBody({ email: "user@test.com", password: "secret" });
    expect(result.password).toBe("[REDACTED]");
    expect(result.email).toMatch(/@test\.com$/);
  });

  it("returns non-object bodies unchanged", () => {
    expect(redactRequestBody(null)).toBeNull();
    expect(redactRequestBody("raw string")).toBe("raw string");
    expect(redactRequestBody(42)).toBe(42);
  });

  it("handles empty body object", () => {
    expect(redactRequestBody({})).toEqual({});
  });

  it("preserves safe fields", () => {
    const result = redactRequestBody({ role: "client", jobId: "abc-123" });
    expect(result.role).toBe("client");
    expect(result.jobId).toBe("abc-123");
  });
});
