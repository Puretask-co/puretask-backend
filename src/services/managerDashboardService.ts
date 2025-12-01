// src/services/managerDashboardService.ts
// Full manager dashboard with GMV, supply/demand, and all business metrics

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface DashboardOverview {
  gmv: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
  };
  credits: {
    purchased: number;
    spent: number;
    refunded: number;
    totalSupply: number;
    velocityPerDay: number;
  };
  jobs: {
    today: number;
    thisWeek: number;
    completionRate: number;
    avgRating: number;
    avgJobValue: number;
  };
  users: {
    totalClients: number;
    totalCleaners: number;
    activeClients30d: number;
    activeCleaners30d: number;
    newClientsThisWeek: number;
    newCleanersThisWeek: number;
  };
  rates: {
    refundRate: number;
    disputeRate: number;
    cancellationRate: number;
    payoutErrorRate: number;
    workflowErrorRate: number;
  };
}

export interface SupplyDemandHeatmap {
  hour: number;
  dayOfWeek: number;
  demand: number; // Jobs requested
  supply: number; // Cleaners available
  ratio: number;  // demand/supply
  fillRate: number;
}

export interface TierDistribution {
  tier: string;
  count: number;
  avgReliability: number;
  avgJobsCompleted: number;
  totalEarnings: number;
}

export interface RetentionCohort {
  cohortMonth: string;
  signups: number;
  month1Active: number;
  month2Active: number;
  month3Active: number;
  month1Pct: number;
  month2Pct: number;
  month3Pct: number;
}

// ============================================
// Dashboard Overview
// ============================================

