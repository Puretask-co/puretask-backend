// src/middleware/__tests__/adminAuth.test.ts
// Unit tests for admin authentication middleware

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireAdmin } from "../adminAuth";
import { JWTAuthedRequest } from "../jwtAuth";
import { query } from "../../db/client";

vi.mock("../../db/client");
vi.mock("../jwtAuth", () => ({
  jwtAuthMiddleware: vi.fn((req: any, res: any, next: any) => {
    (req as any).user = { id: "user-123", role: "admin" };
    next();
  }),
}));

describe("adminAuth middleware", () => {
  let req: Partial<JWTAuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      user: { id: "user-123", role: "admin" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("requireAdmin", () => {
    it("allows admin users", async () => {
      req.user = { id: "user-123", role: "admin" };
      (query as any).mockResolvedValueOnce({ rows: [{ role: "admin" }] });

      await requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects non-admin users", async () => {
      req.user = { id: "user-123", role: "client" };
      (query as any).mockResolvedValueOnce({ rows: [{ role: "client" }] });

      await requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ADMIN_ACCESS_REQUIRED",
          error: "Admin access required",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects requests without user", async () => {
      req.user = undefined;

      await requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
