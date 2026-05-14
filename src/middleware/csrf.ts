// src/middleware/csrf.ts
// CSRF protection middleware. Storage is Redis when available, in-process
// Map otherwise. Multi-replica deployments rely on the Redis path so a token
// issued on replica A can be validated on replica B.
//
// See docs/active/AUDIT_REANALYSIS_2026-05-13.md § B.5.

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";
import { getRedisClient, isRedisAvailable } from "../lib/redis";

/**
 * CSRF token generation and validation
 */

// In-process fallback when Redis is not configured (dev, tests).
export const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// Token expiration: 1 hour (override via env)
const TOKEN_EXPIRATION_MS = parseInt(process.env.CSRF_TOKEN_EXPIRATION_MS ?? `${60 * 60 * 1000}`, 10);
const TOKEN_EXPIRATION_SECONDS = Math.ceil(TOKEN_EXPIRATION_MS / 1000);

const REDIS_KEY_PREFIX = "csrf:";
const redisKey = (sessionId: string): string => `${REDIS_KEY_PREFIX}${sessionId}`;

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return uuidv4();
}

/**
 * Store CSRF token for session. Writes to Redis when available, otherwise
 * to the in-process Map (single-replica only).
 */
export async function storeCsrfToken(sessionId: string, token: string): Promise<void> {
  const client = getRedisClient();
  if (client && isRedisAvailable()) {
    try {
      await client.set(redisKey(sessionId), token, { EX: TOKEN_EXPIRATION_SECONDS });
      return;
    } catch (err) {
      logger.error("csrf_redis_set_failed", { error: (err as Error).message });
      // Fall through to in-memory storage so dev/test scenarios still work.
    }
  }

  csrfTokens.set(sessionId, {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRATION_MS,
  });

  // Cleanup expired tokens periodically when relying on the Map.
  if (csrfTokens.size > 1000) {
    cleanupExpiredTokens();
  }
}

/**
 * Validate CSRF token
 */
export async function validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
  const client = getRedisClient();
  if (client && isRedisAvailable()) {
    try {
      const stored = await client.get(redisKey(sessionId));
      return stored !== null && stored === token;
    } catch (err) {
      logger.error("csrf_redis_get_failed", { error: (err as Error).message });
      // Fall through to in-memory check.
    }
  }

  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return stored.token === token;
}

/**
 * Cleanup expired tokens (in-process Map fallback)
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(sessionId);
    }
  }
}

/**
 * Pick the session identifier for CSRF binding.
 *
 * Preference order:
 * 1. `req.user?.jti` — set by the JWT auth middleware when the token has a jti.
 *    This is the only stable cross-replica identifier we have.
 * 2. Explicit `x-session-id` header (used by some integration tests).
 * 3. `req.ip` — last-resort fallback; per-IP CSRF works fine for single-user
 *    flows but loses precision behind shared-IP proxies / CG-NAT.
 */
function getCsrfSessionId(req: Request): string {
  const jti = (req as Request & { user?: { jti?: string } }).user?.jti;
  if (jti) return jti;
  const explicit = (req as Request & { sessionId?: string }).sessionId;
  if (explicit) return explicit;
  const headerSession = req.headers["x-session-id"];
  if (typeof headerSession === "string" && headerSession.length > 0) return headerSession;
  return req.ip ?? "unknown";
}

/**
 * CSRF token middleware
 * Generates and validates CSRF tokens
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const sessionId = getCsrfSessionId(req);

  // GET-like requests: Generate and return token.
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    const token = generateCsrfToken();
    void storeCsrfToken(sessionId, token).then(
      () => {
        res.setHeader("X-CSRF-Token", token);
        (req as Request & { csrfToken?: string }).csrfToken = token;
        next();
      },
      (err) => {
        logger.error("csrf_token_store_failed", { error: (err as Error).message });
        next(err);
      }
    );
    return;
  }

  // POST/PUT/PATCH/DELETE: Validate token.
  const token =
    (req.headers["x-csrf-token"] as string) ||
    (req.body as { _csrf?: string } | undefined)?._csrf;

  if (!token) {
    logger.warn("csrf_token_missing", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      error: {
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF token is required",
      },
    });
    return;
  }

  void validateCsrfToken(sessionId, token).then(
    (valid) => {
      if (!valid) {
        logger.warn("csrf_token_invalid", {
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        res.status(403).json({
          error: {
            code: "CSRF_TOKEN_INVALID",
            message: "Invalid CSRF token",
          },
        });
        return;
      }
      next();
    },
    (err) => {
      logger.error("csrf_validate_failed", { error: (err as Error).message });
      next(err);
    }
  );
}

/**
 * Optional CSRF protection (only for state-changing operations)
 */
export function optionalCsrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    csrfProtection(req, res, next);
    return;
  }
  next();
}
