// src/services/analyticsService.ts
// Analytics service - Revenue reports, trends, and business metrics

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export type TimeRange = "day" | "week" | "month" | "quarter" | "year" | "all";

export interface RevenueMetrics {
  totalCredits: number;
  totalRevenueCents: number;
  platformFeeCents: number;
  cleanerPayoutsCents: number;
  averageJobCredits: number;
  jobCount: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface DashboardMetrics {
  revenue: RevenueMetrics;
  users: {
    totalClients: number;
    totalCleaners: number;
    newClientsThisMonth: number;
    newCleanersThisMonth: number;
    activeClientsThisMonth: number;
    activeCleanersThisMonth: number;
  };
  jobs: {
    totalJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    disputedJobs: number;
    averageJobDurationHours: number;
    completionRate: number;
  };
  credits: {
    totalCreditsPurchased: number;
    totalCreditsUsed: number;
    totalCreditsRefunded: number;
    currentCreditSupply: number;
  };
  cleaners: {
    averageReliabilityScore: number;
    averageRating: number;
    cleanersByTier: Record<string, number>;
  };
}

export interface RevenueByPeriod {
  period: string;
  creditsEarned: number;
  revenueCents: number;
  payoutsCents: number;
  platformFeeCents: number;
  jobCount: number;
}

export interface TopPerformer {
  userId: string;
  email: string;
  name?: string;
  value: number;
  rank: number;
}

// ============================================
// Helper Functions
// ============================================

function getDateRangeCondition(timeRange: TimeRange, column: string = "created_at"): string {
  switch (timeRange) {
    case "day": return `${column} >= NOW() - INTERVAL '1 day'`;
    case "week": return `${column} >= NOW() - INTERVAL '7 days'`;
    case "month": return `${column} >= NOW() - INTERVAL '30 days'`;
    case "quarter": return `${column} >= NOW() - INTERVAL '90 days'`;
    case "year": return `${column} >= NOW() - INTERVAL '365 days'`;
    case "all": return "1=1";
    default: return `${column} >= NOW() - INTERVAL '30 days'`;
  }
}

function getDateTrunc(timeRange: TimeRange): string {
  switch (timeRange) {
    case "day": return "hour";
    case "week": return "day";
    case "month": return "day";
    case "quarter": return "week";
    case "year": return "month";
    case "all": return "month";
    default: return "day";
  }
}

// ============================================
// Dashboard Metrics
// ============================================

/**
 * Get comprehensive dashboard metrics
 */
export async function getDashboardMetrics(timeRange: TimeRange = "month"): Promise<DashboardMetrics> {
  const dateCondition = getDateRangeCondition(timeRange);

  // Revenue metrics
  const revenueResult = await query<{
    total_credits: string;
    job_count: string;
    avg_credits: string;
  }>(
    `
      SELECT 
        COALESCE(SUM(credit_amount), 0)::text as total_credits,
        COUNT(*)::text as job_count,
        COALESCE(AVG(credit_amount), 0)::text as avg_credits
      FROM jobs
      WHERE status = 'completed' AND ${dateCondition}
    `
  );

  const payoutsResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::text as total FROM payouts WHERE status = 'paid' AND ${dateCondition}`
  );

  // User metrics
  const userResult = await query<{
    total_clients: string;
    total_cleaners: string;
    new_clients: string;
    new_cleaners: string;
    active_clients: string;
    active_cleaners: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE role = 'client')::text as total_clients,
        COUNT(*) FILTER (WHERE role = 'cleaner')::text as total_cleaners,
        COUNT(*) FILTER (WHERE role = 'client' AND created_at >= NOW() - INTERVAL '30 days')::text as new_clients,
        COUNT(*) FILTER (WHERE role = 'cleaner' AND created_at >= NOW() - INTERVAL '30 days')::text as new_cleaners,
        (SELECT COUNT(DISTINCT client_id) FROM jobs WHERE ${dateCondition})::text as active_clients,
        (SELECT COUNT(DISTINCT cleaner_id) FROM jobs WHERE cleaner_id IS NOT NULL AND ${dateCondition})::text as active_cleaners
      FROM users
    `
  );

