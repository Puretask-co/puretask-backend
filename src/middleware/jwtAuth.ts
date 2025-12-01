// src/middleware/jwtAuth.ts
// JWT authentication middleware

import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../services/authService";
import { logger } from "../lib/logger";
import type { UserRole } from "../types/db";

export interface JWTAuthedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string | null;
  };
}

/**
 * JWT authentication middleware
 * Validates Bearer token and attaches user to request
 */
export function jwtAuthMiddleware(
  req: JWTAuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Also support legacy header-based auth for backwards compatibility
  const legacyRole = req.header("x-user-role");
  const legacyId = req.header("x-user-id");

  if (legacyRole && legacyId) {
    // Legacy auth (for testing/development)
    if (!["client", "cleaner", "admin"].includes(legacyRole)) {
      return res.status(403).json({
        error: { code: "INVALID_ROLE", message: "Invalid role" },
      });
    }
    req.user = { id: legacyId, role: legacyRole as UserRole, email: null };
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Missing or invalid authorization header",
      },
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.userId,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (error) {
    logger.warn("jwt_auth_failed", {
      error: (error as Error).message,
      ip: req.ip,
    });
    return res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
    });
  }
}

/**
 * Optional JWT middleware - doesn't fail if no token
 * Useful for routes that work with or without auth
 */
export function optionalJwtAuth(
  req: JWTAuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.userId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: JWTAuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `This action requires one of: ${allowedRoles.join(", ")}`,
        },
      });
    }

    next();
  };
}

