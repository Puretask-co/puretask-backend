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
  renderNotification,
  getEmailSubject,
  getEmailBody,
  getSmsBody,
  getPushTitle,
  getPushBody,
  TEMPLATE_VERSION,
  type TemplateData,
  type Channel,
} from "./templates";
import { sendNotificationViaEvent } from "./eventBasedNotificationService";

// ============================================
// Idempotency & Delivery Logging
// ============================================

/**
 * Get deduplication window for a notification type
 * Some notifications should allow re-sends after a cooldown (e.g., password reset)
 * Others should be "ever sent" (e.g., welcome, job lifecycle events)
 */
function getDedupeWindow(type: NotificationType): { window: "ever" | "time"; minutes?: number } {
  // Strict "ever sent" - these should never be sent twice with same dedupe key
  const everSentTypes: NotificationType[] = [
    "welcome",
    "job.created",
    "job.accepted",
    "job.on_my_way",
    "job.started",
    "job.completed",
    "job.awaiting_approval",
    "job.approved",
    "job.disputed",
    "job.cancelled",
    "job.reminder_24h", // Has timestamp bucket in dedupe key
    "job.reminder_2h", // Has timestamp bucket in dedupe key
    "job.no_show_warning", // Has timestamp bucket in dedupe key
    "credits.purchased",
    "payout.processed",
  ];

  if (everSentTypes.includes(type)) {
    return { window: "ever" };
  }

  // Time-windowed dedupe - allow re-send after cooldown
  const timeWindowedTypes: Partial<Record<NotificationType, number>> = {
    "password.reset": 60, // 1 hour - user can request reset again
    "payment.failed": 60, // 1 hour - payment can fail multiple times
    "payout.failed": 1440, // 24 hours - payout issues need attention
    "credits.low": 1440, // 24 hours - warn again if still low
    "subscription.renewal_reminder": 1440, // 24 hours - daily reminder is fine
  };

  const windowMinutes = timeWindowedTypes[type];
  if (windowMinutes) {
    return { window: "time", minutes: windowMinutes };
  }

  // Default: "ever sent" for safety (prevents accidental duplicates)
  return { window: "ever" };
}

/**
 * Check if a notification with the given dedupe key was already sent
 * Uses type-aware deduplication:
 * - "ever sent" for job lifecycle, welcome, etc. (dedupe key includes jobId/timestamp)
 * - Time-windowed for password reset, payment failed, etc. (allow re-send after cooldown)
 */
async function alreadySent(dedupeKey: string, type: NotificationType): Promise<boolean> {
  if (!dedupeKey) return false;

  const dedupeConfig = getDedupeWindow(type);

  try {
    let queryText: string;
    let params: string[];

    if (dedupeConfig.window === "ever") {
      // Check "ever sent" - prevents all duplicates
      queryText = `
        SELECT id FROM notification_log
        WHERE payload->>'dedupeKey' = $1
          AND status = 'sent'
        LIMIT 1
      `;
      params = [dedupeKey];
    } else {
      // Check within time window - allows re-send after cooldown
      queryText = `
        SELECT id FROM notification_log
        WHERE payload->>'dedupeKey' = $1
          AND status = 'sent'
          AND created_at > NOW() - INTERVAL '${dedupeConfig.minutes} minutes'
        LIMIT 1
      `;
      params = [dedupeKey];
    }

    const result = await query<{ id: string }>(queryText, params);
    return result.rows.length > 0;
  } catch (err) {
    logger.error("idempotency_check_failed", {
      dedupeKey,
      type,
      error: (err as Error).message,
    });
    // On error, allow send (fail open) but log
    return false;
  }
}

/**
 * Log a notification delivery attempt to notification_log table
 * Includes rich context for debugging and support
 */
