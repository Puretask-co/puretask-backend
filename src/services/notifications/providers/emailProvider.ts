// src/services/notifications/providers/emailProvider.ts
// Email provider wrapper for SendGrid

import { SendGridProvider } from "./sendgrid";
import { logger } from "../../../lib/logger";

const sendgrid = new SendGridProvider();

export interface EmailParams {
  to: string;
  subject: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
}

/**
 * Send email via SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<void> {
  const { to, subject, template, templateData, html, text } = params;

  try {
    // For now, send with HTML (template support requires SendGrid template setup)
    const result = await sendgrid.send({
      channel: "email",
      type: "welcome", // Placeholder type
      email: to,
      to,
      subject,
      html: html || text || "Email from PureTask",
      text: text || "",
      data: templateData || {},
    });

    if (!result.success) {
      throw new Error(result.error || "Email send failed");
    }

    logger.info("email_sent", { to, subject });
  } catch (error) {
    logger.error("email_send_failed", {
      to,
      subject,
      error: (error as Error).message,
    });
    throw error;
  }
}

// Re-export for convenience
export { sendgrid };

