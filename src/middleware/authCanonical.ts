// src/middleware/authCanonical.ts
// CANONICAL AUTH MIDDLEWARE - Single source of truth for authentication
// 
// This is the ONLY auth middleware that should be used in routes.
// All legacy auth mechanisms are deprecated and removed.

import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, AuthUser } from "../lib/auth";
import { logger } from "../lib/logger";
import type { UserRole } from "../types/db";

/**
 * Canonical authenticated request interface
 * All routes must use this shape - no variations allowed
 */
export interface AuthedRequest extends Request {
  user: {
    id: string;
    role: UserRole;
    email?: string | null;
  };
}

/**
 * requireAuth - Enforces JWT authentication
 * 
 * Use this for all protected routes.
 * Returns 401 if no token or invalid token.
 * 
 * @example
 * router.use(requireAuth);
 * router.get('/profile', (req: AuthedRequest, res) => { ... });
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("auth_failed", {
      reason: "missing_authorization_header",
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Missing or invalid authorization header",
      },
    });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const payload = verifyAuthToken(token);
    // Attach user to request with canonical shape
    (req as AuthedRequest).user = {
      id: payload.id,
      role: payload.role,
      email: payload.email ?? null,
    };
    next();
  } catch (error) {
    logger.warn("auth_failed", {
      reason: "invalid_token",
      error: (error as Error).message,
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
    });
  }
}

/**
 * optionalAuth - Attaches user if token present, but doesn't fail if missing
 * 
 * Use this ONLY for public routes that can work with or without auth.
 * 
 * @example
 * router.get('/public-data', optionalAuth, (req, res) => {
 *   if (req.user) { /* authenticated user *\/ }
 *   else { /* anonymous user *\/ }
 * });
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAuthToken(token);
    (req as AuthedRequest).user = {
      id: payload.id,
      role: payload.role,
      email: payload.email ?? null,
    };
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * requireRole - Enforces authentication AND specific role(s)
 * 
 * Use this for role-restricted routes.
 * Must be used AFTER requireAuth or on routes that already have requireAuth.
 * 
 * @example
 * router.use(requireAuth);
 * router.get('/admin/users', requireRole('admin'), (req: AuthedRequest, res) => { ... });
 * 
 * @example
 * router.get('/cleaner/earnings', requireAuth, requireRole('cleaner'), (req: AuthedRequest, res) => { ... });
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authedReq = req as AuthedRequest;

    if (!authedReq.user) {
      logger.warn("auth_failed", {
        reason: "missing_user_context",
        path: req.path,
        ip: req.ip,
      });
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!allowedRoles.includes(authedReq.user.role)) {
      logger.warn("auth_failed", {
        reason: "insufficient_permissions",
        userId: authedReq.user.id,
        userRole: authedReq.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `This action requires one of: ${allowedRoles.join(", ")}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * requireAdmin - Convenience wrapper for admin-only routes
 * 
 * @example
 * router.use(requireAuth);
 * router.get('/admin/users', requireAdmin, (req: AuthedRequest, res) => { ... });
 */
export const requireAdmin = requireRole("admin");

/**
 * requireCleaner - Convenience wrapper for cleaner-only routes
 */
export const requireCleaner = requireRole("cleaner");

/**
 * requireClient - Convenience wrapper for client-only routes
 */
export const requireClient = requireRole("client");