async function logDeliveryAttempt(args: {
  userId?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  status: "sent" | "failed" | "skipped";
  error?: string;
  providerMessageId?: string;
  dedupeKey?: string;
  recipient?: string;
  jobId?: string;
  primaryActionUrl?: string;
}): Promise<void> {
  try {
    await query(
      `
        INSERT INTO notification_log (
          user_id,
          channel,
          type,
          payload,
          status,
          error_message,
          sent_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      `,
      [
        args.userId ?? null,
        args.channel,
        args.type,
        JSON.stringify({
          dedupeKey: args.dedupeKey,
          recipient: args.recipient,
          providerMessageId: args.providerMessageId,
          jobId: args.jobId,
          primaryActionUrl: args.primaryActionUrl,
          templateVersion: TEMPLATE_VERSION,
        }),
        args.status,
        args.error ?? null,
        args.status === "sent" ? new Date() : null,
      ]
    );
  } catch (err) {
    logger.error("failed_to_log_notification_delivery", {
      error: (err as Error).message,
      type: args.type,
      channel: args.channel,
    });
  }
}

// ============================================
// Main Notification Dispatcher
// ============================================

/**
 * Send a notification via the specified channel
 * - Uses event-based (n8n) if configured, otherwise falls back to direct provider calls
 * - Does not throw if channel is not configured; logs and returns
 * - Records failures to notification_failures table for retry
 * - Checks idempotency if dedupeKey is provided
 * - Logs all delivery attempts to notification_log table
 */
