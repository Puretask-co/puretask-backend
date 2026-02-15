// src/lib/__tests__/security.test.ts
// Unit tests for security utilities (rate limiting, etc.)

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { createRateLimiter, generalRateLimiter } from "../security";

describe("security utilities", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  let uniqueKey = 0;
  beforeEach(() => {
    uniqueKey += 1;
    req = {
      ip: `127.0.0.${uniqueKey}`,
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

  describe("createRateLimiter", () => {
    it("allows requests under limit", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => `test-allow-${uniqueKey}`,
      });

      for (let i = 0; i < 5; i++) {
        limiter(req as Request, res as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("blocks requests over limit", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: () => `test-block-${uniqueKey}`,
      });

      for (let i = 0; i < 6; i++) {
        limiter(req as Request, res as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "RATE_LIMITED",
          }),
        })
      );
    });

    it("resets limit after window expires", async () => {
      const limiter = createRateLimiter({
        windowMs: 100,
        max: 2,
        keyGenerator: () => `test-reset-${uniqueKey}`,
      });

      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setTimeout(resolve, 150));

      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(3);
    });

    it("sets rate limit headers", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => `test-headers-${uniqueKey}`,
      });

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 10);
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 9);
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(Number));
    });

    it("uses custom key generator", () => {
      const customKey = `custom-key-${uniqueKey}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: () => customKey,
      });

      limiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("generalRateLimiter", () => {
    it("is a configured rate limiter", () => {
      expect(typeof generalRateLimiter).toBe("function");
      generalRateLimiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
