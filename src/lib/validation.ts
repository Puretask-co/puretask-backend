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
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body validation failed",
          details: result.error.errors,
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
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameters validation failed",
          details: result.error.errors,
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
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "URL parameters validation failed",
          details: result.error.errors,
        },
      });
    }

    req.params = result.data as any;
    next();
  };
}

