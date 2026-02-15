// src/services/weeklySummaryService.ts
// Weekly summary email generation for clients and cleaners

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { sendNotification } from "./notifications";

// ============================================
// Types
// ============================================

export interface ClientWeeklySummary {
  userId: string;
  email: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    jobsBooked: number;
    jobsCompleted: number;
    creditsSpent: number;
    creditBalance: number;
    avgRatingGiven: number | null;
  };
  upcomingJobs: Array<{
    id: string;
    scheduled_start_at: string;
    address: string;
    cleaner_email: string | null;
  }>;
}

export interface CleanerWeeklySummary {
  userId: string;
  email: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    jobsCompleted: number;
    creditsEarned: number;
    pendingPayoutCents: number;
    avgRating: number | null;
    reliabilityScore: number;
    tier: string;
  };
  upcomingJobs: Array<{
    id: string;
    scheduled_start_at: string;
    address: string;
    credit_amount: number;
  }>;
  weeklyTips: string[];
}

// ============================================
// Data Fetching
// ============================================

/**
 * Get weekly summary data for a client
 */
export async function getClientWeeklySummary(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<ClientWeeklySummary | null> {
  // Get user info
  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1 AND role = 'client'`,
    [userId]
  );

  if (userResult.rows.length === 0) return null;

  // Get job stats for the week
  const statsResult = await query<{
    jobs_booked: string;
    jobs_completed: string;
    credits_spent: string;
    avg_rating: string | null;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE created_at BETWEEN $2 AND $3)::text as jobs_booked,
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3)::text as jobs_completed,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3), 0)::text as credits_spent,
        AVG(rating)::text as avg_rating
      FROM jobs
      WHERE client_id = $1
    `,
    [userId, weekStart.toISOString(), weekEnd.toISOString()]
  );

  // Get credit balance
  const balanceResult = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );

  // Get upcoming jobs
  const upcomingResult = await query<{
    id: string;
    scheduled_start_at: string;
    address: string;
    cleaner_email: string | null;
  }>(
    `
      SELECT 
        j.id, 
        j.scheduled_start_at::text, 
        j.address,
        u.email as cleaner_email
      FROM jobs j
      LEFT JOIN users u ON u.id = j.cleaner_id
      WHERE j.client_id = $1
        AND j.status NOT IN ('completed', 'cancelled')
        AND j.scheduled_start_at > NOW()
      ORDER BY j.scheduled_start_at
      LIMIT 5
    `,
    [userId]
  );

  const stats = statsResult.rows[0];

  return {
    userId,
    email: userResult.rows[0].email,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    stats: {
      jobsBooked: Number(stats?.jobs_booked || 0),
      jobsCompleted: Number(stats?.jobs_completed || 0),
      creditsSpent: Number(stats?.credits_spent || 0),
      creditBalance: Number(balanceResult.rows[0]?.balance || 0),
      avgRatingGiven: stats?.avg_rating ? Number(stats.avg_rating) : null,
    },
    upcomingJobs: upcomingResult.rows,
  };
}

/**
 * Get weekly summary data for a cleaner
 */
export async function getCleanerWeeklySummary(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<CleanerWeeklySummary | null> {
  // Get user info
  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1 AND role = 'cleaner'`,
    [userId]
  );

  if (userResult.rows.length === 0) return null;

  // Get job stats for the week
  const statsResult = await query<{
    jobs_completed: string;
    credits_earned: string;
    avg_rating: string | null;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3)::text as jobs_completed,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3), 0)::text as credits_earned,
        AVG(rating)::text as avg_rating
      FROM jobs
      WHERE cleaner_id = $1
    `,
    [userId, weekStart.toISOString(), weekEnd.toISOString()]
  );

  // Get profile info
  const profileResult = await query<{
    reliability_score: string;
    tier: string;
  }>(`SELECT reliability_score::text, tier FROM cleaner_profiles WHERE user_id = $1`, [userId]);

  // Get pending payout amount
  const payoutResult = await query<{ pending_cents: string }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::text as pending_cents FROM payouts WHERE cleaner_id = $1 AND status = 'pending'`,
    [userId]
  );

  // Get upcoming jobs
  const upcomingResult = await query<{
    id: string;
    scheduled_start_at: string;
    address: string;
    credit_amount: number;
  }>(
    `
      SELECT id, scheduled_start_at::text, address, credit_amount
      FROM jobs
      WHERE cleaner_id = $1
        AND status NOT IN ('completed', 'cancelled')
        AND scheduled_start_at > NOW()
      ORDER BY scheduled_start_at
      LIMIT 5
    `,
    [userId]
  );

  const stats = statsResult.rows[0];
  const profile = profileResult.rows[0];

  // Generate tips based on performance
  const tips = generateCleanerTips({
    reliabilityScore: Number(profile?.reliability_score || 100),
    tier: profile?.tier || "bronze",
    avgRating: stats?.avg_rating ? Number(stats.avg_rating) : null,
    jobsThisWeek: Number(stats?.jobs_completed || 0),
  });

  return {
    userId,
    email: userResult.rows[0].email,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    stats: {
      jobsCompleted: Number(stats?.jobs_completed || 0),
      creditsEarned: Number(stats?.credits_earned || 0),
      pendingPayoutCents: Number(payoutResult.rows[0]?.pending_cents || 0),
      avgRating: stats?.avg_rating ? Number(stats.avg_rating) : null,
      reliabilityScore: Number(profile?.reliability_score || 100),
      tier: profile?.tier || "bronze",
    },
    upcomingJobs: upcomingResult.rows,
    weeklyTips: tips,
  };
}

/**
 * Generate personalized tips for cleaners
 */
function generateCleanerTips(data: {
  reliabilityScore: number;
  tier: string;
  avgRating: number | null;
  jobsThisWeek: number;
}): string[] {
  const tips: string[] = [];

  // Reliability tips
  if (data.reliabilityScore < 80) {
    tips.push("💡 Your reliability score is below 80. Complete more jobs on time to improve it!");
  } else if (data.reliabilityScore >= 95) {
    tips.push("⭐ Excellent reliability! You're on track to maintain Platinum status.");
  }

  // Tier tips
  const tierThresholds: Record<string, number> = {
    bronze: 70,
    silver: 85,
    gold: 95,
    platinum: 100,
  };
  const nextTier =
    data.tier === "bronze"
      ? "silver"
      : data.tier === "silver"
        ? "gold"
        : data.tier === "gold"
          ? "platinum"
          : null;
  if (nextTier && data.reliabilityScore >= tierThresholds[data.tier] - 5) {
    tips.push(`🎯 You're close to ${nextTier} tier! Keep up the great work.`);
  }

  // Rating tips
  if (data.avgRating && data.avgRating < 4.5) {
    tips.push("📸 Remember to upload before/after photos to boost your ratings!");
  }

  // Activity tips
  if (data.jobsThisWeek === 0) {
    tips.push("📅 No jobs this week? Make sure your availability is up to date!");
  } else if (data.jobsThisWeek >= 5) {
    tips.push("🔥 Great week! You completed " + data.jobsThisWeek + " jobs.");
  }

  // Default tip if none
  if (tips.length === 0) {
    tips.push("💪 Keep delivering quality service to grow your business!");
  }

  return tips.slice(0, 3); // Max 3 tips
}

