// src/lib/logger.ts
// Centralized JSON logger with request ID tracing for PureTask backend

import { AsyncLocalStorage } from "async_hooks";

export type LogLevel = "info" | "warn" | "error" | "debug";

// ============================================
// Request Context (AsyncLocalStorage)
// ============================================

interface RequestContext {
  requestId: string;
  userId?: string;
  jobId?: string;
  cleanerId?: string;
  clientId?: string;
  stripeEventId?: string;
  workerName?: string;
  correlationId?: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function within a request context
 * All logs within this context will include the context fields
 */
export function withRequestContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const requestId = context.requestId || generateRequestId();
  return requestContext.run({ requestId, ...context }, fn);
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Add fields to the current request context
 */
export function enrichContext(fields: Partial<RequestContext>): void {
  const ctx = requestContext.getStore();
  if (ctx) {
    Object.assign(ctx, fields);
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

// ============================================
// Log Entry Types
// ============================================

interface LogEntry {
  level: LogLevel;
  msg: string;
  time: string;
  service: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  jobId?: string;
  cleanerId?: string;
  clientId?: string;
  stripeEventId?: string;
  workerName?: string;
  durationMs?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

// ============================================
// Core Logging Function
// ============================================

const SERVICE_NAME = process.env.SERVICE_NAME || "puretask-backend";

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const ctx = requestContext.getStore();

  const entry: LogEntry = {
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
      code: (meta.error as Error & { code?: string }).code,
    };
    delete entry.error; // Remove the raw error
    entry.error = {
      message: (meta.error as Error).message,
      stack: (meta.error as Error).stack,
      code: (meta.error as Error & { code?: string }).code,
    };
  }

  // Remove undefined values for cleaner output
  const cleanEntry = Object.fromEntries(
    Object.entries(entry).filter(([, v]) => v !== undefined)
  );

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

export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - start) / 1_000_000; // Return ms
}

// ============================================
// Structured Logger Export
// ============================================

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),

  /**
   * Log with timing - useful for measuring operation duration
   */
  timed: (msg: string, durationMs: number, meta?: Record<string, unknown>) =>
    log("info", msg, { ...meta, durationMs }),

  /**
   * Create a child logger with preset context
   */
  child: (context: Partial<RequestContext>) => ({
    info: (msg: string, meta?: Record<string, unknown>) =>
      log("info", msg, { ...context, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      log("warn", msg, { ...context, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) =>
      log("error", msg, { ...context, ...meta }),
    debug: (msg: string, meta?: Record<string, unknown>) =>
      log("debug", msg, { ...context, ...meta }),
  }),
};

// ============================================
// Specific Domain Loggers
// ============================================

export const stripeLogger = logger.child({ service: "stripe" } as Partial<RequestContext>);
export const workerLogger = (workerName: string) => logger.child({ workerName } as Partial<RequestContext>);
export const jobLogger = (jobId: string) => logger.child({ jobId } as Partial<RequestContext>);
