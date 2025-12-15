"use strict";
// src/services/creditEconomyService.ts
// Credit economy controls: anti-fraud, bonus caps, decay logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_ECONOMY_CONFIG = void 0;
exports.getUserWeeklyBonusTotal = getUserWeeklyBonusTotal;
exports.canReceiveBonus = canReceiveBonus;
exports.awardBonusCredits = awardBonusCredits;
exports.applyReliabilityDecay = applyReliabilityDecay;
exports.isTierLocked = isTierLocked;
exports.createTierLock = createTierLock;
exports.cleanupExpiredTierLocks = cleanupExpiredTierLocks;
exports.checkLargeAdjustment = checkLargeAdjustment;
exports.createFraudAlert = createFraudAlert;
exports.getOpenFraudAlerts = getOpenFraudAlerts;
exports.resolveFraudAlert = resolveFraudAlert;
exports.calculateCancellationFeePercent = calculateCancellationFeePercent;
exports.recordClientCancellation = recordClientCancellation;
exports.recordCleanerCancellation = recordCleanerCancellation;
exports.getGraceCancellationsRemaining = getGraceCancellationsRemaining;
exports.recordCancellation = recordCancellation;
exports.processCleanerNoShow = processCleanerNoShow;
exports.getCleanerNoShowStats = getCleanerNoShowStats;
exports.createAuditLog = createAuditLog;
exports.getAuditLogs = getAuditLogs;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
// ============================================
// Configuration
// ============================================
exports.CREDIT_ECONOMY_CONFIG = {
    // Weekly bonus caps
    WEEKLY_BONUS_CAP: 50, // Max 50 bonus credits per week
    WEEKLY_BONUS_WARNING: 40, // Warn at 40 credits
    // Reliability decay
    DECAY_INACTIVE_WEEKS: 2, // Start decay after 2 weeks inactive
    DECAY_RATE_PER_WEEK: 2, // -2 points per week inactive
    // Tier lock duration (days)
    TIER_LOCK_DAYS: 7, // Can't lose tier for 7 days after promotion
    // Cancellation policy (per Terms of Service)
    // Grace cancellations: 2 free cancellations per client (LIFETIME, not monthly)
    LIFETIME_GRACE_CANCELLATIONS: 2,
    // Cancellation fee percentages based on notice given:
    // - >48 hours: 0% fee (free cancellation)
    // - 24-48 hours: 50% fee
    // - <24 hours: 100% fee
    CANCEL_FREE_HOURS: 48, // Free cancellation if >48h before
    CANCEL_PARTIAL_HOURS: 24, // 50% fee if 24-48h before
    CANCEL_FEE_PARTIAL_PERCENT: 50, // 50% fee for 24-48h notice
    CANCEL_FEE_LATE_PERCENT: 100, // 100% fee for <24h notice
    // Anti-fraud thresholds
    FRAUD_RAPID_BONUS_THRESHOLD: 5, // Alert if >5 bonuses in 1 hour
    FRAUD_LARGE_ADJUSTMENT_THRESHOLD: 500, // Alert if single adjustment >500 credits
    // Cleaner penalties (reliability score impact)
    NO_SHOW_PENALTY_CLEANER: 25, // Cleaner no-show reliability penalty
    LATE_CANCEL_PENALTY_CLEANER: 10, // Cleaner late cancellation reliability penalty
    // Photo compliance bonus (per Photo Proof policy)
    PHOTO_COMPLIANCE_BONUS: 10, // +10 reliability points for photo compliance
};
// ============================================
// Bonus Cap System
// ============================================
/**
 * Get user's weekly bonus total
 */
async function getUserWeeklyBonusTotal(userId) {
    const now = new Date();
    const year = now.getFullYear();
    const week = getISOWeek(now);
    const result = await (0, client_1.query)(`SELECT get_user_weekly_bonus_total($1, $2, $3)::text as total`, [userId, year, week]);
    return Number(result.rows[0]?.total || 0);
}
/**
 * Check if user can receive bonus (under cap)
 */
