// src/services/cleanerDashboardService.ts
// Section 9: Dashboard analytics and goals — moved out of routes for layering.

import { query } from "../db/client";
import { logger } from "../lib/logger";

const PERIOD_MAP: Record<string, string> = {
  week: "7 days",
  month: "30 days",
  year: "365 days",
};

export interface DashboardAnalytics {
  earningsTrend: Array<{ date: string; earnings: number }>;
  jobsTrend: Array<{ date: string; count: number }>;
  ratingTrend: Array<{ date: string; avg_rating?: number; count?: number }>;
  platformAverage: { avg_earnings: number; avg_jobs: number };
}

export async function getDashboardAnalytics(
  cleanerId: string,
  period: string = "month"
): Promise<DashboardAnalytics> {
  const periodInterval = PERIOD_MAP[period] || "30 days";

  const [earningsTrend, jobsTrend, ratingTrend, platformAvg] = await Promise.all([
    query<{ date: string; earnings: number }>(
      `
      SELECT 
        DATE_TRUNC('day', j.completed_at)::text as date,
        SUM(ce.net_amount_cents) / 100.0 as earnings
      FROM jobs j
      INNER JOIN cleaner_earnings ce ON ce.job_id = j.id
      WHERE j.cleaner_id = $1 
        AND j.status = 'completed'
        AND j.completed_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', j.completed_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    ),
    query<{ date: string; count: number }>(
      `
      SELECT 
        DATE_TRUNC('day', completed_at)::text as date,
        COUNT(*)::int as count
      FROM jobs
      WHERE cleaner_id = $1 
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', completed_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    ),
    query<{ date: string; avg_rating?: number; count?: number }>(
      `
      SELECT 
        DATE_TRUNC('day', r.created_at)::text as date,
        AVG(r.rating)::float as avg_rating,
        COUNT(*)::int as count
      FROM reviews r
      WHERE r.reviewee_id = $1
        AND r.created_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', r.created_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    ),
    query<{ avg_earnings: number; avg_jobs: number }>(
      `
      SELECT 
        COALESCE(AVG(earnings), 0) as avg_earnings,
        COALESCE(AVG(jobs), 0) as avg_jobs
      FROM (
        SELECT 
          SUM(ce.net_amount_cents) / 100.0 as earnings,
          COUNT(*)::int as jobs
        FROM jobs j
        INNER JOIN cleaner_earnings ce ON ce.job_id = j.id
        WHERE j.status = 'completed'
          AND j.completed_at >= NOW() - INTERVAL '${periodInterval}'
        GROUP BY j.cleaner_id
      ) t
      `,
      []
    ),
  ]);

  return {
    earningsTrend: earningsTrend.rows,
    jobsTrend: jobsTrend.rows,
    ratingTrend: ratingTrend.rows,
    platformAverage: platformAvg.rows[0] || { avg_earnings: 0, avg_jobs: 0 },
  };
}

export async function setCleanerGoals(
  cleanerId: string,
  type: string,
  target: number,
  period: string
): Promise<void> {
  await query(
    `
    UPDATE cleaner_profiles
    SET metadata = COALESCE(metadata, '{}'::jsonb) || 
        jsonb_build_object('goals', 
          COALESCE(metadata->'goals', '{}'::jsonb) || 
          jsonb_build_object($1, jsonb_build_object('target', $2, 'period', $3, 'created_at', NOW()))
        ),
        updated_at = NOW()
    WHERE user_id = $4
    `,
    [type, target, period, cleanerId]
  );
}

export async function getCleanerGoals(cleanerId: string): Promise<Record<string, unknown>> {
  const result = await query<{ goals: Record<string, unknown> }>(
    `SELECT metadata->'goals' as goals FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );
  const row = result.rows[0];
  const goals = row?.goals;
  if (!goals || typeof goals !== "object") return {};
  return goals as Record<string, unknown>;
}
