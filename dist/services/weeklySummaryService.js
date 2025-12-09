"use strict";
// src/services/weeklySummaryService.ts
// Weekly summary email generation for clients and cleaners
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientWeeklySummary = getClientWeeklySummary;
exports.getCleanerWeeklySummary = getCleanerWeeklySummary;
exports.sendClientWeeklySummaryEmail = sendClientWeeklySummaryEmail;
exports.sendCleanerWeeklySummaryEmail = sendCleanerWeeklySummaryEmail;
exports.sendAllClientWeeklySummaries = sendAllClientWeeklySummaries;
exports.sendAllCleanerWeeklySummaries = sendAllCleanerWeeklySummaries;
exports.getPreviousWeekRange = getPreviousWeekRange;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const emailProvider_1 = require("./notifications/emailProvider");
// ============================================
// Data Fetching
// ============================================
/**
 * Get weekly summary data for a client
 */
async function getClientWeeklySummary(userId, weekStart, weekEnd) {
    // Get user info
    const userResult = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1 AND role = 'client'`, [userId]);
    if (userResult.rows.length === 0)
        return null;
    // Get job stats for the week
    const statsResult = await (0, client_1.query)(`
      SELECT
        COUNT(*) FILTER (WHERE created_at BETWEEN $2 AND $3)::text as jobs_booked,
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3)::text as jobs_completed,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3), 0)::text as credits_spent,
        AVG(rating)::text as avg_rating
      FROM jobs
      WHERE client_id = $1
    `, [userId, weekStart.toISOString(), weekEnd.toISOString()]);
    // Get credit balance
    const balanceResult = await (0, client_1.query)(`SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`, [userId]);
    // Get upcoming jobs
    const upcomingResult = await (0, client_1.query)(`
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
    `, [userId]);
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
async function getCleanerWeeklySummary(userId, weekStart, weekEnd) {
    // Get user info
    const userResult = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1 AND role = 'cleaner'`, [userId]);
    if (userResult.rows.length === 0)
        return null;
    // Get job stats for the week
    const statsResult = await (0, client_1.query)(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3)::text as jobs_completed,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed' AND updated_at BETWEEN $2 AND $3), 0)::text as credits_earned,
        AVG(rating)::text as avg_rating
      FROM jobs
      WHERE cleaner_id = $1
    `, [userId, weekStart.toISOString(), weekEnd.toISOString()]);
    // Get profile info
    const profileResult = await (0, client_1.query)(`SELECT reliability_score::text, tier FROM cleaner_profiles WHERE user_id = $1`, [userId]);
    // Get pending payout amount
    const payoutResult = await (0, client_1.query)(`SELECT COALESCE(SUM(amount_cents), 0)::text as pending_cents FROM payouts WHERE cleaner_id = $1 AND status = 'pending'`, [userId]);
    // Get upcoming jobs
    const upcomingResult = await (0, client_1.query)(`
      SELECT id, scheduled_start_at::text, address, credit_amount
      FROM jobs
      WHERE cleaner_id = $1
        AND status NOT IN ('completed', 'cancelled')
        AND scheduled_start_at > NOW()
      ORDER BY scheduled_start_at
      LIMIT 5
    `, [userId]);
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
function generateCleanerTips(data) {
    const tips = [];
    // Reliability tips
    if (data.reliabilityScore < 80) {
        tips.push("💡 Your reliability score is below 80. Complete more jobs on time to improve it!");
    }
    else if (data.reliabilityScore >= 95) {
        tips.push("⭐ Excellent reliability! You're on track to maintain Platinum status.");
    }
    // Tier tips
    const tierThresholds = {
        bronze: 70,
        silver: 85,
        gold: 95,
        platinum: 100,
    };
    const nextTier = data.tier === "bronze" ? "silver" : data.tier === "silver" ? "gold" : data.tier === "gold" ? "platinum" : null;
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
    }
    else if (data.jobsThisWeek >= 5) {
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
async function sendClientWeeklySummaryEmail(summary) {
    try {
        await (0, emailProvider_1.sendEmail)({
            to: summary.email,
            templateId: "client_weekly_summary",
            dynamicData: {
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
        logger_1.logger.info("client_weekly_summary_sent", {
            userId: summary.userId,
            email: summary.email,
        });
        return true;
    }
    catch (err) {
        logger_1.logger.error("client_weekly_summary_failed", {
            userId: summary.userId,
            error: err.message,
        });
        return false;
    }
}
/**
 * Send weekly summary email to a cleaner
 */
async function sendCleanerWeeklySummaryEmail(summary) {
    try {
        await (0, emailProvider_1.sendEmail)({
            to: summary.email,
            templateId: "cleaner_weekly_summary",
            dynamicData: {
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
        logger_1.logger.info("cleaner_weekly_summary_sent", {
            userId: summary.userId,
            email: summary.email,
        });
        return true;
    }
    catch (err) {
        logger_1.logger.error("cleaner_weekly_summary_failed", {
            userId: summary.userId,
            error: err.message,
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
async function sendAllClientWeeklySummaries(weekStart, weekEnd) {
    const clientsResult = await (0, client_1.query)(`SELECT id FROM users WHERE role = 'client'`);
    let sent = 0;
    let failed = 0;
    for (const client of clientsResult.rows) {
        const summary = await getClientWeeklySummary(client.id, weekStart, weekEnd);
        if (summary && summary.stats.jobsBooked > 0) {
            const success = await sendClientWeeklySummaryEmail(summary);
            if (success)
                sent++;
            else
                failed++;
        }
    }
    return { sent, failed };
}
/**
 * Send weekly summaries to all cleaners
 */
async function sendAllCleanerWeeklySummaries(weekStart, weekEnd) {
    const cleanersResult = await (0, client_1.query)(`SELECT id FROM users WHERE role = 'cleaner'`);
    let sent = 0;
    let failed = 0;
    for (const cleaner of cleanersResult.rows) {
        const summary = await getCleanerWeeklySummary(cleaner.id, weekStart, weekEnd);
        if (summary) {
            const success = await sendCleanerWeeklySummaryEmail(summary);
            if (success)
                sent++;
            else
                failed++;
        }
    }
    return { sent, failed };
}
// ============================================
// Helpers
// ============================================
function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}
/**
 * Get the start and end of the previous week
 */
function getPreviousWeekRange() {
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