  // Job metrics
  const jobResult = await query<{
    total: string;
    completed: string;
    cancelled: string;
    disputed: string;
    avg_duration: string;
  }>(
    `
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled,
        COUNT(*) FILTER (WHERE status = 'disputed')::text as disputed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (actual_end_at - actual_start_at)) / 3600), 0)::text as avg_duration
      FROM jobs
      WHERE ${dateCondition}
    `
  );

  // Credit metrics
  const creditResult = await query<{
    purchased: string;
    used: string;
    refunded: string;
    supply: string;
  }>(
    `
      SELECT
        COALESCE(SUM(delta_credits) FILTER (WHERE reason = 'purchase'), 0)::text as purchased,
        COALESCE(ABS(SUM(delta_credits) FILTER (WHERE reason = 'job_escrow')), 0)::text as used,
        COALESCE(SUM(delta_credits) FILTER (WHERE reason = 'refund'), 0)::text as refunded,
        COALESCE(SUM(delta_credits), 0)::text as supply
      FROM credit_ledger
      WHERE ${dateCondition}
    `
  );

  // Cleaner metrics
  const cleanerResult = await query<{
    avg_reliability: string;
    avg_rating: string;
    bronze: string;
    silver: string;
    gold: string;
    platinum: string;
  }>(
    `
      SELECT
        COALESCE(AVG(cp.reliability_score), 0)::text as avg_reliability,
        COALESCE(AVG(j.rating), 0)::text as avg_rating,
        COUNT(*) FILTER (WHERE cp.tier = 'bronze')::text as bronze,
        COUNT(*) FILTER (WHERE cp.tier = 'silver')::text as silver,
        COUNT(*) FILTER (WHERE cp.tier = 'gold')::text as gold,
        COUNT(*) FILTER (WHERE cp.tier = 'platinum')::text as platinum
      FROM cleaner_profiles cp
      LEFT JOIN jobs j ON j.cleaner_id = cp.user_id AND j.status = 'completed'
    `
  );

  const rev = revenueResult.rows[0];
  const payout = payoutsResult.rows[0];
  const user = userResult.rows[0];
  const job = jobResult.rows[0];
  const credit = creditResult.rows[0];
  const cleaner = cleanerResult.rows[0];

  const totalCredits = Number(rev?.total_credits || 0);
  const centsPerCredit = 100; // From config
  const totalRevenueCents = totalCredits * centsPerCredit;
  const cleanerPayoutsCents = Number(payout?.total || 0);
  const platformFeeCents = totalRevenueCents - cleanerPayoutsCents;

  const totalJobs = Number(job?.total || 0);
  const completedJobs = Number(job?.completed || 0);

  return {
    revenue: {
      totalCredits,
      totalRevenueCents,
      platformFeeCents,
      cleanerPayoutsCents,
      averageJobCredits: Number(rev?.avg_credits || 0),
      jobCount: Number(rev?.job_count || 0),
    },
    users: {
      totalClients: Number(user?.total_clients || 0),
      totalCleaners: Number(user?.total_cleaners || 0),
      newClientsThisMonth: Number(user?.new_clients || 0),
      newCleanersThisMonth: Number(user?.new_cleaners || 0),
      activeClientsThisMonth: Number(user?.active_clients || 0),
      activeCleanersThisMonth: Number(user?.active_cleaners || 0),
    },
    jobs: {
      totalJobs,
      completedJobs,
      cancelledJobs: Number(job?.cancelled || 0),
      disputedJobs: Number(job?.disputed || 0),
      averageJobDurationHours: Number(job?.avg_duration || 0),
      completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
    },
    credits: {
      totalCreditsPurchased: Number(credit?.purchased || 0),
      totalCreditsUsed: Number(credit?.used || 0),
      totalCreditsRefunded: Number(credit?.refunded || 0),
      currentCreditSupply: Number(credit?.supply || 0),
    },
    cleaners: {
      averageReliabilityScore: Number(cleaner?.avg_reliability || 0),
      averageRating: Number(cleaner?.avg_rating || 0),
      cleanersByTier: {
        bronze: Number(cleaner?.bronze || 0),
        silver: Number(cleaner?.silver || 0),
        gold: Number(cleaner?.gold || 0),
        platinum: Number(cleaner?.platinum || 0),
      },
    },
  };
}

