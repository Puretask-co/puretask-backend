// src/services/earningsService.ts
// V3 FEATURE: Cleaner earnings dashboard - simple, user-friendly earnings view
// Shows pending earnings, paid out, and next payout date

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";

// ============================================
// Types
// ============================================

export interface CleanerEarnings {
  pendingEarnings: {
    credits: number;
    usd: number;
    jobs: number;
  };
  paidOut: {
    credits: number;
    usd: number;
    jobs: number;
    lastPayout: Date | null;
  };
  nextPayout: {
    date: Date;
    estimatedCredits: number;
    estimatedUsd: number;
  };
  payoutSchedule: string; // "weekly" | "biweekly" | "monthly"
}

// ============================================
// Configuration
// ============================================

// Payout schedule configuration (can be moved to env/config)
const PAYOUT_SCHEDULE = (process.env.CLEANER_PAYOUT_SCHEDULE || "weekly") as
  | "weekly"
  | "biweekly"
  | "monthly";

// Credits to USD conversion (1 credit = $0.10, or 10 credits = $1.00)
const CENTS_PER_CREDIT = env.CENTS_PER_CREDIT || 10;
const CREDITS_PER_USD = 100 / CENTS_PER_CREDIT; // 10 credits per $1.00

// ============================================
// Core Functions
// ============================================

/**
 * Get cleaner earnings dashboard
 *
 * V3 FEATURE: Simple, user-friendly earnings view
 * - Pending earnings: Not yet paid out
 * - Paid out: Already received
 * - Next payout: When and how much is coming next
 */
export async function getCleanerEarnings(cleanerId: string): Promise<CleanerEarnings> {
  try {
    // Get pending earnings (from credit_ledger where reason = 'job_release' and not yet paid out)
    // Note: credit_ledger uses user_id (not cleaner_id) and delta_credits
    const pendingResult = await query<{
      total_credits: string;
      job_count: string;
    }>(
      `
        SELECT 
          COALESCE(SUM(delta_credits), 0)::text as total_credits,
          COUNT(DISTINCT job_id)::text as job_count
        FROM credit_ledger
        WHERE user_id = $1
          AND reason = 'job_release'
          AND job_id IS NOT NULL
          AND delta_credits > 0
          AND NOT EXISTS (
            -- Exclude if already paid out (job is linked to a completed payout)
            SELECT 1 FROM payouts p
            WHERE p.cleaner_id = $1
              AND p.job_id = credit_ledger.job_id
              AND p.status IN ('paid', 'completed', 'succeeded')
          )
      `,
      [cleanerId]
    );

    const pendingCredits = Number(pendingResult.rows[0]?.total_credits || 0);
    const pendingJobs = Number(pendingResult.rows[0]?.job_count || 0);
    const pendingUsd = pendingCredits / CREDITS_PER_USD;

    // Get paid out earnings (from payouts table)
    const paidResult = await query<{
      total_credits: string;
      job_count: string;
      last_payout_date: Date | null;
    }>(
      `
        SELECT 
          COALESCE(SUM(amount_credits), 0)::text as total_credits,
          COUNT(*)::text as job_count,
          MAX(created_at) as last_payout_date
        FROM payouts
        WHERE cleaner_id = $1
          AND status IN ('paid', 'completed', 'succeeded')
      `,
      [cleanerId]
    );

    const paidCredits = Number(paidResult.rows[0]?.total_credits || 0);
    const paidJobs = Number(paidResult.rows[0]?.job_count || 0);
    const lastPayout = paidResult.rows[0]?.last_payout_date || null;
    const paidUsd = paidCredits / CREDITS_PER_USD;

    // Calculate next payout date based on schedule
    const nextPayoutDate = calculateNextPayoutDate(PAYOUT_SCHEDULE, lastPayout);

    // Estimate next payout amount (assume pending earnings will be paid)
    const estimatedCredits = pendingCredits;
    const estimatedUsd = pendingUsd;

    const earnings: CleanerEarnings = {
      pendingEarnings: {
        credits: pendingCredits,
        usd: Math.round(pendingUsd * 100) / 100, // Round to 2 decimal places
        jobs: pendingJobs,
      },
      paidOut: {
        credits: paidCredits,
        usd: Math.round(paidUsd * 100) / 100,
        jobs: paidJobs,
        lastPayout,
      },
      nextPayout: {
        date: nextPayoutDate,
        estimatedCredits,
        estimatedUsd: Math.round(estimatedUsd * 100) / 100,
      },
      payoutSchedule: PAYOUT_SCHEDULE,
    };

    logger.info("cleaner_earnings_retrieved", {
      cleanerId,
      pendingCredits,
      paidCredits,
      nextPayoutDate: nextPayoutDate.toISOString(),
    });

    return earnings;
  } catch (error) {
    logger.error("get_cleaner_earnings_failed", {
      cleanerId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Calculate next payout date based on schedule
 */
function calculateNextPayoutDate(
  schedule: "weekly" | "biweekly" | "monthly",
  lastPayout: Date | null
): Date {
  const now = new Date();
  let nextDate = new Date();

  if (!lastPayout) {
    // If never paid, next payout is based on schedule from today
    switch (schedule) {
      case "weekly":
        nextDate.setDate(now.getDate() + 7);
        break;
      case "biweekly":
        nextDate.setDate(now.getDate() + 14);
        break;
      case "monthly":
        nextDate.setMonth(now.getMonth() + 1);
        break;
    }
    return nextDate;
  }

  // Calculate from last payout date
  switch (schedule) {
    case "weekly":
      nextDate = new Date(lastPayout);
      nextDate.setDate(nextDate.getDate() + 7);
      // If last payout was more than a week ago, use current date + 7 days
      if (nextDate < now) {
        nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + 7);
      }
      break;
    case "biweekly":
      nextDate = new Date(lastPayout);
      nextDate.setDate(nextDate.getDate() + 14);
      if (nextDate < now) {
        nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + 14);
      }
      break;
    case "monthly":
      nextDate = new Date(lastPayout);
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (nextDate < now) {
        nextDate = new Date(now);
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      break;
  }

  return nextDate;
}