/**
 * Get full dashboard overview
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [gmv, credits, jobs, users, rates] = await Promise.all([
    getGMVMetrics(),
    getCreditMetrics(),
    getJobMetrics(),
    getUserMetrics(),
    getRateMetrics(),
  ]);

  return { gmv, credits, jobs, users, rates };
}

async function getGMVMetrics() {
  const result = await query<{
    today: string;
    this_week: string;
    this_month: string;
    last_month: string;
  }>(
    `
      SELECT
        COALESCE(SUM(credit_amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0)::text as today,
        COALESCE(SUM(credit_amount) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)), 0)::text as this_week,
        COALESCE(SUM(credit_amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)::text as this_month,
        COALESCE(SUM(credit_amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
          AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0)::text as last_month
      FROM jobs
      WHERE status = 'completed'
    `
  );

  const row = result.rows[0];
  const thisMonth = Number(row?.this_month || 0);
  const lastMonth = Number(row?.last_month || 0);

  return {
    today: Number(row?.today || 0),
    thisWeek: Number(row?.this_week || 0),
    thisMonth,
    lastMonth,
    monthOverMonthGrowth: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0,
  };
}

async function getCreditMetrics() {
  const result = await query<{
    purchased: string;
    spent: string;
    refunded: string;
    total_supply: string;
  }>(
    `
      SELECT
        COALESCE(SUM(delta_credits) FILTER (WHERE reason = 'purchase'), 0)::text as purchased,
        COALESCE(ABS(SUM(delta_credits) FILTER (WHERE reason = 'job_escrow')), 0)::text as spent,
        COALESCE(SUM(delta_credits) FILTER (WHERE reason = 'refund'), 0)::text as refunded,
        COALESCE(SUM(delta_credits), 0)::text as total_supply
      FROM credit_ledger
    `
  );

  // Calculate velocity (credits spent per day in last 30 days)
  const velocityResult = await query<{ velocity: string }>(
    `
      SELECT COALESCE(ABS(SUM(delta_credits)) / 30, 0)::text as velocity
      FROM credit_ledger
      WHERE reason = 'job_escrow'
        AND created_at >= NOW() - INTERVAL '30 days'
    `
  );

  const row = result.rows[0];
  return {
    purchased: Number(row?.purchased || 0),
    spent: Number(row?.spent || 0),
    refunded: Number(row?.refunded || 0),
    totalSupply: Number(row?.total_supply || 0),
    velocityPerDay: Number(velocityResult.rows[0]?.velocity || 0),
  };
}

async function getJobMetrics() {
  const result = await query<{
    today: string;
    this_week: string;
    completed: string;
    total: string;
    avg_rating: string;
    avg_value: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::text as today,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE))::text as this_week,
        COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
        COUNT(*)::text as total,
        AVG(rating)::text as avg_rating,
        AVG(credit_amount)::text as avg_value
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '90 days'
    `
  );

  const row = result.rows[0];
  const completed = Number(row?.completed || 0);
  const total = Number(row?.total || 0);

  return {
    today: Number(row?.today || 0),
    thisWeek: Number(row?.this_week || 0),
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    avgRating: Number(row?.avg_rating || 0),
    avgJobValue: Number(row?.avg_value || 0),
  };
}

async function getUserMetrics() {
  const result = await query<{
    total_clients: string;
    total_cleaners: string;
    active_clients: string;
    active_cleaners: string;
    new_clients_week: string;
    new_cleaners_week: string;
  }>(
    `
      WITH user_activity AS (
        SELECT DISTINCT client_id as user_id FROM jobs WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION
        SELECT DISTINCT cleaner_id FROM jobs WHERE cleaner_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'client')::text as total_clients,
        (SELECT COUNT(*) FROM users WHERE role = 'cleaner')::text as total_cleaners,
        (SELECT COUNT(*) FROM user_activity ua JOIN users u ON u.id = ua.user_id WHERE u.role = 'client')::text as active_clients,
        (SELECT COUNT(*) FROM user_activity ua JOIN users u ON u.id = ua.user_id WHERE u.role = 'cleaner')::text as active_cleaners,
        (SELECT COUNT(*) FROM users WHERE role = 'client' AND created_at >= DATE_TRUNC('week', CURRENT_DATE))::text as new_clients_week,
        (SELECT COUNT(*) FROM users WHERE role = 'cleaner' AND created_at >= DATE_TRUNC('week', CURRENT_DATE))::text as new_cleaners_week
    `
  );

  const row = result.rows[0];
  return {
    totalClients: Number(row?.total_clients || 0),
    totalCleaners: Number(row?.total_cleaners || 0),
    activeClients30d: Number(row?.active_clients || 0),
    activeCleaners30d: Number(row?.active_cleaners || 0),
    newClientsThisWeek: Number(row?.new_clients_week || 0),
    newCleanersThisWeek: Number(row?.new_cleaners_week || 0),
  };
}

async function getRateMetrics() {
  const result = await query<{
    total_completed: string;
    refunded: string;
    disputed: string;
    cancelled: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::text as total_completed,
        COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT job_id FROM credit_ledger WHERE reason = 'refund'))::text as refunded,
        COUNT(*) FILTER (WHERE status = 'disputed')::text as disputed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '90 days'
    `
  );

  const payoutResult = await query<{ failed: string; total: string }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed')::text as failed,
        COUNT(*)::text as total
      FROM payouts
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `
  );

  const workflowResult = await query<{ failed: string }>(
    `SELECT COUNT(*)::text as failed FROM webhook_failures WHERE created_at >= NOW() - INTERVAL '7 days'`
  );

  const row = result.rows[0];
  const total = Number(row?.total_completed || 0) + Number(row?.cancelled || 0);
  const payoutRow = payoutResult.rows[0];
  const payoutTotal = Number(payoutRow?.total || 0);

  return {
    refundRate: total > 0 ? (Number(row?.refunded || 0) / total) * 100 : 0,
    disputeRate: total > 0 ? (Number(row?.disputed || 0) / total) * 100 : 0,
    cancellationRate: total > 0 ? (Number(row?.cancelled || 0) / total) * 100 : 0,
    payoutErrorRate: payoutTotal > 0 ? (Number(payoutRow?.failed || 0) / payoutTotal) * 100 : 0,
    workflowErrorRate: Number(workflowResult.rows[0]?.failed || 0),
  };
}

// ============================================
// Supply/Demand Heatmap
// ============================================

/**
 * Get supply/demand heatmap by hour and day of week
 */
