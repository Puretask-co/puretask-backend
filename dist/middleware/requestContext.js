"use strict";
// src/middleware/requestContext.ts
// Request context middleware for tracing
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = requestContextMiddleware;
exports.enrichRequestContext = enrichRequestContext;
exports.getCurrentRequestId = getCurrentRequestId;
exports.getCurrentCorrelationId = getCurrentCorrelationId;
const logger_1 = require("../lib/logger");
// Header names for request/correlation IDs
const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";
/**
 * Middleware to establish request context with tracing IDs
 * - Generates or uses existing request ID
 * - Propagates correlation ID for distributed tracing
 * - Makes IDs available in logger context
 */
function requestContextMiddleware(req, res, next) {
    // Get or generate request ID
    const requestId = req.headers[REQUEST_ID_HEADER] || (0, logger_1.generateRequestId)();
    // Get correlation ID (for cross-service tracing)
    const correlationId = req.headers[CORRELATION_ID_HEADER] || requestId;
    // Attach to request object
    req.requestId = requestId;
    req.correlationId = correlationId;
    // Set response headers for client tracking
    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    // Run the rest of the request in this context
    (0, logger_1.withRequestContext)({
        requestId,
        correlationId,
    }, () => {
        // Enrich context with user info after auth runs
        res.on("finish", () => {
            // Context cleanup happens automatically
        });
        next();
    });
}
/**
 * Enrich the current request context with additional fields
 * Call this after authentication to add userId, etc.
 */
function enrichRequestContext(req) {
    const user = req.user;
    if (user) {
        (0, logger_1.enrichContext)({
            userId: user.id,
        });
    }
}
/**
 * Get current request ID (for passing to external services)
 */
function getCurrentRequestId() {
    return (0, logger_1.getRequestContext)()?.requestId;
}
/**
 * Get current correlation ID (for passing to external services)
 */
function getCurrentCorrelationId() {
    return (0, logger_1.getRequestContext)()?.correlationId;
}
