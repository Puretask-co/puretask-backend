// src/middleware/__tests__/rateLimit.test.ts
// Unit tests for rate limiting middleware

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { productionRateLimit } from "../productionRateLimit";

describe("rateLimit middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      ip: "127.0.0.1",
      path: "/test",
      method: "GET",
      headers: {},
    };
    res = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("productionRateLimit", () => {
    it("allows requests under limit", async () => {
      const limiter = productionRateLimit({ windowMs: 60000, maxRequests: 100 });
      await limiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("sets rate limit headers", async () => {
      const limiter = productionRateLimit({ windowMs: 60000, maxRequests: 100 });
      await limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 100);
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", expect.any(Number));
    });
  });
});
