"use strict";
// src/services/premiumService.ts
// Premium features: Boosts, Rush Jobs, Subscriptions
// V2 FEATURE — DISABLED FOR NOW
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUSH_CONFIG = exports.BOOST_CONFIG = void 0;
exports.purchaseBoost = purchaseBoost;
exports.getActiveBoost = getActiveBoost;
exports.getBoostMultiplier = getBoostMultiplier;
exports.incrementBoostJobs = incrementBoostJobs;
exports.expireOldBoosts = expireOldBoosts;
exports.calculateRushFee = calculateRushFee;
exports.applyRushFee = applyRushFee;
exports.createSubscription = createSubscription;
exports.getClientSubscriptions = getClientSubscriptions;
exports.updateSubscriptionStatus = updateSubscriptionStatus;
exports.cancelSubscription = cancelSubscription;
exports.getSubscriptionsDueForJobCreation = getSubscriptionsDueForJobCreation;
exports.markSubscriptionJobCreated = markSubscriptionJobCreated;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const creditsService_1 = require("./creditsService");
// ============================================
// Configuration
// ============================================
exports.BOOST_CONFIG = {
    STANDARD: { credits: 30, multiplier: 1.5, durationHours: 24 },
    PREMIUM: { credits: 60, multiplier: 2.0, durationHours: 48 },
    MEGA: { credits: 100, multiplier: 3.0, durationHours: 72 },
};
exports.RUSH_CONFIG = {
    MIN_HOURS_AHEAD: 2,
    RUSH_MULTIPLIER: 1.25,
    MAX_RUSH_FEE: 50,
};
// ============================================
// Cleaner Boosts
// ============================================
/**
 * Purchase a boost for a cleaner
 */
async function purchaseBoost(cleanerId, boostType) {
    const config = exports.BOOST_CONFIG[boostType];
    if (!config) {
        throw Object.assign(new Error("Invalid boost type"), { statusCode: 400 });
    }
    // Check cleaner has enough credits
    const balance = await (0, creditsService_1.getUserCreditBalance)(cleanerId);
    if (balance < config.credits) {
        throw Object.assign(new Error("Insufficient credits"), { statusCode: 400 });
    }
    // Check if cleaner already has active boost
    const existingResult = await (0, client_1.query)(`SELECT * FROM cleaner_boosts WHERE cleaner_id = $1 AND status = 'active' AND ends_at > NOW()`, [cleanerId]);
    if (existingResult.rows.length > 0) {
        throw Object.assign(new Error("Already have an active boost"), { statusCode: 400 });
    }
    // Deduct credits
    await (0, creditsService_1.addLedgerEntry)({
        userId: cleanerId,
        deltaCredits: -config.credits,
        reason: "adjustment",
    });
    // Calculate end time
    const endsAt = new Date(Date.now() + config.durationHours * 60 * 60 * 1000);
    // Create boost
    const result = await (0, client_1.query)(`
      INSERT INTO cleaner_boosts (cleaner_id, boost_type, credits_spent, multiplier, ends_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [cleanerId, boostType.toLowerCase(), config.credits, config.multiplier, endsAt.toISOString()]);
    logger_1.logger.info("boost_purchased", {
        cleanerId,
        boostType,
        creditsSpent: config.credits,
        endsAt,
    });
    return result.rows[0];
}
/**
 * Get cleaner's active boost
 */
async function getActiveBoost(cleanerId) {
    const result = await (0, client_1.query)(`SELECT * FROM cleaner_boosts WHERE cleaner_id = $1 AND status = 'active' AND ends_at > NOW()`, [cleanerId]);
    return result.rows[0] ?? null;
}
/**
 * Get boost multiplier for cleaner (for ranking)
 */
async function getBoostMultiplier(cleanerId) {
    const boost = await getActiveBoost(cleanerId);
    return boost?.multiplier ?? 1.0;
}
/**
 * Increment jobs count for active boost
 */
async function incrementBoostJobs(cleanerId) {
    await (0, client_1.query)(`
      UPDATE cleaner_boosts 
      SET jobs_during = jobs_during + 1 
      WHERE cleaner_id = $1 AND status = 'active' AND ends_at > NOW()
    `, [cleanerId]);
}
/**
 * Expire old boosts
 */
async function expireOldBoosts() {
    const result = await (0, client_1.query)(`
      WITH expired AS (
        UPDATE cleaner_boosts 
        SET status = 'expired' 
        WHERE status = 'active' AND ends_at < NOW()
        RETURNING id
      )
      SELECT COUNT(*)::text as count FROM expired
    `);
    return Number(result.rows[0]?.count || 0);
}
// ============================================
// Rush Jobs
// ============================================
/**
 * Calculate rush fee for a job
 */
async function calculateRushFee(scheduledStartAt, baseCredits) {
    const now = new Date();
    const hoursUntilStart = (scheduledStartAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilStart >= exports.RUSH_CONFIG.MIN_HOURS_AHEAD) {
        return { isRush: false, rushFee: 0, totalCredits: baseCredits };
    }
    // Calculate rush fee
    const rushFee = Math.min(Math.round(baseCredits * (exports.RUSH_CONFIG.RUSH_MULTIPLIER - 1)), exports.RUSH_CONFIG.MAX_RUSH_FEE);
    return {
        isRush: true,
        rushFee,
        totalCredits: baseCredits + rushFee,
    };
}
/**
 * Mark job as rush and apply fee
 */
async function applyRushFee(jobId, rushFee) {
    await (0, client_1.query)(`UPDATE jobs SET is_rush = true, rush_fee_credits = $2, updated_at = NOW() WHERE id = $1`, [jobId, rushFee]);
}
// ============================================
// Cleaning Subscriptions
// ============================================
/**
 * Create a cleaning subscription
 */
async function createSubscription(params) {
    const { clientId, cleanerId, frequency, dayOfWeek, preferredTime, address, latitude, longitude, creditAmount, } = params;
    // Calculate next job date
    const nextJobDate = calculateNextJobDate(frequency, dayOfWeek);
    const result = await (0, client_1.query)(`
      INSERT INTO cleaning_subscriptions (
        client_id, cleaner_id, frequency, day_of_week, preferred_time,
        address, latitude, longitude, credit_amount, next_job_date
      )
      VALUES ($1, $2, $3, $4, $5::TIME, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
        clientId,
        cleanerId ?? null,
        frequency,
        dayOfWeek ?? null,
        preferredTime ?? null,
        address,
        latitude ?? null,
        longitude ?? null,
        creditAmount,
        nextJobDate.toISOString().split("T")[0],
    ]);
    logger_1.logger.info("subscription_created", {
        subscriptionId: result.rows[0].id,
        clientId,
        frequency,
        nextJobDate,
    });
    return result.rows[0];
}
/**
 * Get client's subscriptions
 */
