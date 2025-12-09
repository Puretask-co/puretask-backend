"use strict";
// src/middleware/rateLimit.ts
// Simple in-memory rate limiting middleware
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensiveRateLimit = exports.readRateLimit = exports.apiRateLimit = exports.authRateLimit = void 0;
exports.rateLimit = rateLimit;
exports.userKeyGenerator = userKeyGenerator;
const logger_1 = require("../lib/logger");
const stores = new Map();
/**
 * Create a rate limiter middleware
 */
function rateLimit(options) {
    const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator, message = "Too many requests, please try again later", skipSuccessfulRequests = false, skip, } = options;
    // Create a unique store for this limiter
    const storeId = `${Date.now()}-${Math.random()}`;
    stores.set(storeId, {});
    // Cleanup old entries periodically
    const cleanup = () => {
        const store = stores.get(storeId);
        if (!store)
            return;
        const now = Date.now();
        for (const key of Object.keys(store)) {
            if (store[key].resetTime < now) {
                delete store[key];
            }
        }
    };
    setInterval(cleanup, windowMs);
    return (req, res, next) => {
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
            logger_1.logger.warn("rate_limit_exceeded", {
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
            const originalEnd = res.end.bind(res);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.end = function (chunk, encoding, callback) {
                if (res.statusCode < 400) {
                    store[key].count--;
                }
                if (typeof encoding === 'function') {
                    return originalEnd(chunk, encoding);
                }
                if (encoding) {
                    return originalEnd(chunk, encoding, callback);
                }
                return originalEnd(chunk, callback);
            };
        }
        next();
    };
}
/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req) {
    // Get IP from various headers (for proxies)
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded?.[0]) ||
        req.ip ||
        req.socket.remoteAddress ||
        "unknown";
    return ip;
}
/**
 * Key generator that uses user ID + IP
 */
function userKeyGenerator(req) {
    const ip = defaultKeyGenerator(req);
    const userId = req.user?.id || "anonymous";
    return `${userId}:${ip}`;
}
// Pre-configured rate limiters
/**
 * Strict rate limit for auth endpoints
 */
exports.authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 attempts per 15 minutes
    message: "Too many authentication attempts, please try again later",
    skipSuccessfulRequests: true,
});
/**
 * Standard API rate limit
 */
exports.apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    keyGenerator: userKeyGenerator,
});
/**
 * Relaxed rate limit for read operations
 */
exports.readRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // 300 requests per minute
    keyGenerator: userKeyGenerator,
});
/**
 * Strict rate limit for expensive operations
 */
exports.expensiveRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    keyGenerator: userKeyGenerator,
    message: "This operation is rate limited, please try again later",
});