// ============================================
// Revenue Trends
// ============================================

/**
 * Get revenue over time
 */
export async function getRevenueTrend(timeRange: TimeRange = "month"): Promise<TrendDataPoint[]> {
  const dateCondition = getDateRangeCondition(timeRange);
  const dateTrunc = getDateTrunc(timeRange);

  const result = await query<{ period: string; value: string }>(
    `
      SELECT 
        DATE_TRUNC('${dateTrunc}', created_at)::text as period,
        COALESCE(SUM(credit_amount), 0)::text as value
      FROM jobs
      WHERE status = 'completed' AND ${dateCondition}
      GROUP BY period
      ORDER BY period ASC
    `
  );

  return result.rows.map((row) => ({
    date: row.period,
    value: Number(row.value),
  }));
}

/**
 * Get revenue by period (daily, weekly, monthly breakdown)
 */
export async function getRevenueByPeriod(
  groupBy: "day" | "week" | "month" = "day",
  timeRange: TimeRange = "month"
): Promise<RevenueByPeriod[]> {
  const dateCondition = getDateRangeCondition(timeRange);
  const dateTrunc = groupBy === "day" ? "day" : groupBy === "week" ? "week" : "month";

  const result = await query<{
    period: string;
    credits: string;
    job_count: string;
    payouts: string;
  }>(
    `
      SELECT 
        DATE_TRUNC('${dateTrunc}', j.created_at)::text as period,
        COALESCE(SUM(j.credit_amount), 0)::text as credits,
        COUNT(j.id)::text as job_count,
        COALESCE(SUM(p.amount_cents), 0)::text as payouts
      FROM jobs j
      LEFT JOIN payouts p ON p.job_id = j.id AND p.status = 'paid'
      WHERE j.status = 'completed' AND ${dateCondition.replace('created_at', 'j.created_at')}
      GROUP BY period
      ORDER BY period ASC
    `
  );

  const centsPerCredit = 100;

  return result.rows.map((row) => {
    const creditsEarned = Number(row.credits);
    const revenueCents = creditsEarned * centsPerCredit;
    const payoutsCents = Number(row.payouts);

    return {
      period: row.period,
      creditsEarned,
      revenueCents,
      payoutsCents,
      platformFeeCents: revenueCents - payoutsCents,
      jobCount: Number(row.job_count),
    };
  });
}

// ============================================
// Job Trends
// ============================================

/**
 * Get job count over time
 */
export async function getJobTrend(timeRange: TimeRange = "month"): Promise<TrendDataPoint[]> {
  const dateCondition = getDateRangeCondition(timeRange);
  const dateTrunc = getDateTrunc(timeRange);

  const result = await query<{ period: string; value: string }>(
    `
      SELECT 
        DATE_TRUNC('${dateTrunc}', created_at)::text as period,
        COUNT(*)::text as value
      FROM jobs
      WHERE ${dateCondition}
      GROUP BY period
      ORDER BY period ASC
    `
  );

  return result.rows.map((row) => ({
    date: row.period,
    value: Number(row.value),
  }));
}

/**
 * Get job status breakdown
 */