async function canReceiveBonus(userId, amount) {
    const currentTotal = await getUserWeeklyBonusTotal(userId);
    const remaining = Math.max(0, exports.CREDIT_ECONOMY_CONFIG.WEEKLY_BONUS_CAP - currentTotal);
    return {
        allowed: currentTotal + amount <= exports.CREDIT_ECONOMY_CONFIG.WEEKLY_BONUS_CAP,
        currentTotal,
        cap: exports.CREDIT_ECONOMY_CONFIG.WEEKLY_BONUS_CAP,
        remaining,
    };
}
/**
 * Award bonus credits (with cap enforcement)
 */
async function awardBonusCredits(params) {
    const { userId, amount, bonusType, source, bypassCap = false } = params;
    // Check cap
    const { allowed, currentTotal, remaining } = await canReceiveBonus(userId, amount);
    let awardedAmount = amount;
    let capped = false;
    if (!allowed && !bypassCap) {
        awardedAmount = remaining;
        capped = true;
        if (awardedAmount <= 0) {
            logger_1.logger.warn("bonus_cap_reached", { userId, requestedAmount: amount, currentTotal });
            return { awarded: 0, capped: true, newTotal: currentTotal };
        }
    }
    const now = new Date();
    const year = now.getFullYear();
    const week = getISOWeek(now);
    // Record bonus
    await (0, client_1.query)(`
      INSERT INTO credit_bonuses (user_id, bonus_type, amount, week_of_year, year, source)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, bonusType, awardedAmount, week, year, source ?? null]);
    // Add to credit ledger
    await (0, client_1.query)(`
      INSERT INTO credit_ledger (user_id, delta_credits, reason)
      VALUES ($1, $2, 'adjustment')
    `, [userId, awardedAmount]);
    const newTotal = currentTotal + awardedAmount;
    logger_1.logger.info("bonus_credits_awarded", {
        userId,
        bonusType,
        requestedAmount: amount,
        awardedAmount,
        capped,
        newWeeklyTotal: newTotal,
    });
    // Check for fraud (rapid bonuses)
    await checkRapidBonusActivity(userId);
    return { awarded: awardedAmount, capped, newTotal };
}
// ============================================
// Reliability Decay System
// ============================================
/**
 * Apply weekly reliability decay for inactive cleaners
 */
async function applyReliabilityDecay() {
    const weeksInactive = exports.CREDIT_ECONOMY_CONFIG.DECAY_INACTIVE_WEEKS;
    const decayRate = exports.CREDIT_ECONOMY_CONFIG.DECAY_RATE_PER_WEEK;
    // Find cleaners who haven't completed a job in X weeks
    const inactiveCleaners = await (0, client_1.query)(`
      SELECT 
        cp.user_id,
        cp.reliability_score,
        cp.tier,
        MAX(j.actual_end_at)::text as last_job_date
      FROM cleaner_profiles cp
      LEFT JOIN jobs j ON j.cleaner_id = cp.user_id AND j.status = 'completed'
      GROUP BY cp.user_id, cp.reliability_score, cp.tier
      HAVING MAX(j.actual_end_at) IS NULL 
         OR MAX(j.actual_end_at) < NOW() - INTERVAL '1 week' * $1
    `, [weeksInactive]);
    let decayed = 0;
    for (const cleaner of inactiveCleaners.rows) {
        // Don't decay below 50
        if (cleaner.reliability_score <= 50)
            continue;
        // Check tier lock
        const isLocked = await isTierLocked(cleaner.user_id);
        if (isLocked)
            continue;
        const newScore = Math.max(50, cleaner.reliability_score - decayRate);
        // Apply decay
        await (0, client_1.query)(`UPDATE cleaner_profiles SET reliability_score = $2, updated_at = NOW() WHERE user_id = $1`, [cleaner.user_id, newScore]);
        // Record history
        await (0, client_1.query)(`
        INSERT INTO reliability_history (cleaner_id, old_score, new_score, old_tier, new_tier, reason, metadata)
        VALUES ($1, $2, $3, $4, $4, 'decay', $5::jsonb)
      `, [
            cleaner.user_id,
            cleaner.reliability_score,
            newScore,
            cleaner.tier,
            JSON.stringify({ weeks_inactive: weeksInactive, decay_rate: decayRate }),
        ]);
        decayed++;
        logger_1.logger.info("reliability_decay_applied", {
            cleanerId: cleaner.user_id,
            oldScore: cleaner.reliability_score,
            newScore,
            tier: cleaner.tier,
        });
    }
    logger_1.logger.info("reliability_decay_completed", {
        processed: inactiveCleaners.rows.length,
        decayed,
    });
    return { processed: inactiveCleaners.rows.length, decayed };
}
// ============================================
// Tier Lock System
// ============================================
/**
 * Check if cleaner's tier is locked
 * Handles missing database function gracefully
 */
async function isTierLocked(cleanerId) {
    try {
        const result = await (0, client_1.query)(`SELECT is_tier_locked($1) as locked`, [cleanerId]);
        return result.rows[0]?.locked ?? false;
    }
    catch (error) {
        // If function doesn't exist, check tier_locks table directly
        if (error?.code === '42883' || error?.message?.includes('does not exist')) {
            logger_1.logger.warn("is_tier_locked_function_missing", {
                cleanerId,
                message: "is_tier_locked function not found, checking tier_locks table directly",
            });
            // Fallback: check tier_locks table directly
            const lockResult = await (0, client_1.query)(`
          SELECT id FROM tier_locks 
          WHERE cleaner_id = $1 
            AND locked_until > NOW()
        `, [cleanerId]);
            return lockResult.rows.length > 0;
        }
        // Re-throw other errors
        throw error;
    }
}
/**
 * Create tier lock after promotion
 */
async function createTierLock(cleanerId, tier, reason = "promotion") {
    const lockDays = exports.CREDIT_ECONOMY_CONFIG.TIER_LOCK_DAYS;
    const lockedUntil = new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000);
    await (0, client_1.query)(`
      INSERT INTO tier_locks (cleaner_id, tier, locked_until, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cleaner_id) DO UPDATE
      SET tier = EXCLUDED.tier,
          locked_until = EXCLUDED.locked_until,
          reason = EXCLUDED.reason
    `, [cleanerId, tier, lockedUntil.toISOString(), reason]);
    logger_1.logger.info("tier_lock_created", { cleanerId, tier, lockedUntil, reason });
}
/**
 * Remove expired tier locks
 */
async function cleanupExpiredTierLocks() {
    const result = await (0, client_1.query)(`
      WITH deleted AS (
        DELETE FROM tier_locks WHERE locked_until < NOW() RETURNING id
      )
      SELECT COUNT(*)::text as count FROM deleted
    `);
    return Number(result.rows[0]?.count || 0);
}
// ============================================
// Anti-Fraud Detection
// ============================================
/**
 * Check for rapid bonus activity (potential abuse)
 */
async function checkRapidBonusActivity(userId) {
    const threshold = exports.CREDIT_ECONOMY_CONFIG.FRAUD_RAPID_BONUS_THRESHOLD;
    const result = await (0, client_1.query)(`
      SELECT COUNT(*)::text as count
      FROM credit_bonuses
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [userId]);
    const count = Number(result.rows[0]?.count || 0);
    if (count >= threshold) {
        await createFraudAlert({
            userId,
            alertType: "rapid_bonus",
            severity: "high",
            description: `User received ${count} bonuses in the last hour (threshold: ${threshold})`,
            metadata: { bonusCount: count, threshold, timeWindow: "1 hour" },
        });
    }
}
/**
 * Check for large credit adjustments
 */
