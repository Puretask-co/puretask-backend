// src/workers/autoPausePayouts.ts
// Auto-pause payouts for cleaners with flagged reconciliation items

import { pool } from "../db/client";
import { logger } from "../lib/logger";

async function main(): Promise<void> {
  logger.info("auto_pause_payouts_started");
  try {
    await pool.query(`
      WITH flagged AS (
        SELECT DISTINCT cleaner_id
        FROM payout_reconciliation_flags
        WHERE status = 'flagged' AND cleaner_id IS NOT NULL
      )
      UPDATE cleaner_profiles cp
      SET payout_paused = true,
          payout_paused_at = NOW()
      FROM flagged f
      WHERE cp.user_id = f.cleaner_id
        AND cp.payout_paused = false
    `);
    logger.info("auto_pause_payouts_completed");
  } catch (error) {
    logger.error("auto_pause_payouts_failed", { error: (error as Error).message });
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("auto_pause_payouts_unhandled", { error: err.message });
    process.exit(1);
  });
}