// ============================================
// Email Sending
// ============================================

/**
 * Send weekly summary email to a client
 */
export async function sendClientWeeklySummaryEmail(summary: ClientWeeklySummary): Promise<boolean> {
  try {
    await sendNotification({
      email: summary.email,
      userId: summary.userId,
      type: "welcome", // Using welcome type as placeholder - weekly summary type doesn't exist
      channel: "email",
      data: {
        weekStart: formatDate(summary.weekStart),
        weekEnd: formatDate(summary.weekEnd),
        jobsBooked: summary.stats.jobsBooked,
        jobsCompleted: summary.stats.jobsCompleted,
        creditsSpent: summary.stats.creditsSpent,
        creditBalance: summary.stats.creditBalance,
        upcomingJobs: summary.upcomingJobs,
        hasUpcomingJobs: summary.upcomingJobs.length > 0,
      },
    });

    logger.info("client_weekly_summary_sent", {
      userId: summary.userId,
      email: summary.email,
    });

    return true;
  } catch (err) {
    logger.error("client_weekly_summary_failed", {
      userId: summary.userId,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Send weekly summary email to a cleaner
 */
export async function sendCleanerWeeklySummaryEmail(
  summary: CleanerWeeklySummary
): Promise<boolean> {
  try {
    await sendNotification({
      email: summary.email,
      userId: summary.userId,
      type: "welcome", // Using welcome type as placeholder - weekly summary type doesn't exist
      channel: "email",
      data: {
        weekStart: formatDate(summary.weekStart),
        weekEnd: formatDate(summary.weekEnd),
        jobsCompleted: summary.stats.jobsCompleted,
        creditsEarned: summary.stats.creditsEarned,
        pendingPayout: (summary.stats.pendingPayoutCents / 100).toFixed(2),
        avgRating: summary.stats.avgRating?.toFixed(1) || "N/A",
        reliabilityScore: summary.stats.reliabilityScore.toFixed(1),
        tier: summary.stats.tier.charAt(0).toUpperCase() + summary.stats.tier.slice(1),
        upcomingJobs: summary.upcomingJobs,
        hasUpcomingJobs: summary.upcomingJobs.length > 0,
        tips: summary.weeklyTips,
      },
    });

    logger.info("cleaner_weekly_summary_sent", {
      userId: summary.userId,
      email: summary.email,
    });

    return true;
  } catch (err) {
    logger.error("cleaner_weekly_summary_failed", {
      userId: summary.userId,
      error: (err as Error).message,
    });
    return false;
  }
}

// ============================================
// Batch Processing
// ============================================

/**
 * Send weekly summaries to all clients
 */
export async function sendAllClientWeeklySummaries(
  weekStart: Date,
  weekEnd: Date
): Promise<{ sent: number; failed: number }> {
  const clientsResult = await query<{ id: string }>(`SELECT id FROM users WHERE role = 'client'`);

  let sent = 0;
  let failed = 0;

  for (const client of clientsResult.rows) {
    const summary = await getClientWeeklySummary(client.id, weekStart, weekEnd);
    if (summary && summary.stats.jobsBooked > 0) {
      const success = await sendClientWeeklySummaryEmail(summary);
      if (success) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}

/**
 * Send weekly summaries to all cleaners
 */
export async function sendAllCleanerWeeklySummaries(
  weekStart: Date,
  weekEnd: Date
): Promise<{ sent: number; failed: number }> {
  const cleanersResult = await query<{ id: string }>(`SELECT id FROM users WHERE role = 'cleaner'`);

  let sent = 0;
  let failed = 0;

  for (const cleaner of cleanersResult.rows) {
    const summary = await getCleanerWeeklySummary(cleaner.id, weekStart, weekEnd);
    if (summary) {
      const success = await sendCleanerWeeklySummaryEmail(summary);
      if (success) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}

// ============================================
// Helpers
// ============================================

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get the start and end of the previous week
 */
export function getPreviousWeekRange(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Get last Sunday (start of previous week)
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() - dayOfWeek);
  weekEnd.setHours(23, 59, 59, 999);

  // Get the Sunday before that (start of that week)
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  return { weekStart, weekEnd };
}