async function checkLargeAdjustment(userId, amount, adjustedBy) {
    const threshold = exports.CREDIT_ECONOMY_CONFIG.FRAUD_LARGE_ADJUSTMENT_THRESHOLD;
    if (Math.abs(amount) >= threshold) {
        await createFraudAlert({
            userId,
            alertType: "large_adjustment",
            severity: amount >= threshold * 2 ? "critical" : "medium",
            description: `Large credit adjustment of ${amount} credits`,
            metadata: { amount, threshold, adjustedBy },
        });
    }
}
/**
 * Create a fraud alert
 */
async function createFraudAlert(params) {
    const { userId, alertType, severity, description, metadata = {} } = params;
    const result = await (0, client_1.query)(`
      INSERT INTO fraud_alerts (user_id, alert_type, severity, description, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `, [userId ?? null, alertType, severity, description, JSON.stringify(metadata)]);
    const alert = result.rows[0];
    logger_1.logger.warn("fraud_alert_created", {
        alertId: alert.id,
        userId,
        alertType,
        severity,
        description,
    });
    return alert;
}
/**
 * Get open fraud alerts
 */
async function getOpenFraudAlerts() {
    const result = await (0, client_1.query)(`SELECT * FROM fraud_alerts WHERE status = 'open' ORDER BY severity DESC, created_at DESC`);
    return result.rows;
}
/**
 * Resolve a fraud alert
 */
