// src/services/creditsService.ts
// Complete credit system matching 001_init.sql + 003_credit_views.sql
//
// Credit Model:
// - Client buys credits → +credits (reason: purchase)
// - Escrow for job → -credits from client (reason: job_escrow)
// - Release credits to cleaner → +credits to cleaner (reason: job_release)
// - Refund after dispute → +credits back to client (reason: refund)
// - Manual tweaks → ±credits (reason: adjustment)

import { query, withTransaction } from "../db/client";
import { PoolClient } from "pg";
import { CreditReason, CreditLedgerEntry } from "../types/db";
import { logger } from "../lib/logger";
import { env } from "../config/env";

export type { CreditReason };

// Re-export for backwards compatibility
export { CreditLedgerEntry };

/**
 * Get user's current credit balance
 * Balance = SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) from credit_ledger
 */
export async function getUserBalance(userId: string): Promise<number> {
  const result = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );
  return Number(result.rows[0]?.balance ?? 0);
}

/**
 * Get user's credit balance (alias for backwards compatibility)
 */
export const getUserCreditBalance = getUserBalance;

/**
 * Record a ledger entry
 * Positive deltaCredits = add credits (direction = 'credit')
 * Negative deltaCredits = remove credits (direction = 'debit')
 * 
 * V1 HARDENING: For idempotent operations (escrow, refund, etc.), uses ON CONFLICT
 * to prevent duplicates via unique constraints.
 */
