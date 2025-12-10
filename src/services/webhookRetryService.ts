// src/services/webhookRetryService.ts
// Webhook retry queue service for handling failed webhooks

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { handleStripeEvent } from "./paymentService";
import Stripe from "stripe";

// ============================================
// Types
// ============================================

export type WebhookSource = "stripe" | "n8n" | "other";
export type WebhookStatus = "pending" | "processing" | "succeeded" | "failed" | "dead";

export interface WebhookFailure {
  id: string;
  source: WebhookSource;
  event_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: WebhookStatus;
  created_at: string;
  updated_at: string;
}

// Exponential backoff intervals (in milliseconds)
const RETRY_INTERVALS = [
  1 * 60 * 1000,      // 1 minute
  5 * 60 * 1000,      // 5 minutes
  15 * 60 * 1000,     // 15 minutes
  60 * 60 * 1000,     // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
];

// ============================================
// Queue Management
// ============================================

/**
 * Add a failed webhook to the retry queue
 */
export async function queueWebhookForRetry(params: {
  source: WebhookSource;
  eventId?: string;
  eventType: string;
  payload: unknown;
  errorMessage: string;
  maxRetries?: number;
}): Promise<WebhookFailure> {
  const {
    source,
    eventId,
    eventType,
    payload,
    errorMessage,
    maxRetries = 5,
  } = params;

  // Check if already queued (by event_id for idempotency)
  if (eventId) {
    const existing = await query<WebhookFailure>(
      `SELECT * FROM webhook_failures WHERE event_id = $1 AND source = $2`,
      [eventId, source]
    );
    
    if (existing.rows.length > 0) {
      logger.info("webhook_already_queued", { source, eventId });
      return existing.rows[0];
    }
  }

  // Calculate first retry time
  const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[0]).toISOString();

  const result = await query<WebhookFailure>(
    `
      INSERT INTO webhook_failures (
        source,
        event_id,
        event_type,
        payload,
        error_message,
        max_retries,
        next_retry_at,
        status
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'pending')
      RETURNING *
    `,
    [
      source,
      eventId ?? null,
      eventType,
      JSON.stringify(payload),
      errorMessage,
      maxRetries,
      nextRetryAt,
    ]
  );

  const failure = result.rows[0];

  logger.info("webhook_queued_for_retry", {
    id: failure.id,
    source,
    eventId,
    eventType,
    nextRetryAt,
  });

  return failure;
}

/**
 * Get webhooks ready to retry
 */