async function resolveFraudAlert(alertId, resolvedBy, resolution, notes) {
    await (0, client_1.query)(`
      UPDATE fraud_alerts
      SET status = $2,
          resolved_by = $3,
          resolved_at = NOW(),
          resolution_notes = $4
      WHERE id = $1
    `, [alertId, resolution, resolvedBy, notes ?? null]);
    logger_1.logger.info("fraud_alert_resolved", { alertId, resolvedBy, resolution });
}
// ============================================
// Cancellation Tracking
// ============================================
/**
 * Calculate cancellation fee based on notice given (per Cancellation Policy)
 * - >48 hours: 0% fee (free cancellation)
 * - 24-48 hours: 50% fee
 * - <24 hours: 100% fee
 */
function calculateCancellationFeePercent(hoursBefore) {
    if (hoursBefore > exports.CREDIT_ECONOMY_CONFIG.CANCEL_FREE_HOURS) {
        return 0; // Free cancellation
    }
    if (hoursBefore > exports.CREDIT_ECONOMY_CONFIG.CANCEL_PARTIAL_HOURS) {
        return exports.CREDIT_ECONOMY_CONFIG.CANCEL_FEE_PARTIAL_PERCENT; // 50% fee
    }
    return exports.CREDIT_ECONOMY_CONFIG.CANCEL_FEE_LATE_PERCENT; // 100% fee
}
/**
 * Record a client job cancellation (per Cancellation Policy)
 *
 * Fee structure:
 * - >48h before: 0% fee (free cancellation)
 * - 24-48h before: 50% fee
 * - <24h before: 100% fee
 *
 * Grace cancellations:
 * - Each client gets 2 FREE grace cancellations (LIFETIME, not monthly)
 * - Grace cancellations waive the 50% or 100% fee
 * - Not applicable to no-shows
 */
async function recordClientCancellation(params) {
    const { jobId, clientId, scheduledStart, jobCreditAmount, useGraceCancellation = false } = params;
    const now = new Date();
    const hoursBefore = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Calculate base fee percentage
    const baseFeePercent = calculateCancellationFeePercent(hoursBefore);
    // Check grace cancellations remaining (LIFETIME total)
    const graceRemaining = await getGraceCancellationsRemaining(clientId);
    // Determine if grace cancellation can/should be used
    let usedGrace = false;
    let feePercent = baseFeePercent;
    if (baseFeePercent > 0 && useGraceCancellation && graceRemaining > 0) {
        // Use grace cancellation to waive fee
        usedGrace = true;
        feePercent = 0;
    }
    // Calculate actual credits
    const feeCredits = Math.round(jobCreditAmount * (feePercent / 100));
    const refundCredits = jobCreditAmount - feeCredits;
    // Record cancellation
    await (0, client_1.query)(`
      INSERT INTO cancellation_records (
        job_id, cancelled_by, cancelled_by_role, scheduled_start,
        hours_before, penalty_applied, penalty_credits, is_grace_period,
        fee_percent, refund_credits
      )
      VALUES ($1, $2, 'client', $3, $4, $5, $6, $7, $8, $9)
    `, [
        jobId,
        clientId,
        scheduledStart.toISOString(),
        hoursBefore,
        feeCredits > 0,
        feeCredits,
        usedGrace,
        feePercent,
        refundCredits,
    ]);
    // If grace cancellation was used, record it
    if (usedGrace) {
        await recordGraceCancellationUsed(clientId, jobId);
    }
    logger_1.logger.info("client_cancellation_recorded", {
        jobId,
        clientId,
        hoursBefore,
        baseFeePercent,
        feePercent,
        feeCredits,
        refundCredits,
        usedGraceCancellation: usedGrace,
    });
    return {
        feePercent,
        feeCredits,
        refundCredits,
        usedGraceCancellation: usedGrace,
        graceCancellationsRemaining: usedGrace ? graceRemaining - 1 : graceRemaining,
    };
}
/**
 * Record a cleaner job cancellation
 * - No charge to client (full refund)
 * - Affects cleaner's reliability score
 */
