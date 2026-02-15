/**
 * Step 20 — Governor Metrics Scheduler
 * Computes region_marketplace_metrics per region and triggers governor compute.
 * Run hourly (e.g. via scheduler or cron).
 */

import { query } from "../../db/client";
import { MarketplaceGovernorService } from "../../services/marketplaceGovernorService";
import { logger } from "../../lib/logger";

const REGIONS = (process.env.REGION_IDS || "__global__")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const EVENT_TABLE = process.env.EVENT_TABLE_NAME || "pt_event_log";

type MetricsRow = {
  region_id: string;
  window_start: string;
  window_end: string;
  active_cleaners: number;
  available_cleaners: number;
  job_requests: number;
  jobs_booked: number;
  median_fill_minutes: number | null;
  cancel_rate: number | null;
  dispute_rate: number | null;
  avg_rating: number | null;
  on_time_rate: number | null;
  acceptance_rate: number | null;
};

async function queryActiveCleaners(regionId: string): Promise<number> {
  try {
    const r = await query<{ n: string }>(
      `SELECT COUNT(DISTINCT cleaner_id)::int AS n
       FROM ${EVENT_TABLE}
       WHERE event_type IN ('meaningful_action','job_completed','job_request_accepted')
         AND occurred_at >= now() - interval '24 hours'
         AND cleaner_id IS NOT NULL
         AND ($1 = '__global__' OR region_id IS NOT DISTINCT FROM $1)`,
      [regionId]
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (e) {
    logger.warn("governor_metrics_active_cleaners_failed", {
      regionId,
      error: (e as Error).message,
    });
    return 0;
  }
}

async function queryJobRequests(regionId: string): Promise<number> {
  try {
    // job_offers.created_at approximates request; for __global__ we count all
    const r = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM job_offers
       WHERE created_at >= now() - interval '1 hour'`,
      []
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (e) {
    logger.warn("governor_metrics_job_requests_failed", { regionId, error: (e as Error).message });
    return 0;
  }
}

async function queryJobsBooked(regionId: string): Promise<number> {
  try {
    const r = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM job_offers
       WHERE status = 'accepted' AND updated_at >= now() - interval '1 hour'`,
      []
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (e) {
    logger.warn("governor_metrics_jobs_booked_failed", { regionId, error: (e as Error).message });
    return 0;
  }
}

async function queryMedianFillMinutes(regionId: string): Promise<number | null> {
  try {
    const r = await query<{ med: string }>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 60
       ) AS med
       FROM job_offers
       WHERE status = 'accepted'
         AND updated_at IS NOT NULL
         AND created_at >= now() - interval '24 hours'`,
      []
    );
    const v = r.rows[0]?.med;
    return v != null ? Number(v) : null;
  } catch (e) {
    logger.warn("governor_metrics_median_fill_failed", { regionId, error: (e as Error).message });
    return null;
  }
}

async function queryCancelRate(regionId: string): Promise<number | null> {
  try {
    const r = await query<{ r: string }>(
      `SELECT COALESCE(
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::numeric
           / NULLIF(COUNT(*), 0),
         0
       ) AS r
       FROM jobs
       WHERE created_at >= now() - interval '7 days'`,
      []
    );
    return Number(r.rows[0]?.r ?? 0);
  } catch (e) {
    logger.warn("governor_metrics_cancel_rate_failed", { regionId, error: (e as Error).message });
    return null;
  }
}

async function queryDisputeRate(regionId: string): Promise<number | null> {
  try {
    const r = await query<{ r: string }>(
      `SELECT COALESCE(
         (SELECT COUNT(*)::numeric FROM disputes d
          JOIN jobs j ON j.id = d.job_id
          WHERE j.created_at >= now() - interval '7 days')
           / NULLIF((SELECT COUNT(*)::numeric FROM jobs WHERE created_at >= now() - interval '7 days'), 0),
         0
       ) AS r`,
      []
    );
    return Number(r.rows[0]?.r ?? 0);
  } catch (e) {
    logger.warn("governor_metrics_dispute_rate_failed", { regionId, error: (e as Error).message });
    return null;
  }
}

async function queryAvgRating(regionId: string): Promise<number | null> {
  try {
    const r = await query<{ r: string }>(
      `SELECT COALESCE(AVG(rating), 5) AS r
       FROM jobs
       WHERE rating IS NOT NULL AND created_at >= now() - interval '30 days'`,
      []
    );
    return Number(r.rows[0]?.r ?? 5);
  } catch (e) {
    logger.warn("governor_metrics_avg_rating_failed", { regionId, error: (e as Error).message });
    return null;
  }
}

async function queryOnTimeRate(regionId: string): Promise<number | null> {
  try {
    // Infer on_time from actual_start_at vs scheduled_start_at (±15 min)
    const r = await query<{ r: string }>(
      `SELECT COALESCE(
         SUM(CASE
           WHEN actual_start_at IS NOT NULL
             AND abs(EXTRACT(EPOCH FROM (actual_start_at - scheduled_start_at)) / 60) <= 15
           THEN 1 ELSE 0 END
         )::numeric / NULLIF(COUNT(*) FILTER (WHERE actual_start_at IS NOT NULL), 0),
         1
       ) AS r
       FROM jobs
       WHERE status = 'completed'
         AND updated_at >= now() - interval '30 days'`,
      []
    );
    return Number(r.rows[0]?.r ?? 1);
  } catch (e) {
    logger.warn("governor_metrics_on_time_rate_failed", { regionId, error: (e as Error).message });
    return null;
  }
}

async function queryAcceptanceRate(regionId: string): Promise<number | null> {
  try {
    const r = await query<{ r: string }>(
      `SELECT COALESCE(
         SUM(CASE WHEN event_type = 'job_request_accepted' THEN 1 ELSE 0 END)::numeric
           / NULLIF(SUM(
             CASE
               WHEN event_type = 'job_request_accepted' THEN 1
               WHEN event_type = 'job_request_declined'
                 AND COALESCE((payload->>'good_faith')::boolean, false) = false
               THEN 1
               ELSE 0
             END
           ), 0),
         1
       ) AS r
       FROM ${EVENT_TABLE}
       WHERE occurred_at >= now() - interval '30 days'
         AND event_type IN ('job_request_accepted', 'job_request_declined')
         AND ($1 = '__global__' OR region_id IS NOT DISTINCT FROM $1)`,
      [regionId]
    );
    return Number(r.rows[0]?.r ?? 1);
  } catch (e) {
    logger.warn("governor_metrics_acceptance_rate_failed", {
      regionId,
      error: (e as Error).message,
    });
    return null;
  }
}

async function computeRegionMetrics(regionId: string): Promise<MetricsRow> {
  const now = new Date();
  const windowEnd = now.toISOString();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const [
    active_cleaners,
    job_requests,
    jobs_booked,
    median_fill_minutes,
    cancel_rate,
    dispute_rate,
    avg_rating,
    on_time_rate,
    acceptance_rate,
  ] = await Promise.all([
    queryActiveCleaners(regionId),
    queryJobRequests(regionId),
    queryJobsBooked(regionId),
    queryMedianFillMinutes(regionId),
    queryCancelRate(regionId),
    queryDisputeRate(regionId),
    queryAvgRating(regionId),
    queryOnTimeRate(regionId),
    queryAcceptanceRate(regionId),
  ]);

  return {
    region_id: regionId,
    window_start: windowStart,
    window_end: windowEnd,
    active_cleaners,
    available_cleaners: 0, // TODO: wire to cleaner_availability when schema supports
    job_requests,
    jobs_booked,
    median_fill_minutes,
    cancel_rate,
    dispute_rate,
    avg_rating,
    on_time_rate,
    acceptance_rate,
  };
}

export async function runComputeGovernorMetrics(): Promise<void> {
  const svc = new MarketplaceGovernorService();
  const dryRun = process.env.GOVERNOR_METRICS_DRY_RUN === "true";

  for (const regionId of REGIONS) {
    try {
      const metrics = await computeRegionMetrics(regionId);

      if (dryRun) {
        logger.info("governor_metrics_dry_run", {
          regionId,
          median_fill_minutes: metrics.median_fill_minutes,
          cancel_rate: metrics.cancel_rate,
          dispute_rate: metrics.dispute_rate,
        });
        continue;
      }

      await svc.insertMetricsRow(metrics);
      const state = await svc.computeRegion(regionId, "governor_scheduler");

      logger.info("governor_metrics_computed", {
        regionId,
        state: state.state,
        median_fill_minutes: metrics.median_fill_minutes,
      });
    } catch (e) {
      logger.error("governor_metrics_failed", {
        regionId,
        error: (e as Error).message,
      });
      throw e;
    }
  }
}
