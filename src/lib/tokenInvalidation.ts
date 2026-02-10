// src/lib/tokenInvalidation.ts
// Token invalidation utilities

import { query } from "../db/client";
import { logger } from "./logger";

/**
 * Invalidate all tokens for a user (increment token_version)
 * This will cause all existing tokens to fail verification
 */
export async function invalidateUserTokens(
  userId: string,
  reason?: string
): Promise<void> {
  await query(
    `SELECT invalidate_user_tokens($1, $2)`,
    [userId, reason || null]
  );

  logger.info("user_tokens_invalidated", {
    userId,
    reason: reason || "manual_invalidation",
  });
}

/**
 * Explicitly invalidate a specific token by JTI
 */
export async function invalidateTokenByJti(
  jti: string,
  userId: string,
  reason?: string
): Promise<void> {
  await query(
    `
      INSERT INTO invalidated_tokens (jti, user_id, reason)
      VALUES ($1, $2, $3)
      ON CONFLICT (jti) DO NOTHING
    `,
    [jti, userId, reason || null]
  );

  logger.info("token_invalidated_by_jti", {
    jti,
    userId,
    reason: reason || "manual_invalidation",
  });
}

/**
 * Cleanup old invalidated tokens (older than token expiration period)
 */
export async function cleanupInvalidatedTokens(): Promise<number> {
  // Clean up tokens older than 30 days (default JWT expiration)
  const result = await query<{ count: string }>(
    `
      WITH deleted AS (
        DELETE FROM invalidated_tokens
        WHERE invalidated_at < NOW() - INTERVAL '30 days'
        RETURNING jti
      )
      SELECT COUNT(*)::text as count FROM deleted
    `
  );

  const count = parseInt(result.rows[0]?.count || "0", 10);
  
  if (count > 0) {
    logger.info("invalidated_tokens_cleaned_up", { count });
  }

  return count;
}
