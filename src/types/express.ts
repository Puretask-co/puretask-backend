// src/types/express.ts
// Express type extensions

import { Request } from "express";

/**
 * Authenticated request with user information
 */
export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: "client" | "cleaner" | "admin";
    email?: string;
  };
}
