// src/middleware/requestContext.ts
// Request context middleware for tracing

import { Request, Response, NextFunction } from "express";
import {
  withRequestContext,
  generateRequestId,
  enrichContext,
  getRequestContext,
} from "../lib/logger";

// Header names for request/correlation IDs
const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      correlationId?: string;
    }
  }
}

/**
 * Middleware to establish request context with tracing IDs
 * - Generates or uses existing request ID
 * - Propagates correlation ID for distributed tracing
 * - Makes IDs available in logger context
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get or generate request ID
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || generateRequestId();

  // Get correlation ID (for cross-service tracing)
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || requestId;

  // Attach to request object
  req.requestId = requestId;
  req.correlationId = correlationId;

  // Set response headers for client tracking
  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  // Run the rest of the request in this context
  withRequestContext(
    {
      requestId,
      correlationId,
    },
    () => {
      // Enrich context with user info after auth runs
      res.on("finish", () => {
        // Context cleanup happens automatically
      });
      next();
    }
  );
}

/**
 * Enrich the current request context with additional fields
 * Call this after authentication to add userId, etc.
 */
export function enrichRequestContext(req: Request): void {
  const user = (req as any).user;
  if (user) {
    enrichContext({
      userId: user.id,
    });
  }
}

/**
 * Get current request ID (for passing to external services)
 */
export function getCurrentRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Get current correlation ID (for passing to external services)
 */
export function getCurrentCorrelationId(): string | undefined {
  return getRequestContext()?.correlationId;
}
