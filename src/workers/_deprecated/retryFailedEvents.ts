// src/workers/retryFailedEvents.ts
// Worker to retry failed Stripe webhook events
// Uses stripe_events table from 001_init.sql

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { handleStripeEvent } from "../../services/paymentService";
import Stripe from "stripe";

// Configuration
const BATCH_SIZE = parseInt(process.env.RETRY_BATCH_SIZE || "50", 10);
const MAX_RETRY_AGE_HOURS = parseInt(process.env.MAX_RETRY_AGE_HOURS || "24", 10);

interface FailedEvent {
  id: string;
  stripe_event_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Find unprocessed Stripe events
 */
async function findUnprocessedEvents(): Promise<FailedEvent[]> {
  const result = await query<FailedEvent>(
    `
      SELECT id, stripe_event_id, type, payload, created_at
      FROM stripe_events
      WHERE processed = false
        AND created_at > NOW() - INTERVAL '${MAX_RETRY_AGE_HOURS} hours'
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Retry processing a single event
 */
async function retryEvent(event: FailedEvent): Promise<boolean> {
  try {
    // Reconstruct Stripe event from stored payload
    const stripeEvent = event.payload as unknown as Stripe.Event;

    await handleStripeEvent(stripeEvent);

    logger.info("event_retry_succeeded", {
      eventId: event.stripe_event_id,
      eventType: event.type,
    });

    return true;
  } catch (error) {
    logger.error("event_retry_failed", {
      eventId: event.stripe_event_id,
      eventType: event.type,
      error: (error as Error).message,
    });

    return false;
  }
}

/**
 * Main worker function
 */
export async function runRetryFailedEventsWorker(): Promise<{
  found: number;
  succeeded: number;
  failed: number;
}> {
  logger.info("retry_failed_events_worker_started", {
    batchSize: BATCH_SIZE,
    maxRetryAgeHours: MAX_RETRY_AGE_HOURS,
  });

  const events = await findUnprocessedEvents();

  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    const success = await retryEvent(event);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  const result = {
    found: events.length,
    succeeded,
    failed,
  };

  logger.info("retry_failed_events_worker_completed", result);

  return result;
}

// Run if executed directly
if (require.main === module) {
  runRetryFailedEventsWorker()
    .then((result) => {
      console.log("Retry failed events worker completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Retry failed events worker failed:", error);
      process.exit(1);
    });
}
