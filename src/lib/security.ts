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
export function getClientIp(req: Request): string {
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
 * 200 requests per 15 minutes per IP (testing-friendly)
 * Prevents brute-force login/registration attempts
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
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
// Fine-Grained Endpoint Rate Limiters
// ============================================

/**
 * Rate limit configuration per endpoint pattern
 */
export interface EndpointRateLimitConfig {
  pattern: RegExp | string;
  method?: string | string[];
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Default endpoint-specific rate limits
 */
export const endpointRateLimits: EndpointRateLimitConfig[] = [
  // Auth endpoints - relaxed for testing
  { pattern: /^\/auth\/login$/, method: "POST", windowMs: 15 * 60 * 1000, max: 200, message: "Too many login attempts" },
  { pattern: /^\/auth\/register$/, method: "POST", windowMs: 60 * 60 * 1000, max: 50, message: "Too many registration attempts" },
  
  // Payment endpoints - moderate
  { pattern: /^\/payments\/credits$/, method: "POST", windowMs: 60 * 1000, max: 10, message: "Too many payment requests" },
  { pattern: /^\/payments\/job\//, method: "POST", windowMs: 60 * 1000, max: 10, message: "Too many payment requests" },
  { pattern: /^\/jobs\/.*\/pay$/, method: "POST", windowMs: 60 * 1000, max: 10, message: "Too many payment requests" },
  
  // Job creation - moderate
  { pattern: /^\/jobs$/, method: "POST", windowMs: 60 * 1000, max: 20, message: "Too many job creation requests" },
  
  // Job transitions - moderate
  { pattern: /^\/jobs\/.*\/transition$/, method: "POST", windowMs: 60 * 1000, max: 30, message: "Too many transition requests" },
  
  // Admin endpoints - relaxed (trusted users)
  { pattern: /^\/admin\//, windowMs: 60 * 1000, max: 100, message: "Admin rate limit exceeded" },
  
  // Stripe webhooks - high throughput
  { pattern: /^\/stripe\/webhook$/, method: "POST", windowMs: 60 * 1000, max: 200, message: "Webhook rate limit exceeded" },
  
  // n8n webhooks (inbound) - moderate; both paths used by events router
  { pattern: /^\/n8n\/events$/, method: "POST", windowMs: 60 * 1000, max: 50, message: "n8n webhook rate limit exceeded" },
  { pattern: /^\/events$/, method: "POST", windowMs: 60 * 1000, max: 50, message: "n8n webhook rate limit exceeded" },

  // Read endpoints - relaxed
  { pattern: /^\/jobs$/, method: "GET", windowMs: 60 * 1000, max: 60, message: "Too many list requests" },
  { pattern: /^\/payments\/balance$/, method: "GET", windowMs: 60 * 1000, max: 60, message: "Too many balance requests" },
  { pattern: /^\/payments\/history$/, method: "GET", windowMs: 60 * 1000, max: 30, message: "Too many history requests" },
];

/**
 * Endpoint-specific rate limiter middleware
 * Applies different limits based on the endpoint pattern
 */
export function endpointRateLimiter(
  customLimits?: EndpointRateLimitConfig[]
) {
  const limits = customLimits || endpointRateLimits;
  
  // Create a bucket for each pattern
  const patternBuckets = new Map<string, Map<string, RateLimitBucket>>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;
    const method = req.method;
    
    // Find matching limit config
    const config = limits.find((limit) => {
      const patternMatch = typeof limit.pattern === "string"
        ? path === limit.pattern
        : limit.pattern.test(path);
      
      if (!patternMatch) return false;
      
      if (limit.method) {
        const methods = Array.isArray(limit.method) ? limit.method : [limit.method];
        return methods.includes(method);
      }
      
      return true;
    });
    
    // If no specific config, use general limiter
    if (!config) {
      return generalRateLimiter(req, res, next);
    }
    
    // Create bucket key
    const patternKey = config.pattern.toString();
    const clientKey = getClientIp(req);
    const bucketKey = `${patternKey}:${clientKey}`;
    
    // Get or create pattern bucket map
    if (!patternBuckets.has(patternKey)) {
      patternBuckets.set(patternKey, new Map());
    }
    const bucketMap = patternBuckets.get(patternKey)!;
    
    const now = Date.now();
    let bucket = bucketMap.get(clientKey);
    
    if (!bucket) {
      bucket = { count: 1, firstRequestAt: now };
      bucketMap.set(clientKey, bucket);
      
      res.setHeader("X-RateLimit-Limit", config.max);
      res.setHeader("X-RateLimit-Remaining", config.max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + config.windowMs) / 1000));
      
      next();
      return;
    }
    
    const elapsed = now - bucket.firstRequestAt;
    
    if (elapsed > config.windowMs) {
      bucket.count = 1;
      bucket.firstRequestAt = now;
      
      res.setHeader("X-RateLimit-Limit", config.max);
      res.setHeader("X-RateLimit-Remaining", config.max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + config.windowMs) / 1000));
      
      next();
      return;
    }
    
    bucket.count += 1;
    const remaining = Math.max(0, config.max - bucket.count);
    const resetTime = Math.ceil((bucket.firstRequestAt + config.windowMs) / 1000);
    
    res.setHeader("X-RateLimit-Limit", config.max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);
    
    if (bucket.count > config.max) {
      logger.warn("endpoint_rate_limited", {
        ip: clientKey,
        path,
        method,
        pattern: patternKey,
        count: bucket.count,
        max: config.max,
      });
      
      res.setHeader("Retry-After", Math.ceil((bucket.firstRequestAt + config.windowMs - now) / 1000));
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: config.message || "Too many requests",
          retryAfter: Math.ceil((bucket.firstRequestAt + config.windowMs - now) / 1000),
        },
      });
      return;
    }
    
    next();
  };
}

/**
 * User-based rate limiter (uses user ID instead of IP)
 * Better for authenticated endpoints
 */
export function userRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  return createRateLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use user ID if available, fall back to IP
      const userId = (req as any).user?.id;
      if (userId) return `user:${userId}`;
      return `ip:${getClientIp(req)}`;
    },
  });
}

/**
 * Combined IP + User rate limiter
 * Limits both per-IP and per-user
 */
export function combinedRateLimiter(options: {
  ipWindowMs: number;
  ipMax: number;
  userWindowMs: number;
  userMax: number;
  message?: string;
}) {
  const ipLimiter = createRateLimiter({
    windowMs: options.ipWindowMs,
    max: options.ipMax,
    message: options.message,
  });
  
  const userLimiter = userRateLimiter({
    windowMs: options.userWindowMs,
    max: options.userMax,
    message: options.message,
  });
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // First check IP limit
    ipLimiter(req, res, (err) => {
      if (err || res.headersSent) return;
      // Then check user limit
      userLimiter(req, res, next);
    });
  };
}

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
 * Sanitize request body (remove prototype pollution vectors and sanitize strings)
 */
export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    // Remove dangerous keys (prototype pollution prevention)
    delete req.body.__proto__;
    delete req.body.constructor;
    delete req.body.prototype;
    
    // Import sanitization utilities
    const { sanitizeObject } = require("./sanitization");
    
    // Sanitize string values in body
    req.body = sanitizeObject(req.body, {
      allowHtml: false, // Don't allow HTML in request bodies
      maxDepth: 10,
    });
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

