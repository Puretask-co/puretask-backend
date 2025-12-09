"use strict";
// src/services/adminRepairService.ts
// Admin repair tools for stuck jobs, credits, and system issues
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findStuckJobs = findStuckJobs;
exports.findStuckPayouts = findStuckPayouts;
exports.findLedgerInconsistencies = findLedgerInconsistencies;
exports.forceCompleteJob = forceCompleteJob;
exports.forceCancelJob = forceCancelJob;
exports.reassignJob = reassignJob;
exports.adjustCredits = adjustCredits;
exports.forceProcessPayout = forceProcessPayout;
exports.runSystemHealthCheck = runSystemHealthCheck;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const creditEconomyService_1 = require("./creditEconomyService");
const events_1 = require("../lib/events");
// ============================================
// Stuck Job Detection
// ============================================
/**
 * Find jobs stuck in various states
 */
async function findStuckJobs() {
    const result = await (0, client_1.query)(`
      WITH stuck_jobs AS (
        -- Jobs stuck in 'requested' for >24h with no cleaner
        SELECT 
          id, status, client_id, cleaner_id, scheduled_start_at, created_at,
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_stuck,
          'No cleaner assigned for 24+ hours' as reason
        FROM jobs
        WHERE status = 'requested'
          AND cleaner_id IS NULL
          AND created_at < NOW() - INTERVAL '24 hours'
        
        UNION ALL
        
        -- Jobs stuck in 'accepted' past scheduled start
        SELECT 
          id, status, client_id, cleaner_id, scheduled_start_at, created_at,
          EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 3600 as hours_stuck,
          'Accepted but past scheduled start' as reason
        FROM jobs
        WHERE status = 'accepted'
          AND scheduled_start_at < NOW() - INTERVAL '1 hour'
        
        UNION ALL
        
        -- Jobs stuck in 'in_progress' for >12 hours
        SELECT 
          id, status, client_id, cleaner_id, scheduled_start_at, created_at,
          EXTRACT(EPOCH FROM (NOW() - actual_start_at)) / 3600 as hours_stuck,
          'In progress for 12+ hours' as reason
        FROM jobs
        WHERE status = 'in_progress'
          AND actual_start_at < NOW() - INTERVAL '12 hours'
        
        UNION ALL
        
        -- Jobs stuck in 'awaiting_approval' for >7 days
        SELECT 
          id, status, client_id, cleaner_id, scheduled_start_at, created_at,
          EXTRACT(EPOCH FROM (NOW() - actual_end_at)) / 3600 as hours_stuck,
          'Awaiting approval for 7+ days' as reason
        FROM jobs
        WHERE status = 'awaiting_approval'
          AND actual_end_at < NOW() - INTERVAL '7 days'
      )
      SELECT * FROM stuck_jobs
      ORDER BY hours_stuck DESC
    `);
    return result.rows;
}
/**
 * Find stuck payouts
 */
async function findStuckPayouts() {
    const result = await (0, client_1.query)(`
      SELECT 
        p.id, p.cleaner_id, p.job_id, p.amount_cents, p.status, p.created_at,
        EXTRACT(DAY FROM (NOW() - p.created_at)) as days_pending
      FROM payouts p
      WHERE p.status = 'pending'
        AND p.created_at < NOW() - INTERVAL '7 days'
      ORDER BY p.created_at ASC
    `);
    return result.rows;
}
/**
 * Find credit ledger inconsistencies
 */
