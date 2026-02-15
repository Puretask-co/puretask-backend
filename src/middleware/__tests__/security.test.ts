// src/middleware/__tests__/security.test.ts
// Unit tests for security middleware

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { securityHeaders } from "../security";
import { sanitizeBody } from "../../lib/security";

describe("security middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
    };
    res = {
      setHeader: vi.fn().mockReturnThis(),
      removeHeader: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("securityHeaders", () => {
    it("sets X-Frame-Options header", () => {
      securityHeaders(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    });

    it("sets X-Content-Type-Options header", () => {
      securityHeaders(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    });

    it("sets X-XSS-Protection header", () => {
      securityHeaders(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
    });

    it("sets Referrer-Policy header", () => {
      securityHeaders(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
      );
    });

    it("calls next()", () => {
      securityHeaders(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("sanitizeBody", () => {
    it("sanitizes HTML in request body", () => {
      req.body = {
        name: '<script>alert("xss")</script>Hello',
        email: "test@example.com",
      };

      sanitizeBody(req as Request, res as Response, next);

      // Body should be sanitized (script tags removed)
      expect(req.body.name).not.toContain("<script>");
      expect(next).toHaveBeenCalled();
    });

    it("handles nested objects", () => {
      req.body = {
        user: {
          name: "<b>Bold</b> text",
          bio: "<i>Italic</i> content",
        },
      };

      sanitizeBody(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("handles arrays", () => {
      req.body = {
        items: ["<script>alert(1)</script>", "safe text"],
      };

      sanitizeBody(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("handles empty body", () => {
      req.body = {};

      sanitizeBody(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
