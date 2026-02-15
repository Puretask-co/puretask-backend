import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * ⚠️ DEPRECATED - DO NOT USE IN NEW CODE ⚠️
 *
 * Legacy auth middleware using x-user-id/x-user-role headers
 *
 * This middleware is DEPRECATED and will be removed in a future version.
 *
 * ⚠️ SECURITY WARNING: This auth method is DISABLED in production
 *
 * MIGRATION GUIDE:
 * - Replace `import { authMiddleware } from '../middleware/auth'`
 * - With `import { requireAuth } from '../middleware/authCanonical'`
 * - Replace `router.use(authMiddleware)` with `router.use(requireAuth)`
 *
 * For role-based routes, use:
 * - `requireAuth` + `requireRole('admin')` or `requireAdmin`
 * - `requireAuth` + `requireRole('client')` or `requireClient`
 * - `requireAuth` + `requireRole('cleaner')` or `requireCleaner`
 *
 * See src/middleware/authCanonical.ts for the canonical auth implementation.
 *
 * @deprecated Use requireAuth from src/middleware/authCanonical.ts instead
 */
export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: "client" | "cleaner" | "admin";
  };
}

/**
 * @deprecated Use requireAuth from src/middleware/authCanonical.ts instead
 */
export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  // Log deprecation warning
  logger.error("legacy_auth_deprecated", {
    reason: "authMiddleware is deprecated",
    message: "Use requireAuth from src/middleware/authCanonical.ts instead",
    path: req.path,
    stack: new Error().stack,
  });

  // Block legacy auth in production
  if (env.NODE_ENV === "production") {
    logger.error("legacy_auth_blocked", {
      reason: "x-user-id/x-user-role headers disabled in production",
      message: "Use JWT Bearer token authentication instead",
      path: req.path,
    });
    return res.status(401).json({
      error: {
        code: "AUTH_METHOD_DISABLED",
        message: "This authentication method is disabled. Use Bearer token authentication.",
      },
    });
  }

  const role = (req.header("x-user-role") as any) || null;
  const id = req.header("x-user-id") || null;

  if (!role || !id) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Missing auth headers" },
    });
  }

  if (!["client", "cleaner", "admin"].includes(role)) {
    return res.status(403).json({
      error: { code: "INVALID_ROLE", message: "Invalid role" },
    });
  }

  // Log usage for monitoring
  logger.warn("legacy_auth_used", {
    userId: id,
    role,
    path: req.path,
    warning: "Consider migrating to JWT authentication",
  });

  req.user = { id, role };
  next();
}
