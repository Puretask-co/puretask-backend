// src/workers/payoutRetry.ts
// Worker to process failed payout retries
//
// Run every 30 minutes: node dist/workers/payoutRetry.js

import { pool } from "../db/client";
import { logger } from "../lib/logger";
import { processPayoutRetries } from "../services/payoutImprovementsService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("payout_retry_worker_started");

  try {
    const result = await processPayoutRetries();

    logger.info("payout_retry_worker_completed", result);
  } catch (error) {
    logger.error("payout_retry_worker_failed", {
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
      console.log("Payout retry worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Payout retry worker failed:", error);
      process.exit(1);
    });
}

export { main as runPayoutRetry };

