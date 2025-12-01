import { Request, Response, NextFunction } from "express";

/**
 * Super simple auth stub.
 *
 * In a real deployment you would:
 * - Validate a JWT / Clerk Session / Supabase auth
 * - Look up the user in your `clients` / `cleaners` tables
 * - Attach `req.user`, `req.client`, `req.cleaner`
 *
 * For now we accept headers:
 *   x-user-role: "client" | "cleaner" | "admin"
 *   x-user-id: some-id
 */
export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: "client" | "cleaner" | "admin";
  };
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const role = (req.header("x-user-role") as any) || null;
  const id = req.header("x-user-id") || null;

  if (!role || !id) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing auth headers" } });
  }

  if (!["client", "cleaner", "admin"].includes(role)) {
    return res.status(403).json({ error: { code: "INVALID_ROLE", message: "Invalid role" } });
  }

  req.user = { id, role };
  next();
}
