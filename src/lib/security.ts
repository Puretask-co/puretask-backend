// src/lib/security.ts
// Security middleware: rate limiting, request validation

import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// ============================================
// Rate Limiting (In-Memory)
// ============================================

interface RateLimitBucket {
  count: number;
  firstRequestAt: number;
}

// Global buckets map (in production, use Redis)
const buckets = new Map<string, RateLimitBucket>();

// Cleanup old buckets periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.firstRequestAt > maxAge) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Get client IP address (handles proxies)
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Create a rate limiter middleware
 * @param options.windowMs - Time window in milliseconds
 * @param options.max - Maximum requests per window
 * @param options.keyGenerator - Optional function to generate bucket key (defaults to IP)
 * @param options.message - Custom error message
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) {
  const {
    windowMs,
    max,
    keyGenerator = getClientIp,
    message = "Too many requests. Please slow down.",
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket) {
      // First request from this key
      bucket = { count: 1, firstRequestAt: now };
      buckets.set(key, bucket);
      
      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      
      next();
      return;
    }

    const elapsed = now - bucket.firstRequestAt;

    if (elapsed > windowMs) {
      // Window expired, reset
      bucket.count = 1;
      bucket.firstRequestAt = now;
      
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const resetTime = Math.ceil((bucket.firstRequestAt + windowMs) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);

    if (bucket.count > max) {
      logger.warn("rate_limited", {
        ip: key,
        path: req.path,
        method: req.method,
        count: bucket.count,
        max,
      });

      res.setHeader("Retry-After", Math.ceil((bucket.firstRequestAt + windowMs - now) / 1000));
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message,
          retryAfter: Math.ceil((bucket.firstRequestAt + windowMs - now) / 1000),
        },
      });
      return;
    }

    next();
  };
}

// ============================================
// Pre-configured Rate Limiters
// ============================================

/**
 * General API rate limiter
 * 300 requests per 15 minutes per IP
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: "Too many requests. Please slow down.",
});

/**
 * Auth endpoints rate limiter (stricter)
 * 20 requests per 15 minutes per IP
 * Prevents brute-force login/registration attempts
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
});

/**
 * Stripe webhook rate limiter
 * 100 requests per minute (Stripe can burst)
 */
export const stripeWebhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many webhook requests.",
});

/**
 * Password reset rate limiter (very strict)
 * 5 requests per hour per IP
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many password reset attempts. Please try again later.",
});

// ============================================
// Request Validation
// ============================================

/**
 * Validate Content-Type header for JSON endpoints
 */
export function requireJsonContentType(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === "GET" || req.method === "DELETE" || req.method === "OPTIONS") {
    next();
    return;
  }

  const contentType = req.headers["content-type"];
  if (!contentType || !contentType.includes("application/json")) {
    res.status(415).json({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json",
      },
    });
    return;
  }

  next();
}

/**
 * Sanitize request body (remove prototype pollution vectors)
 */
export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    // Remove dangerous keys
    delete req.body.__proto__;
    delete req.body.constructor;
    delete req.body.prototype;
  }
  next();
}

// ============================================
// Security Headers (additional to helmet)
// ============================================

/**
 * Add custom security headers
 */
export function additionalSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent caching of sensitive data
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  next();
}

