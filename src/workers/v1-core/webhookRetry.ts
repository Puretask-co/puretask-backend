// src/workers/webhookRetry.ts
// Worker to process failed webhook retries
//
// Run on a schedule (e.g., every 5 minutes):
// node dist/workers/webhookRetry.js

import { pool } from "../db/client";
import { logger } from "../lib/logger";
import {
  processWebhookRetries,
  cleanupOldWebhooks,
  getWebhookStats,
} from "../services/webhookRetryService";

const BATCH_SIZE = 50;
const CLEANUP_DAYS = 30;

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("webhook_retry_worker_started", {
    batchSize: BATCH_SIZE,
    cleanupDays: CLEANUP_DAYS,
  });

  try {
    // Get stats before processing
    const statsBefore = await getWebhookStats();
    logger.info("webhook_queue_stats", statsBefore);

    // Process pending retries
    const result = await processWebhookRetries(BATCH_SIZE);

    // Clean up old entries
    const cleanedUp = await cleanupOldWebhooks(CLEANUP_DAYS);

    // Get stats after processing
    const statsAfter = await getWebhookStats();

    logger.info("webhook_retry_worker_completed", {
      ...result,
      cleanedUp,
      remainingPending: statsAfter.pending,
      remainingDead: statsAfter.dead,
    });
  } catch (error) {
    logger.error("webhook_retry_worker_failed", {
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
      console.log("Webhook retry worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Webhook retry worker failed:", error);
      process.exit(1);
    });
}

export { main as runWebhookRetryWorker };