export async function getSupplyDemandHeatmap(): Promise<SupplyDemandHeatmap[]> {
  // Demand: Jobs scheduled per hour/day
  const demandResult = await query<{
    hour: string;
    dow: string;
    demand: string;
    fill_rate: string;
  }>(
    `
      SELECT
        EXTRACT(HOUR FROM scheduled_start_at)::text as hour,
        EXTRACT(DOW FROM scheduled_start_at)::text as dow,
        COUNT(*)::text as demand,
        (COUNT(*) FILTER (WHERE cleaner_id IS NOT NULL)::float / NULLIF(COUNT(*), 0))::text as fill_rate
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '90 days'
      GROUP BY 1, 2
    `
  );

  // Supply: Cleaner availability per hour/day
  const supplyResult = await query<{
    hour: string;
    dow: string;
    supply: string;
  }>(
    `
      SELECT
        h.hour::text,
        ca.day_of_week::text as dow,
        COUNT(DISTINCT ca.cleaner_id)::text as supply
      FROM cleaner_availability ca
      CROSS JOIN LATERAL generate_series(0, 23) as h(hour)
      WHERE h.hour >= EXTRACT(HOUR FROM ca.start_time)::int
        AND h.hour < EXTRACT(HOUR FROM ca.end_time)::int
      GROUP BY 1, 2
    `
  );

  // Combine data
  const heatmap: Map<string, SupplyDemandHeatmap> = new Map();

  for (let hour = 0; hour < 24; hour++) {
    for (let dow = 0; dow < 7; dow++) {
      const key = `${hour}-${dow}`;
      heatmap.set(key, {
        hour,
        dayOfWeek: dow,
        demand: 0,
        supply: 0,
        ratio: 0,
        fillRate: 0,
      });
    }
  }

  for (const row of demandResult.rows) {
    const key = `${row.hour}-${row.dow}`;
    const entry = heatmap.get(key);
    if (entry) {
      entry.demand = Number(row.demand);
      entry.fillRate = Number(row.fill_rate || 0);
    }
  }

  for (const row of supplyResult.rows) {
    const key = `${row.hour}-${row.dow}`;
    const entry = heatmap.get(key);
    if (entry) {
      entry.supply = Number(row.supply);
      entry.ratio = entry.supply > 0 ? entry.demand / entry.supply : 999;
    }
  }

  return Array.from(heatmap.values());
}

// ============================================
// Tier Distribution
// ============================================

/**
 * Get cleaner tier distribution with metrics
 */
export async function getTierDistribution(): Promise<TierDistribution[]> {
  const result = await query<{
    tier: string;
    count: string;
    avg_reliability: string;
    avg_jobs: string;
    total_earnings: string;
  }>(
    `
      SELECT
        cp.tier,
        COUNT(*)::text as count,
        AVG(cp.reliability_score)::text as avg_reliability,
        AVG(job_counts.jobs)::text as avg_jobs,
        COALESCE(SUM(earnings.total), 0)::text as total_earnings
      FROM cleaner_profiles cp
      LEFT JOIN (
        SELECT cleaner_id, COUNT(*) as jobs
        FROM jobs
        WHERE status = 'completed'
        GROUP BY cleaner_id
      ) job_counts ON job_counts.cleaner_id = cp.user_id
      LEFT JOIN (
        SELECT user_id, SUM(delta_credits) as total
        FROM credit_ledger
        WHERE reason = 'job_release'
        GROUP BY user_id
      ) earnings ON earnings.user_id = cp.user_id
      GROUP BY cp.tier
      ORDER BY 
        CASE cp.tier 
          WHEN 'platinum' THEN 1 
          WHEN 'gold' THEN 2 
          WHEN 'silver' THEN 3 
          ELSE 4 
        END
    `
  );

  return result.rows.map((row) => ({
    tier: row.tier,
    count: Number(row.count),
    avgReliability: Number(row.avg_reliability || 0),
    avgJobsCompleted: Number(row.avg_jobs || 0),
    totalEarnings: Number(row.total_earnings || 0),
  }));
}

// ============================================
// Retention Cohorts
// ============================================

/**
 * Get retention cohort analysis
 */