export async function sendNotification(input: NotificationPayload): Promise<NotificationResult> {
  // Check idempotency if dedupeKey is provided
  if (input.dedupeKey) {
    const wasAlreadySent = await alreadySent(input.dedupeKey, input.type);
    if (wasAlreadySent) {
      logger.debug("notification_skipped_duplicate", {
        dedupeKey: input.dedupeKey,
        type: input.type,
        channel: input.channel,
      });

      // Extract context for logging
      const jobId = (input.data as any)?.jobId as string | undefined;
      const rendered = renderNotification(input.type, input.data as TemplateData, [input.channel]);
      const primaryActionUrl =
        rendered?.email?.primaryActionUrl || rendered?.sms?.primaryActionUrl || rendered?.push?.url;

      await logDeliveryAttempt({
        userId: input.userId ?? null,
        type: input.type,
        channel: input.channel,
        status: "skipped",
        dedupeKey: input.dedupeKey,
        recipient: input.email || input.phone || undefined,
        jobId,
        primaryActionUrl,
      });

      return { success: true, messageId: undefined, channel: input.channel };
    }
  }

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
      const result = await sendNotificationViaEvent(input);

      // Log delivery attempt
      // Extract context for logging
      const jobId = (input.data as any)?.jobId as string | undefined;
      const rendered = renderNotification(input.type, input.data as TemplateData, [input.channel]);
      const primaryActionUrl =
        rendered?.email?.primaryActionUrl || rendered?.sms?.primaryActionUrl || rendered?.push?.url;

      await logDeliveryAttempt({
        userId: input.userId ?? null,
        type: input.type,
        channel: input.channel,
        status: result.success ? "sent" : "failed",
        error: result.error,
        providerMessageId: result.messageId,
        dedupeKey: input.dedupeKey,
        recipient: input.email || input.phone || undefined,
        jobId,
        primaryActionUrl,
      });

      return result;
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
        await logDeliveryAttempt({
          userId: input.userId ?? null,
          type: input.type,
          channel: input.channel,
          status: "failed",
          error: "Unknown channel",
          dedupeKey: input.dedupeKey,
          recipient: input.email || input.phone || undefined,
        });
        return { success: false, error: "Unknown channel" };
    }

    // Extract context for logging
    const rendered = renderNotification(input.type, input.data as TemplateData, [input.channel]);
    const jobId = (input.data as any)?.jobId as string | undefined;
    const primaryActionUrl =
      rendered?.email?.primaryActionUrl || rendered?.sms?.primaryActionUrl || rendered?.push?.url;

    // Log delivery attempt
    await logDeliveryAttempt({
      userId: input.userId ?? null,
      type: input.type,
      channel: input.channel,
      status: result.success ? "sent" : "failed",
      error: result.error,
      providerMessageId: result.messageId,
      dedupeKey: input.dedupeKey,
      recipient: input.email || input.phone || undefined,
      jobId,
      primaryActionUrl,
    });

    if (result.success) {
      logger.info("notification_sent", {
        channel: input.channel,
        type: input.type,
        userId: input.userId,
        dedupeKey: input.dedupeKey,
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
      dedupeKey: input.dedupeKey,
    });

    // Extract context for logging
    const jobId = (input.data as any)?.jobId as string | undefined;

    // Log failure
    await logDeliveryAttempt({
      userId: input.userId ?? null,
      type: input.type,
      channel: input.channel,
      status: "failed",
      error: error.message,
      dedupeKey: input.dedupeKey,
      recipient: input.email || input.phone || undefined,
      jobId,
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

  // Use new template system
  const rendered = renderNotification(input.type, input.data as TemplateData, ["email"]);

  if (!rendered.email) {
    logger.warn("email_template_not_available_fallback", {
      type: input.type,
      message: "Falling back to deprecated template helpers - migrate to renderNotification()",
    });
    // Fallback to old system for backwards compatibility
    const subject = getEmailSubject(input.type, input.data as TemplateData);
    const text = getEmailBody(input.type, input.data);

    const sgMail = await import("@sendgrid/mail").then((m) => m.default);
    sgMail.setApiKey(env.SENDGRID_API_KEY);

    const response = await sgMail.send({
      to: input.email,
      from: env.SENDGRID_FROM_EMAIL,
      subject,
      text,
    });

    const messageId = response[0]?.headers?.["x-message-id"] || undefined;
    return { success: true, messageId };
  }

  // Use dynamic import to avoid loading SendGrid if not used
  const sgMail = await import("@sendgrid/mail").then((m) => m.default);
  sgMail.setApiKey(env.SENDGRID_API_KEY);

  const response = await sgMail.send({
    to: input.email,
    from: env.SENDGRID_FROM_EMAIL,
    subject: rendered.email.subject,
    text: rendered.email.text,
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

  // Use new template system
  const rendered = renderNotification(input.type, input.data as TemplateData, ["sms"]);

  let body: string;
  if (rendered.sms) {
    body = rendered.sms.text;
  } else {
    // Fallback to old system for backwards compatibility
    body = getSmsBody(input.type, input.data);
  }

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

  // Use new template system
  const rendered = renderNotification(input.type, input.data as TemplateData, ["push"]);

  let title: string;
  let message: string;
  let url: string | undefined;

  if (rendered.push) {
    title = rendered.push.title;
    message = rendered.push.body;
    url = rendered.push.url;
  } else {
    // Fallback to old system for backwards compatibility
    title = getPushTitle(input.type);
    message = getPushBody(input.type, input.data);
  }

  const body: Record<string, unknown> = {
    app_id: env.ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    data: {
      ...input.data,
      // Include deep link URL in data for app to handle
      deepLink: url,
    },
  };

  // Add URL to OneSignal payload if supported
  if (url) {
    body.url = url;
  }

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

  const result = (await response.json()) as { id?: string };

  logger.info("push_sent", {
    type: input.type,
    userId: input.userId,
    notificationId: result.id,
    url,
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
  const result = await query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);

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

/**
 * Generate a dedupe key for a notification
 * Format: ${type}:${channel}:${userId}:${jobId || ""}:${timestampBucket || ""}
 */
function generateDedupeKey(
  type: NotificationType,
  channel: NotificationChannel,
  userId: string,
  data: Record<string, unknown>
): string {
  const jobId = (data.jobId as string) || "";
  // For reminders, use scheduled_start_at bucket (hour) to prevent duplicates within same hour
  const scheduledStartAt = data.scheduled_start_at as string | undefined;
  const timestampBucket = scheduledStartAt
    ? new Date(scheduledStartAt).toISOString().slice(0, 13) // YYYY-MM-DDTHH
    : "";

  return `${type}:${channel}:${userId}:${jobId}:${timestampBucket}`;
}

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
    // Generate dedupe key for idempotency
    const dedupeKey = generateDedupeKey(type, channel, userId, data);

    const result = await sendNotification({
      userId,
      email: contact.email,
      phone: contact.phone,
      pushToken: contact.pushToken,
      type,
      channel,
      data,
      dedupeKey,
    });
    results.push(result);
  }

  return results;
}
