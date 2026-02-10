// src/lib/workerMetrics.ts
// Worker observability: metrics and alerts

import { query } from "../db/client";
import { logger } from "./logger";
import { queueService } from "./queue";

// ============================================
// Metrics Collection
// ============================================

export interface WorkerMetrics {
  timestamp: string;
  jobQueue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
  };
  workerRuns: {
    running: number;
    success: number;
    failed: number;
    expired: number;
  };
  stuckJobs: number;
  deadLetterJobs: number;
}

/**
 * Collect current worker metrics
 */
export async function collectWorkerMetrics(): Promise<WorkerMetrics> {
  const jobQueueStats = await queueService.getQueueStats();

  // Get worker run stats
  const workerRunStats = await query<{
    running: string;
    success: string;
    failed: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'running')::text as running,
        COUNT(*) FILTER (WHERE status = 'success' AND finished_at > NOW() - INTERVAL '24 hours')::text as success,
        COUNT(*) FILTER (WHERE status = 'failed' AND finished_at > NOW() - INTERVAL '24 hours')::text as failed
      FROM worker_runs
    `
  );

  const row = workerRunStats.rows[0];

  // Get stuck jobs count
  const stuckJobsResult = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text as count
      FROM job_queue
      WHERE status = 'processing'
        AND locked_at < NOW() - INTERVAL '30 minutes'
    `
  );

  // Get dead-letter count
  const deadLetterResult = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text as count
      FROM job_queue
      WHERE status = 'dead'
    `
  );

  return {
    timestamp: new Date().toISOString(),
    jobQueue: jobQueueStats,
    workerRuns: {
      running: Number(row?.running || 0),
      success: Number(row?.success || 0),
      failed: Number(row?.failed || 0),
      expired: 0, // Calculated separately
    },
    stuckJobs: Number(stuckJobsResult.rows[0]?.count || 0),
    deadLetterJobs: Number(deadLetterResult.rows[0]?.count || 0),
  };
}

// ============================================
// Alerting
// ============================================

export interface AlertThresholds {
  maxStuckJobs: number;
  maxDeadLetterJobs: number;
  maxFailedWorkerRuns: number;
  maxPendingJobs: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  maxStuckJobs: 10,
  maxDeadLetterJobs: 50,
  maxFailedWorkerRuns: 5,
  maxPendingJobs: 1000,
};

/**
 * Check metrics against thresholds and emit alerts
 */
export async function checkWorkerAlerts(
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<string[]> {
  const metrics = await collectWorkerMetrics();
  const alerts: string[] = [];

  // Check stuck jobs
  if (metrics.stuckJobs > thresholds.maxStuckJobs) {
    const alert = `ALERT: ${metrics.stuckJobs} stuck jobs detected (threshold: ${thresholds.maxStuckJobs})`;
    alerts.push(alert);
    logger.error("worker_alert_stuck_jobs", {
      count: metrics.stuckJobs,
      threshold: thresholds.maxStuckJobs,
    });
  }

  // Check dead-letter queue
  if (metrics.deadLetterJobs > thresholds.maxDeadLetterJobs) {
    const alert = `ALERT: ${metrics.deadLetterJobs} dead-letter jobs (threshold: ${thresholds.maxDeadLetterJobs})`;
    alerts.push(alert);
    logger.error("worker_alert_dead_letter", {
      count: metrics.deadLetterJobs,
      threshold: thresholds.maxDeadLetterJobs,
    });
  }

  // Check failed worker runs
  if (metrics.workerRuns.failed > thresholds.maxFailedWorkerRuns) {
    const alert = `ALERT: ${metrics.workerRuns.failed} failed worker runs in last 24h (threshold: ${thresholds.maxFailedWorkerRuns})`;
    alerts.push(alert);
    logger.error("worker_alert_failed_runs", {
      count: metrics.workerRuns.failed,
      threshold: thresholds.maxFailedWorkerRuns,
    });
  }

  // Check pending jobs backlog
  if (metrics.jobQueue.pending > thresholds.maxPendingJobs) {
    const alert = `ALERT: ${metrics.jobQueue.pending} pending jobs (threshold: ${thresholds.maxPendingJobs})`;
    alerts.push(alert);
    logger.error("worker_alert_pending_backlog", {
      count: metrics.jobQueue.pending,
      threshold: thresholds.maxPendingJobs,
    });
  }

  return alerts;
}

/**
 * Get worker health status
 */
export async function getWorkerHealth(): Promise<{
  healthy: boolean;
  metrics: WorkerMetrics;
  alerts: string[];
}> {
  const metrics = await collectWorkerMetrics();
  const alerts = await checkWorkerAlerts();

  return {
    healthy: alerts.length === 0,
    metrics,
    alerts,
  };
}
