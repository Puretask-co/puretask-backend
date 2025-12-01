// src/middleware/rateLimit.ts
// Simple in-memory rate limiting middleware

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
}

const stores: Map<string, RateLimitStore> = new Map();

/**
 * Create a rate limiter middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
    skip,
  } = options;

  // Create a unique store for this limiter
  const storeId = `${Date.now()}-${Math.random()}`;
  stores.set(storeId, {});

  // Cleanup old entries periodically
  const cleanup = () => {
    const store = stores.get(storeId);
    if (!store) return;

    const now = Date.now();
    for (const key of Object.keys(store)) {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    }
  };

  setInterval(cleanup, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (skip && skip(req)) {
      return next();
    }

    const store = stores.get(storeId);
    if (!store) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment count
    store[key].count++;

    // Calculate remaining
    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetTime = store[key].resetTime;

    // Set headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

    // Check if over limit
    if (store[key].count > maxRequests) {
      logger.warn("rate_limit_exceeded", {
        key,
        count: store[key].count,
        maxRequests,
        ip: req.ip,
        path: req.path,
      });

      res.setHeader("Retry-After", Math.ceil((resetTime - now) / 1000));

      return res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          retryAfter: Math.ceil((resetTime - now) / 1000),
        },
      });
    }

    // If skipSuccessfulRequests, decrement on successful response
    if (skipSuccessfulRequests) {
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        if (res.statusCode < 400) {
          store[key].count--;
        }
        return originalEnd.apply(this, args);
      };
    }

    next();
  };
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Get IP from various headers (for proxies)
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded?.[0]) ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";

  return ip;
}

/**
 * Key generator that uses user ID + IP
 */
export function userKeyGenerator(req: Request): string {
  const ip = defaultKeyGenerator(req);
  const userId = (req as any).user?.id || "anonymous";
  return `${userId}:${ip}`;
}

// Pre-configured rate limiters

/**
 * Strict rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true,
});

/**
 * Standard API rate limit
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyGenerator: userKeyGenerator,
});

/**
 * Relaxed rate limit for read operations
 */
export const readRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300, // 300 requests per minute
  keyGenerator: userKeyGenerator,
});

/**
 * Strict rate limit for expensive operations
 */
export const expensiveRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyGenerator: userKeyGenerator,
  message: "This operation is rate limited, please try again later",
});

