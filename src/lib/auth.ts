// src/lib/auth.ts
// Authentication helpers: password hashing, JWT signing/verification, middleware
// Includes n8n HMAC signature verification

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";

export type UserRole = "client" | "cleaner" | "admin";

export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string | null;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ============================================
// Password Hashing
// ============================================

/**
 * Hash a plaintext password
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ============================================
// JWT Token Management
// ============================================

/**
 * Sign a JWT token for an authenticated user
 */
export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyAuthToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
  return { id: decoded.id, role: decoded.role };
}

// ============================================
// JWT Middleware
// ============================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

/**
 * Attach user to request if valid JWT is present (but don't enforce auth)
 * Use this for routes where auth is optional
 */
export function authMiddlewareAttachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.user = verifyAuthToken(token);
    } catch {
      // Ignore invalid token - user stays undefined
    }
  }
  next();
}

/**
 * Enforce authentication, optionally requiring a specific role
 * Use this for protected routes
 */
export function auth(requiredRole?: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Missing auth token" },
      });
      return;
    }

    try {
      const decoded = verifyAuthToken(token);
      req.user = decoded;

      // Check role if required (admin can access everything)
      if (requiredRole && decoded.role !== requiredRole && decoded.role !== "admin") {
        res.status(403).json({
          error: { code: "FORBIDDEN", message: `Requires ${requiredRole} role` },
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({
        error: { code: "INVALID_TOKEN", message: "Invalid or expired auth token" },
      });
    }
  };
}

/**
 * Require admin role
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Missing auth token" },
    });
    return;
  }

  try {
    const decoded = verifyAuthToken(token);
    req.user = decoded;

    if (decoded.role !== "admin") {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "Admin access required" },
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Invalid or expired auth token" },
    });
  }
}

// ============================================
// n8n HMAC Signature Verification
// ============================================

/**
 * Verify that this request came from n8n using an HMAC signature.
 *
 * Signature scheme:
 * - Shared secret: N8N_WEBHOOK_SECRET
 * - Header: x-n8n-signature
 * - Algorithm: HMAC-SHA256 over JSON.stringify(req.body)
 * - signature = hex(HMAC_SHA256(secret, JSON.stringify(body)))
 *
 * In n8n, compute the same signature and set the header:
 * ```javascript
 * const crypto = require('crypto');
 * const secret = 'your_N8N_WEBHOOK_SECRET';
 * const body = JSON.stringify($json);
 * const hmac = crypto.createHmac('sha256', secret);
 * hmac.update(body, 'utf8');
 * const signature = hmac.digest('hex');
 * // Set header: x-n8n-signature = signature
 * ```
 */
export function verifyN8nSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = env.N8N_WEBHOOK_SECRET;

  // If secret not configured
  if (!secret) {
    if (env.NODE_ENV === "production") {
      // Fail closed in production
      res.status(500).json({
        error: { code: "CONFIG_ERROR", message: "n8n webhook secret not configured" },
      });
      return;
    }
    // In dev, allow through for local testing
    next();
    return;
  }

  // Get signature from header
  const headerSig = req.headers["x-n8n-signature"];
  if (!headerSig || typeof headerSig !== "string") {
    res.status(401).json({
      error: { code: "MISSING_SIGNATURE", message: "Missing x-n8n-signature header" },
    });
    return;
  }

  // Compute expected signature
  const bodyString = JSON.stringify(req.body ?? {});
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(bodyString, "utf8");
  const expectedSig = hmac.digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  let valid = false;
  try {
    valid =
      headerSig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(headerSig), Buffer.from(expectedSig));
  } catch {
    // If lengths differ, timingSafeEqual throws
    valid = false;
  }

  if (!valid) {
    res.status(401).json({
      error: { code: "INVALID_SIGNATURE", message: "Invalid n8n signature" },
    });
    return;
  }

  next();
}

/**
 * Compute n8n signature for testing
 */
export function computeN8nSignature(body: unknown): string {
  const bodyString = JSON.stringify(body ?? {});
  const hmac = crypto.createHmac("sha256", env.N8N_WEBHOOK_SECRET);
  hmac.update(bodyString, "utf8");
  return hmac.digest("hex");
}
