// src/services/adminRepairService.ts
// Admin repair tools for stuck jobs, credits, and system issues

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { createAuditLog } from "./creditEconomyService";
import { publishEvent } from "../lib/events";

// ============================================
// Types
// ============================================

export interface StuckJob {
  id: string;
  status: string;
  client_id: string;
  cleaner_id: string | null;
  scheduled_start_at: string;
  created_at: string;
  hours_stuck: number;
  reason: string;
}

export interface StuckPayout {
  id: string;
  cleaner_id: string;
  job_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  days_pending: number;
}

export interface LedgerInconsistency {
  user_id: string;
  email: string;
  computed_balance: number;
  expected_balance: number;
  discrepancy: number;
}

export interface PayoutEarningMismatch {
  payout_id: string;
  cleaner_id: string | null;
  amount_cents: number;
  earnings_cents: number;
  delta_cents: number;
}

export interface RepairResult {
  success: boolean;
  action: string;
  resourceId: string;
  details: Record<string, unknown>;
}

// ============================================
// Stuck Job Detection
// ============================================

/**
 * Find jobs stuck in various states
 */
export async function findStuckJobs(): Promise<StuckJob[]> {
  const result = await query<StuckJob>(
    `
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
    `
  );

  return result.rows;
}

/**
 * Find stuck payouts
 */
export async function findStuckPayouts(): Promise<StuckPayout[]> {
  const result = await query<StuckPayout>(
    `
      SELECT 
        p.id, p.cleaner_id, p.job_id, p.amount_cents, p.status, p.created_at,
        EXTRACT(DAY FROM (NOW() - p.created_at)) as days_pending
      FROM payouts p
      WHERE p.status = 'pending'
        AND p.created_at < NOW() - INTERVAL '7 days'
      ORDER BY p.created_at ASC
    `
  );

  return result.rows;
}

/**
 * Find mismatches between payouts and linked earnings
 */
export async function findPayoutEarningMismatches(): Promise<PayoutEarningMismatch[]> {
  const result = await query<PayoutEarningMismatch>(
    `
      SELECT 
        p.id as payout_id,
        p.cleaner_id,
        COALESCE(p.amount_cents, 0) as amount_cents,
        COALESCE(SUM(e.amount_cents), 0) as earnings_cents,
        COALESCE(SUM(e.amount_cents), 0) - COALESCE(p.amount_cents, 0) as delta_cents
      FROM payouts p
      LEFT JOIN cleaner_earnings e ON e.payout_id = p.id
      GROUP BY p.id, p.cleaner_id, p.amount_cents
      HAVING COALESCE(SUM(e.amount_cents), 0) <> COALESCE(p.amount_cents, 0)
    `
  );

  return result.rows;
}

/**
 * Find credit ledger inconsistencies
 */
export async function findLedgerInconsistencies(): Promise<LedgerInconsistency[]> {
  // This checks for users where ledger sum doesn't match expected patterns
  const result = await query<LedgerInconsistency>(
    `
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
    `
  );

  return result.rows;
}

// ============================================
// Repair Actions
// ============================================

/**
 * Force-complete a stuck job
 */