export async function getRetentionCohorts(): Promise<RetentionCohort[]> {
  const result = await query<{
    cohort_month: string;
    signups: string;
    m1: string;
    m2: string;
    m3: string;
  }>(
    `
      WITH cohorts AS (
        SELECT 
          DATE_TRUNC('month', created_at) as cohort_month,
          id as user_id
        FROM users
        WHERE role = 'client'
          AND created_at >= NOW() - INTERVAL '6 months'
      ),
      activity AS (
        SELECT 
          client_id,
          DATE_TRUNC('month', created_at) as activity_month
        FROM jobs
        GROUP BY 1, 2
      )
      SELECT
        c.cohort_month::text,
        COUNT(DISTINCT c.user_id)::text as signups,
        COUNT(DISTINCT a1.client_id)::text as m1,
        COUNT(DISTINCT a2.client_id)::text as m2,
        COUNT(DISTINCT a3.client_id)::text as m3
      FROM cohorts c
      LEFT JOIN activity a1 ON a1.client_id = c.user_id 
        AND a1.activity_month = c.cohort_month + INTERVAL '1 month'
      LEFT JOIN activity a2 ON a2.client_id = c.user_id 
        AND a2.activity_month = c.cohort_month + INTERVAL '2 months'
      LEFT JOIN activity a3 ON a3.client_id = c.user_id 
        AND a3.activity_month = c.cohort_month + INTERVAL '3 months'
      GROUP BY c.cohort_month
      ORDER BY c.cohort_month DESC
    `
  );

  return result.rows.map((row) => {
    const signups = Number(row.signups || 0);
    return {
      cohortMonth: row.cohort_month.split("T")[0],
      signups,
      month1Active: Number(row.m1 || 0),
      month2Active: Number(row.m2 || 0),
      month3Active: Number(row.m3 || 0),
      month1Pct: signups > 0 ? (Number(row.m1 || 0) / signups) * 100 : 0,
      month2Pct: signups > 0 ? (Number(row.m2 || 0) / signups) * 100 : 0,
      month3Pct: signups > 0 ? (Number(row.m3 || 0) / signups) * 100 : 0,
    };
  });
}

// ============================================
// Real-time Alerts
// ============================================

/**
 * Get active alerts that need attention
 */
export async function getActiveAlerts(): Promise<Array<{
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  count: number;
}>> {
  const alerts: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
    count: number;
  }> = [];

  // Check stuck jobs
  const stuckJobsResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM jobs WHERE status = 'requested' AND created_at < NOW() - INTERVAL '24 hours'`
  );
  const stuckJobs = Number(stuckJobsResult.rows[0]?.count || 0);
  if (stuckJobs > 0) {
    alerts.push({
      type: "stuck_jobs",
      severity: stuckJobs > 5 ? "critical" : "warning",
      message: `${stuckJobs} jobs stuck in requested status for 24+ hours`,
      count: stuckJobs,
    });
  }

  // Check failed payouts
  const failedPayoutsResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM payouts WHERE status = 'failed'`
  );
  const failedPayouts = Number(failedPayoutsResult.rows[0]?.count || 0);
  if (failedPayouts > 0) {
    alerts.push({
      type: "failed_payouts",
      severity: "critical",
      message: `${failedPayouts} payouts have failed and need attention`,
      count: failedPayouts,
    });
  }

  // Check open disputes
  const openDisputesResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM disputes WHERE status = 'open'`
  );
  const openDisputes = Number(openDisputesResult.rows[0]?.count || 0);
  if (openDisputes > 0) {
    alerts.push({
      type: "open_disputes",
      severity: openDisputes > 10 ? "critical" : "warning",
      message: `${openDisputes} open disputes require resolution`,
      count: openDisputes,
    });
  }

  // Check fraud alerts
  const fraudResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM fraud_alerts WHERE status = 'open'`
  );
  const fraudAlerts = Number(fraudResult.rows[0]?.count || 0);
  if (fraudAlerts > 0) {
    alerts.push({
      type: "fraud_alerts",
      severity: "critical",
      message: `${fraudAlerts} potential fraud alerts need review`,
      count: fraudAlerts,
    });
  }

  return alerts;
}

