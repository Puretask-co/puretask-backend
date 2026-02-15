// src/middleware/adminAuth.ts
import { Response, NextFunction } from "express";
import { AuthedRequest } from "../types/express";
import { query } from "../db/client";
import { logger } from "../lib/logger";

/**
 * Middleware to verify user has admin privileges
 * Must be used AFTER jwtAuth middleware
 */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Check if user has admin role
    const result = await query(`SELECT role FROM users WHERE id = $1`, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const user = result.rows[0];

    if (user.role !== "admin" && user.role !== "super_admin") {
      logger.warn("Unauthorized admin access attempt", {
        userId: req.user.id,
        email: req.user.email,
        role: user.role,
        path: req.path,
      });

      return res.status(403).json({
        error: "Admin access required",
        code: "ADMIN_ACCESS_REQUIRED",
      });
    }

    // Add role to request for downstream handlers
    req.user.role = user.role;

    logger.info("Admin access granted", {
      userId: req.user.id,
      email: req.user.email,
      role: user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error("Admin auth middleware error", { error });
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Middleware to verify user has super admin privileges
 * For sensitive operations like system config changes
 */
export async function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const result = await query(`SELECT role FROM users WHERE id = $1`, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const user = result.rows[0];

    if (user.role !== "super_admin") {
      logger.warn("Unauthorized super admin access attempt", {
        userId: req.user.id,
        email: req.user.email,
        role: user.role,
        path: req.path,
      });

      return res.status(403).json({
        error: "Super admin access required",
        code: "SUPER_ADMIN_REQUIRED",
      });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    logger.error("Super admin auth middleware error", { error });
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}
