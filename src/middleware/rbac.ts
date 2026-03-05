/**
 * RBAC shim for bundle-style admin routes.
 * Use after requireAuth. Sets req.adminUser so bundle routes that read (req as any).adminUser.id work.
 * Maps backend UserRole to bundle AdminRole (admin, ops, support, viewer).
 * See: docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 4.
 */
import { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "./authCanonical";

export type AdminRole = "admin" | "ops" | "support" | "viewer";

const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 1,
  support: 2,
  ops: 3,
  admin: 4,
};

function bundleRoleFromBackendRole(backendRole: string): AdminRole {
  if (backendRole === "admin" || backendRole === "super_admin") return "admin";
  if (backendRole === "ops_finance") return "ops";
  if (backendRole === "support_lead" || backendRole === "support_agent") return "support";
  return "viewer";
}

/**
 * Use after requireAuth. Ensures req.user exists and sets req.adminUser = { id, role }
 * so bundle admin routes that read (req as any).adminUser.id work.
 */
export function requireAdminRole(minRole: AdminRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authed = req as AuthedRequest;
    if (!authed.user) {
      res.status(401).json({ ok: false, error: "admin auth required" });
      return;
    }
    const adminUser = {
      id: authed.user.id,
      role: bundleRoleFromBackendRole(authed.user.role),
    };
    (req as Request & { adminUser: { id: string; role: AdminRole } }).adminUser = adminUser;
    if (!adminUser.role || ROLE_ORDER[adminUser.role] < ROLE_ORDER[minRole]) {
      res.status(403).json({ ok: false, error: "insufficient role" });
      return;
    }
    next();
  };
}
