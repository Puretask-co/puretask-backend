import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * DEPRECATED: Legacy auth middleware using x-user-id/x-user-role headers
 * 
 * ⚠️ SECURITY WARNING: This auth method is DISABLED in production
 * Use jwtAuthMiddleware from src/middleware/jwtAuth.ts instead
 * 
 * This is only available in development/test for backwards compatibility
 * with existing tests and development workflows.
 * 
 * For production, use proper JWT Bearer token authentication.
 */
export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: "client" | "cleaner" | "admin";
  };
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
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
