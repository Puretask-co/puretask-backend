"use strict";
// src/workers/retryFailedEvents.ts
// Worker to retry failed Stripe webhook events
// Uses stripe_events table from 001_init.sql
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRetryFailedEventsWorker = runRetryFailedEventsWorker;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const paymentService_1 = require("../services/paymentService");
// Configuration
const BATCH_SIZE = parseInt(process.env.RETRY_BATCH_SIZE || "50", 10);
const MAX_RETRY_AGE_HOURS = parseInt(process.env.MAX_RETRY_AGE_HOURS || "24", 10);
/**
 * Find unprocessed Stripe events
 */
async function findUnprocessedEvents() {
    const result = await (0, client_1.query)(`
      SELECT id, stripe_event_id, type, payload, created_at
      FROM stripe_events
      WHERE processed = false
        AND created_at > NOW() - INTERVAL '${MAX_RETRY_AGE_HOURS} hours'
      ORDER BY created_at ASC
      LIMIT $1
    `, [BATCH_SIZE]);
    return result.rows;
}
/**
 * Retry processing a single event
 */
async function retryEvent(event) {
    try {
        // Reconstruct Stripe event from stored payload
        const stripeEvent = event.payload;
        await (0, paymentService_1.handleStripeEvent)(stripeEvent);
        logger_1.logger.info("event_retry_succeeded", {
            eventId: event.stripe_event_id,
            eventType: event.type,
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error("event_retry_failed", {
            eventId: event.stripe_event_id,
            eventType: event.type,
            error: error.message,
        });
        return false;
    }
}
/**
 * Main worker function
 */
async function runRetryFailedEventsWorker() {
    logger_1.logger.info("retry_failed_events_worker_started", {
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
        }
        else {
            failed++;
        }
    }
    const result = {
        found: events.length,
        succeeded,
        failed,
    };
    logger_1.logger.info("retry_failed_events_worker_completed", result);
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
