// src/workers/payoutReconciliation.ts
// Scheduled job to auto-flag payout/earnings mismatches and optionally pause payouts

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import { findPayoutEarningMismatches } from "../../services/adminRepairService";
import { upsertReconciliationFlag } from "../../services/reconciliationService";
import { sendAlert } from "../../lib/alerting";

async function main(): Promise<void> {
  logger.info("payout_reconciliation_worker_started");
  try {
    const mismatches = await findPayoutEarningMismatches();
    for (const m of mismatches) {
      await upsertReconciliationFlag({
        payoutId: m.payout_id,
        cleanerId: m.cleaner_id,
        deltaCents: m.delta_cents,
      });
    }

    if (mismatches.length > 0) {
      await sendAlert({
        level: "warning",
        title: "Payout reconciliation mismatches",
        message: `${mismatches.length} payouts differ from summed earnings.`,
        details: { mismatches: mismatches.slice(0, 10) },
      });
    }

    logger.info("payout_reconciliation_worker_completed", {
      mismatches: mismatches.length,
    });
  } catch (error) {
    logger.error("payout_reconciliation_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("payout_reconciliation_worker_unhandled", { error: err.message });
    process.exit(1);
  });
}

