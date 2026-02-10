// src/services/webhookEventStorage.ts
// Webhook event storage layer - canonical intake before processing
// Implements Section 4: Webhook & External Integrations Hardening

import { query, withTransaction } from "../db/client";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

export type WebhookProvider = "stripe" | "n8n" | "sendgrid" | "twilio" | "onesignal";
export type ProcessingStatus = "pending" | "processing" | "done" | "failed";

export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  event_id: string | null;
  event_type: string;
  received_at: Date;
  signature_verified: boolean;
  payload_json: any;
  processing_status: ProcessingStatus;
  attempt_count: number;
  last_error: string | null;
  processed_at: Date | null;
  correlation_id: string | null;
  metadata: Record<string, any>;
}

/**
 * Store webhook event before processing (canonical intake)
 * This is the source of truth for webhook audit and replay
 * 
 * @param params Webhook event parameters
 * @returns The stored webhook event ID
 */
export async function storeWebhookEvent(params: {
  provider: WebhookProvider;
  event_id: string | null;
  event_type: string;
  payload: any;
  signature_verified: boolean;
  correlation_id?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const correlationId = params.correlation_id || uuidv4();
  
  try {
    const result = await query<{ id: string }>(
      `
        INSERT INTO webhook_events (
          provider,
          event_id,
          event_type,
          signature_verified,
          payload_json,
          processing_status,
          correlation_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6, $7::jsonb)
        ON CONFLICT (provider, event_id) 
        DO UPDATE SET
          event_type = EXCLUDED.event_type,
          payload_json = EXCLUDED.payload_json,
          signature_verified = EXCLUDED.signature_verified,
          metadata = EXCLUDED.metadata,
          received_at = EXCLUDED.received_at
        RETURNING id
      `,
      [
        params.provider,
        params.event_id,
        params.event_type,
        params.signature_verified,
        JSON.stringify(params.payload),
        correlationId,
        JSON.stringify(params.metadata || {}),
      ]
    );

    if (!result.rows[0]) {
      // Duplicate event - already stored
      const existing = await query<{ id: string; processing_status: ProcessingStatus }>(
        `SELECT id, processing_status FROM webhook_events 
         WHERE provider = $1 AND event_id = $2`,
        [params.provider, params.event_id]
      );
      
      if (existing.rows[0]) {
        logger.info("webhook_event_duplicate", {
          provider: params.provider,
          event_id: params.event_id,
          existing_id: existing.rows[0].id,
          status: existing.rows[0].processing_status,
        });
        return existing.rows[0].id;
      }
      
      throw new Error("Failed to store webhook event");
    }

    logger.info("webhook_event_stored", {
      id: result.rows[0].id,
      provider: params.provider,
      event_id: params.event_id,
      event_type: params.event_type,
      correlation_id: correlationId,
    });

    return result.rows[0].id;
  } catch (error) {
    logger.error("webhook_event_storage_failed", {
      error: (error as Error).message,
      provider: params.provider,
      event_id: params.event_id,
    });
    throw error;
  }
}

/**
 * Mark webhook event as processing (with concurrency lock)
 * Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing
 * 
 * @param eventId Webhook event ID
 * @returns The event if successfully locked, null if already being processed
 */
export async function lockWebhookEventForProcessing(
  eventId: string
): Promise<WebhookEvent | null> {
  try {
    const result = await query<WebhookEvent>(
      `
        UPDATE webhook_events
        SET processing_status = 'processing',
            attempt_count = attempt_count + 1
        WHERE id = $1
          AND processing_status = 'pending'
        RETURNING *
      `,
      [eventId]
    );

    if (!result.rows[0]) {
      return null; // Already being processed or not found
    }

    return result.rows[0];
  } catch (error) {
    logger.error("webhook_event_lock_failed", {
      error: (error as Error).message,
      event_id: eventId,
    });
    throw error;
  }
}

/**
 * Mark webhook event as done
 */
export async function markWebhookEventDone(eventId: string): Promise<void> {
  await query(
    `
      UPDATE webhook_events
      SET processing_status = 'done',
          processed_at = NOW()
      WHERE id = $1
    `,
    [eventId]
  );

  logger.info("webhook_event_processed", { event_id: eventId });
}

/**
 * Mark webhook event as failed
 */
export async function markWebhookEventFailed(
  eventId: string,
  error: string
): Promise<void> {
  await query(
    `
      UPDATE webhook_events
      SET processing_status = 'failed',
          last_error = $2,
          processed_at = NOW()
      WHERE id = $1
    `,
    [eventId, error]
  );

  logger.error("webhook_event_failed", {
    event_id: eventId,
    error,
  });
}

/**
 * Get pending webhook events ready for processing
 * Returns events that are pending and haven't been attempted too many times
 */
export async function getPendingWebhookEvents(
  limit: number = 10
): Promise<WebhookEvent[]> {
  const result = await query<WebhookEvent>(
    `
      SELECT *
      FROM webhook_events
      WHERE processing_status = 'pending'
        AND attempt_count < 5
      ORDER BY received_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Check if webhook event already exists (idempotency check)
 */
export async function webhookEventExists(
  provider: WebhookProvider,
  event_id: string
): Promise<boolean> {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*) as count
      FROM webhook_events
      WHERE provider = $1 AND event_id = $2
    `,
    [provider, event_id]
  );

  return parseInt(result.rows[0].count) > 0;
}