export async function getPendingWebhooks(limit: number = 50): Promise<WebhookFailure[]> {
  const result = await query<WebhookFailure>(
    `
      SELECT *
      FROM webhook_failures
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Mark webhook as processing
 */
async function markAsProcessing(id: string): Promise<void> {
  await query(
    `UPDATE webhook_failures SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Mark webhook as succeeded
 */
async function markAsSucceeded(id: string): Promise<void> {
  await query(
    `UPDATE webhook_failures SET status = 'succeeded', updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Mark webhook as failed with next retry time
 */
async function markAsFailed(
  id: string,
  errorMessage: string,
  retryCount: number,
  maxRetries: number
): Promise<void> {
  // Check if we've exhausted retries
  if (retryCount >= maxRetries) {
    await query(
      `
        UPDATE webhook_failures 
        SET status = 'dead',
            error_message = $2,
            retry_count = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, errorMessage, retryCount]
    );
    return;
  }

  // Calculate next retry time with exponential backoff
  const intervalIndex = Math.min(retryCount, RETRY_INTERVALS.length - 1);
  const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[intervalIndex]).toISOString();

  await query(
    `
      UPDATE webhook_failures 
      SET status = 'pending',
          error_message = $2,
          retry_count = $3,
          next_retry_at = $4,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id, errorMessage, retryCount, nextRetryAt]
  );
}

// ============================================
// Retry Processing
// ============================================

/**
 * Process a single webhook retry
 */
async function processWebhookRetry(failure: WebhookFailure): Promise<boolean> {
  try {
    await markAsProcessing(failure.id);

    switch (failure.source) {
      case "stripe":
        // Reconstruct Stripe event and process
        const stripeEvent = failure.payload as unknown as Stripe.Event;
        await handleStripeEvent(stripeEvent);
        break;

      case "n8n":
        // n8n events - try to import and process
        const { publishEvent } = await import("../lib/events");
        const n8nPayload = failure.payload as {
          jobId?: string;
          actorType?: string;
          actorId?: string;
          eventName?: string;
          payload?: Record<string, unknown>;
        };
        await publishEvent({
          jobId: n8nPayload.jobId,
          actorType: n8nPayload.actorType as any,
          actorId: n8nPayload.actorId,
          eventName: n8nPayload.eventName || failure.event_type,
          payload: n8nPayload.payload,
        });
        break;

      default:
        throw new Error(`Unknown webhook source: ${failure.source}`);
    }

    await markAsSucceeded(failure.id);

    logger.info("webhook_retry_succeeded", {
      id: failure.id,
      source: failure.source,
      eventType: failure.event_type,
      attempts: failure.retry_count + 1,
    });

    return true;
  } catch (err) {
    const error = err as Error;

    await markAsFailed(
      failure.id,
      error.message,
      failure.retry_count + 1,
      failure.max_retries
    );

    logger.error("webhook_retry_failed", {
      id: failure.id,
      source: failure.source,
      eventType: failure.event_type,
      attempt: failure.retry_count + 1,
      maxRetries: failure.max_retries,
      error: error.message,
    });

    return false;
  }
}

/**
 * Process all pending webhook retries
 */
export async function processWebhookRetries(limit: number = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pending = await getPendingWebhooks(limit);

  if (pending.length === 0) {
    logger.info("no_pending_webhook_retries");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  logger.info("processing_webhook_retries", { count: pending.length });

  let succeeded = 0;
  let failed = 0;

  for (const failure of pending) {
    const success = await processWebhookRetry(failure);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  logger.info("webhook_retries_completed", {
    processed: pending.length,
    succeeded,
    failed,
  });

  return {
    processed: pending.length,
    succeeded,
    failed,
  };
}

// ============================================
// Cleanup & Stats
// ============================================

/**
 * Clean up old succeeded/dead webhooks
 */
export async function cleanupOldWebhooks(daysOld: number = 30): Promise<number> {
  const result = await query<{ count: string }>(
    `
      WITH deleted AS (
        DELETE FROM webhook_failures
        WHERE (status IN ('succeeded', 'dead') AND created_at < NOW() - INTERVAL '1 day' * $1)
           OR (status = 'failed' AND created_at < NOW() - INTERVAL '1 day' * $1)
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `,
    [daysOld]
  );

  const count = Number(result.rows[0]?.count || 0);

  if (count > 0) {
    logger.info("cleaned_up_old_webhooks", { count, daysOld });
  }

  return count;
}

/**
 * Get webhook queue stats
 */
export async function getWebhookStats(): Promise<{
  pending: number;
  processing: number;
  succeeded: number;
  failed: number;
  dead: number;
  bySource: Record<string, number>;
}> {
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM webhook_failures GROUP BY status`
  );

  const sourceResult = await query<{ source: string; count: string }>(
    `SELECT source, COUNT(*) as count FROM webhook_failures WHERE status = 'pending' GROUP BY source`
  );

  const stats = {
    pending: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    bySource: {} as Record<string, number>,
  };

  for (const row of statusResult.rows) {
    const count = Number(row.count);
    switch (row.status) {
      case "pending": stats.pending = count; break;
      case "processing": stats.processing = count; break;
      case "succeeded": stats.succeeded = count; break;
      case "failed": stats.failed = count; break;
      case "dead": stats.dead = count; break;
    }
  }

  for (const row of sourceResult.rows) {
    stats.bySource[row.source] = Number(row.count);
  }

  return stats;
}

/**
 * Get recent webhook failures for monitoring
 */
export async function getRecentFailures(limit: number = 20): Promise<WebhookFailure[]> {
  const result = await query<WebhookFailure>(
    `
      SELECT *
      FROM webhook_failures
      WHERE status IN ('pending', 'dead')
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Manually retry a specific webhook
 */
export async function retryWebhook(id: string): Promise<boolean> {
  const result = await query<WebhookFailure>(
    `SELECT * FROM webhook_failures WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Webhook failure not found");
  }

  const failure = result.rows[0];

  // Reset status to pending for retry
  await query(
    `UPDATE webhook_failures SET status = 'pending', next_retry_at = NOW() WHERE id = $1`,
    [id]
  );

  return processWebhookRetry({ ...failure, status: "pending" });
}

/**
 * Mark a dead webhook as resolved (manual intervention completed)
 */
export async function markAsResolved(id: string, notes?: string): Promise<void> {
  await query(
    `
      UPDATE webhook_failures 
      SET status = 'succeeded',
          error_message = COALESCE($2, error_message) || ' [MANUALLY RESOLVED]',
          updated_at = NOW()
      WHERE id = $1
    `,
    [id, notes ?? ""]
  );
}

