// src/middleware/jwtAuth.ts
// JWT authentication middleware

import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, AuthUser } from "../lib/auth";
import { logger } from "../lib/logger";
import type { UserRole } from "../types/db";

// For backwards compatibility
export type TokenPayload = AuthUser & { email?: string | null };
export const verifyToken = async (token: string): Promise<TokenPayload> => {
  const decoded = await verifyAuthToken(token);
  return { ...decoded, email: decoded.email ?? null };
};

export interface JWTAuthedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email?: string | null;
  };
}

/**
 * JWT authentication middleware
 * Validates Bearer token and attaches user to request
 *
 * NOTE: This middleware is maintained for backwards compatibility.
 * New routes should use requireAuth from src/middleware/authCanonical.ts
 */
export async function jwtAuthMiddleware(
  req: JWTAuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
    const payload = await verifyToken(token);
    req.user = {
      id: payload.id,
      role: payload.role,
      email: payload.email ?? null,
    };
    next();
  } catch (error) {
    logger.warn("jwt_auth_failed", {
      error: (error as Error).message,
      ip: req.ip,
    });
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
    });
    return;
  }
}

/**
 * Optional JWT middleware - doesn't fail if no token
 * Useful for routes that work with or without auth
 */
export function optionalJwtAuth(req: JWTAuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  void verifyToken(token)
    .then((payload) => {
      req.user = {
        id: payload.id,
        role: payload.role,
        email: payload.email ?? null,
      };
      next();
    })
    .catch(() => {
      next();
    });
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
