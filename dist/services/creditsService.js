"use strict";
// src/services/creditsService.ts
// Complete credit system matching 001_init.sql + 003_credit_views.sql
//
// Credit Model:
// - Client buys credits → +credits (reason: purchase)
// - Escrow for job → -credits from client (reason: job_escrow)
// - Release credits to cleaner → +credits to cleaner (reason: job_release)
// - Refund after dispute → +credits back to client (reason: refund)
// - Manual tweaks → ±credits (reason: adjustment)
Object.defineProperty(exports, "__esModule", { value: true });
exports.escrowCreditsForJob = exports.refundCredits = exports.releaseEscrowedCredits = exports.getUserCreditBalance = void 0;
exports.getUserBalance = getUserBalance;
exports.addLedgerEntry = addLedgerEntry;
exports.ensureUserHasCredits = ensureUserHasCredits;
exports.escrowJobCredits = escrowJobCredits;
exports.releaseJobCreditsToCleaner = releaseJobCreditsToCleaner;
exports.refundJobCreditsToClient = refundJobCreditsToClient;
exports.purchaseCredits = purchaseCredits;
exports.adjustCredits = adjustCredits;
exports.getCreditHistory = getCreditHistory;
exports.getCreditHistoryWithBalance = getCreditHistoryWithBalance;
exports.getJobCreditEntries = getJobCreditEntries;
exports.getBalanceWithSummary = getBalanceWithSummary;
exports.escrowCreditsWithTransaction = escrowCreditsWithTransaction;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
/**
 * Get user's current credit balance
 * Balance = SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) from credit_ledger
 */
async function getUserBalance(userId) {
    const result = await (0, client_1.query)(`SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance FROM credit_ledger WHERE user_id = $1`, [userId]);
    return Number(result.rows[0]?.balance ?? 0);
}
/**
 * Get user's credit balance (alias for backwards compatibility)
 */
exports.getUserCreditBalance = getUserBalance;
/**
 * Record a ledger entry
 * Positive deltaCredits = add credits (direction = 'credit')
 * Negative deltaCredits = remove credits (direction = 'debit')
 */
async function addLedgerEntry(input) {
    const { userId, jobId = null, deltaCredits, reason } = input;
    // Convert deltaCredits to amount and direction
    const amount = Math.abs(deltaCredits);
    const direction = deltaCredits >= 0 ? 'credit' : 'debit';
    const result = await (0, client_1.query)(`
      INSERT INTO credit_ledger (user_id, job_id, amount, direction, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, jobId, amount, direction, reason]);
    logger_1.logger.info("credit_ledger_entry", {
        userId,
        jobId,
        deltaCredits,
        amount,
        direction,
        reason,
    });
    return result.rows[0];
}
/**
 * Ensure a client has at least `requiredCredits` balance.
 * Throws if insufficient.
 */
async function ensureUserHasCredits(userId, requiredCredits) {
    const balance = await getUserBalance(userId);
    if (balance < requiredCredits) {
        throw Object.assign(new Error(`Insufficient credits. Required: ${requiredCredits}, Available: ${balance}`), { statusCode: 400, code: "INSUFFICIENT_CREDITS" });
    }
}
/**
 * On job creation: move credits into "escrow" by deducting from client.
 * This deducts from their available balance.
 */
async function escrowJobCredits(clientId, jobId, creditAmount) {
    if (creditAmount <= 0) {
        throw new Error("Credit amount must be positive");
    }
    // Ensure client has enough credits
    await ensureUserHasCredits(clientId, creditAmount);
    // Deduct credits (negative delta)
    return addLedgerEntry({
        userId: clientId,
        jobId,
        deltaCredits: -creditAmount,
        reason: "job_escrow",
    });
}
/**
 * On job completion/approval: release credits to cleaner as earnings.
 * This does NOT touch the client; they already lost credits at escrow time.
 */
async function releaseJobCreditsToCleaner(cleanerId, jobId, creditAmount) {
    if (creditAmount <= 0) {
        throw new Error("Credit amount must be positive");
    }
    // Add credits to cleaner (positive delta)
    return addLedgerEntry({
        userId: cleanerId,
        jobId,
        deltaCredits: creditAmount,
        reason: "job_release",
    });
}
/**
 * On dispute resolution with refund: return credits to client.
 * This is independent of whether cleaner has already been credited.
 */
async function refundJobCreditsToClient(clientId, jobId, creditAmount) {
    if (creditAmount <= 0) {
        throw new Error("Credit amount must be positive");
    }
    // Return credits to client (positive delta)
    return addLedgerEntry({
        userId: clientId,
        jobId,
        deltaCredits: creditAmount,
        reason: "refund",
    });
}
/**
 * Purchase credits (add to user's balance)
 * Called after successful Stripe payment
 */
async function purchaseCredits(options) {
    const { userId, creditAmount } = options;
    if (creditAmount <= 0) {
        throw new Error("Credit amount must be positive");
    }
    return addLedgerEntry({
        userId,
        deltaCredits: creditAmount,
        reason: "purchase",
    });
}
/**
 * Admin adjustment (can be positive or negative)
 */
async function adjustCredits(options) {
    const { userId, creditAmount } = options;
    return addLedgerEntry({
        userId,
        deltaCredits: creditAmount,
        reason: "adjustment",
    });
}
/**
 * Get credit ledger history for a user
 */
async function getCreditHistory(userId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);
    return result.rows;
}
/**
 * Get credit history with running balance
 */
async function getCreditHistoryWithBalance(userId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM credit_ledger_with_balance
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);
    return result.rows;
}
/**
 * Get credit ledger entries for a specific job
 */
async function getJobCreditEntries(jobId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM credit_ledger
      WHERE job_id = $1
      ORDER BY created_at ASC
    `, [jobId]);
    return result.rows;
}
/**
 * Get balance with summary statistics
 */