export async function forceCompleteJob(
  jobId: string,
  adminId: string,
  reason: string
): Promise<RepairResult> {
  const jobResult = await query<{ status: string; cleaner_id: string | null }>(
    `SELECT status, cleaner_id FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  const oldStatus = job.status;

  // Update job
  await query(
    `
      UPDATE jobs 
      SET status = 'completed', 
          actual_end_at = COALESCE(actual_end_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
    `,
    [jobId]
  );

  // Log event
  await publishEvent({
    jobId,
    actorType: "admin",
    actorId: adminId,
    eventName: "job.force_completed",
    payload: { oldStatus, reason, forcedBy: adminId },
  });

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "job_force_completed",
    resourceType: "job",
    resourceId: jobId,
    oldValue: { status: oldStatus },
    newValue: { status: "completed" },
    metadata: { reason },
  });

  logger.info("job_force_completed", { jobId, oldStatus, adminId, reason });

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
export async function forceCancelJob(
  jobId: string,
  adminId: string,
  reason: string,
  refundCredits: boolean = true
): Promise<RepairResult> {
  const jobResult = await query<{
    status: string;
    client_id: string;
    cleaner_id: string | null;
    credit_amount: number;
  }>(
    `SELECT status, client_id, cleaner_id, credit_amount FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  const oldStatus = job.status;

  // Update job
  await query(
    `UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [jobId]
  );

  // Refund credits if requested
  if (refundCredits && job.credit_amount > 0) {
    await query(
      `
        INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason)
        VALUES ($1, $2, $3, 'refund')
      `,
      [job.client_id, jobId, job.credit_amount]
    );
  }

  await publishEvent({
    jobId,
    actorType: "admin",
    actorId: adminId,
    eventName: "job.force_cancelled",
    payload: { oldStatus, reason, refundCredits, forcedBy: adminId },
  });

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "job_force_cancelled",
    resourceType: "job",
    resourceId: jobId,
    oldValue: { status: oldStatus },
    newValue: { status: "cancelled" },
    metadata: { reason, refundCredits, refundAmount: refundCredits ? job.credit_amount : 0 },
  });

  logger.info("job_force_cancelled", { jobId, oldStatus, adminId, reason, refundCredits });

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
export async function reassignJob(
  jobId: string,
  newCleanerId: string,
  adminId: string,
  reason: string
): Promise<RepairResult> {
  const jobResult = await query<{ status: string; cleaner_id: string | null }>(
    `SELECT status, cleaner_id FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  const oldCleanerId = job.cleaner_id;

  await query(
    `UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [jobId, newCleanerId]
  );

  await publishEvent({
    jobId,
    actorType: "admin",
    actorId: adminId,
    eventName: "job.reassigned",
    payload: { oldCleanerId, newCleanerId, reason, forcedBy: adminId },
  });

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "job_reassigned",
    resourceType: "job",
    resourceId: jobId,
    oldValue: { cleaner_id: oldCleanerId },
    newValue: { cleaner_id: newCleanerId },
    metadata: { reason },
  });

  logger.info("job_reassigned", { jobId, oldCleanerId, newCleanerId, adminId });

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
export async function adjustCredits(
  userId: string,
  amount: number,
  reason: string,
  adminId: string
): Promise<RepairResult> {
  // Get current balance
  const balanceResult = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );

  const oldBalance = Number(balanceResult.rows[0]?.balance || 0);

  await query(
    `INSERT INTO credit_ledger (user_id, delta_credits, reason) VALUES ($1, $2, 'adjustment')`,
    [userId, amount]
  );

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "credits_adjusted",
    resourceType: "credit_ledger",
    resourceId: userId,
    oldValue: { balance: oldBalance },
    newValue: { balance: oldBalance + amount },
    metadata: { adjustment: amount, reason },
  });

  logger.info("credits_adjusted", { userId, amount, oldBalance, newBalance: oldBalance + amount, adminId });

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
export async function forceProcessPayout(
  payoutId: string,
  adminId: string
): Promise<RepairResult> {
  const payoutResult = await query<{
    id: string;
    cleaner_id: string;
    amount_cents: number;
    status: string;
  }>(
    `SELECT * FROM payouts WHERE id = $1`,
    [payoutId]
  );

  const payout = payoutResult.rows[0];
  if (!payout) {
    throw Object.assign(new Error("Payout not found"), { statusCode: 404 });
  }

  if (payout.status !== "pending") {
    throw Object.assign(new Error("Payout is not pending"), { statusCode: 400 });
  }

  // Import and call the payout service
  const { processPayoutRetries, queuePayoutForRetry } = await import("./payoutImprovementsService");

  // Queue it for immediate retry
  await queuePayoutForRetry({
    payoutId: payout.id,
    cleanerId: payout.cleaner_id,
    amountCents: payout.amount_cents,
    stripeAccountId: null, // Will be fetched during processing
    errorMessage: "Admin forced retry",
  });

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "payout_force_processed",
    resourceType: "payout",
    resourceId: payoutId,
    metadata: { amount_cents: payout.amount_cents },
  });

  logger.info("payout_force_processed", { payoutId, adminId });

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
export async function runSystemHealthCheck(): Promise<{
  stuckJobs: number;
  stuckPayouts: number;
  ledgerInconsistencies: number;
  pendingWebhooks: number;
  openFraudAlerts: number;
  details: {
    stuckJobs: StuckJob[];
    stuckPayouts: StuckPayout[];
    ledgerInconsistencies: LedgerInconsistency[];
  };
}> {
  const [stuckJobs, stuckPayouts, ledgerInconsistencies, pendingWebhooks, fraudAlerts] = await Promise.all([
    findStuckJobs(),
    findStuckPayouts(),
    findLedgerInconsistencies(),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM webhook_failures WHERE status = 'pending'`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM fraud_alerts WHERE status = 'open'`),
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

