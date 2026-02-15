// src/middleware/productionRateLimit.ts
// Production-ready rate limiting with Redis support (falls back to in-memory)

import { Request, Response, NextFunction } from "express";
import { getRedisClient, isRedisAvailable } from "../lib/redis";
import { logger } from "../lib/logger";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

interface InMemoryStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory fallback store
const inMemoryStore: InMemoryStore = {};

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Production-ready rate limiter with Redis support
 * Falls back to in-memory if Redis is unavailable
 */
export function productionRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
  } = options;

  // Cleanup in-memory store periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(inMemoryStore)) {
      if (inMemoryStore[key].resetTime < now) {
        delete inMemoryStore[key];
      }
    }
  }, windowMs);

  // Clear interval on process exit
  if (process.env.NODE_ENV !== "test") {
    process.on("SIGTERM", () => clearInterval(cleanupInterval));
    process.on("SIGINT", () => clearInterval(cleanupInterval));
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();

    try {
      if (isRedisAvailable()) {
        // Use Redis for distributed rate limiting
        const result = await rateLimitWithRedis(key, windowMs, maxRequests, now);
        handleRateLimitResult(result, maxRequests, message, res, next);
      } else {
        // Fall back to in-memory
        const result = rateLimitInMemory(key, windowMs, maxRequests, now);
        handleRateLimitResult(result, maxRequests, message, res, next);
      }
    } catch (error) {
      logger.error("rate_limit_error", {
        error: (error as Error).message,
        key,
      });
      // On error, allow the request (fail open)
      next();
    }

    // If skipSuccessfulRequests, decrement on successful response
    if (skipSuccessfulRequests) {
      res.on("finish", () => {
        if (res.statusCode < 400) {
          decrementRateLimit(key).catch((err) => {
            logger.error("rate_limit_decrement_failed", {
              error: err.message,
              key,
            });
          });
        }
      });
    }
  };
}

/**
 * Rate limiting using Redis
 */
async function rateLimitWithRedis(
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number
): Promise<{ count: number; resetTime: number }> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("Redis client not available");
  }

  const windowSeconds = Math.ceil(windowMs / 1000);

  // Use Redis pipeline for atomic operations
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds);

  const results = await multi.exec();
  const rawCount = results?.[0];
  const count = typeof rawCount === "number" ? rawCount : Number(rawCount ?? 0);

  // Get TTL to calculate reset time
  const ttl = await redis.ttl(key);
  const resetTime = ttl > 0 ? now + ttl * 1000 : now + windowMs;

  return { count, resetTime };
}

/**
 * Rate limiting using in-memory store
 */
function rateLimitInMemory(
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number
): { count: number; resetTime: number } {
  // Initialize or reset if window expired
  if (!inMemoryStore[key] || inMemoryStore[key].resetTime < now) {
    inMemoryStore[key] = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Increment count
  inMemoryStore[key].count++;

  return {
    count: inMemoryStore[key].count,
    resetTime: inMemoryStore[key].resetTime,
  };
}

/**
 * Handle rate limit result and send response
 */
function handleRateLimitResult(
  result: { count: number; resetTime: number },
  maxRequests: number,
  message: string,
  res: Response,
  next: NextFunction
): void {
  const { count, resetTime } = result;
  const remaining = Math.max(0, maxRequests - count);
  const now = Date.now();

  // Set rate limit headers (standard format)
  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

  if (count > maxRequests) {
    logger.warn("rate_limit_exceeded", {
      count,
      maxRequests,
      remaining,
    });

    res.setHeader("Retry-After", Math.ceil((resetTime - now) / 1000));

    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      },
    });
    return;
  }

  next();
}

/**
 * Decrement rate limit counter (for skipSuccessfulRequests)
 */
async function decrementRateLimit(key: string): Promise<void> {
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    if (redis) {
      await redis.decr(key);
    }
  } else if (inMemoryStore[key]) {
    inMemoryStore[key].count = Math.max(0, inMemoryStore[key].count - 1);
  }
}

/**
 * Export convenience rate limiters for common scenarios
 */
export const authRateLimiter = productionRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: "Too many auth attempts. Please try again later.",
});

export const apiRateLimiter = productionRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: "Too many API requests. Please slow down.",
});

export const strictRateLimiter = productionRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: "Too many requests. Please try again later.",
});
