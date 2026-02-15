// src/lib/idempotency.ts
// Idempotency-Key header support for API endpoints

import { Request, Response, NextFunction } from "express";
import { query } from "../db/client";
import { logger } from "./logger";
import { sendError } from "./errors";
import { ErrorCode } from "./errors";

// ============================================
// Idempotency Storage
// ============================================

interface IdempotencyRecord {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_body: any;
  created_at: string;
}

/**
 * Store idempotency result
 */
async function storeIdempotencyResult(
  key: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseBody: any
): Promise<void> {
  try {
    await query(
      `
        INSERT INTO idempotency_keys (idempotency_key, endpoint, method, status_code, response_body, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        ON CONFLICT (idempotency_key) DO NOTHING
      `,
      [key, endpoint, method, statusCode, JSON.stringify(responseBody)]
    );
  } catch (error) {
    logger.error("idempotency_store_failed", {
      key,
      error: (error as Error).message,
    });
    // Don't throw - idempotency is best-effort
  }
}

/**
 * Get idempotency result
 */
async function getIdempotencyResult(key: string): Promise<IdempotencyRecord | null> {
  try {
    const result = await query<IdempotencyRecord>(
      `
        SELECT idempotency_key as id, endpoint, method, status_code, response_body, created_at
        FROM idempotency_keys
        WHERE idempotency_key = $1
        LIMIT 1
      `,
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      ...result.rows[0],
      response_body:
        typeof result.rows[0].response_body === "string"
          ? JSON.parse(result.rows[0].response_body)
          : result.rows[0].response_body,
    };
  } catch (error) {
    logger.error("idempotency_get_failed", {
      key,
      error: (error as Error).message,
    });
    return null;
  }
}

// ============================================
// Middleware
// ============================================

/**
 * Middleware to handle Idempotency-Key header
 *
 * If the same key is used again, returns the previous response.
 * Otherwise, stores the response for future requests.
 *
 * Usage:
 * router.post('/jobs', requireIdempotency, async (req, res) => {
 *   // Your handler
 * });
 */
export function requireIdempotency(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers["idempotency-key"] as string;

  if (!idempotencyKey) {
    return next(); // No key provided, proceed normally
  }

  // Validate key format (alphanumeric, dashes, underscores, max 255 chars)
  if (!/^[a-zA-Z0-9_-]{1,255}$/.test(idempotencyKey)) {
    return sendError(res, {
      code: ErrorCode.VALIDATION_ERROR,
      message:
        "Invalid Idempotency-Key format. Must be alphanumeric with dashes/underscores, max 255 characters.",
      statusCode: 400,
    } as any);
  }

  // Check for existing result
  getIdempotencyResult(idempotencyKey)
    .then((existing) => {
      if (existing) {
        logger.info("idempotency_key_reused", {
          key: idempotencyKey,
          endpoint: req.path,
          originalStatus: existing.status_code,
        });

        // Return previous response
        res.status(existing.status_code).json(existing.response_body);
        return; // Don't call next() - response already sent
      }

      // No existing result, proceed with request
      // Store original json method to intercept response
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Store result before sending
        storeIdempotencyResult(
          idempotencyKey,
          req.path,
          req.method,
          res.statusCode || 200,
          body
        ).catch((err) => {
          logger.error("idempotency_store_error", {
            key: idempotencyKey,
            error: err.message,
          });
        });

        // Send response
        return originalJson(body);
      };

      next();
    })
    .catch((error) => {
      logger.error("idempotency_check_failed", {
        key: idempotencyKey,
        error: error.message,
      });
      // On error, proceed without idempotency (fail open)
      next();
    });
}

/**
 * Optional idempotency (doesn't require key, but uses it if provided)
 */
export function optionalIdempotency(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers["idempotency-key"] as string;

  if (!idempotencyKey) {
    return next(); // No key, proceed normally
  }

  // If key provided, use full idempotency
  requireIdempotency(req, res, next);
}
