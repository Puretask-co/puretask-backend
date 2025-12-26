"use strict";
// src/lib/events.ts
// Centralized event publishing system for PureTask
// Uses job_events table from 001_init.sql
// Wires events to notifications and n8n
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
exports.publishEvent = publishEvent;
exports.getJobEvents = getJobEvents;
exports.getEventsByType = getEventsByType;
exports.getEventsByActor = getEventsByActor;
const client_1 = require("../db/client");
const logger_1 = require("./logger");
const env_1 = require("../config/env");
const httpClient_1 = require("./httpClient");
/**
 * Publish an application event to job_events table
 * Matches 001_init.sql schema: (id, job_id, actor_type, actor_id, event_type, payload, created_at)
 * Note: job_id is NOT NULL in the schema, so events without a jobId are logged but not stored in DB
 */
async function publishEvent(input) {
    const { jobId = null, actorType = null, actorId = null, eventName, payload = {}, } = input;
    const payloadJson = JSON.stringify(payload);
    // Only insert into job_events if jobId is provided (schema requires NOT NULL)
    // For system events without a job, we still log and forward to n8n, but don't store in DB
    if (jobId) {
        try {
            await (0, client_1.query)(`
          INSERT INTO job_events (
            job_id,
            actor_type,
            actor_id,
            event_type,
            payload
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
        `, [jobId, actorType, actorId, eventName, payloadJson]);
        }
        catch (error) {
            // If insert fails (e.g., foreign key constraint), log but don't throw
            // This allows events to still be forwarded to n8n even if DB insert fails
            logger_1.logger.error("job_event_insert_failed", {
                jobId,
                eventName,
                error: error.message,
            });
        }
    }
    logger_1.logger.info("job_event_published", {
        jobId,
        eventName,
        actorType,
        actorId,
    });
    // NOTE: maybeSendNotifications is disabled - all email/SMS notifications now go through n8n
    // n8n workflows triggered by events handle all communications
    // If n8n is not configured, notifications can still be sent via the notification service
    // which will use direct provider calls as fallback
    // Legacy notification sending (disabled in favor of event-driven n8n architecture):
    // maybeSendNotifications(jobId, eventName, payload).catch((err) => {
    //   logger.error("event_notification_failed_non_blocking", {
    //     jobId,
    //     eventName,
    //     error: (err as Error).message,
    //   });
    // });
    // Forward to n8n webhook if configured (non-blocking, errors are logged but don't fail the request)
    maybeForwardToN8n(jobId, actorType, actorId, eventName, payload).catch((err) => {
        logger_1.logger.error("n8n_forward_failed_non_blocking", {
            error: err.message,
            jobId,
            eventName,
        });
    });
}
/**
 * Send notifications for key job events
 */
async function maybeSendNotifications(jobId, eventName, payload) {
    if (!jobId)
        return;
    try {
        // Dynamically import to avoid circular dependencies
        const { sendNotification } = await Promise.resolve().then(() => __importStar(require("../services/notifications")));
        // Map events to notification types
        const notificationEvents = [
            "job_accepted",
            "cleaner_on_my_way",
            "job_started",
            "job_completed",
            "client_approved",
            "client_disputed",
        ];
        if (!notificationEvents.includes(eventName)) {
            return;
        }
        // Get job to find client/cleaner
        const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
        const job = jobResult.rows[0];
        if (!job)
            return;
        // Determine who to notify based on event
        let targetUserId = null;
        switch (eventName) {
            case "job_accepted":
            case "cleaner_on_my_way":
            case "job_started":
            case "job_completed":
                // Notify client about cleaner actions
                targetUserId = job.client_id;
                break;
            case "client_approved":
            case "client_disputed":
                // Notify cleaner about client actions
                targetUserId = job.cleaner_id;
                break;
        }
        if (!targetUserId)
            return;
        // Get user contact info
        const userResult = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1`, [targetUserId]);
        const user = userResult.rows[0];
        if (!user)
            return;
        // Send notification (non-blocking)
        await sendNotification({
            userId: targetUserId,
            email: user.email,
            channel: "email",
            type: eventName,
            data: {
                jobId,
                address: job.address,
                creditAmount: job.credit_amount,
                ...payload,
            },
        });
        // Also send push if it's an urgent event
        const pushEvents = ["cleaner_on_my_way", "job_started", "job_completed"];
        if (pushEvents.includes(eventName)) {
            await sendNotification({
                userId: targetUserId,
                channel: "push",
                type: eventName,
                data: {
                    jobId,
                    address: job.address,
                    ...payload,
                },
            });
        }
    }
    catch (err) {
        logger_1.logger.error("event_notification_failed", {
            jobId,
            eventName,
            error: err.message,
        });
    }
}
/**
 * Forward event to n8n webhook
 */
async function maybeForwardToN8n(jobId, actorType, actorId, eventName, payload) {
    if (!env_1.env.N8N_WEBHOOK_URL)
        return;
    try {
        await (0, httpClient_1.postJson)(env_1.env.N8N_WEBHOOK_URL, {
            jobId,
            actorType,
            actorId,
            eventName,
            payload,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        logger_1.logger.error("n8n_forward_failed", {
            error: err.message,
            jobId,
            eventName,
        });
    }
}
/**
 * Get events for a specific job
 */
async function getJobEvents(jobId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [jobId, limit]);
    return result.rows;
}
/**
 * Get events by event type
 */
async function getEventsByType(eventType, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [eventType, limit]);
    return result.rows;
}
/**
 * Get events by actor
 */
async function getEventsByActor(actorId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE actor_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [actorId, limit]);
    return result.rows;
}
