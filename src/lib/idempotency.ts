// src/lib/idempotency.ts
// Idempotency-Key header support for API endpoints (audit B4: optional request body hash)

import crypto from "crypto";
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
  request_body_hash?: string | null;
}

function hashBody(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  const str = typeof body === "string" ? body : JSON.stringify(body);
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Store idempotency result (audit B4: optional request_body_hash)
 */
async function storeIdempotencyResult(
  key: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseBody: any,
  requestBodyHash?: string | null
): Promise<void> {
  try {
    try {
      await query(
        `INSERT INTO idempotency_keys (idempotency_key, endpoint, method, status_code, response_body, request_body_hash, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [key, endpoint, method, statusCode, JSON.stringify(responseBody), requestBodyHash ?? null]
      );
    } catch (colError: any) {
      if (colError?.code === "42703") {
        await query(
          `INSERT INTO idempotency_keys (idempotency_key, endpoint, method, status_code, response_body, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [key, endpoint, method, statusCode, JSON.stringify(responseBody)]
        );
      } else throw colError;
    }
  } catch (error) {
    logger.error("idempotency_store_failed", { key, error: (error as Error).message });
  }
}

/**
 * Get idempotency result (includes request_body_hash when column exists, e.g. after migration 065)
 */
async function getIdempotencyResult(key: string): Promise<IdempotencyRecord | null> {
  try {
    let result: { rows: (IdempotencyRecord & { request_body_hash?: string | null })[] };
    try {
      result = await query<IdempotencyRecord & { request_body_hash?: string | null }>(
        `SELECT idempotency_key as id, endpoint, method, status_code, response_body, request_body_hash, created_at
         FROM idempotency_keys WHERE idempotency_key = $1 LIMIT 1`,
        [key]
      );
    } catch (colError: any) {
      if (colError?.code === "42703") {
        result = await query<IdempotencyRecord>(
          `SELECT idempotency_key as id, endpoint, method, status_code, response_body, created_at
           FROM idempotency_keys WHERE idempotency_key = $1 LIMIT 1`,
          [key]
        );
        (result as any).rows = result.rows.map((r) => ({ ...r, request_body_hash: undefined }));
      } else throw colError;
    }
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      request_body_hash: (row as any).request_body_hash ?? undefined,
      response_body:
        typeof row.response_body === "string" ? JSON.parse(row.response_body) : row.response_body,
    };
  } catch (error) {
    logger.error("idempotency_get_failed", { key, error: (error as Error).message });
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

  const bodyHash = hashBody(req.body);

  getIdempotencyResult(idempotencyKey)
    .then((existing) => {
      if (existing) {
        // Audit B4: reject same key with different body when stored hash exists
        if (existing.request_body_hash && bodyHash !== null && existing.request_body_hash !== bodyHash) {
          logger.warn("idempotency_key_body_mismatch", {
            key: idempotencyKey,
            endpoint: req.path,
          });
          sendError(res, {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Idempotency-Key was used with a different request body. Use a new key or the same body.",
            statusCode: 409,
          } as any);
          return;
        }

        logger.info("idempotency_key_reused", {
          key: idempotencyKey,
          endpoint: req.path,
          originalStatus: existing.status_code,
        });
        res.status(existing.status_code).json(existing.response_body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        storeIdempotencyResult(
          idempotencyKey,
          req.path,
          req.method,
          res.statusCode || 200,
          body,
          bodyHash
        ).catch((err) => {
          logger.error("idempotency_store_error", {
            key: idempotencyKey,
            error: err.message,
          });
        });
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