async function getClientSubscriptions(clientId) {
    const result = await (0, client_1.query)(`SELECT * FROM cleaning_subscriptions WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
    return result.rows;
}
/**
 * Pause/resume subscription
 */
async function updateSubscriptionStatus(subscriptionId, clientId, status) {
    const result = await (0, client_1.query)(`
      UPDATE cleaning_subscriptions 
      SET status = $3, 
          next_job_date = CASE WHEN $3 = 'active' THEN $4 ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1 AND client_id = $2
      RETURNING *
    `, [
        subscriptionId,
        clientId,
        status,
        status === "active" ? calculateNextJobDate("weekly").toISOString().split("T")[0] : null,
    ]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Subscription not found"), { statusCode: 404 });
    }
    logger_1.logger.info("subscription_status_updated", { subscriptionId, status });
    return result.rows[0];
}
/**
 * Cancel subscription
 */
async function cancelSubscription(subscriptionId, clientId) {
    await (0, client_1.query)(`
      UPDATE cleaning_subscriptions 
      SET status = 'cancelled', next_job_date = NULL, updated_at = NOW()
      WHERE id = $1 AND client_id = $2
    `, [subscriptionId, clientId]);
    logger_1.logger.info("subscription_cancelled", { subscriptionId });
}
/**
 * Get subscriptions due for job creation
 */
async function getSubscriptionsDueForJobCreation() {
    const result = await (0, client_1.query)(`
      SELECT * FROM cleaning_subscriptions 
      WHERE status = 'active' 
        AND next_job_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY next_job_date ASC
    `);
    return result.rows;
}
/**
 * Mark subscription job as created and calculate next date
 */
async function markSubscriptionJobCreated(subscriptionId, jobId) {
    const subResult = await (0, client_1.query)(`SELECT * FROM cleaning_subscriptions WHERE id = $1`, [subscriptionId]);
    if (subResult.rows.length === 0)
        return;
    const sub = subResult.rows[0];
    const nextDate = calculateNextJobDate(sub.frequency, sub.day_of_week ?? undefined);
    await (0, client_1.query)(`
      UPDATE cleaning_subscriptions 
      SET jobs_created = jobs_created + 1,
          next_job_date = $2,
          updated_at = NOW()
      WHERE id = $1
    `, [subscriptionId, nextDate.toISOString().split("T")[0]]);
    logger_1.logger.info("subscription_job_created", { subscriptionId, jobId, nextDate });
}
// ============================================
// Helpers
// ============================================
function calculateNextJobDate(frequency, preferredDayOfWeek) {
    const now = new Date();
    const next = new Date(now);
    // Set to next occurrence of preferred day if specified
    if (preferredDayOfWeek !== undefined) {
        const daysUntil = (preferredDayOfWeek - now.getDay() + 7) % 7;
        next.setDate(now.getDate() + (daysUntil === 0 ? 7 : daysUntil));
    }
    else {
        // Default to same day next week
        next.setDate(now.getDate() + 7);
    }
    // Adjust based on frequency
    switch (frequency) {
        case "weekly":
            // Already set
            break;
        case "biweekly":
            next.setDate(next.getDate() + 7); // Add another week
            break;
        case "monthly":
            next.setMonth(next.getMonth() + 1);
            break;
    }
    return next;
}