async function getBalanceWithSummary(userId) {
    const result = await (0, client_1.query)(`
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) as balance,
        COALESCE(SUM(CASE WHEN reason = 'purchase' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_purchased,
        COALESCE(SUM(CASE WHEN reason = 'job_escrow' AND direction = 'debit' THEN amount ELSE 0 END), 0) as total_escrowed,
        COALESCE(SUM(CASE WHEN reason = 'job_release' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_released,
        COALESCE(SUM(CASE WHEN reason = 'refund' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_refunded,
        COALESCE(SUM(CASE WHEN reason = 'adjustment' THEN CASE WHEN direction = 'credit' THEN amount ELSE -amount END ELSE 0 END), 0) as total_adjusted
      FROM credit_ledger
      WHERE user_id = $1
    `, [userId]);
    const row = result.rows[0];
    return {
        balance: Number(row?.balance ?? 0),
        totalPurchased: Number(row?.total_purchased ?? 0),
        totalEscrowed: Number(row?.total_escrowed ?? 0),
        totalReleased: Number(row?.total_released ?? 0),
        totalRefunded: Number(row?.total_refunded ?? 0),
        totalAdjusted: Number(row?.total_adjusted ?? 0),
    };
}
/**
 * Escrow credits with transaction safety
 * Use this for critical operations where atomicity is required
 */
async function escrowCreditsWithTransaction(options) {
    const { clientId, jobId, creditAmount } = options;
    if (creditAmount <= 0) {
        throw new Error("Credit amount must be positive");
    }
    return (0, client_1.withTransaction)(async (client) => {
        // Lock rows first, then calculate balance
        // We can't use FOR UPDATE with aggregate functions, so we lock rows in a CTE
        const balanceResult = await client.query(`
        WITH locked_rows AS (
          SELECT * FROM credit_ledger WHERE user_id = $1 FOR UPDATE
        )
        SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
        FROM locked_rows
      `, [clientId]);
        const balance = Number(balanceResult.rows[0]?.balance ?? 0);
        if (balance < creditAmount) {
            throw Object.assign(new Error(`Insufficient credits. Required: ${creditAmount}, Available: ${balance}`), { statusCode: 400, code: "INSUFFICIENT_CREDITS" });
        }
        // Insert escrow entry (debit = remove credits)
        const result = await client.query(`
        INSERT INTO credit_ledger (user_id, job_id, amount, direction, reason)
        VALUES ($1, $2, $3, 'debit', 'job_escrow')
        RETURNING *
      `, [clientId, jobId, creditAmount]);
        logger_1.logger.info("credits_escrowed", {
            clientId,
            jobId,
            creditAmount,
            previousBalance: balance,
            newBalance: balance - creditAmount,
        });
        return result.rows[0];
    });
}
// Backwards compatibility aliases
const releaseEscrowedCredits = async (options) => refundJobCreditsToClient(options.userId, options.jobId, options.creditAmount);
exports.releaseEscrowedCredits = releaseEscrowedCredits;
const refundCredits = async (options) => addLedgerEntry({
    userId: options.userId,
    jobId: options.jobId,
    deltaCredits: options.creditAmount,
    reason: "refund",
});
exports.refundCredits = refundCredits;
exports.escrowCreditsForJob = escrowJobCredits;
