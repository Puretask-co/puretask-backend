// src/lib/__tests__/tokenInvalidation.test.ts
// Unit tests for src/lib/tokenInvalidation.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================================
// Mocks
// =====================================================================

const { mockQuery, mockLogger } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../db/client", () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
vi.mock("../logger", () => ({ logger: mockLogger }));
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

import {
  invalidateUserTokens,
  invalidateTokenByJti,
  cleanupInvalidatedTokens,
} from "../tokenInvalidation";

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
});

// =====================================================================
// invalidateUserTokens
// =====================================================================

describe("invalidateUserTokens", () => {
  it("calls query with the correct SQL function and userId", async () => {
    await invalidateUserTokens("user-1");
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("invalidate_user_tokens");
    expect(params[0]).toBe("user-1");
  });

  it("passes null reason when reason is not provided", async () => {
    await invalidateUserTokens("user-1");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBeNull();
  });

  it("passes the provided reason to the query", async () => {
    await invalidateUserTokens("user-1", "password_changed");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe("password_changed");
  });

  it("logs info after invalidating tokens", async () => {
    await invalidateUserTokens("user-1", "logout");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "user_tokens_invalidated",
      expect.objectContaining({ userId: "user-1", reason: "logout" })
    );
  });

  it("logs 'manual_invalidation' as reason when not provided", async () => {
    await invalidateUserTokens("user-abc");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "user_tokens_invalidated",
      expect.objectContaining({ reason: "manual_invalidation" })
    );
  });

  it("propagates query errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db down"));
    await expect(invalidateUserTokens("user-1")).rejects.toThrow("db down");
  });
});

// =====================================================================
// invalidateTokenByJti
// =====================================================================

describe("invalidateTokenByJti", () => {
  it("calls query with jti, userId, and reason", async () => {
    await invalidateTokenByJti("jti-123", "user-1", "logout");
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("invalidated_tokens");
    expect(params[0]).toBe("jti-123");
    expect(params[1]).toBe("user-1");
    expect(params[2]).toBe("logout");
  });

  it("passes null reason when not provided", async () => {
    await invalidateTokenByJti("jti-456", "user-2");
    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBeNull();
  });

  it("uses ON CONFLICT DO NOTHING to handle duplicate JTIs", async () => {
    await invalidateTokenByJti("jti-789", "user-3");
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("DO NOTHING");
  });

  it("logs info after invalidating the token", async () => {
    await invalidateTokenByJti("jti-abc", "user-1", "security_breach");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "token_invalidated_by_jti",
      expect.objectContaining({ jti: "jti-abc", userId: "user-1", reason: "security_breach" })
    );
  });

  it("logs 'manual_invalidation' as reason when not provided", async () => {
    await invalidateTokenByJti("jti-def", "user-2");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "token_invalidated_by_jti",
      expect.objectContaining({ reason: "manual_invalidation" })
    );
  });

  it("propagates query errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("constraint violation"));
    await expect(invalidateTokenByJti("jti-err", "user-1")).rejects.toThrow(
      "constraint violation"
    );
  });
});

// =====================================================================
// cleanupInvalidatedTokens
// =====================================================================

describe("cleanupInvalidatedTokens", () => {
  it("returns the count of deleted tokens", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "5" }] });
    const result = await cleanupInvalidatedTokens();
    expect(result).toBe(5);
  });

  it("returns 0 when no tokens were deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    const result = await cleanupInvalidatedTokens();
    expect(result).toBe(0);
  });

  it("returns 0 when rows are empty", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await cleanupInvalidatedTokens();
    expect(result).toBe(0);
  });

  it("logs info when tokens are deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "3" }] });
    await cleanupInvalidatedTokens();
    expect(mockLogger.info).toHaveBeenCalledWith(
      "invalidated_tokens_cleaned_up",
      expect.objectContaining({ count: 3 })
    );
  });

  it("does not log when no tokens were deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    await cleanupInvalidatedTokens();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("deletes tokens older than 30 days", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
    await cleanupInvalidatedTokens();
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("30 days");
  });

  it("propagates query errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db error"));
    await expect(cleanupInvalidatedTokens()).rejects.toThrow("db error");
  });
});
