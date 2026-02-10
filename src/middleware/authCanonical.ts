// src/middleware/authCanonical.ts
// CANONICAL AUTH MIDDLEWARE - Single source of truth for authentication
// 
// This is the ONLY auth middleware that should be used in routes.
// All legacy auth mechanisms are deprecated and removed.

import { Request, Response, NextFunction, type RequestHandler } from "express";
import { verifyAuthToken, AuthUser } from "../lib/auth";
import { logger } from "../lib/logger";
import { query } from "../db/client";
import type { UserRole } from "../types/db";

/** Role after auth (includes super_admin when set by requireSuperAdmin). */
export type AuthedRole = UserRole;

/**
 * Canonical authenticated request interface
 * All routes must use this shape - no variations allowed
 */
export interface AuthedRequest extends Request {
  user: {
    id: string;
    role: AuthedRole;
    email?: string | null;
  };
}

/**
 * Wraps a handler that expects AuthedRequest so Express accepts it (Request has optional user).
 * Use after requireAuth/requireAdmin: router.get(path, requireAuth, authedHandler(async (req, res) => { ... })).
 * Handler may return void or Response (e.g. return res.json()) - return value is ignored.
 */
export function authedHandler(
  handler: (req: AuthedRequest, res: Response) => void | Promise<void | Response>
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req as AuthedRequest, res)).then(() => next(), next);
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
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
    const payload = await verifyAuthToken(token);
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
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyAuthToken(token);
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
/** Roles that can be required; includes super_admin for admin/super_admin routes. */
export type RequirableRole = UserRole | "super_admin";

export function requireRole(...allowedRoles: RequirableRole[]) {
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

/**
 * requireSuperAdmin - Enforces super_admin role via DB lookup
 * Use for sensitive operations (system config, settings reset, export/import).
 * Must be used AFTER requireAuth.
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authedReq = req as AuthedRequest;
  if (!authedReq.user?.id) {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
    return;
  }
  try {
    const result = await query<{ role: string }>(
      "SELECT role FROM users WHERE id = $1",
      [authedReq.user.id]
    );
    if (result.rows.length === 0) {
      res.status(401).json({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }
    const role = result.rows[0].role;
    if (role !== "super_admin") {
      logger.warn("auth_failed", {
        reason: "super_admin_required",
        userId: authedReq.user.id,
        path: req.path,
      });
      res.status(403).json({
        error: {
          code: "SUPER_ADMIN_REQUIRED",
          message: "Super admin access required",
        },
      });
      return;
    }
    authedReq.user.role = "super_admin";
    next();
  } catch (error) {
    logger.error("requireSuperAdmin_error", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
}
