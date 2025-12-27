// src/services/notifications/providers/smsProvider.ts
// SMS provider for sending text messages via Twilio

import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";

export interface SMSParams {
  to: string;
  message: string;
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(params: SMSParams): Promise<void> {
  const { to, message } = params;

  // Check if Twilio is configured
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    logger.warn("twilio_not_configured", { to });
    
    if (env.NODE_ENV === "development") {
      logger.info("sms_would_send_dev", { to, message });
      return;
    }
    
    throw new Error("Twilio SMS is not configured");
  }

  try {
    // In development, log instead of sending
    if (env.NODE_ENV === "development") {
      logger.info("sms_dev_mode", { to, message });
      return;
    }

    // Send via Twilio (using fetch since twilio SDK adds dependencies)
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: env.TWILIO_FROM_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio API error: ${error}`);
    }

    logger.info("sms_sent", { to });
  } catch (error) {
    logger.error("sms_send_failed", {
      to,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Send SMS with template
 */
export async function sendSMSTemplate(
  to: string,
  templateKey: string,
  data: Record<string, string>
): Promise<void> {
  // Simple template replacement
  let message = getTemplate(templateKey);
  
  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{{${key}}}`, "g"), value);
  });

  await sendSMS({ to, message });
}

/**
 * Get SMS template
 */
function getTemplate(key: string): string {
  const templates: Record<string, string> = {
    verification_code: "Your PureTask verification code is: {{code}}. Valid for 10 minutes.",
    job_reminder: "Reminder: You have a cleaning job at {{address}} at {{time}}.",
    emergency: "URGENT: {{message}}",
  };

  return templates[key] || "{{message}}";
}