export async function addLedgerEntry(input: {
  userId: string;
  jobId?: string | null;
  deltaCredits: number;
  reason: CreditReason;
}): Promise<CreditLedgerEntry> {
  const { userId, jobId = null, deltaCredits, reason } = input;

  // V1 HARDENING: Check credits guard flag
  if (!env.CREDITS_ENABLED && reason !== 'refund') {
    throw Object.assign(
      new Error("Credits are currently disabled"),
      { statusCode: 503, code: "CREDITS_DISABLED" }
    );
  }

  // V1 HARDENING: Check refunds guard flag
  if (reason === 'refund' && !env.REFUNDS_ENABLED) {
    throw Object.assign(
      new Error("Refunds are currently disabled"),
      { statusCode: 503, code: "REFUNDS_DISABLED" }
    );
  }

  // Convert deltaCredits to amount and direction
  const amount = Math.abs(deltaCredits);
  const direction = deltaCredits >= 0 ? 'credit' : 'debit';

  // Check if this is an idempotent operation (has unique constraint)
  const isIdempotentOperation = 
    reason === 'job_escrow' || 
    reason === 'job_release' || 
    reason === 'refund' ||
    reason === 'purchase';

  if (isIdempotentOperation && jobId) {
    // For idempotent operations, check for existing entry first
    // The unique constraint (user_id, reason, job_id) will prevent duplicates
    const existing = await query<CreditLedgerEntry>(
      `
        SELECT * FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = $3
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId, jobId, reason]
    );

    if (existing.rows[0]) {
      logger.info("credit_ledger_entry_duplicate_prevented", {
        userId,
        jobId,
        reason,
        existingEntryId: existing.rows[0].id,
      });
      return existing.rows[0];
    }
  }

  // Non-idempotent operation or no jobId - insert normally
  const result = await query<CreditLedgerEntry>(
    `
      INSERT INTO credit_ledger (user_id, job_id, amount, direction, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [userId, jobId, amount, direction, reason]
  );

  logger.info("credit_ledger_entry", {
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
export async function ensureUserHasCredits(
  userId: string,
  requiredCredits: number
): Promise<void> {
  const balance = await getUserBalance(userId);
  if (balance < requiredCredits) {
    throw Object.assign(
      new Error(`Insufficient credits. Required: ${requiredCredits}, Available: ${balance}`),
      { statusCode: 400, code: "INSUFFICIENT_CREDITS" }
    );
  }
}

/**
 * On job creation: move credits into "escrow" by deducting from client.
 * This deducts from their available balance.
 */
export async function escrowJobCredits(
  clientId: string,
  jobId: string,
  creditAmount: number
): Promise<CreditLedgerEntry> {
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
export async function releaseJobCreditsToCleaner(
  cleanerId: string,
  jobId: string,
  creditAmount: number
): Promise<CreditLedgerEntry> {
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
export async function refundJobCreditsToClient(
  clientId: string,
  jobId: string,
  creditAmount: number
): Promise<CreditLedgerEntry> {
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
export async function purchaseCredits(options: {
  userId: string;
  creditAmount: number;
}): Promise<CreditLedgerEntry> {
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
export async function adjustCredits(options: {
  userId: string;
  creditAmount: number;
}): Promise<CreditLedgerEntry> {
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
export async function getCreditHistory(
  userId: string,
  limit: number = 100
): Promise<CreditLedgerEntry[]> {
  const result = await query<CreditLedgerEntry>(
    `
      SELECT *
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get credit history with running balance
 */
export async function getCreditHistoryWithBalance(
  userId: string,
  limit: number = 100
): Promise<(CreditLedgerEntry & { running_balance: number })[]> {
  const result = await query<CreditLedgerEntry & { running_balance: number }>(
    `
      SELECT *
      FROM credit_ledger_with_balance
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get credit ledger entries for a specific job
 */
export async function getJobCreditEntries(
  jobId: string
): Promise<CreditLedgerEntry[]> {
  const result = await query<CreditLedgerEntry>(
    `
      SELECT *
      FROM credit_ledger
      WHERE job_id = $1
      ORDER BY created_at ASC
    `,
    [jobId]
  );

  return result.rows;
}

/**
 * Get balance with summary statistics
 */
export async function getBalanceWithSummary(userId: string): Promise<{
  balance: number;
  totalPurchased: number;
  totalEscrowed: number;
  totalReleased: number;
  totalRefunded: number;
  totalAdjusted: number;
}> {
  const result = await query<{
    balance: string;
    total_purchased: string;
    total_escrowed: string;
    total_released: string;
    total_refunded: string;
    total_adjusted: string;
  }>(
    `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) as balance,
        COALESCE(SUM(CASE WHEN reason = 'purchase' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_purchased,
        COALESCE(SUM(CASE WHEN reason = 'job_escrow' AND direction = 'debit' THEN amount ELSE 0 END), 0) as total_escrowed,
        COALESCE(SUM(CASE WHEN reason = 'job_release' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_released,
        COALESCE(SUM(CASE WHEN reason = 'refund' AND direction = 'credit' THEN amount ELSE 0 END), 0) as total_refunded,
        COALESCE(SUM(CASE WHEN reason = 'adjustment' THEN CASE WHEN direction = 'credit' THEN amount ELSE -amount END ELSE 0 END), 0) as total_adjusted
      FROM credit_ledger
      WHERE user_id = $1
    `,
    [userId]
  );

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
export async function escrowCreditsWithTransaction(options: {
  clientId: string;
  jobId: string;
  creditAmount: number;
}): Promise<CreditLedgerEntry> {
  const { clientId, jobId, creditAmount } = options;

  if (creditAmount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  return withTransaction(async (client: PoolClient) => {
    // V1 HARDENING: Check for existing escrow entry (idempotency)
    const existing = await client.query<CreditLedgerEntry>(
      `
        SELECT * FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = 'job_escrow'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [clientId, jobId]
    );

    if (existing.rows[0]) {
      logger.info("credit_ledger_entry_duplicate_prevented", {
        userId: clientId,
        jobId,
        reason: "job_escrow",
        existingEntryId: existing.rows[0].id,
      });
      return existing.rows[0];
    }

    // Lock rows first, then calculate balance
    // We can't use FOR UPDATE with aggregate functions, so we lock rows in a CTE
    const balanceResult = await client.query<{ balance: string }>(
      `
        WITH locked_rows AS (
          SELECT * FROM credit_ledger WHERE user_id = $1 FOR UPDATE
        )
        SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
        FROM locked_rows
      `,
      [clientId]
    );

    const balance = Number(balanceResult.rows[0]?.balance ?? 0);

    if (balance < creditAmount) {
      throw Object.assign(
        new Error(`Insufficient credits. Required: ${creditAmount}, Available: ${balance}`),
        { statusCode: 400, code: "INSUFFICIENT_CREDITS" }
      );
    }

    // Insert escrow entry (debit = remove credits)
    // Note: Pre-check above handles idempotency. If a race condition occurs,
    // the unique index will throw an error (better than silent duplicate).
    const result = await client.query<CreditLedgerEntry>(
      `
        INSERT INTO credit_ledger (user_id, job_id, amount, direction, reason)
        VALUES ($1, $2, $3, 'debit', 'job_escrow')
        RETURNING *
      `,
      [clientId, jobId, creditAmount]
    );

    logger.info("credits_escrowed", {
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
export const releaseEscrowedCredits = async (options: {
  userId: string;
  jobId: string;
  creditAmount: number;
}) => refundJobCreditsToClient(options.userId, options.jobId, options.creditAmount);

export const refundCredits = async (options: {
  userId: string;
  jobId?: string;
  creditAmount: number;
}) => addLedgerEntry({
  userId: options.userId,
  jobId: options.jobId,
  deltaCredits: options.creditAmount,
  reason: "refund",
});

export const escrowCreditsForJob = escrowJobCredits;
