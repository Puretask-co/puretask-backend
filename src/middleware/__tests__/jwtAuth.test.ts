// src/middleware/__tests__/jwtAuth.test.ts
// Unit tests for JWT authentication middleware

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../jwtAuth";
import { verifyAuthToken } from "../../lib/auth";

vi.mock("../../lib/auth");
vi.mock("../../lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("jwtAuthMiddleware", () => {
  let req: Partial<JWTAuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("attaches user to request with valid token", async () => {
    const mockUser = { id: "user-123", role: "client" as const, email: null };
    vi.mocked(verifyAuthToken).mockResolvedValueOnce(mockUser);

    req.headers = {
      authorization: "Bearer valid-token",
    };

    await jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(verifyAuthToken).toHaveBeenCalledWith("valid-token");
    expect(req.user).toEqual({ id: "user-123", role: "client", email: null });
    expect(next).toHaveBeenCalled();
  });

  it("rejects request without authorization header", async () => {
    req.headers = {};

    await jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "UNAUTHENTICATED",
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects request with invalid token", async () => {
    vi.mocked(verifyAuthToken).mockRejectedValueOnce(new Error("Invalid token"));

    req.headers = {
      authorization: "Bearer invalid-token",
    };

    await jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects request with malformed authorization header", async () => {
    req.headers = {
      authorization: "InvalidFormat token",
    };

    await jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when only legacy headers present (no Bearer)", async () => {
    req.headers = { "x-user-id": "user-123", "x-user-role": "client" };

    await jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
