// src/workers/cleaningScores.ts
// Recalculate cleaning scores for all properties
//
// Run daily: node dist/workers/cleaningScores.js

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import { recalculateAllScores } from "../../services/propertiesService";

async function main(): Promise<void> {
  logger.info("cleaning_scores_worker_started");

  try {
    const updated = await recalculateAllScores();
    logger.info("cleaning_scores_worker_completed", { propertiesUpdated: updated });
  } catch (error) {
    logger.error("cleaning_scores_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("Cleaning scores worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleaning scores worker failed:", error);
      process.exit(1);
    });
}

export { main as runCleaningScores };
