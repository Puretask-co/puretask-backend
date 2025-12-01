// src/workers/creditEconomyMaintenance.ts
// Worker for credit economy maintenance tasks
//
// Run daily: node dist/workers/creditEconomyMaintenance.js

import { pool } from "../db/client";
import { logger } from "../lib/logger";
import {
  applyReliabilityDecay,
  cleanupExpiredTierLocks,
  getOpenFraudAlerts,
} from "../services/creditEconomyService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("credit_economy_maintenance_started");

  try {
    // 1. Apply reliability decay for inactive cleaners
    const decayResult = await applyReliabilityDecay();
    logger.info("reliability_decay_completed", decayResult);

    // 2. Cleanup expired tier locks
    const expiredLocks = await cleanupExpiredTierLocks();
    logger.info("tier_locks_cleaned", { expiredLocks });

    // 3. Check for open fraud alerts (alert admins if critical)
    const alerts = await getOpenFraudAlerts();
    const criticalAlerts = alerts.filter((a) => a.severity === "critical");

    if (criticalAlerts.length > 0) {
      logger.warn("critical_fraud_alerts_pending", {
        count: criticalAlerts.length,
        alerts: criticalAlerts.map((a) => ({
          id: a.id,
          type: a.alert_type,
          description: a.description,
        })),
      });
      // TODO: Send notification to admin
    }

    logger.info("credit_economy_maintenance_completed", {
      decayed: decayResult.decayed,
      expiredLocks,
      openAlerts: alerts.length,
      criticalAlerts: criticalAlerts.length,
    });
  } catch (error) {
    logger.error("credit_economy_maintenance_failed", {
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
      console.log("Credit economy maintenance completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Credit economy maintenance failed:", error);
      process.exit(1);
    });
}

export { main as runCreditEconomyMaintenance };

