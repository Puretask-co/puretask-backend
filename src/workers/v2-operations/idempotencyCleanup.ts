// src/workers/v2-operations/idempotencyCleanup.ts
// R11: Scheduled cleanup of old idempotency_keys to avoid unbounded growth.
// RUNBOOK §1.4: cleanup_old_idempotency_keys() deletes keys older than 24 hours.

import { query } from "../../db/client";
import { logger } from "../../lib/logger";

export async function runIdempotencyCleanupWorker(): Promise<void> {
  try {
    const result = await query<{ cleanup_old_idempotency_keys: number }>(
      "SELECT cleanup_old_idempotency_keys() AS cleanup_old_idempotency_keys"
    );
    const deleted = Number(result.rows[0]?.cleanup_old_idempotency_keys ?? 0);
    logger.info("idempotency_cleanup_completed", { deleted });
  } catch (error) {
    logger.error("idempotency_cleanup_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}