async function findLedgerInconsistencies() {
    // This checks for users where ledger sum doesn't match expected patterns
    const result = await (0, client_1.query)(`
      WITH user_balances AS (
        SELECT 
          u.id as user_id,
          u.email,
          COALESCE(SUM(cl.delta_credits), 0) as computed_balance
        FROM users u
        LEFT JOIN credit_ledger cl ON cl.user_id = u.id
        GROUP BY u.id, u.email
      ),
      expected_patterns AS (
        -- Clients should have balance >= 0 (unless refunds pending)
        -- Cleaners should have balance >= 0
        SELECT 
          user_id,
          email,
          computed_balance,
          CASE 
            WHEN computed_balance < -100 THEN computed_balance  -- Large negative = problem
            ELSE 0
          END as expected_balance
        FROM user_balances
      )
      SELECT 
        user_id,
        email,
        computed_balance,
        expected_balance,
        ABS(computed_balance - expected_balance) as discrepancy
      FROM expected_patterns
      WHERE computed_balance < -100  -- Flag significant negative balances
      ORDER BY discrepancy DESC
    `);
    return result.rows;
}
// ============================================
// Repair Actions
// ============================================
/**
 * Force-complete a stuck job
 */
async function forceCompleteJob(jobId, adminId, reason) {
    const jobResult = await (0, client_1.query)(`SELECT status, cleaner_id FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    const oldStatus = job.status;
    // Update job
    await (0, client_1.query)(`
      UPDATE jobs 
      SET status = 'completed', 
          actual_end_at = COALESCE(actual_end_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
    `, [jobId]);
    // Log event
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "admin",
        actorId: adminId,
        eventName: "job.force_completed",
        payload: { oldStatus, reason, forcedBy: adminId },
    });
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: adminId,
        actorType: "admin",
        action: "job_force_completed",
        resourceType: "job",
        resourceId: jobId,
        oldValue: { status: oldStatus },
        newValue: { status: "completed" },
        metadata: { reason },
    });
    logger_1.logger.info("job_force_completed", { jobId, oldStatus, adminId, reason });
    return {
        success: true,
        action: "force_complete",
        resourceId: jobId,
        details: { oldStatus, newStatus: "completed", reason },
    };
}
/**
 * Force-cancel a stuck job (with optional refund)
 */
async function forceCancelJob(jobId, adminId, reason, refundCredits = true) {
    const jobResult = await (0, client_1.query)(`SELECT status, client_id, cleaner_id, credit_amount FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    const oldStatus = job.status;
    // Update job
    await (0, client_1.query)(`UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [jobId]);
    // Refund credits if requested
    if (refundCredits && job.credit_amount > 0) {
        await (0, client_1.query)(`
        INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
        VALUES ($1, $2, $3, 'refund')
      `, [job.client_id, jobId, job.credit_amount]);
    }
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "admin",
        actorId: adminId,
        eventName: "job.force_cancelled",
        payload: { oldStatus, reason, refundCredits, forcedBy: adminId },
    });
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: adminId,
        actorType: "admin",
        action: "job_force_cancelled",
        resourceType: "job",
        resourceId: jobId,
        oldValue: { status: oldStatus },
        newValue: { status: "cancelled" },
        metadata: { reason, refundCredits, refundAmount: refundCredits ? job.credit_amount : 0 },
    });
    logger_1.logger.info("job_force_cancelled", { jobId, oldStatus, adminId, reason, refundCredits });
    return {
        success: true,
        action: "force_cancel",
        resourceId: jobId,
        details: { oldStatus, newStatus: "cancelled", reason, refundCredits },
    };
}
/**
 * Reassign stuck job to a different cleaner
 */
async function reassignJob(jobId, newCleanerId, adminId, reason) {
    const jobResult = await (0, client_1.query)(`SELECT status, cleaner_id FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    const oldCleanerId = job.cleaner_id;
    await (0, client_1.query)(`UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`, [jobId, newCleanerId]);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "admin",
        actorId: adminId,
        eventName: "job.reassigned",
        payload: { oldCleanerId, newCleanerId, reason, forcedBy: adminId },
    });
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: adminId,
        actorType: "admin",
        action: "job_reassigned",
        resourceType: "job",
        resourceId: jobId,
        oldValue: { cleaner_id: oldCleanerId },
        newValue: { cleaner_id: newCleanerId },
        metadata: { reason },
    });
    logger_1.logger.info("job_reassigned", { jobId, oldCleanerId, newCleanerId, adminId });
    return {
        success: true,
        action: "reassign",
        resourceId: jobId,
        details: { oldCleanerId, newCleanerId, reason },
    };
}
/**
 * Adjust user credit balance (repair ledger)
 */
