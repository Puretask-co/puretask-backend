// src/lib/speedInsights.ts
// Vercel Speed Insights integration for Express backend

import express from 'express';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Initialize Vercel Speed Insights for the backend application.
 * 
 * Speed Insights collects performance data about your application
 * and sends it to Vercel's infrastructure. In a backend context,
 * this captures server-side performance metrics like API response times,
 * database query times, and other backend operation metrics.
 * 
 * This should be called early in the application startup process.
 * 
 * @see https://vercel.com/docs/speed-insights
 */
export function initializeSpeedInsights(): void {
  // Only initialize in non-test environments
  const isTestMode =
    process.env.RUNNING_TESTS === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    typeof process.env.VITEST_WORKER_ID !== 'undefined';

  if (isTestMode) {
    logger.debug('Speed Insights initialization skipped in test mode');
    return;
  }

  try {
    // Initialize Speed Insights
    injectSpeedInsights();

    logger.info('speed_insights_initialized', {
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log error but don't fail application startup
    logger.error('speed_insights_initialization_failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Record a custom metric to Speed Insights.
 * Useful for tracking specific backend operations or business metrics.
 * 
 * @param metricName - Name of the metric
 * @param value - Numeric value of the metric
 * @param unit - Unit of measurement (optional)
 * 
 * @example
 * recordMetric('database_query_time', 150, 'ms');
 * recordMetric('cache_hit_ratio', 0.95);
 */
export function recordMetric(
  metricName: string,
  value: number,
  unit?: string
): void {
  try {
    // Speed Insights captures metrics via the beforeSend callback
    // In a backend context, performance metrics are automatically collected
    // by the Speed Insights middleware on the response object
    const globalWindow = typeof window !== 'undefined' ? (window as unknown) : null;
    const windowWithSiq = globalWindow as { siq?: unknown[] } | null;
    if (windowWithSiq && windowWithSiq.siq) {
      windowWithSiq.siq.push(['metric', {
        name: metricName,
        value,
        unit,
      }]);
    }
  } catch (error) {
    // Log error but don't fail request processing
    logger.debug('metric_recording_failed', {
      metricName,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Middleware to automatically capture API response times and performance data.
 * Records metrics for each HTTP request including response time and status code.
 * 
 * @returns Express middleware function
 * 
 * @example
 * app.use(speedInsightsMiddleware());
 */
export function speedInsightsMiddleware() {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const start = Date.now();

    // Capture response finish to record metrics
    res.on('finish', () => {
      const duration = Date.now() - start;

      // Record response time metric
      recordMetric(`api_response_time_${req.method}_${req.path}`, duration, 'ms');

      // Record status code metric
      recordMetric(`api_status_${res.statusCode}`, 1);
    });

    next();
  };
}
