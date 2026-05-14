// src/lib/rateLimitRedis.ts
// Redis-based rate limiting for production (falls back to in-memory if Redis unavailable)

import { Request, Response, NextFunction } from "express";
import { getRedisClient, isRedisAvailable } from "./redis";
import { logger } from "./logger";
import { createRateLimiter, getClientIp } from "./security";
import { env } from "../config/env";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skip?: (req: Request) => boolean;
}

/**
 * Whether rate limiting should fail closed (503) when Redis is unreachable
 * instead of silently falling back to per-instance memory limits.
 *
 * Per-instance fallback in production with N replicas gives an attacker N×
 * the budget. In production with Redis-mode enabled, refuse to serve rather
 * than silently degrade.
 *
 * See docs/active/AUDIT_REANALYSIS_2026-05-13.md § B.4.
 */
function shouldFailClosed(): boolean {
  return env.NODE_ENV === "production" && env.USE_REDIS_RATE_LIMITING === true;
}

let lastRedisErrorLoggedAt = 0;
function reportRedisDegradation(reason: string, extra: Record<string, unknown> = {}): void {
  // Log at most once per minute to avoid Sentry noise during sustained outages.
  const now = Date.now();
  if (now - lastRedisErrorLoggedAt < 60_000) return;
  lastRedisErrorLoggedAt = now;
  logger.error("rate_limit_redis_unavailable", { reason, ...extra });
}

function sendUnavailable(res: Response, message: string): void {
  res.setHeader("Retry-After", "10");
  res.status(503).json({
    error: {
      code: "RATE_LIMIT_BACKEND_UNAVAILABLE",
      message,
    },
  });
}

/**
 * Redis-based rate limiter using sliding window log algorithm
 * Falls back to in-memory limiter if Redis is unavailable
 */
export function createRedisRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = getClientIp,
    message = "Too many requests. Please slow down.",
    skipSuccessfulRequests = false,
    skip,
  } = options;

  // At-startup decision: if Redis isn't configured/available and we're NOT
  // in production-fail-closed mode, use the in-memory limiter for the
  // lifetime of the limiter. In production with USE_REDIS_RATE_LIMITING=true,
  // we instead let every request reach the runtime Redis check so a transient
  // outage results in 503 rather than silent per-instance fallback.
  if (!isRedisAvailable() || !process.env.USE_REDIS_RATE_LIMITING) {
    if (shouldFailClosed()) {
      reportRedisDegradation("Redis not available at limiter init in production");
      return async (_req: Request, res: Response): Promise<void> => {
        sendUnavailable(res, message);
      };
    }
    logger.debug("rate_limit_using_memory", { reason: "Redis not available" });
    return createRateLimiter(options);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if configured
    if (skip && skip(req)) {
      return next();
    }

    const redis = getRedisClient();
    if (!redis) {
      if (shouldFailClosed()) {
        reportRedisDegradation("Redis client missing at request time", { path: req.path });
        sendUnavailable(res, message);
        return;
      }
      // Dev/non-fail-closed: fall back to in-memory
      return createRateLimiter(options)(req, res, next);
    }

    const key = `rate_limit:${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use Redis sorted set for sliding window
      // Key: rate_limit:{identifier}
      // Score: timestamp
      // Value: request ID (unique per request)

      // Remove old entries outside window
      await redis.zRemRangeByScore(key, 0, windowStart);

      // Count current requests in window
      const count = await redis.zCard(key);

      // Calculate remaining requests
      const remaining = Math.max(0, max - count);
      const resetTime = Math.ceil((now + windowMs) / 1000);

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", resetTime);

      // Check if limit exceeded
      if (count >= max) {
        logger.warn("rate_limit_exceeded_redis", {
          key: keyGenerator(req),
          path: req.path,
          method: req.method,
          count,
          max,
        });

        res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
        res.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message,
            retryAfter: Math.ceil(windowMs / 1000),
          },
        });
        return;
      }

      // Add current request to sorted set
      const requestId = `${now}-${Math.random()}`;
      await redis.zAdd(key, {
        score: now,
        value: requestId,
      });

      // Set expiration on the key (windowMs + buffer)
      await redis.expire(key, Math.ceil(windowMs / 1000) + 60);

      // If skipSuccessfulRequests, remove on successful response
      if (skipSuccessfulRequests) {
        res.on("finish", () => {
          void (async () => {
            if (res.statusCode < 400) {
              try {
                await redis.zRem(key, requestId);
              } catch (err) {
                logger.error("rate_limit_redis_cleanup_failed", {
                  error: (err as Error).message,
                });
              }
            }
          })();
        });
      }

      next();
    } catch (error) {
      if (shouldFailClosed()) {
        reportRedisDegradation("Redis call failed at request time", {
          path: req.path,
          error: (error as Error).message,
        });
        sendUnavailable(res, message);
        return;
      }
      // Dev/non-fail-closed: fall back to in-memory limiter
      logger.error("rate_limit_redis_error", {
        error: (error as Error).message,
        fallingBack: true,
      });
      return createRateLimiter(options)(req, res, next);
    }
  };
}

/**
 * User-based rate limiter using Redis
 * Uses user ID instead of IP for authenticated endpoints
 */
export function createRedisUserRateLimiter(options: RateLimitOptions) {
  return createRedisRateLimiter({
    ...options,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      if (userId) {
        return `user:${userId}`;
      }
      return getClientIp(req);
    },
  });
}

/**
 * Production-ready general rate limiter
 * Uses Redis if available, falls back to in-memory
 */
export const productionGeneralRateLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: "Too many requests. Please slow down.",
});

/**
 * Production-ready auth rate limiter
 * Stricter limits for authentication endpoints
 */
export const productionAuthRateLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: "Too many authentication attempts. Please try again later.",
});

/**
 * Production-ready endpoint-specific rate limiter
 * Can be configured per endpoint pattern
 */
export function createProductionEndpointRateLimiter(
  pattern: string | RegExp,
  options: RateLimitOptions
) {
  return createRedisRateLimiter({
    ...options,
    keyGenerator: (req: Request) => {
      const patternStr = typeof pattern === "string" ? pattern : pattern.toString();
      const clientKey = getClientIp(req);
      return `${patternStr}:${clientKey}`;
    },
  });
}
