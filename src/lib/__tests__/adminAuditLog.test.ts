// src/lib/__tests__/adminAuditLog.test.ts
// Unit tests for src/lib/adminAuditLog.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================================
// Mocks
// =====================================================================

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../../db/client", () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
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

import { logAdminAction } from "../adminAuditLog";

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
});

// =====================================================================
// logAdminAction
// =====================================================================

describe("logAdminAction", () => {
  const base = {
    adminUserId: "admin-1",
    action: "resolve_dispute",
    entityType: "dispute",
    entityId: "dispute-42",
  };

  it("calls query with the correct SQL INSERT", async () => {
    await logAdminAction(base);
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO admin_audit_log");
  });

  it("passes adminUserId, action, entityType, entityId as positional params", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("admin-1");
    expect(params[1]).toBe("resolve_dispute");
    expect(params[2]).toBe("dispute");
    expect(params[3]).toBe("dispute-42");
  });

  it("passes null entityId when not provided", async () => {
    await logAdminAction({ adminUserId: "admin-1", action: "login", entityType: "session" });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[3]).toBeNull();
  });

  it("serializes oldValues as JSON string", async () => {
    await logAdminAction({ ...base, oldValues: { status: "open" } });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[4]).toBe(JSON.stringify({ status: "open" }));
  });

  it("passes null for oldValues when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[4]).toBeNull();
  });

  it("passes null for oldValues when explicitly null", async () => {
    await logAdminAction({ ...base, oldValues: null });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[4]).toBeNull();
  });

  it("serializes newValues as JSON string", async () => {
    await logAdminAction({ ...base, newValues: { status: "resolved" } });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[5]).toBe(JSON.stringify({ status: "resolved" }));
  });

  it("passes null for newValues when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[5]).toBeNull();
  });

  it("passes reason when provided", async () => {
    await logAdminAction({ ...base, reason: "Fraudulent activity" });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[6]).toBe("Fraudulent activity");
  });

  it("passes null reason when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[6]).toBeNull();
  });

  it("passes ipAddress when provided", async () => {
    await logAdminAction({ ...base, ipAddress: "192.0.2.1" });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[7]).toBe("192.0.2.1");
  });

  it("passes null ipAddress when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[7]).toBeNull();
  });

  it("passes userAgent when provided", async () => {
    await logAdminAction({ ...base, userAgent: "Mozilla/5.0" });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[8]).toBe("Mozilla/5.0");
  });

  it("passes null userAgent when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[8]).toBeNull();
  });

  it("serializes metadata as JSON string", async () => {
    await logAdminAction({ ...base, metadata: { source: "admin_panel", version: 2 } });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[9]).toBe(JSON.stringify({ source: "admin_panel", version: 2 }));
  });

  it("defaults metadata to empty object JSON when not provided", async () => {
    await logAdminAction(base);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[9]).toBe("{}");
  });

  it("resolves without returning a value", async () => {
    const result = await logAdminAction(base);
    expect(result).toBeUndefined();
  });

  it("propagates query errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db constraint"));
    await expect(logAdminAction(base)).rejects.toThrow("db constraint");
  });

  it("handles all optional fields in one call", async () => {
    await logAdminAction({
      adminUserId: "admin-2",
      action: "override_job_status",
      entityType: "job",
      entityId: "job-99",
      oldValues: { status: "requested" },
      newValues: { status: "completed" },
      reason: "Manual override",
      ipAddress: "10.0.0.1",
      userAgent: "AdminTool/1.0",
      metadata: { env: "production" },
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("admin-2");
    expect(params[1]).toBe("override_job_status");
    expect(params[4]).toBe(JSON.stringify({ status: "requested" }));
    expect(params[5]).toBe(JSON.stringify({ status: "completed" }));
    expect(params[6]).toBe("Manual override");
    expect(params[7]).toBe("10.0.0.1");
    expect(params[8]).toBe("AdminTool/1.0");
    expect(params[9]).toBe(JSON.stringify({ env: "production" }));
  });
});
