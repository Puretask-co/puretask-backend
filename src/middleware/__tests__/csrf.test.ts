// src/middleware/__tests__/csrf.test.ts
// Unit tests for CSRF protection middleware.
//
// After B.5, storeCsrfToken / validateCsrfToken became async (Redis-backed
// with in-memory fallback). The csrfProtection middleware still expresses
// next/res via callbacks, so tests use a brief flush helper for the
// async path.

import { beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { generateCsrfToken, validateCsrfToken, storeCsrfToken, csrfProtection } from "../csrf";

// Yield to the microtask queue so the void-then() chains inside
// csrfProtection have a chance to call next/res.
const flush = () => new Promise<void>((r) => setImmediate(r));

describe("CSRF protection", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: "GET",
      headers: {},
      cookies: {},
    };
    res = {
      cookie: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("generateCsrfToken", () => {
    it("generates a valid UUID token", () => {
      const token = generateCsrfToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("generates unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("storeCsrfToken / validateCsrfToken (in-memory fallback)", () => {
    it("stores and validates a token for a session", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken();

      await storeCsrfToken(sessionId, token);

      expect(await validateCsrfToken(sessionId, token)).toBe(true);
    });

    it("rejects an invalid token", async () => {
      const sessionId = "session-123";
      const validToken = generateCsrfToken();
      await storeCsrfToken(sessionId, validToken);

      expect(await validateCsrfToken(sessionId, "invalid-token")).toBe(false);
    });

    it("rejects a token for a different session", async () => {
      const token = generateCsrfToken();
      await storeCsrfToken("session-123", token);

      expect(await validateCsrfToken("session-456", token)).toBe(false);
    });

    it("validateCsrfToken returns false for an unknown session", async () => {
      expect(await validateCsrfToken("non-existent", "anything")).toBe(false);
    });
  });

  describe("csrfProtection", () => {
    it("allows GET requests and generates a token", async () => {
      req.method = "GET";
      req.ip = "127.0.0.1";
      req.headers = {};

      csrfProtection(req as Request, res as Response, next);
      await flush();

      expect(res.setHeader).toHaveBeenCalledWith("X-CSRF-Token", expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    it("allows HEAD requests without CSRF token", async () => {
      req.method = "HEAD";
      req.ip = "127.0.0.1";

      csrfProtection(req as Request, res as Response, next);
      await flush();

      expect(next).toHaveBeenCalled();
    });

    it("allows OPTIONS requests without CSRF token", async () => {
      req.method = "OPTIONS";
      req.ip = "127.0.0.1";

      csrfProtection(req as Request, res as Response, next);
      await flush();

      expect(next).toHaveBeenCalled();
    });

    it("requires CSRF token for POST requests", () => {
      req.method = "POST";
      req.ip = "127.0.0.1";
      req.headers = {};
      req.body = {};

      csrfProtection(req as Request, res as Response, next);

      // Missing-token path is synchronous (no async lookup needed).
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "CSRF_TOKEN_MISSING",
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("validates CSRF token for POST requests", async () => {
      req.method = "POST";
      req.ip = "127.0.0.1";
      const sessionId = req.ip;
      const token = generateCsrfToken();
      await storeCsrfToken(sessionId!, token);

      req.headers = {
        "x-csrf-token": token,
      };
      req.body = {};

      csrfProtection(req as Request, res as Response, next);
      await flush();

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects invalid CSRF token", async () => {
      req.method = "POST";
      req.ip = "127.0.0.1";
      const sessionId = req.ip;
      const validToken = generateCsrfToken();
      await storeCsrfToken(sessionId!, validToken);

      req.headers = {
        "x-csrf-token": "invalid-token",
      };
      req.body = {};

      csrfProtection(req as Request, res as Response, next);
      await flush();

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "CSRF_TOKEN_INVALID",
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
