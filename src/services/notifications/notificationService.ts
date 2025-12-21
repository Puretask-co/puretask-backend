// src/services/notifications/notificationService.ts
// Main notification service - dispatches to providers
// Supports both event-based (n8n) and direct provider calls

import { env } from "../../config/env";
import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import {
  NotificationPayload,
  NotificationResult,
  NotificationChannel,
  NotificationType,
} from "./types";
import {
  getEmailSubject,
  getEmailBody,
  getSmsBody,
  getPushTitle,
  getPushBody,
} from "./templates";
import { sendNotificationViaEvent } from "./eventBasedNotificationService";

// ============================================
// Main Notification Dispatcher
// ============================================

/**
 * Send a notification via the specified channel
 * - Uses event-based (n8n) if configured, otherwise falls back to direct provider calls
 * - Does not throw if channel is not configured; logs and returns
 * - Records failures to notification_failures table for retry
 */
export async function sendNotification(input: NotificationPayload): Promise<NotificationResult> {
  try {
    // Use event-based notifications if n8n is configured and feature flag is enabled
    // Push notifications always use direct calls (OneSignal)
    const shouldUseEventBased = 
      env.N8N_WEBHOOK_URL && 
      env.USE_EVENT_BASED_NOTIFICATIONS && 
      (input.channel === "email" || input.channel === "sms");

    if (shouldUseEventBased) {
      logger.debug("using_event_based_notification", {
        channel: input.channel,
        type: input.type,
      });
      return await sendNotificationViaEvent(input);
    }

    // Fallback to direct provider calls (legacy or push notifications)
    let result: NotificationResult;

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
        logger.warn("unknown_notification_channel", {
          channel: input.channel,
          type: input.type,
        });
        return { success: false, error: "Unknown channel" };
    }

    if (result.success) {
      logger.info("notification_sent", {
        channel: input.channel,
        type: input.type,
        userId: input.userId,
      });
    }

    return result;
  } catch (err) {
    const error = err as Error;
    logger.error("notification_failed", {
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
async function recordNotificationFailure(
  input: NotificationPayload,
  errorMessage: string
): Promise<void> {
  try {
    await query(
      `
        INSERT INTO notification_failures (
          user_id,
          channel,
          type,
          payload,
          error_message,
          retry_count
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, 0)
      `,
      [
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
      ]
    );
  } catch (err) {
    logger.error("failed_to_record_notification_failure", {
      error: (err as Error).message,
    });
  }
}

// ============================================
// Email via SendGrid
// ============================================

async function sendEmailNotification(input: NotificationPayload): Promise<NotificationResult> {
  if (!env.SENDGRID_API_KEY) {
    logger.debug("email_not_configured", {});
    return { success: false, error: "Email not configured" };
  }

  if (!input.email) {
    logger.warn("email_missing_address", { type: input.type, userId: input.userId });
    return { success: false, error: "Missing email address" };
  }

  const subject = getEmailSubject(input.type);
  const text = getEmailBody(input.type, input.data);

  // Use dynamic import to avoid loading SendGrid if not used
  const sgMail = await import("@sendgrid/mail").then((m) => m.default);
  sgMail.setApiKey(env.SENDGRID_API_KEY);

  const response = await sgMail.send({
    to: input.email,
    from: env.SENDGRID_FROM_EMAIL,
    subject,
    text,
  });

  const messageId = response[0]?.headers?.["x-message-id"] || undefined;

  logger.info("email_sent", {
    type: input.type,
    email: input.email,
    messageId,
  });

  return { success: true, messageId };
}

// ============================================
// SMS via Twilio
// ============================================

async function sendSmsNotification(input: NotificationPayload): Promise<NotificationResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    logger.debug("sms_not_configured", {});
    return { success: false, error: "SMS not configured" };
  }

  if (!input.phone) {
    logger.warn("sms_missing_phone", { type: input.type, userId: input.userId });
    return { success: false, error: "Missing phone number" };
  }

  const body = getSmsBody(input.type, input.data);

  // Use dynamic import
  const twilio = await import("twilio").then((m) => m.default);
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  const message = await client.messages.create({
    body,
    from: env.TWILIO_FROM_NUMBER,
    to: input.phone,
  });

  logger.info("sms_sent", {
    type: input.type,
    phone: input.phone,
    sid: message.sid,
  });

  return { success: true, messageId: message.sid };
}

// ============================================
// Push via OneSignal
// ============================================

async function sendPushNotification(input: NotificationPayload): Promise<NotificationResult> {
  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY) {
    logger.debug("push_not_configured", {});
    return { success: false, error: "Push not configured" };
  }

  if (!input.pushToken && !input.userId) {
    logger.warn("push_missing_target", { type: input.type });
    return { success: false, error: "Missing push target" };
  }

  const title = getPushTitle(input.type);
  const message = getPushBody(input.type, input.data);

  const body: Record<string, unknown> = {
    app_id: env.ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    data: input.data,
  };

  if (input.pushToken) {
    body.include_player_ids = [input.pushToken];
  } else if (input.userId) {
    // Using external_id mapping in OneSignal
    body.include_external_user_ids = [input.userId];
  }

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OneSignal error: ${response.status} ${text}`);
  }

  const result = await response.json() as { id?: string };

  logger.info("push_sent", {
    type: input.type,
    userId: input.userId,
    notificationId: result.id,
  });

  return { success: true, messageId: result.id };
}

// ============================================
// Helper: Get user contact info from DB
// ============================================

interface UserContactInfo {
  email: string;
  phone?: string;
  pushToken?: string;
}

export async function getUserContactInfo(userId: string): Promise<UserContactInfo | null> {
  // For now, we only have email in the users table
  // In the future, you might add phone and push_token columns
  const result = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );

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

export async function sendNotificationToUser(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  channels: NotificationChannel[] = ["email"]
): Promise<NotificationResult[]> {
  const contact = await getUserContactInfo(userId);

  if (!contact) {
    logger.warn("user_not_found_for_notification", { userId, type });
    return [{ success: false, error: "User not found" }];
  }

  const results: NotificationResult[] = [];

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
