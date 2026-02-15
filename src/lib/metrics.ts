// src/lib/metrics.ts
// Basic metrics collection for monitoring

import { logger } from "./logger";

export interface MetricTags {
  [key: string]: string | number | boolean;
}

/**
 * Record a metric value
 * In production, this would send to a metrics service (Datadog, Prometheus, etc.)
 * For now, we log metrics which can be scraped or sent to a service later
 */
export function recordMetric(name: string, value: number, tags?: MetricTags): void {
  logger.info("metric", {
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment a counter metric
 */
export function incrementCounter(name: string, tags?: MetricTags): void {
  recordMetric(name, 1, tags);
}

/**
 * Record a timing/duration metric (in milliseconds)
 */
export function recordTiming(name: string, durationMs: number, tags?: MetricTags): void {
  recordMetric(name, durationMs, { ...tags, unit: "ms" });
}

/**
 * Common metrics helpers
 */
export const metrics = {
  // API metrics
  apiRequest: (method: string, path: string, statusCode: number, durationMs: number) => {
    recordTiming("api.request.duration", durationMs, {
      method,
      path,
      status: statusCode,
      statusClass: `${Math.floor(statusCode / 100)}xx`,
    });
    incrementCounter("api.request.count", {
      method,
      path,
      status: statusCode,
    });
  },

  // Database metrics
  dbQuery: (operation: string, durationMs: number, success: boolean) => {
    recordTiming("db.query.duration", durationMs, {
      operation,
      success: success.toString(),
    });
    incrementCounter("db.query.count", {
      operation,
      success: success.toString(),
    });
  },

  // Job metrics
  jobCreated: (jobId: string) => {
    incrementCounter("job.created", { jobId });
  },

  jobCompleted: (jobId: string, durationHours: number) => {
    incrementCounter("job.completed", { jobId });
    recordMetric("job.duration", durationHours, { unit: "hours" });
  },

  // Payment metrics
  paymentProcessed: (amountCents: number, success: boolean) => {
    incrementCounter("payment.processed", {
      success: success.toString(),
    });
    recordMetric("payment.amount", amountCents, { unit: "cents" });
  },

  // Payout metrics
  payoutProcessed: (amountCents: number, success: boolean) => {
    incrementCounter("payout.processed", {
      success: success.toString(),
    });
    recordMetric("payout.amount", amountCents, { unit: "cents" });
  },

  // Error metrics
  errorOccurred: (errorCode: string, path?: string) => {
    incrementCounter("error.count", {
      code: errorCode,
      path: path || "unknown",
    });
  },
};
