// src/lib/__tests__/ownership.test.ts
// Unit tests for src/lib/ownership.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// =====================================================================
// Mocks
// =====================================================================

const mockQuery = vi.fn();

vi.mock("../../db/client", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

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

import { ensureOwnership, checkOwnership, requireOwnership } from "../ownership";

beforeEach(() => {
  vi.clearAllMocks();
});

// =====================================================================
// Helpers
// =====================================================================

function makeReq(userId: string, role: string, params: Record<string, string> = {}): Request {
  return {
    user: { id: userId, role },
    params,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {},
  } as unknown as Response;
  return res;
}

// =====================================================================
// ensureOwnership — admin bypass
// =====================================================================

describe("ensureOwnership — admin bypass", () => {
  it("allows admin without querying DB", async () => {
    await expect(
      ensureOwnership("job", "job-1", "user-1", "admin")
    ).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("allows super_admin without querying DB", async () => {
    await expect(
      ensureOwnership("job", "job-1", "user-1", "super_admin")
    ).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// =====================================================================
// ensureOwnership — job
// =====================================================================

describe("ensureOwnership — job", () => {
  it("allows client who owns the job", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "user-1", cleaner_id: null, status: "requested" }],
    });
    await expect(ensureOwnership("job", "job-1", "user-1", "client")).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when client does not own the job", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "other-user", cleaner_id: null, status: "requested" }],
    });
    await expect(ensureOwnership("job", "job-1", "user-1", "client")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("allows cleaner assigned to the job", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: "cleaner-1", status: "accepted" }],
    });
    await expect(
      ensureOwnership("job", "job-1", "cleaner-1", "cleaner")
    ).resolves.toBeUndefined();
  });

  it("allows cleaner to view a requested job (not yet assigned)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: null, status: "requested" }],
    });
    await expect(
      ensureOwnership("job", "job-1", "cleaner-1", "cleaner")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when cleaner is not assigned and status is not requested", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: "other-cleaner", status: "accepted" }],
    });
    await expect(
      ensureOwnership("job", "job-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws NOT_FOUND when job does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("job", "job-1", "user-1", "client")
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// =====================================================================
// ensureOwnership — user
// =====================================================================

describe("ensureOwnership — user", () => {
  it("allows access when userId matches resourceId", async () => {
    await expect(
      ensureOwnership("user", "user-1", "user-1", "client")
    ).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when userId does not match resourceId", async () => {
    await expect(
      ensureOwnership("user", "user-2", "user-1", "client")
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// =====================================================================
// ensureOwnership — payout
// =====================================================================

describe("ensureOwnership — payout", () => {
  it("allows cleaner who owns the payout", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ cleaner_id: "cleaner-1" }] });
    await expect(
      ensureOwnership("payout", "payout-1", "cleaner-1", "cleaner")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when cleaner does not own the payout", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ cleaner_id: "other-cleaner" }] });
    await expect(
      ensureOwnership("payout", "payout-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws NOT_FOUND when payout does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("payout", "payout-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// =====================================================================
// ensureOwnership — invoice
// =====================================================================

describe("ensureOwnership — invoice", () => {
  it("allows client who owns the invoice", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: "cleaner-1" }],
    });
    await expect(
      ensureOwnership("invoice", "inv-1", "client-1", "client")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when client does not own the invoice", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "other-client", cleaner_id: "cleaner-1" }],
    });
    await expect(
      ensureOwnership("invoice", "inv-1", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows cleaner who is on the invoice", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: "cleaner-1" }],
    });
    await expect(
      ensureOwnership("invoice", "inv-1", "cleaner-1", "cleaner")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when cleaner is not on the invoice", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ client_id: "client-1", cleaner_id: "other-cleaner" }],
    });
    await expect(
      ensureOwnership("invoice", "inv-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws NOT_FOUND when invoice does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("invoice", "inv-1", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// =====================================================================
// ensureOwnership — property
// =====================================================================

describe("ensureOwnership — property", () => {
  it("allows client who owns the property", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: "client-1" }] });
    await expect(
      ensureOwnership("property", "42", "client-1", "client")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when client does not own the property", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: "other-client" }] });
    await expect(
      ensureOwnership("property", "42", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws NOT_FOUND when property does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("property", "42", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws NOT_FOUND for non-numeric property ID", async () => {
    await expect(
      ensureOwnership("property", "not-a-number", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// =====================================================================
// ensureOwnership — photo
// =====================================================================

describe("ensureOwnership — photo", () => {
  it("allows cleaner who owns the photo", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ cleaner_id: "cleaner-1", job_id: "job-1" }],
    });
    await expect(
      ensureOwnership("photo", "photo-1", "cleaner-1", "cleaner")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when cleaner does not own the photo", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ cleaner_id: "other-cleaner", job_id: "job-1" }],
    });
    await expect(
      ensureOwnership("photo", "photo-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws NOT_FOUND when photo does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("photo", "photo-1", "cleaner-1", "cleaner")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("allows client whose job owns the photo", async () => {
    // First query: photo lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ cleaner_id: "cleaner-1", job_id: "job-1" }],
    });
    // Second query: job lookup for client check
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: "client-1" }] });
    await expect(
      ensureOwnership("photo", "photo-1", "client-1", "client")
    ).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when client's job does not own the photo", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ cleaner_id: "cleaner-1", job_id: "job-1" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ client_id: "other-client" }] });
    await expect(
      ensureOwnership("photo", "photo-1", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws FORBIDDEN when job not found during client photo check", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ cleaner_id: "cleaner-1", job_id: "job-1" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      ensureOwnership("photo", "photo-1", "client-1", "client")
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// =====================================================================
// checkOwnership
// =====================================================================

describe("checkOwnership", () => {
  it("returns true when ownership check passes", async () => {
    const result = await checkOwnership("user", "user-1", "user-1", "client");
    expect(result).toBe(true);
  });

  it("returns false when ownership check fails", async () => {
    const result = await checkOwnership("user", "user-2", "user-1", "client");
    expect(result).toBe(false);
  });

  it("returns true for admin on any resource", async () => {
    const result = await checkOwnership("job", "job-1", "admin-1", "admin");
    expect(result).toBe(true);
  });

  it("returns false when job not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await checkOwnership("job", "job-x", "user-1", "client");
    expect(result).toBe(false);
  });
});

// =====================================================================
// requireOwnership middleware
// =====================================================================

describe("requireOwnership middleware", () => {
  it("calls next() when ownership check passes", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = makeReq("user-1", "client", { userId: "user-1" });
    const res = makeRes();

    const middleware = requireOwnership("user", "userId");
    middleware(req, res, next);

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 10));
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 403 when ownership check fails", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = makeReq("user-1", "client", { userId: "user-2" });
    const res = makeRes();

    const middleware = requireOwnership("user", "userId");
    middleware(req, res, next);

    await new Promise((r) => setTimeout(r, 10));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("responds 401 when user is not authenticated", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = { params: { jobId: "job-1" } } as unknown as Request;
    const res = makeRes();

    const middleware = requireOwnership("job", "jobId");
    middleware(req, res, next);

    await new Promise((r) => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 400 when param is missing from req.params", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = makeReq("user-1", "client", {}); // no jobId
    const res = makeRes();

    const middleware = requireOwnership("job", "jobId");
    middleware(req, res, next);

    await new Promise((r) => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("responds with 404 status when resource is not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const next = vi.fn() as unknown as NextFunction;
    const req = makeReq("user-1", "client", { jobId: "job-missing" });
    const res = makeRes();

    const middleware = requireOwnership("job", "jobId");
    middleware(req, res, next);

    await new Promise((r) => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
