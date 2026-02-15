// src/middleware/__tests__/authCanonical.test.ts
// Unit tests for canonical auth middleware (requireAuth, requireRole)

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireAuth, requireRole, requireAdmin, AuthedRequest } from "../authCanonical";
import { verifyAuthToken } from "../../lib/auth";

vi.mock("../../lib/auth");
vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("requireAuth", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, path: "/test" };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    req.headers = {};
    await requireAuth(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(vi.mocked(res.json).mock.calls[0][0].error.code).toBe("UNAUTHENTICATED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization is not Bearer", async () => {
    req.headers = { authorization: "Basic xyz" };
    await requireAuth(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    req.headers = { authorization: "Bearer bad-token" };
    vi.mocked(verifyAuthToken).mockRejectedValue(new Error("invalid"));
    await requireAuth(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(vi.mocked(res.json).mock.calls[0][0].error.code).toBe("INVALID_TOKEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches user and calls next when token is valid", async () => {
    req.headers = { authorization: "Bearer valid-token" };
    const mockUser = { id: "user-1", role: "client" as const, email: null };
    vi.mocked(verifyAuthToken).mockResolvedValue(mockUser);
    await requireAuth(req as Request, res as Response, next);
    expect((req as AuthedRequest).user).toEqual({ id: "user-1", role: "client", email: null });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  let req: Partial<AuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: "/test" };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("returns 401 when user is missing", () => {
    req.user = undefined;
    const middleware = requireRole("admin");
    middleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when role is wrong", () => {
    req.user = { id: "u1", role: "client", email: null };
    const middleware = requireRole("admin");
    middleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(vi.mocked(res.json).mock.calls[0][0].error.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when role matches", () => {
    req.user = { id: "u1", role: "admin", email: null };
    const middleware = requireRole("admin");
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next when user has one of allowed roles", () => {
    req.user = { id: "u1", role: "cleaner", email: null };
    const middleware = requireRole("cleaner", "admin");
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  let req: Partial<AuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: "/admin" };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", () => {
    req.user = { id: "u1", role: "client", email: null };
    requireAdmin(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when user is admin", () => {
    req.user = { id: "u1", role: "admin", email: null };
    requireAdmin(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
