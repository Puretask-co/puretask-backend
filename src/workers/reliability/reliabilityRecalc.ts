// src/workers/reliabilityRecalc.ts
// Nightly worker to recalculate all cleaner reliability scores
//
// Run on a schedule (e.g., daily at 03:00 UTC):
// node dist/workers/reliabilityRecalc.js
//
// Cron example: 0 3 * * * node /app/dist/workers/reliabilityRecalc.js

import { pool } from "../db/client";
import { logger } from "../lib/logger";
import { recalcAllCleanersReliability, ReliabilityUpdate } from "../services/reliabilityService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("reliability_recalc_worker_started", {
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await recalcAllCleanersReliability();

    // Log significant score changes
    const significantChanges = result.updates.filter(
      (u: ReliabilityUpdate) => Math.abs(u.newScore - u.previousScore) >= 5
    );

    if (significantChanges.length > 0) {
      logger.info("reliability_significant_changes", {
        count: significantChanges.length,
        changes: significantChanges.map((c: ReliabilityUpdate) => ({
          cleanerId: c.cleanerId,
          from: c.previousScore,
          to: c.newScore,
          delta: c.newScore - c.previousScore,
        })),
      });
    }

    logger.info("reliability_recalc_worker_completed", {
      processed: result.processed,
      failed: result.failed,
      significantChanges: significantChanges.length,
    });
  } catch (error) {
    logger.error("reliability_recalc_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("Reliability recalc worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Reliability recalc worker failed:", error);
      process.exit(1);
    });
}

export { main as runReliabilityRecalc };