export async function getJobStatusBreakdown(timeRange: TimeRange = "month"): Promise<Record<string, number>> {
  const dateCondition = getDateRangeCondition(timeRange);

  const result = await query<{ status: string; count: string }>(
    `
      SELECT status, COUNT(*)::text as count
      FROM jobs
      WHERE ${dateCondition}
      GROUP BY status
    `
  );

  const breakdown: Record<string, number> = {};
  for (const row of result.rows) {
    breakdown[row.status] = Number(row.count);
  }

  return breakdown;
}

// ============================================
// User Trends
// ============================================

/**
 * Get new user signups over time
 */
export async function getUserSignupTrend(
  role: "client" | "cleaner" | "all" = "all",
  timeRange: TimeRange = "month"
): Promise<TrendDataPoint[]> {
  const dateCondition = getDateRangeCondition(timeRange);
  const dateTrunc = getDateTrunc(timeRange);
  const roleCondition = role === "all" ? "" : `AND role = '${role}'`;

  const result = await query<{ period: string; value: string }>(
    `
      SELECT 
        DATE_TRUNC('${dateTrunc}', created_at)::text as period,
        COUNT(*)::text as value
      FROM users
      WHERE ${dateCondition} ${roleCondition}
      GROUP BY period
      ORDER BY period ASC
    `
  );

  return result.rows.map((row) => ({
    date: row.period,
    value: Number(row.value),
  }));
}

// ============================================
// Top Performers
// ============================================

/**
 * Get top clients by spending
 */
export async function getTopClients(limit: number = 10, timeRange: TimeRange = "month"): Promise<TopPerformer[]> {
  const dateCondition = getDateRangeCondition(timeRange);

  const result = await query<{
    user_id: string;
    email: string;
    total_spent: string;
  }>(
    `
      SELECT 
        u.id as user_id,
        u.email,
        COALESCE(ABS(SUM(cl.delta_credits)), 0)::text as total_spent
      FROM users u
      LEFT JOIN credit_ledger cl ON cl.user_id = u.id AND cl.reason = 'job_escrow' AND ${dateCondition.replace('created_at', 'cl.created_at')}
      WHERE u.role = 'client'
      GROUP BY u.id, u.email
      ORDER BY total_spent DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row, index) => ({
    userId: row.user_id,
    email: row.email,
    value: Number(row.total_spent),
    rank: index + 1,
  }));
}

/**
 * Get top cleaners by earnings
 */
export async function getTopCleaners(limit: number = 10, timeRange: TimeRange = "month"): Promise<TopPerformer[]> {
  const dateCondition = getDateRangeCondition(timeRange);

  const result = await query<{
    user_id: string;
    email: string;
    total_earned: string;
    job_count: string;
  }>(
    `
      SELECT 
        u.id as user_id,
        u.email,
        COALESCE(SUM(cl.delta_credits), 0)::text as total_earned,
        COUNT(DISTINCT j.id)::text as job_count
      FROM users u
      LEFT JOIN credit_ledger cl ON cl.user_id = u.id AND cl.reason = 'job_release' AND ${dateCondition.replace('created_at', 'cl.created_at')}
      LEFT JOIN jobs j ON j.cleaner_id = u.id AND j.status = 'completed' AND ${dateCondition.replace('created_at', 'j.created_at')}
      WHERE u.role = 'cleaner'
      GROUP BY u.id, u.email
      ORDER BY total_earned DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row, index) => ({
    userId: row.user_id,
    email: row.email,
    value: Number(row.total_earned),
    rank: index + 1,
  }));
}

/**
 * Get top cleaners by rating
 */
