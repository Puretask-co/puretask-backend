"use strict";
// src/services/webhookRetryService.ts
// Webhook retry queue service for handling failed webhooks
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueWebhookForRetry = queueWebhookForRetry;
exports.getPendingWebhooks = getPendingWebhooks;
exports.processWebhookRetries = processWebhookRetries;
exports.cleanupOldWebhooks = cleanupOldWebhooks;
exports.getWebhookStats = getWebhookStats;
exports.getRecentFailures = getRecentFailures;
exports.retryWebhook = retryWebhook;
exports.markAsResolved = markAsResolved;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const paymentService_1 = require("./paymentService");
// Exponential backoff intervals (in milliseconds)
const RETRY_INTERVALS = [
    1 * 60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    4 * 60 * 60 * 1000, // 4 hours
];
// ============================================
// Queue Management
// ============================================
/**
 * Add a failed webhook to the retry queue
 */
async function queueWebhookForRetry(params) {
    const { source, eventId, eventType, payload, errorMessage, maxRetries = 5, } = params;
    // Check if already queued (by event_id for idempotency)
    if (eventId) {
        const existing = await (0, client_1.query)(`SELECT * FROM webhook_failures WHERE event_id = $1 AND source = $2`, [eventId, source]);
        if (existing.rows.length > 0) {
            logger_1.logger.info("webhook_already_queued", { source, eventId });
            return existing.rows[0];
        }
    }
    // Calculate first retry time
    const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[0]).toISOString();
    const result = await (0, client_1.query)(`
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
    `, [
        source,
        eventId ?? null,
        eventType,
        JSON.stringify(payload),
        errorMessage,
        maxRetries,
        nextRetryAt,
    ]);
    const failure = result.rows[0];
    logger_1.logger.info("webhook_queued_for_retry", {
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
async function getPendingWebhooks(limit = 50) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM webhook_failures
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);
    return result.rows;
}
/**
 * Mark webhook as processing
 */
async function markAsProcessing(id) {
    await (0, client_1.query)(`UPDATE webhook_failures SET status = 'processing', updated_at = NOW() WHERE id = $1`, [id]);
}
/**
 * Mark webhook as succeeded
 */
async function markAsSucceeded(id) {
    await (0, client_1.query)(`UPDATE webhook_failures SET status = 'succeeded', updated_at = NOW() WHERE id = $1`, [id]);
}
/**
 * Mark webhook as failed with next retry time
 */
async function markAsFailed(id, errorMessage, retryCount, maxRetries) {
    // Check if we've exhausted retries
    if (retryCount >= maxRetries) {
        await (0, client_1.query)(`
        UPDATE webhook_failures 
        SET status = 'dead',
            error_message = $2,
            retry_count = $3,
            updated_at = NOW()
        WHERE id = $1
      `, [id, errorMessage, retryCount]);
        return;
    }
    // Calculate next retry time with exponential backoff
    const intervalIndex = Math.min(retryCount, RETRY_INTERVALS.length - 1);
    const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[intervalIndex]).toISOString();
    await (0, client_1.query)(`
      UPDATE webhook_failures 
      SET status = 'pending',
          error_message = $2,
          retry_count = $3,
          next_retry_at = $4,
          updated_at = NOW()
      WHERE id = $1
    `, [id, errorMessage, retryCount, nextRetryAt]);
}
// ============================================
// Retry Processing
// ============================================
/**
 * Process a single webhook retry
 */