async function recordCleanerCancellation(params) {
    const { jobId, cleanerId, scheduledStart } = params;
    const now = new Date();
    const hoursBefore = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Late cancellations affect reliability more
    const reliabilityPenalty = hoursBefore < 24
        ? exports.CREDIT_ECONOMY_CONFIG.LATE_CANCEL_PENALTY_CLEANER
        : 5;
    // Record cancellation
    await (0, client_1.query)(`
      INSERT INTO cancellation_records (
        job_id, cancelled_by, cancelled_by_role, scheduled_start,
        hours_before, penalty_applied, penalty_credits, is_grace_period
      )
      VALUES ($1, $2, 'cleaner', $3, $4, false, 0, false)
    `, [jobId, cleanerId, scheduledStart.toISOString(), hoursBefore]);
    logger_1.logger.info("cleaner_cancellation_recorded", {
        jobId,
        cleanerId,
        hoursBefore,
        reliabilityPenalty,
    });
    return { reliabilityPenalty };
}
/**
 * Get client's remaining grace cancellations (LIFETIME total of 2)
 */
async function getGraceCancellationsRemaining(clientId) {
    const result = await (0, client_1.query)(`
      SELECT COUNT(*)::text as used
      FROM grace_cancellations
      WHERE client_id = $1
    `, [clientId]);
    const used = Number(result.rows[0]?.used || 0);
    return Math.max(0, exports.CREDIT_ECONOMY_CONFIG.LIFETIME_GRACE_CANCELLATIONS - used);
}
/**
 * Record a grace cancellation used
 */
async function recordGraceCancellationUsed(clientId, jobId) {
    await (0, client_1.query)(`INSERT INTO grace_cancellations (client_id, job_id) VALUES ($1, $2)`, [clientId, jobId]);
    logger_1.logger.info("grace_cancellation_used", { clientId, jobId });
}
/**
 * Legacy function for backwards compatibility
 * @deprecated Use recordClientCancellation or recordCleanerCancellation instead
 */
async function recordCancellation(params) {
    const { jobId, cancelledBy, cancelledByRole, scheduledStart } = params;
    const now = new Date();
    const hoursBefore = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (cancelledByRole === "client") {
        // Use new cancellation logic
        const result = await recordClientCancellation({
            jobId,
            clientId: cancelledBy,
            scheduledStart,
            jobCreditAmount: 0, // Legacy - no amount tracking
            useGraceCancellation: false,
        });
        return {
            isGracePeriod: false,
            penaltyCredits: result.feeCredits,
            monthlyCount: exports.CREDIT_ECONOMY_CONFIG.LIFETIME_GRACE_CANCELLATIONS - result.graceCancellationsRemaining,
        };
    }
    else {
        await recordCleanerCancellation({ jobId, cleanerId: cancelledBy, scheduledStart });
        return { isGracePeriod: false, penaltyCredits: 0, monthlyCount: 0 };
    }
}
// ============================================
// Cleaner No-Show Handling (per Cancellation Policy)
// "If a cleaner doesn't arrive within 30 minutes of scheduled time:
//  - Client receives full refund + 50 bonus credits"
// ============================================
/**
 * Process a cleaner no-show
 * Per Cancellation Policy: Client gets full refund + 50 bonus credits
 */
