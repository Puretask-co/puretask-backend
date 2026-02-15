// src/lib/response.ts
// Standardized response helpers

import { Response, Request } from "express";

// ============================================
// Success Responses
// ============================================

/**
 * Send successful response with data wrapper
 *
 * Usage:
 * sendSuccess(res, { user: ... });
 * sendSuccess(res, users, { pagination: ... });
 */
export function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
  const response: any = {
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  // Include requestId if available
  const requestId = (res as any).requestId || (res.locals as any)?.requestId;
  if (requestId) {
    response.requestId = requestId;
  }

  return res.json(response);
}

/**
 * Send paginated success response
 *
 * Usage:
 * sendPaginatedSuccess(res, items, total, limit, offset);
 */
export function sendPaginatedSuccess<T>(
  res: Response,
  items: T[],
  total: number,
  limit: number,
  offset: number
): Response {
  const requestId = (res as any).requestId || (res.locals as any)?.requestId;

  return res.json({
    data: items,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    },
    ...(requestId ? { requestId } : {}),
  });
}

/**
 * Send created response (201)
 */
export function sendCreated<T>(res: Response, data: T, location?: string): Response {
  if (location) {
    res.location(location);
  }

  const requestId = (res as any).requestId || (res.locals as any)?.requestId;

  return res.status(201).json({
    data,
    ...(requestId ? { requestId } : {}),
  });
}

/**
 * Send no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

// ============================================
// Error Responses (delegates to errors.ts)
// ============================================

// Error responses are handled by sendError() in errors.ts
// which already includes requestId
