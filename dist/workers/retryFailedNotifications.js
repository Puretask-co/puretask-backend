"use strict";
// src/workers/retryFailedNotifications.ts
// Worker to retry failed notifications
//
// Run on a schedule (e.g., every 5 minutes):
// node dist/workers/retryFailedNotifications.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryFailedNotifications = retryFailedNotifications;
exports.cleanupOldFailures = cleanupOldFailures;
const client_1 = require("../db/client");
const client_2 = require("../db/client");
const logger_1 = require("../lib/logger");
const notifications_1 = require("../services/notifications");
const MAX_RETRIES = 5;
const BATCH_SIZE = 100;
/**
 * Retry failed notifications
 * Strategy:
 * - Load failures with retry_count < MAX_RETRIES
 * - Try sending again
 * - On success: delete failure row
 * - On failure: increment retry_count, update error_message
 */
async function retryFailedNotifications() {
    // Load pending failures
    const failures = await (0, client_1.query)(`
      SELECT id, user_id, channel, type, payload, error_message, retry_count, created_at
      FROM notification_failures
      WHERE retry_count < $1
      ORDER BY created_at ASC
      LIMIT $2
    `, [MAX_RETRIES, BATCH_SIZE]);
    if (failures.rows.length === 0) {
        logger_1.logger.info("no_notification_failures_to_retry");
        return { total: 0, succeeded: 0, failed: 0 };
    }
    logger_1.logger.info("retrying_notification_failures", {
        count: failures.rows.length,
    });
    let succeeded = 0;
    let failed = 0;
    for (const failure of failures.rows) {
        try {
            // Extract contact info from payload
            const payload = failure.payload || {};
            const result = await (0, notifications_1.sendNotification)({
                userId: failure.user_id ?? undefined,
                email: payload.email,
                phone: payload.phone,
                pushToken: payload.pushToken,
                channel: failure.channel,
                type: failure.type,
                data: payload,
            });
            if (result.success) {
                // Delete successful retry
                await (0, client_1.query)(`DELETE FROM notification_failures WHERE id = $1`, [failure.id]);
                succeeded++;
                logger_1.logger.info("notification_retry_succeeded", {
                    failureId: failure.id,
                    channel: failure.channel,
                    type: failure.type,
                    attemptNumber: failure.retry_count + 1,
                });
            }
            else {
                // Still failed, increment counter
                await (0, client_1.query)(`
            UPDATE notification_failures
            SET retry_count = retry_count + 1,
                error_message = $2,
                last_attempt_at = NOW()
            WHERE id = $1
          `, [failure.id, result.error]);
                failed++;
            }
        }
        catch (err) {
            const error = err;
            logger_1.logger.error("notification_retry_error", {
                failureId: failure.id,
                error: error.message,
            });
            // Update with new error
            await (0, client_1.query)(`
          UPDATE notification_failures
          SET retry_count = retry_count + 1,
              error_message = $2,
              last_attempt_at = NOW()
          WHERE id = $1
        `, [failure.id, error.message]);
            failed++;
        }
    }
    return {
        total: failures.rows.length,
        succeeded,
        failed,
    };
}
/**
 * Clean up old failures that have exceeded max retries
 */
async function cleanupOldFailures() {
    const result = await (0, client_1.query)(`
      WITH deleted AS (
        DELETE FROM notification_failures
        WHERE retry_count >= $1
          OR created_at < NOW() - INTERVAL '7 days'
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `, [MAX_RETRIES]);
    const count = Number(result.rows[0]?.count || 0);
    if (count > 0) {
        logger_1.logger.info("cleaned_up_old_failures", { count });
    }
    return count;
}
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("notification_retry_worker_started", {
        maxRetries: MAX_RETRIES,
        batchSize: BATCH_SIZE,
    });
    try {
        // Retry failed notifications
        const retryResult = await retryFailedNotifications();
        // Clean up old failures
        const cleanedUp = await cleanupOldFailures();
        logger_1.logger.info("notification_retry_worker_completed", {
            ...retryResult,
            cleanedUp,
        });
    }
    catch (error) {
        logger_1.logger.error("notification_retry_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        // Close database connection
        await client_2.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Notification retry worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Notification retry worker failed:", error);
        process.exit(1);
    });
}