async function processWebhookRetry(failure) {
    try {
        await markAsProcessing(failure.id);
        switch (failure.source) {
            case "stripe":
                // Reconstruct Stripe event and process
                const stripeEvent = failure.payload;
                await (0, paymentService_1.handleStripeEvent)(stripeEvent);
                break;
            case "n8n":
                // n8n events - try to import and process
                const { publishEvent } = await Promise.resolve().then(() => __importStar(require("../lib/events")));
                const n8nPayload = failure.payload;
                await publishEvent({
                    jobId: n8nPayload.jobId,
                    actorType: n8nPayload.actorType,
                    actorId: n8nPayload.actorId,
                    eventName: n8nPayload.eventName || failure.event_type,
                    payload: n8nPayload.payload,
                });
                break;
            default:
                throw new Error(`Unknown webhook source: ${failure.source}`);
        }
        await markAsSucceeded(failure.id);
        logger_1.logger.info("webhook_retry_succeeded", {
            id: failure.id,
            source: failure.source,
            eventType: failure.event_type,
            attempts: failure.retry_count + 1,
        });
        return true;
    }
    catch (err) {
        const error = err;
        await markAsFailed(failure.id, error.message, failure.retry_count + 1, failure.max_retries);
        logger_1.logger.error("webhook_retry_failed", {
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
async function processWebhookRetries(limit = 50) {
    const pending = await getPendingWebhooks(limit);
    if (pending.length === 0) {
        logger_1.logger.info("no_pending_webhook_retries");
        return { processed: 0, succeeded: 0, failed: 0 };
    }
    logger_1.logger.info("processing_webhook_retries", { count: pending.length });
    let succeeded = 0;
    let failed = 0;
    for (const failure of pending) {
        const success = await processWebhookRetry(failure);
        if (success) {
            succeeded++;
        }
        else {
            failed++;
        }
    }
    logger_1.logger.info("webhook_retries_completed", {
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
async function cleanupOldWebhooks(daysOld = 30) {
    const result = await (0, client_1.query)(`
      WITH deleted AS (
        DELETE FROM webhook_failures
        WHERE (status IN ('succeeded', 'dead') AND created_at < NOW() - INTERVAL '1 day' * $1)
           OR (status = 'failed' AND created_at < NOW() - INTERVAL '1 day' * $1)
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `, [daysOld]);
    const count = Number(result.rows[0]?.count || 0);
    if (count > 0) {
        logger_1.logger.info("cleaned_up_old_webhooks", { count, daysOld });
    }
    return count;
}
/**
 * Get webhook queue stats
 */
async function getWebhookStats() {
    const statusResult = await (0, client_1.query)(`SELECT status, COUNT(*) as count FROM webhook_failures GROUP BY status`);
    const sourceResult = await (0, client_1.query)(`SELECT source, COUNT(*) as count FROM webhook_failures WHERE status = 'pending' GROUP BY source`);
    const stats = {
        pending: 0,
        processing: 0,
        succeeded: 0,
        failed: 0,
        dead: 0,
        bySource: {},
    };
    for (const row of statusResult.rows) {
        const count = Number(row.count);
        switch (row.status) {
            case "pending":
                stats.pending = count;
                break;
            case "processing":
                stats.processing = count;
                break;
            case "succeeded":
                stats.succeeded = count;
                break;
            case "failed":
                stats.failed = count;
                break;
            case "dead":
                stats.dead = count;
                break;
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
async function getRecentFailures(limit = 20) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM webhook_failures
      WHERE status IN ('pending', 'dead')
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
}
/**
 * Manually retry a specific webhook
 */
async function retryWebhook(id) {
    const result = await (0, client_1.query)(`SELECT * FROM webhook_failures WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
        throw new Error("Webhook failure not found");
    }
    const failure = result.rows[0];
    // Reset status to pending for retry
    await (0, client_1.query)(`UPDATE webhook_failures SET status = 'pending', next_retry_at = NOW() WHERE id = $1`, [id]);
    return processWebhookRetry({ ...failure, status: "pending" });
}
/**
 * Mark a dead webhook as resolved (manual intervention completed)
 */
async function markAsResolved(id, notes) {
    await (0, client_1.query)(`
      UPDATE webhook_failures 
      SET status = 'succeeded',
          error_message = COALESCE($2, error_message) || ' [MANUALLY RESOLVED]',
          updated_at = NOW()
      WHERE id = $1
    `, [id, notes ?? ""]);
}
