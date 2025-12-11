// src/services/notifications/providers/twilio.ts
// Twilio SMS provider

import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";
import type { SMSPayload, NotificationResult, NotificationProvider } from "../types";

const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

export class TwilioProvider implements NotificationProvider {
  name = "twilio";
  channel = "sms" as const;

  isConfigured(): boolean {
    return !!(
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }

  async send(payload: SMSPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: "sms",
        error: "Twilio not configured",
      };
    }

    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

    try {
      const url = `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`;

      const params = new URLSearchParams({
        To: payload.to || payload.phone || "",
        From: fromNumber,
        Body: payload.body || "",
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization":
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error("twilio_send_failed", {
          status: response.status,
          error: responseData,
          to: payload.to,
        });
        return {
          success: false,
          channel: "sms",
          error: responseData.message || `Twilio error: ${response.status}`,
        };
      }

      logger.info("sms_sent", {
        provider: "twilio",
        to: payload.to,
        messageId: responseData.sid,
        status: responseData.status,
      });

      return {
        success: true,
        channel: "sms",
        messageId: responseData.sid,
      };
    } catch (error) {
      logger.error("twilio_error", {
        error: (error as Error).message,
        to: payload.to,
      });
      return {
        success: false,
        channel: "sms",
        error: (error as Error).message,
      };
    }
  }
}

export const twilioProvider = new TwilioProvider();

