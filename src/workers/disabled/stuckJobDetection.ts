// src/workers/stuckJobDetection.ts
// Worker to detect and alert on stuck jobs, payouts, and system issues
//
// Run every 15 minutes: node dist/workers/stuckJobDetection.js

import { pool, query } from "../../db/client";
import { logger } from "../../lib/logger";
import {
  findStuckJobs,
  findStuckPayouts,
  findLedgerInconsistencies,
  findPayoutEarningMismatches,
  runSystemHealthCheck,
} from "../../services/adminRepairService";
import { upsertReconciliationFlag } from "../../services/reconciliationService";
import { getOpenFraudAlerts, FraudAlert } from "../../services/creditEconomyService";
import { publishEvent } from "../../lib/events";
import { sendAlert as sendAlertLib } from "../../lib/alerting";

// Thresholds for alerting
const ALERT_THRESHOLDS = {
  STUCK_JOBS: 5,        // Alert if > 5 stuck jobs
  STUCK_PAYOUTS: 10,    // Alert if > 10 stuck payouts
  LEDGER_ISSUES: 1,     // Alert immediately on ledger issues
  FRAUD_ALERTS: 1,      // Alert on any fraud alerts
  WEBHOOK_FAILURES: 20, // Alert if > 20 pending webhooks
};

// No-show grace period (minutes) after scheduled_start_at with no check-in
const NO_SHOW_GRACE_MINUTES = 60;

