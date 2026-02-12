// src/lib/errors.ts
// Standardized error handling for the application

import { Response } from "express";
import { logger } from "./logger";
import { ZodError } from "zod";

/**
 * Standard error codes used across the application
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHENTICATED = "UNAUTHENTICATED",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  
  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  
  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  CONFLICT = "CONFLICT",
  
  // Business logic
  INVALID_STATE = "INVALID_STATE",
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  
  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && this.details !== null
          ? { details: this.details }
          : {}),
      },
    };
  }
}

/**
 * Common error factories for consistency
 */
export const Errors = {
  unauthenticated(message = "Authentication required"): AppError {
    return new AppError(ErrorCode.UNAUTHENTICATED, message, 401);
  },

  forbidden(message = "Access forbidden"): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  },

  notFound(resource = "Resource", id?: string): AppError {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  },

  validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  },

  conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  },

  invalidState(message: string): AppError {
    return new AppError(ErrorCode.INVALID_STATE, message, 400);
  },

  insufficientCredits(required: number, available: number): AppError {
    return new AppError(
      ErrorCode.INSUFFICIENT_CREDITS,
      `Insufficient credits. Required: ${required}, Available: ${available}`,
      402
    );
  },

  internal(message = "Internal server error"): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
  },

  database(message = "Database operation failed"): AppError {
    return new AppError(ErrorCode.DATABASE_ERROR, message, 500);
  },
};

/**
 * Standardized error response handler
 * Use this to send consistent error responses
 */
export function sendError(res: Response, error: unknown, context?: Record<string, unknown>): void {
  // Handle AppError
  if (error instanceof AppError) {
    logger.warn("app_error", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...context,
    });
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.warn("validation_error", {
      issues: error.issues,
      ...context,
    });
    res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Validation failed",
        details: error.issues,
      },
    });
    return;
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    const statusCode = (error as any).statusCode || 500;
    const code = (error as any).code || ErrorCode.INTERNAL_ERROR;

    if (statusCode >= 500) {
      logger.error("error", {
        code,
        message: error.message,
        stack: error.stack,
        ...context,
      });
    } else {
      logger.warn("error", {
        code,
        message: error.message,
        ...context,
      });
    }

    res.status(statusCode).json({
      error: {
        code,
        message: error.message,
      },
    });
    return;
  }

  // Handle unknown errors
  logger.error("unknown_error", {
    error: String(error),
    ...context,
  });
  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "An unexpected error occurred",
    },
  });
}

/**
 * Async route handler wrapper
 * Automatically catches errors and passes them to error handler
 * 
 * Usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsers();
 *   res.json(users);
 * }));
 */
export function asyncHandler(
  fn: (req: any, res: Response, next?: any) => Promise<any>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      sendError(res, error, {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      });
    });
  };
}