export async function getTopRatedCleaners(limit: number = 10): Promise<TopPerformer[]> {
  const result = await query<{
    user_id: string;
    email: string;
    avg_rating: string;
    job_count: string;
  }>(
    `
      SELECT 
        u.id as user_id,
        u.email,
        COALESCE(AVG(j.rating), 0)::text as avg_rating,
        COUNT(j.id)::text as job_count
      FROM users u
      JOIN jobs j ON j.cleaner_id = u.id AND j.status = 'completed' AND j.rating IS NOT NULL
      WHERE u.role = 'cleaner'
      GROUP BY u.id, u.email
      HAVING COUNT(j.id) >= 5
      ORDER BY avg_rating DESC, job_count DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row, index) => ({
    userId: row.user_id,
    email: row.email,
    value: Number(row.avg_rating),
    rank: index + 1,
  }));
}

// ============================================
// Credit Economy Analytics
// ============================================

/**
 * Get credit economy health metrics
 */
export async function getCreditEconomyHealth(): Promise<{
  totalSupply: number;
  circulatingCredits: number;
  weeklyVelocity: number;
  inflationRate: number;
  purchaseToRefundRatio: number;
}> {
  const result = await query<{
    total_supply: string;
    purchased_this_week: string;
    used_this_week: string;
    refunded_this_week: string;
    purchased_last_week: string;
  }>(
    `
      SELECT
        (SELECT COALESCE(SUM(delta_credits), 0) FROM credit_ledger)::text as total_supply,
        (SELECT COALESCE(SUM(delta_credits), 0) FROM credit_ledger WHERE reason = 'purchase' AND created_at >= NOW() - INTERVAL '7 days')::text as purchased_this_week,
        (SELECT COALESCE(ABS(SUM(delta_credits)), 0) FROM credit_ledger WHERE reason = 'job_escrow' AND created_at >= NOW() - INTERVAL '7 days')::text as used_this_week,
        (SELECT COALESCE(SUM(delta_credits), 0) FROM credit_ledger WHERE reason = 'refund' AND created_at >= NOW() - INTERVAL '7 days')::text as refunded_this_week,
        (SELECT COALESCE(SUM(delta_credits), 0) FROM credit_ledger WHERE reason = 'purchase' AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::text as purchased_last_week
    `
  );

  const row = result.rows[0];
  const totalSupply = Number(row?.total_supply || 0);
  const purchasedThisWeek = Number(row?.purchased_this_week || 0);
  const usedThisWeek = Number(row?.used_this_week || 0);
  const refundedThisWeek = Number(row?.refunded_this_week || 0);
  const purchasedLastWeek = Number(row?.purchased_last_week || 1);

  return {
    totalSupply,
    circulatingCredits: totalSupply, // In a closed system, all credits are circulating
    weeklyVelocity: totalSupply > 0 ? usedThisWeek / totalSupply : 0,
    inflationRate: purchasedLastWeek > 0 ? ((purchasedThisWeek - purchasedLastWeek) / purchasedLastWeek) * 100 : 0,
    purchaseToRefundRatio: refundedThisWeek > 0 ? purchasedThisWeek / refundedThisWeek : purchasedThisWeek,
  };
}

// ============================================
// Export Full Report
// ============================================

/**
 * Generate a comprehensive analytics report
 */
export async function generateFullReport(timeRange: TimeRange = "month"): Promise<{
  generatedAt: string;
  timeRange: string;
  dashboard: DashboardMetrics;
  revenueTrend: TrendDataPoint[];
  jobTrend: TrendDataPoint[];
  userSignupTrend: TrendDataPoint[];
  topClients: TopPerformer[];
  topCleaners: TopPerformer[];
  creditHealth: Awaited<ReturnType<typeof getCreditEconomyHealth>>;
}> {
  logger.info("generating_analytics_report", { timeRange });

  const [
    dashboard,
    revenueTrend,
    jobTrend,
    userSignupTrend,
    topClients,
    topCleaners,
    creditHealth,
  ] = await Promise.all([
    getDashboardMetrics(timeRange),
    getRevenueTrend(timeRange),
    getJobTrend(timeRange),
    getUserSignupTrend("all", timeRange),
    getTopClients(10, timeRange),
    getTopCleaners(10, timeRange),
    getCreditEconomyHealth(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timeRange,
    dashboard,
    revenueTrend,
    jobTrend,
    userSignupTrend,
    topClients,
    topCleaners,
    creditHealth,
  };
}

