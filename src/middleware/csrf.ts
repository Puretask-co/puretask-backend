// src/middleware/csrf.ts
// CSRF protection middleware

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

/**
 * CSRF token generation and validation
 */

// Store tokens in memory (in production, use Redis)
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// Token expiration: 1 hour
const TOKEN_EXPIRATION = 60 * 60 * 1000;

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return uuidv4();
}

/**
 * Store CSRF token for session
 */
export function storeCsrfToken(sessionId: string, token: string): void {
  csrfTokens.set(sessionId, {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRATION,
  });

  // Cleanup expired tokens periodically
  if (csrfTokens.size > 1000) {
    cleanupExpiredTokens();
  }
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  
  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(sessionId);
    return false;
  }

  return stored.token === token;
}

/**
 * Cleanup expired tokens
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
 * CSRF token middleware
 * Generates and validates CSRF tokens
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Get session ID from request (could be from session cookie, JWT, etc.)
  const sessionId = (req as any).sessionId || req.headers["x-session-id"] || req.ip;

  // GET requests: Generate and return token
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    const token = generateCsrfToken();
    storeCsrfToken(sessionId, token);
    res.setHeader("X-CSRF-Token", token);
    (req as any).csrfToken = token;
    return next();
  }

  // POST/PUT/PATCH/DELETE: Validate token
  const token = req.headers["x-csrf-token"] as string || req.body?._csrf;

  if (!token) {
    logger.warn("csrf_token_missing", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      error: {
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF token is required",
      },
    });
  }

  if (!validateCsrfToken(sessionId, token)) {
    logger.warn("csrf_token_invalid", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "Invalid CSRF token",
      },
    });
  }

  next();
}

/**
 * Optional CSRF protection (only for state-changing operations)
 */
export function optionalCsrfProtection(req: Request, res: Response, next: NextFunction) {
  // Only enforce for state-changing methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  next();
}
