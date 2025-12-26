"use strict";
// src/services/notifications/eventBasedNotificationService.ts
// Event-based notification service (n8n architecture)
// Replaces direct SendGrid/Twilio calls with event emission
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationViaEvent = sendNotificationViaEvent;
const events_1 = require("../../lib/events");
const logger_1 = require("../../lib/logger");
const communicationValidation_1 = require("../../lib/communicationValidation");
// ============================================
// Notification Type to Template Key Mapping
// ============================================
/**
 * Maps NotificationType to template keys (from email-registry.md)
 */
const NOTIFICATION_TYPE_TO_TEMPLATE_KEY = {
    // Job lifecycle
    "job.created": "email.client.job_booked",
    "job.accepted": "email.client.job_accepted",
    "job.on_my_way": "email.client.cleaner_on_my_way",
    "job.started": "email.client.job_started", // Note: may need to add this template
    "job.completed": "email.client.job_completed",
    "job.awaiting_approval": "email.client.job_completed", // Same template as completed
    "job.approved": "email.cleaner.job_approved",
    "job.disputed": "email.cleaner.job_disputed",
    "job.cancelled": "email.user.job_cancelled",
    // Payments
    "credits.purchased": "email.client.credit_purchase",
    "credits.low": "email.client.credits_low", // Note: may need to add this template
    "payout.processed": "email.cleaner.payout_sent",
    "payout.failed": "email.cleaner.payout_failed", // Note: may need to add this template
    // Account
    "welcome": "email.user.welcome",
    "password.reset": "email.user.password_reset",
};
/**
 * Maps NotificationType to event names
 */
const NOTIFICATION_TYPE_TO_EVENT_NAME = {
    "job.created": "job.booked",
    "job.accepted": "job.accepted",
    "job.on_my_way": "cleaner.on_my_way",
    "job.started": "job.started",
    "job.completed": "job.completed",
    "job.awaiting_approval": "job.completed",
    "job.approved": "job.approved",
    "job.disputed": "job.disputed",
    "job.cancelled": "job.cancelled",
    "credits.purchased": "payment.succeeded",
    "credits.low": "credits.low",
    "payout.processed": "payout.sent",
    "payout.failed": "payout.failed",
    "welcome": "user.registered",
    "password.reset": "user.password_reset_requested",
};
// ============================================
// Event-Based Notification Service
// ============================================
/**
 * Send notification via event emission (n8n handles delivery)
 * This replaces direct SendGrid/Twilio calls with event-driven architecture
 */
async function sendNotificationViaEvent(input) {
    try {
        // Push notifications are not yet supported via n8n event-based architecture
        if (input.channel === "push") {
            logger_1.logger.info("push_notification_skipped", {
                type: input.type,
                message: "Push notifications not supported via event-based architecture",
            });
            return { success: false, error: "Push notifications not supported via events" };
        }
        // Map notification type to template key
        const templateKey = NOTIFICATION_TYPE_TO_TEMPLATE_KEY[input.type];
        if (!templateKey) {
            logger_1.logger.error("unknown_notification_type", {
                type: input.type,
            });
            return { success: false, error: `Unknown notification type: ${input.type}` };
        }
        // Determine channel from input (now guaranteed to be email or sms)
        const channel = input.channel;
        // Get template ID from env var
        let templateId;
        try {
            // Convert template key to env var name
            const envVarName = (0, communicationValidation_1.validateTemplateKey)(templateKey);
            templateId = (0, communicationValidation_1.getTemplateIdFromEnvVar)(envVarName);
        }
        catch (error) {
            logger_1.logger.warn("template_id_not_configured", {
                templateKey,
                type: input.type,
                error: error.message,
            });
            // Return success but log warning - n8n may handle missing template IDs
            return {
                success: true,
                messageId: undefined,
            };
        }
        // Create validated communication payload
        const communicationPayload = (0, communicationValidation_1.createCommunicationPayload)({
            templateKey,
            templateId,
            to_email: channel === "email" ? input.email : undefined,
            to_phone: channel === "sms" ? input.phone : undefined,
            channel,
            priority: "normal", // Can be made configurable
            dynamic_data: input.data,
        });
        // Get event name from notification type
        const eventName = NOTIFICATION_TYPE_TO_EVENT_NAME[input.type];
        // Extract jobId from data if present
        const jobId = input.data?.jobId || null;
        // Emit event (n8n handles delivery)
        await (0, events_1.publishEvent)({
            eventName: eventName,
            jobId: jobId || null,
            actorType: null,
            actorId: input.userId || null,
            payload: {
                communication: communicationPayload,
                ...input.data, // Include original data
            },
        });
        logger_1.logger.info("notification_event_emitted", {
            type: input.type,
            eventName,
            channel,
            userId: input.userId,
            jobId,
        });
        // Return success (actual delivery handled by n8n)
        return {
            success: true,
            messageId: undefined, // n8n will track this
            channel,
        };
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("notification_event_emission_failed", {
            channel: input.channel,
            type: input.type,
            userId: input.userId ?? null,
            error: error.message,
        });
        return { success: false, error: error.message };
    }
}