async function processCleanerNoShow(params) {
    const { jobId, cleanerId, clientId, jobCreditAmount } = params;
    const bonusCredits = env_1.env.CLEANER_NOSHOW_BONUS_CREDITS;
    const totalCreditsToClient = jobCreditAmount + bonusCredits;
    // Record the no-show
    await (0, client_1.query)(`
      INSERT INTO cleaner_no_shows (job_id, cleaner_id, client_id, bonus_credits, processed)
      VALUES ($1, $2, $3, $4, true)
    `, [jobId, cleanerId, clientId, bonusCredits]);
    // Full refund to client (credits back from escrow)
    await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason) VALUES ($1, $2, $3, 'refund')`, [clientId, jobId, jobCreditAmount]);
    // Bonus credits to client (as compensation)
    await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason) VALUES ($1, $2, $3, 'adjustment')`, [clientId, jobId, bonusCredits]);
    // Apply reliability penalty to cleaner
    const penaltyPoints = exports.CREDIT_ECONOMY_CONFIG.NO_SHOW_PENALTY_CLEANER;
    await (0, client_1.query)(`
      UPDATE cleaner_profiles 
      SET reliability_score = GREATEST(0, reliability_score - $2),
          updated_at = NOW()
      WHERE user_id = $1
    `, [cleanerId, penaltyPoints]);
    // Record reliability history
    await (0, client_1.query)(`
      INSERT INTO reliability_history (cleaner_id, old_score, new_score, old_tier, new_tier, reason, metadata)
      SELECT 
        user_id,
        reliability_score + $2,
        reliability_score,
        tier,
        tier,
        'no_show',
        $3::jsonb
      FROM cleaner_profiles
      WHERE user_id = $1
    `, [cleanerId, penaltyPoints, JSON.stringify({ jobId, penaltyPoints })]);
    logger_1.logger.info("cleaner_no_show_processed", {
        jobId,
        cleanerId,
        clientId,
        refundCredits: jobCreditAmount,
        bonusCredits,
        reliabilityPenalty: penaltyPoints,
    });
    return {
        refundCredits: jobCreditAmount,
        bonusCredits,
        totalCreditsToClient,
    };
}
/**
 * Get no-show statistics for a cleaner
 */
async function getCleanerNoShowStats(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::text as last_30,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days')::text as last_90
      FROM cleaner_no_shows
      WHERE cleaner_id = $1
    `, [cleanerId]);
    const row = result.rows[0];
    return {
        totalNoShows: Number(row?.total || 0),
        last30Days: Number(row?.last_30 || 0),
        last90Days: Number(row?.last_90 || 0),
    };
}
// ============================================
// Audit Logging
// ============================================
/**
 * Create an audit log entry
 */
async function createAuditLog(params) {
    await (0, client_1.query)(`
      INSERT INTO audit_logs (
        actor_id, actor_type, action, resource_type, resource_id,
        old_value, new_value, metadata, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
    `, [
        params.actorId ?? null,
        params.actorType,
        params.action,
        params.resourceType,
        params.resourceId ?? null,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        JSON.stringify(params.metadata ?? {}),
        params.ipAddress ?? null,
        params.userAgent ?? null,
    ]);
}
/**
 * Get audit logs for a resource
 */
async function getAuditLogs(params) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    if (params.resourceType) {
        conditions.push(`resource_type = $${paramIndex++}`);
        values.push(params.resourceType);
    }
    if (params.resourceId) {
        conditions.push(`resource_id = $${paramIndex++}`);
        values.push(params.resourceId);
    }
    if (params.actorId) {
        conditions.push(`actor_id = $${paramIndex++}`);
        values.push(params.actorId);
    }
    if (params.action) {
        conditions.push(`action = $${paramIndex++}`);
        values.push(params.action);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params.limit ?? 100;
    const result = await (0, client_1.query)(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex}`, [...values, limit]);
    return result.rows;
}
// ============================================
// Helpers
// ============================================
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