async function adjustCredits(userId, amount, reason, adminId) {
    // Get current balance
    const balanceResult = await (0, client_1.query)(`SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`, [userId]);
    const oldBalance = Number(balanceResult.rows[0]?.balance || 0);
    await (0, client_1.query)(`INSERT INTO credit_ledger (user_id, delta_credits, reason) VALUES ($1, $2, 'adjustment')`, [userId, amount]);
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: adminId,
        actorType: "admin",
        action: "credits_adjusted",
        resourceType: "credit_ledger",
        resourceId: userId,
        oldValue: { balance: oldBalance },
        newValue: { balance: oldBalance + amount },
        metadata: { adjustment: amount, reason },
    });
    logger_1.logger.info("credits_adjusted", { userId, amount, oldBalance, newBalance: oldBalance + amount, adminId });
    return {
        success: true,
        action: "adjust_credits",
        resourceId: userId,
        details: { oldBalance, newBalance: oldBalance + amount, adjustment: amount, reason },
    };
}
/**
 * Force process stuck payout
 */
async function forceProcessPayout(payoutId, adminId) {
    const payoutResult = await (0, client_1.query)(`SELECT * FROM payouts WHERE id = $1`, [payoutId]);
    const payout = payoutResult.rows[0];
    if (!payout) {
        throw Object.assign(new Error("Payout not found"), { statusCode: 404 });
    }
    if (payout.status !== "pending") {
        throw Object.assign(new Error("Payout is not pending"), { statusCode: 400 });
    }
    // Import and call the payout service
    const { processPayoutRetries, queuePayoutForRetry } = await Promise.resolve().then(() => __importStar(require("./payoutImprovementsService")));
    // Queue it for immediate retry
    await queuePayoutForRetry({
        payoutId: payout.id,
        cleanerId: payout.cleaner_id,
        amountCents: payout.amount_cents,
        stripeAccountId: null, // Will be fetched during processing
        errorMessage: "Admin forced retry",
    });
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: adminId,
        actorType: "admin",
        action: "payout_force_processed",
        resourceType: "payout",
        resourceId: payoutId,
        metadata: { amount_cents: payout.amount_cents },
    });
    logger_1.logger.info("payout_force_processed", { payoutId, adminId });
    return {
        success: true,
        action: "force_process_payout",
        resourceId: payoutId,
        details: { status: "queued_for_retry", amount_cents: payout.amount_cents },
    };
}
// ============================================
// System Health Check
// ============================================
/**
 * Run comprehensive system health check
 */
async function runSystemHealthCheck() {
    const [stuckJobs, stuckPayouts, ledgerInconsistencies, pendingWebhooks, fraudAlerts] = await Promise.all([
        findStuckJobs(),
        findStuckPayouts(),
        findLedgerInconsistencies(),
        (0, client_1.query)(`SELECT COUNT(*)::text as count FROM webhook_failures WHERE status = 'pending'`),
        (0, client_1.query)(`SELECT COUNT(*)::text as count FROM fraud_alerts WHERE status = 'open'`),
    ]);
    return {
        stuckJobs: stuckJobs.length,
        stuckPayouts: stuckPayouts.length,
        ledgerInconsistencies: ledgerInconsistencies.length,
        pendingWebhooks: Number(pendingWebhooks.rows[0]?.count || 0),
        openFraudAlerts: Number(fraudAlerts.rows[0]?.count || 0),
        details: {
            stuckJobs,
            stuckPayouts,
            ledgerInconsistencies,
        },
    };
}