const sendAlert = sendAlertLib;

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("stuck_job_detection_started");

  try {
    // No-show detection for jobs with no check-in past grace
    await detectNoShowJobs();

    // Run health check
    const health = await runSystemHealthCheck();

    logger.info("system_health_snapshot", {
      stuckJobs: health.stuckJobs,
      stuckPayouts: health.stuckPayouts,
      ledgerInconsistencies: health.ledgerInconsistencies,
      pendingWebhooks: health.pendingWebhooks,
      openFraudAlerts: health.openFraudAlerts,
    });

    // Check stuck jobs
    if (health.stuckJobs > ALERT_THRESHOLDS.STUCK_JOBS) {
      await sendAlert({
        level: "warning",
        title: "High number of stuck jobs detected",
        message: `${health.stuckJobs} jobs are stuck in various states. Manual intervention may be required.`,
        details: {
          count: health.stuckJobs,
          jobs: health.details.stuckJobs.slice(0, 10),
        },
      });
    }

    // Check stuck payouts
    if (health.stuckPayouts > ALERT_THRESHOLDS.STUCK_PAYOUTS) {
      await sendAlert({
        level: "warning",
        title: "High number of stuck payouts detected",
        message: `${health.stuckPayouts} payouts have been pending for over 7 days.`,
        details: {
          count: health.stuckPayouts,
          payouts: health.details.stuckPayouts.slice(0, 10),
        },
      });
    }

    // Check ledger issues - these are critical
    if (health.ledgerInconsistencies >= ALERT_THRESHOLDS.LEDGER_ISSUES) {
      await sendAlert({
        level: "critical",
        title: "Credit ledger inconsistencies detected",
        message: `${health.ledgerInconsistencies} users have inconsistent credit balances. Immediate attention required.`,
        details: {
          count: health.ledgerInconsistencies,
          issues: health.details.ledgerInconsistencies,
        },
      });
    }

    // Check fraud alerts
    if (health.openFraudAlerts >= ALERT_THRESHOLDS.FRAUD_ALERTS) {
      const alerts = await getOpenFraudAlerts();
      const criticalAlerts = alerts.filter((a: FraudAlert) => a.severity === "critical");

      if (criticalAlerts.length > 0) {
        await sendAlert({
          level: "critical",
          title: "Critical fraud alerts pending",
          message: `${criticalAlerts.length} critical fraud alerts require immediate attention.`,
          details: {
            totalAlerts: health.openFraudAlerts,
            criticalAlerts: criticalAlerts.map((a) => ({
              id: a.id,
              type: a.alert_type,
              description: a.description,
            })),
          },
        });
      } else if (health.openFraudAlerts > 5) {
        await sendAlert({
          level: "warning",
          title: "Multiple fraud alerts pending",
          message: `${health.openFraudAlerts} fraud alerts are awaiting review.`,
          details: { count: health.openFraudAlerts },
        });
      }
    }

    // Check pending webhooks
    if (health.pendingWebhooks > ALERT_THRESHOLDS.WEBHOOK_FAILURES) {
      await sendAlert({
        level: "warning",
        title: "High number of pending webhook retries",
        message: `${health.pendingWebhooks} webhooks are pending retry. Check webhook processing.`,
        details: { count: health.pendingWebhooks },
      });
    }

    // Payout vs earnings reconciliation
    const mismatches = await findPayoutEarningMismatches();
    if (mismatches.length > 0) {
      for (const m of mismatches) {
        await upsertReconciliationFlag({
          payoutId: m.payout_id,
          cleanerId: m.cleaner_id,
          deltaCents: m.delta_cents,
        });
      }
      await sendAlert({
        level: "warning",
        title: "Payout/earnings reconciliation mismatches",
        message: `${mismatches.length} payouts differ from summed earnings.`,
        details: { mismatches: mismatches.slice(0, 10) },
      });
    }

    // Auto-handle some issues if configured
    await autoHandleStuckJobs(health.details.stuckJobs);

    logger.info("stuck_job_detection_completed", {
      alertsSent: calculateAlertCount(health),
    });
  } catch (error) {
    logger.error("stuck_job_detection_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    // Send error alert
    await sendAlert({
      level: "error",
      title: "Stuck job detection worker failed",
      message: `The stuck job detection worker encountered an error: ${(error as Error).message}`,
      details: { error: (error as Error).message },
    });

    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Auto-handle certain types of stuck jobs
 */
async function autoHandleStuckJobs(stuckJobs: Array<{ id: string; reason: string; hours_stuck: number }>): Promise<void> {
  for (const job of stuckJobs) {
    // Auto-approve jobs that have been awaiting approval for too long
    if (job.reason.includes("Awaiting approval for 7+ days") && job.hours_stuck > 24 * 7) {
      logger.info("auto_approving_stuck_job", { jobId: job.id, hoursStuck: job.hours_stuck });

      // Import dynamically to avoid circular deps
      const { forceCompleteJob } = await import("../../services/adminRepairService");
      
      try {
        await forceCompleteJob(job.id, "system", "Auto-approved after 7+ days awaiting approval");
      } catch (err) {
        logger.error("auto_approve_failed", { jobId: job.id, error: (err as Error).message });
      }
    }
  }
}

/**
 * Detect and mark no-shows: jobs in accepted/on_my_way with no check-in past grace
 */
async function detectNoShowJobs(): Promise<void> {
  const result = await query<{ job_id: string; status: string; scheduled_start_at: string }>(
    `
      SELECT j.id AS job_id, j.status, j.scheduled_start_at
      FROM jobs j
      WHERE j.status IN ('accepted', 'on_my_way')
        AND j.scheduled_start_at + INTERVAL '${NO_SHOW_GRACE_MINUTES} minutes' < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM job_checkins c WHERE c.job_id = j.id
        )
    `
  );

  for (const row of result.rows) {
    logger.warn("marking_no_show_due_to_no_checkin", {
      jobId: row.job_id,
      status: row.status,
      scheduled_start_at: row.scheduled_start_at,
      graceMinutes: NO_SHOW_GRACE_MINUTES,
    });

    // Publish a cancellation/no-show event; downstream logic should refund per policy
    await publishEvent({
      jobId: row.job_id,
      actorType: "system",
      actorId: null,
      eventName: "job_cancelled",
      payload: { reason: "no_show", auto: true },
    });
  }
}

/**
 * Calculate how many alerts would be sent
 */
function calculateAlertCount(health: Awaited<ReturnType<typeof runSystemHealthCheck>>): number {
  let count = 0;
  if (health.stuckJobs > ALERT_THRESHOLDS.STUCK_JOBS) count++;
  if (health.stuckPayouts > ALERT_THRESHOLDS.STUCK_PAYOUTS) count++;
  if (health.ledgerInconsistencies >= ALERT_THRESHOLDS.LEDGER_ISSUES) count++;
  if (health.openFraudAlerts >= ALERT_THRESHOLDS.FRAUD_ALERTS) count++;
  if (health.pendingWebhooks > ALERT_THRESHOLDS.WEBHOOK_FAILURES) count++;
  return count;
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("Stuck job detection completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Stuck job detection failed:", error);
      process.exit(1);
    });
}

export { main as runStuckJobDetection };

