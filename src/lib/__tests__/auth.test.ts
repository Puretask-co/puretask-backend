// src/lib/__tests__/auth.test.ts
// Unit tests for src/lib/auth.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// --- Mock env before any auth imports ---
vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret",
    JWT_EXPIRES_IN: "1h",
    BCRYPT_SALT_ROUNDS: 10,
    N8N_WEBHOOK_SECRET: "test-n8n-secret",
    NODE_ENV: "test",
  },
}));

// --- Mock DB client for verifyAuthToken ---
const mockQuery = vi.fn();
vi.mock("../../db/client", () => ({ query: mockQuery }));

import {
  hashPassword,
  verifyPassword,
  signAuthToken,
  verifyAuthToken,
  verifyAuthTokenSync,
  authMiddlewareAttachUser,
  auth,
  adminOnly,
  verifyN8nSignature,
  computeN8nSignature,
  AuthUser,
} from "../auth";

// =====================================================================
// Helpers
// =====================================================================

function makeReqRes(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    path: "/test",
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next };
}

const TEST_SECRET = "test-jwt-secret";

// =====================================================================
// hashPassword / verifyPassword
// =====================================================================

describe("hashPassword", () => {
  it("returns a string that is not the original password", async () => {
    const hash = await hashPassword("mypassword");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("mypassword");
  });

  it("produces different hashes for the same input (salted)", async () => {
    const hash1 = await hashPassword("same");
    const hash2 = await hashPassword("same");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

// =====================================================================
// signAuthToken / verifyAuthTokenSync
// =====================================================================

describe("signAuthToken", () => {
  it("returns a JWT string", () => {
    const token = signAuthToken({ id: "u1", role: "client" });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });

  it("encodes id and role into the payload", () => {
    const token = signAuthToken({ id: "u1", role: "admin" });
    const decoded = jwt.verify(token, TEST_SECRET) as any;
    expect(decoded.id).toBe("u1");
    expect(decoded.role).toBe("admin");
  });

  it("generates a jti when none is provided", () => {
    const token = signAuthToken({ id: "u1", role: "client" });
    const decoded = jwt.verify(token, TEST_SECRET) as any;
    expect(typeof decoded.jti).toBe("string");
    expect(decoded.jti.length).toBeGreaterThan(0);
  });

  it("uses the provided jti when given", () => {
    const token = signAuthToken({ id: "u1", role: "client" }, "fixed-jti");
    const decoded = jwt.verify(token, TEST_SECRET) as any;
    expect(decoded.jti).toBe("fixed-jti");
  });

  it("two tokens for the same user have different jtis", () => {
    const t1 = signAuthToken({ id: "u1", role: "client" });
    const t2 = signAuthToken({ id: "u1", role: "client" });
    const d1 = jwt.verify(t1, TEST_SECRET) as any;
    const d2 = jwt.verify(t2, TEST_SECRET) as any;
    expect(d1.jti).not.toBe(d2.jti);
  });
});

describe("verifyAuthTokenSync", () => {
  it("decodes a valid token", () => {
    const token = signAuthToken({ id: "u2", role: "cleaner" });
    const user = verifyAuthTokenSync(token);
    expect(user.id).toBe("u2");
    expect(user.role).toBe("cleaner");
  });

  it("throws for an invalid token", () => {
    expect(() => verifyAuthTokenSync("not.a.token")).toThrow();
  });

  it("throws for an expired token", () => {
    const expired = jwt.sign({ id: "u3", role: "client" }, TEST_SECRET, { expiresIn: -1 });
    expect(() => verifyAuthTokenSync(expired)).toThrow();
  });

  it("throws for a token signed with wrong secret", () => {
    const token = jwt.sign({ id: "u4", role: "client" }, "wrong-secret");
    expect(() => verifyAuthTokenSync(token)).toThrow();
  });
});

// =====================================================================
// verifyAuthToken (async, DB checks)
// =====================================================================

describe("verifyAuthToken", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("resolves for a valid token with no invalidation", async () => {
    // Not in invalidated_tokens, no token_version in JWT
    mockQuery.mockResolvedValue({ rows: [] });

    const token = signAuthToken({ id: "u5", role: "client" }, "jti-5");
    const user = await verifyAuthToken(token);

    expect(user.id).toBe("u5");
    expect(user.role).toBe("client");
    expect(user.jti).toBe("jti-5");
  });

  it("throws when jti is in invalidated_tokens", async () => {
    mockQuery.mockResolvedValue({ rows: [{ jti: "jti-bad" }] });

    const token = signAuthToken({ id: "u6", role: "client" }, "jti-bad");
    await expect(verifyAuthToken(token)).rejects.toThrow("Token has been invalidated");
  });

  it("throws for an invalid/malformed token", async () => {
    await expect(verifyAuthToken("bad.token.here")).rejects.toThrow();
  });

  it("throws for an expired token", async () => {
    const expired = jwt.sign({ id: "u7", role: "client", jti: "jti-7" }, TEST_SECRET, {
      expiresIn: -1,
    });
    await expect(verifyAuthToken(expired)).rejects.toThrow();
  });
});

// =====================================================================
// authMiddlewareAttachUser
// =====================================================================

describe("authMiddlewareAttachUser", () => {
  it("attaches user when a valid token is provided", () => {
    const token = signAuthToken({ id: "u8", role: "admin" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    authMiddlewareAttachUser(req, res, next);
    expect((req as any).user.id).toBe("u8");
    expect((req as any).user.role).toBe("admin");
    expect(next).toHaveBeenCalled();
  });

  it("calls next without setting user when no header is present", () => {
    const { req, res, next } = makeReqRes();
    authMiddlewareAttachUser(req, res, next);
    expect((req as any).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("calls next without setting user when token is invalid", () => {
    const { req, res, next } = makeReqRes("Bearer invalid.token.here");
    authMiddlewareAttachUser(req, res, next);
    expect((req as any).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("calls next without setting user when header is not Bearer", () => {
    const { req, res, next } = makeReqRes("Basic xyz");
    authMiddlewareAttachUser(req, res, next);
    expect((req as any).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// =====================================================================
// auth() middleware
// =====================================================================

describe("auth()", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // By default: jti not invalidated
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("returns 401 when no Authorization header", async () => {
    const { req, res, next } = makeReqRes();
    await auth()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("UNAUTHENTICATED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid token", async () => {
    mockQuery.mockRejectedValue(new Error("invalid"));
    const { req, res, next } = makeReqRes("Bearer not.a.valid.token");
    await auth()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("INVALID_TOKEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and attaches user for a valid token with no required role", async () => {
    const token = signAuthToken({ id: "u9", role: "client" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await auth()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).user.id).toBe("u9");
  });

  it("calls next when user role matches required role", async () => {
    const token = signAuthToken({ id: "u10", role: "cleaner" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await auth("cleaner")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next when user is admin regardless of required role", async () => {
    const token = signAuthToken({ id: "u11", role: "admin" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await auth("client")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when user role does not match required role", async () => {
    const token = signAuthToken({ id: "u12", role: "client" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await auth("cleaner")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalidated token", async () => {
    mockQuery.mockResolvedValue({ rows: [{ jti: "jti-inv" }] });
    const token = signAuthToken({ id: "u13", role: "client" }, "jti-inv");
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await auth()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// =====================================================================
// adminOnly middleware
// =====================================================================

describe("adminOnly", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("returns 401 when no token", async () => {
    const { req, res, next } = makeReqRes();
    await adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("UNAUTHENTICATED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid token", async () => {
    const { req, res, next } = makeReqRes("Bearer bad.token");
    await adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("INVALID_TOKEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not admin", async () => {
    const token = signAuthToken({ id: "u14", role: "client" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and attaches user when user is admin", async () => {
    const token = signAuthToken({ id: "u15", role: "admin" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).user.role).toBe("admin");
  });
});

// =====================================================================
// verifyN8nSignature
// =====================================================================

function makeN8nReq(body: unknown, signature?: string) {
  const req = {
    headers: signature ? { "x-n8n-signature": signature } : {},
    body,
    path: "/webhook",
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next };
}

function computeSig(body: unknown, secret = "test-n8n-secret") {
  const bodyString = JSON.stringify(body ?? {});
  return crypto.createHmac("sha256", secret).update(bodyString, "utf8").digest("hex");
}

describe("verifyN8nSignature", () => {
  it("returns 401 when x-n8n-signature header is missing", () => {
    const { req, res, next } = makeN8nReq({ data: "test" });
    verifyN8nSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("MISSING_SIGNATURE");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when signature is invalid", () => {
    const { req, res, next } = makeN8nReq({ data: "test" }, "badsignature");
    verifyN8nSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as any).mock.calls[0][0].error.code).toBe("INVALID_SIGNATURE");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when signature is valid", () => {
    const body = { event: "job.completed", jobId: "123" };
    const sig = computeSig(body);
    const { req, res, next } = makeN8nReq(body, sig);
    verifyN8nSignature(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next for empty body with correct signature", () => {
    const sig = computeSig({});
    const { req, res, next } = makeN8nReq(undefined, sig);
    verifyN8nSignature(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects when signature matches different body", () => {
    const sig = computeSig({ other: "body" });
    const { req, res, next } = makeN8nReq({ data: "test" }, sig);
    verifyN8nSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// =====================================================================
// computeN8nSignature
// =====================================================================

describe("computeN8nSignature", () => {
  it("returns a hex string", () => {
    const sig = computeN8nSignature({ foo: "bar" });
    expect(typeof sig).toBe("string");
    expect(/^[0-9a-f]+$/.test(sig)).toBe(true);
  });

  it("matches manual HMAC computation", () => {
    const body = { event: "test" };
    const expected = computeSig(body);
    expect(computeN8nSignature(body)).toBe(expected);
  });

  it("produces different signatures for different bodies", () => {
    const s1 = computeN8nSignature({ a: 1 });
    const s2 = computeN8nSignature({ a: 2 });
    expect(s1).not.toBe(s2);
  });
});
