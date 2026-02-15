// src/workers/weeklySummary.ts
// Worker to send weekly summary emails to clients and cleaners
//
// Run weekly (Sunday evening): node dist/workers/weeklySummary.js

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import {
  sendAllClientWeeklySummaries,
  sendAllCleanerWeeklySummaries,
  getPreviousWeekRange,
} from "../../services/weeklySummaryService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  const { weekStart, weekEnd } = getPreviousWeekRange();

  logger.info("weekly_summary_worker_started", {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });

  try {
    // Send client summaries
    logger.info("sending_client_summaries");
    const clientResults = await sendAllClientWeeklySummaries(weekStart, weekEnd);
    logger.info("client_summaries_completed", clientResults);

    // Send cleaner summaries
    logger.info("sending_cleaner_summaries");
    const cleanerResults = await sendAllCleanerWeeklySummaries(weekStart, weekEnd);
    logger.info("cleaner_summaries_completed", cleanerResults);

    logger.info("weekly_summary_worker_completed", {
      clientsSent: clientResults.sent,
      clientsFailed: clientResults.failed,
      cleanersSent: cleanerResults.sent,
      cleanersFailed: cleanerResults.failed,
      totalSent: clientResults.sent + cleanerResults.sent,
      totalFailed: clientResults.failed + cleanerResults.failed,
    });
  } catch (error) {
    logger.error("weekly_summary_worker_failed", {
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
      console.log("Weekly summary worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Weekly summary worker failed:", error);
      process.exit(1);
    });
}

export { main as runWeeklySummary };
