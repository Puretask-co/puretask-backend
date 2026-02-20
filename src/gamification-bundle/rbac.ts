import { Request, Response, NextFunction } from "express";

/**
 * Simple RBAC middleware. Assumes req.adminUser is set by auth layer.
 * Roles: admin > ops > support > viewer
 *
 * You can adapt to your existing auth stack (JWT, session, etc.).
 */

export type AdminRole = "admin" | "ops" | "support" | "viewer";

const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 1,
  support: 2,
  ops: 3,
  admin: 4
};

export function requireAdminRole(minRole: AdminRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).adminUser;
    if (!user) return res.status(401).json({ ok: false, error: "admin auth required" });
    const role: AdminRole = user.role;
    if (!role || ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
      return res.status(403).json({ ok: false, error: "insufficient role" });
    }
    next();
  };
}
