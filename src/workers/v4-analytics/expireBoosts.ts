// src/workers/expireBoosts.ts
// Worker to expire old cleaner boosts
//
// Run hourly: node dist/workers/expireBoosts.js

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import { expireOldBoosts } from "../../services/premiumService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("expire_boosts_worker_started");

  try {
    const expiredCount = await expireOldBoosts();

    logger.info("expire_boosts_worker_completed", { expiredCount });
  } catch (error) {
    logger.error("expire_boosts_worker_failed", {
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
      console.log("Expire boosts worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Expire boosts worker failed:", error);
      process.exit(1);
    });
}

export { main as runExpireBoosts };
