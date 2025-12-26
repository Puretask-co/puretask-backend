"use strict";
// src/services/notifications/notificationService.ts
// Main notification service - dispatches to providers
// Supports both event-based (n8n) and direct provider calls
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
exports.sendNotification = sendNotification;
exports.getUserContactInfo = getUserContactInfo;
exports.sendNotificationToUser = sendNotificationToUser;
const env_1 = require("../../config/env");
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
const templates_1 = require("./templates");
const eventBasedNotificationService_1 = require("./eventBasedNotificationService");
// ============================================
// Main Notification Dispatcher
// ============================================
/**
 * Send a notification via the specified channel
 * - Uses event-based (n8n) if configured, otherwise falls back to direct provider calls
 * - Does not throw if channel is not configured; logs and returns
 * - Records failures to notification_failures table for retry
 */
async function sendNotification(input) {
    try {
        // Use event-based notifications if n8n is configured and feature flag is enabled
        // Push notifications always use direct calls (OneSignal)
        const shouldUseEventBased = env_1.env.N8N_WEBHOOK_URL &&
            env_1.env.USE_EVENT_BASED_NOTIFICATIONS &&
            (input.channel === "email" || input.channel === "sms");
        if (shouldUseEventBased) {
            logger_1.logger.debug("using_event_based_notification", {
                channel: input.channel,
                type: input.type,
            });
            return await (0, eventBasedNotificationService_1.sendNotificationViaEvent)(input);
        }
        // Fallback to direct provider calls (legacy or push notifications)
        let result;
        switch (input.channel) {
            case "email":
                result = await sendEmailNotification(input);
                break;
            case "sms":
                result = await sendSmsNotification(input);
                break;
            case "push":
                result = await sendPushNotification(input);
                break;
            default:
                logger_1.logger.warn("unknown_notification_channel", {
                    channel: input.channel,
                    type: input.type,
                });
                return { success: false, error: "Unknown channel" };
        }
        if (result.success) {
            logger_1.logger.info("notification_sent", {
                channel: input.channel,
                type: input.type,
                userId: input.userId,
            });
        }
        return result;
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("notification_failed", {
            channel: input.channel,
            type: input.type,
            userId: input.userId ?? null,
            error: error.message,
        });
        // Record failure for retry
        await recordNotificationFailure(input, error.message);
        return { success: false, error: error.message };
    }
}
/**
 * Record a notification failure for later retry
 */
async function recordNotificationFailure(input, errorMessage) {
    try {
        await (0, client_1.query)(`
        INSERT INTO notification_failures (
          user_id,
          channel,
          type,
          payload,
          error_message,
          retry_count
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, 0)
      `, [
            input.userId ?? null,
            input.channel,
            input.type,
            JSON.stringify({
                ...input.data,
                email: input.email,
                phone: input.phone,
                pushToken: input.pushToken,
            }),
            errorMessage,
        ]);
    }
    catch (err) {
        logger_1.logger.error("failed_to_record_notification_failure", {
            error: err.message,
        });
    }
}
// ============================================
// Email via SendGrid
// ============================================
async function sendEmailNotification(input) {
    if (!env_1.env.SENDGRID_API_KEY) {
        logger_1.logger.debug("email_not_configured", {});
        return { success: false, error: "Email not configured" };
    }
    if (!input.email) {
        logger_1.logger.warn("email_missing_address", { type: input.type, userId: input.userId });
        return { success: false, error: "Missing email address" };
    }
    const subject = (0, templates_1.getEmailSubject)(input.type);
    const text = (0, templates_1.getEmailBody)(input.type, input.data);
    // Use dynamic import to avoid loading SendGrid if not used
    const sgMail = await Promise.resolve().then(() => __importStar(require("@sendgrid/mail"))).then((m) => m.default);
    sgMail.setApiKey(env_1.env.SENDGRID_API_KEY);
    const response = await sgMail.send({
        to: input.email,
        from: env_1.env.SENDGRID_FROM_EMAIL,
        subject,
        text,
    });
    const messageId = response[0]?.headers?.["x-message-id"] || undefined;
    logger_1.logger.info("email_sent", {
        type: input.type,
        email: input.email,
        messageId,
    });
    return { success: true, messageId };
}
// ============================================
// SMS via Twilio
// ============================================
async function sendSmsNotification(input) {
    if (!env_1.env.TWILIO_ACCOUNT_SID || !env_1.env.TWILIO_AUTH_TOKEN || !env_1.env.TWILIO_FROM_NUMBER) {
        logger_1.logger.debug("sms_not_configured", {});
        return { success: false, error: "SMS not configured" };
    }
    if (!input.phone) {
        logger_1.logger.warn("sms_missing_phone", { type: input.type, userId: input.userId });
        return { success: false, error: "Missing phone number" };
    }
    const body = (0, templates_1.getSmsBody)(input.type, input.data);
    // Use dynamic import
    const twilio = await Promise.resolve().then(() => __importStar(require("twilio"))).then((m) => m.default);
    const client = twilio(env_1.env.TWILIO_ACCOUNT_SID, env_1.env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
        body,
        from: env_1.env.TWILIO_FROM_NUMBER,
        to: input.phone,
    });
    logger_1.logger.info("sms_sent", {
        type: input.type,
        phone: input.phone,
        sid: message.sid,
    });
    return { success: true, messageId: message.sid };
}
// ============================================
// Push via OneSignal
// ============================================
async function sendPushNotification(input) {
    if (!env_1.env.ONESIGNAL_APP_ID || !env_1.env.ONESIGNAL_API_KEY) {
        logger_1.logger.debug("push_not_configured", {});
        return { success: false, error: "Push not configured" };
    }
    if (!input.pushToken && !input.userId) {
        logger_1.logger.warn("push_missing_target", { type: input.type });
        return { success: false, error: "Missing push target" };
    }
    const title = (0, templates_1.getPushTitle)(input.type);
    const message = (0, templates_1.getPushBody)(input.type, input.data);
    const body = {
        app_id: env_1.env.ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message },
        data: input.data,
    };
    if (input.pushToken) {
        body.include_player_ids = [input.pushToken];
    }
    else if (input.userId) {
        // Using external_id mapping in OneSignal
        body.include_external_user_ids = [input.userId];
    }
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${env_1.env.ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OneSignal error: ${response.status} ${text}`);
    }
    const result = await response.json();
    logger_1.logger.info("push_sent", {
        type: input.type,
        userId: input.userId,
        notificationId: result.id,
    });
    return { success: true, messageId: result.id };
}
async function getUserContactInfo(userId) {
    // For now, we only have email in the users table
    // In the future, you might add phone and push_token columns
    const result = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1`, [userId]);
    if (result.rows.length === 0) {
        return null;
    }
    return {
        email: result.rows[0].email,
        // phone and pushToken would come from additional columns or separate tables
    };
}
// ============================================
// Convenience: Send notification to user by ID
// ============================================
async function sendNotificationToUser(userId, type, data, channels = ["email"]) {
    const contact = await getUserContactInfo(userId);
    if (!contact) {
        logger_1.logger.warn("user_not_found_for_notification", { userId, type });
        return [{ success: false, error: "User not found" }];
    }
    const results = [];
    for (const channel of channels) {
        const result = await sendNotification({
            userId,
            email: contact.email,
            phone: contact.phone,
            pushToken: contact.pushToken,
            type,
            channel,
            data,
        });
        results.push(result);
    }
    return results;
}
