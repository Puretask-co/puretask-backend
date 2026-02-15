// src/services/notifications/providers/sendgrid.ts
// SendGrid email provider

import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";
import type { EmailPayload, NotificationResult, NotificationProvider } from "../types";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@puretask.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "PureTask";

export class SendGridProvider implements NotificationProvider {
  name = "sendgrid";
  channel = "email" as const;

  isConfigured(): boolean {
    return !!env.SENDGRID_API_KEY;
  }

  async send(payload: EmailPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: "email",
        error: "SendGrid not configured",
      };
    }

    try {
      const response = await fetch(SENDGRID_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: payload.to }],
            },
          ],
          from: {
            email: payload.from || FROM_EMAIL,
            name: FROM_NAME,
          },
          reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
          subject: payload.subject,
          content: [
            {
              type: "text/html",
              value: payload.html,
            },
            ...(payload.text
              ? [
                  {
                    type: "text/plain",
                    value: payload.text,
                  },
                ]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("sendgrid_send_failed", {
          status: response.status,
          error: errorBody,
          to: payload.to,
        });
        return {
          success: false,
          channel: "email",
          error: `SendGrid error: ${response.status}`,
        };
      }

      const messageId = response.headers.get("x-message-id") || undefined;

      logger.info("email_sent", {
        provider: "sendgrid",
        to: payload.to,
        subject: payload.subject,
        messageId,
      });

      return {
        success: true,
        channel: "email",
        messageId,
      };
    } catch (error) {
      logger.error("sendgrid_error", {
        error: (error as Error).message,
        to: payload.to,
      });
      return {
        success: false,
        channel: "email",
        error: (error as Error).message,
      };
    }
  }
}

export const sendGridProvider = new SendGridProvider();
