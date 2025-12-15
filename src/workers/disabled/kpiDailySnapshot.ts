// src/workers/kpiDailySnapshot.ts
// Daily worker to aggregate KPIs into kpi_snapshots table
//
// Run on a schedule (e.g., daily at 01:00 UTC):
// node dist/workers/kpiDailySnapshot.js
// 
// Cron example: 0 1 * * * node /app/dist/workers/kpiDailySnapshot.js

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import { createDailyKpiSnapshot, getExtendedDailyMetrics } from "../../services/kpiService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("kpi_daily_worker_started", {
    timestamp: new Date().toISOString(),
  });

  try {
    // Create the daily KPI snapshot (upsert)
    const snapshot = await createDailyKpiSnapshot();

    // Also log extended metrics (not stored, just for visibility)
    const extended = await getExtendedDailyMetrics();

    logger.info("kpi_daily_worker_completed", {
      date: snapshot.date,
      total_jobs: snapshot.total_jobs,
      completed_jobs: snapshot.completed_jobs,
      disputed_jobs: snapshot.disputed_jobs,
      cancelled_jobs: snapshot.cancelled_jobs,
      // Extended metrics for logging
      new_users: extended.new_users,
      credits_purchased: extended.credits_purchased,
      credits_released: extended.credits_released,
      payouts_paid: extended.payouts_paid,
    });
  } catch (error) {
    logger.error("kpi_daily_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    // Close database connection pool
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("KPI daily snapshot worker completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("KPI daily snapshot worker failed:", error);
      process.exit(1);
    });
}

export { main as runKpiDailySnapshot };

