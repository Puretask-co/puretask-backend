"use strict";
// src/lib/logger.ts
// Centralized JSON logger with request ID tracing for PureTask backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobLogger = exports.workerLogger = exports.stripeLogger = exports.logger = void 0;
exports.withRequestContext = withRequestContext;
exports.getRequestContext = getRequestContext;
exports.enrichContext = enrichContext;
exports.generateRequestId = generateRequestId;
exports.startTimer = startTimer;
const async_hooks_1 = require("async_hooks");
const requestContext = new async_hooks_1.AsyncLocalStorage();
/**
 * Run a function within a request context
 * All logs within this context will include the context fields
 */
function withRequestContext(context, fn) {
    const requestId = context.requestId || generateRequestId();
    return requestContext.run({ requestId, ...context }, fn);
}
/**
 * Get current request context
 */
function getRequestContext() {
    return requestContext.getStore();
}
/**
 * Add fields to the current request context
 */
function enrichContext(fields) {
    const ctx = requestContext.getStore();
    if (ctx) {
        Object.assign(ctx, fields);
    }
}
/**
 * Generate a unique request ID
 */
function generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `req_${timestamp}_${random}`;
}
// ============================================
// Core Logging Function
// ============================================
const SERVICE_NAME = process.env.SERVICE_NAME || "puretask-backend";
function log(level, msg, meta) {
    const ctx = requestContext.getStore();
    const entry = {
        level,
        msg,
        time: new Date().toISOString(),
        service: SERVICE_NAME,
        // Include context if available
        ...(ctx && {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            userId: ctx.userId,
            jobId: ctx.jobId,
            cleanerId: ctx.cleanerId,
            clientId: ctx.clientId,
            stripeEventId: ctx.stripeEventId,
            workerName: ctx.workerName,
        }),
        ...meta,
    };
    // Handle Error objects specially
    if (meta?.error instanceof Error) {
        entry.error = {
            message: meta.error.message,
            stack: meta.error.stack,
            code: meta.error.code,
        };
        delete entry.error; // Remove the raw error
        entry.error = {
            message: meta.error.message,
            stack: meta.error.stack,
            code: meta.error.code,
        };
    }
    // Remove undefined values for cleaner output
    const cleanEntry = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
    const output = JSON.stringify(cleanEntry);
    // Use appropriate console method based on level
    switch (level) {
        case "error":
            console.error(output);
            break;
        case "warn":
            console.warn(output);
            break;
        case "debug":
            if (process.env.NODE_ENV !== "production") {
                console.debug(output);
            }
            break;
        case "info":
        default:
            console.log(output);
            break;
    }
}
// ============================================
// Timer Utility for Performance Logging
// ============================================
function startTimer() {
    const start = process.hrtime.bigint();
    return () => Number(process.hrtime.bigint() - start) / 1000000; // Return ms
}
// ============================================
// Structured Logger Export
// ============================================
exports.logger = {
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
    debug: (msg, meta) => log("debug", msg, meta),
    /**
     * Log with timing - useful for measuring operation duration
     */
    timed: (msg, durationMs, meta) => log("info", msg, { ...meta, durationMs }),
    /**
     * Create a child logger with preset context
     */
    child: (context) => ({
        info: (msg, meta) => log("info", msg, { ...context, ...meta }),
        warn: (msg, meta) => log("warn", msg, { ...context, ...meta }),
        error: (msg, meta) => log("error", msg, { ...context, ...meta }),
        debug: (msg, meta) => log("debug", msg, { ...context, ...meta }),
    }),
};
// ============================================
// Specific Domain Loggers
// ============================================
exports.stripeLogger = exports.logger.child({ service: "stripe" });
const workerLogger = (workerName) => exports.logger.child({ workerName });
exports.workerLogger = workerLogger;
const jobLogger = (jobId) => exports.logger.child({ jobId });
exports.jobLogger = jobLogger;
