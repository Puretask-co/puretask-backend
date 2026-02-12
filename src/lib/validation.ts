// src/lib/validation.ts
// Zod validation middleware for Express routes

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Middleware to validate request body against a Zod schema
 * On validation failure, returns 400 with error details
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const requestId = (res as any).requestId ?? (res.locals as any)?.requestId;
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body validation failed",
          details: result.error.errors,
          ...(requestId ? { requestId } : {}),
        },
      });
    }

    // Replace req.body with validated and parsed data
    req.body = result.data;
    next();
  };
}

/**
 * Middleware to validate request query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const requestId = (res as any).requestId ?? (res.locals as any)?.requestId;
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameters validation failed",
          details: result.error.errors,
          ...(requestId ? { requestId } : {}),
        },
      });
    }

    req.query = result.data as any;
    next();
  };
}

/**
 * Middleware to validate request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const requestId = (res as any).requestId ?? (res.locals as any)?.requestId;
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "URL parameters validation failed",
          details: result.error.errors,
          ...(requestId ? { requestId } : {}),
        },
      });
    }

    req.params = result.data as any;
    next();
  };
}

// ============================================
// Section 8: Input sanitization - sort/filter whitelist
// ============================================

/**
 * Sanitize sort parameter. Only allow whitelisted column names and 'asc'|'desc'.
 * Prevents SQL injection via sort param.
 */
export function sanitizeSort(
  sortParam: unknown,
  allowedColumns: string[],
  defaultSort: string = "created_at",
  defaultOrder: "asc" | "desc" = "desc"
): { column: string; order: "asc" | "desc" } {
  if (typeof sortParam !== "string" || !sortParam.trim()) {
    return { column: defaultSort, order: defaultOrder };
  }
  const parts = sortParam.trim().split(/\s+/);
  const col = parts[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || defaultSort;
  const orderVal = (parts[1]?.toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
  const column = allowedColumns.includes(col) ? col : defaultSort;
  return { column, order: orderVal };
}

/**
 * Sanitize filter keys. Only allow whitelisted filter field names.
 */
export function sanitizeFilterKeys(
  filterObj: Record<string, unknown> | unknown,
  allowedKeys: string[]
): Record<string, unknown> {
  if (!filterObj || typeof filterObj !== "object" || Array.isArray(filterObj)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filterObj)) {
    const key = k.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (allowedKeys.includes(key)) {
      out[key] = v;
    }
  }
  return out;
}

