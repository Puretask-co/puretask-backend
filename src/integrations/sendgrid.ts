// src/integrations/sendgrid.ts
// Centralized SendGrid client initialization

import sgMail from "@sendgrid/mail";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Initialize SendGrid client
 * Sets API key and default from email
 */
export function initializeSendGrid(): void {
  if (!env.SENDGRID_API_KEY) {
    logger.warn("sendgrid_not_configured", {
      message: "SENDGRID_API_KEY not set, email notifications will be disabled",
    });
    return;
  }

  sgMail.setApiKey(env.SENDGRID_API_KEY);

  logger.info("sendgrid_client_initialized", {
    hasApiKey: !!env.SENDGRID_API_KEY,
    fromEmail: env.SENDGRID_FROM_EMAIL,
  });
}

// Initialize on module load
initializeSendGrid();

/**
 * Get SendGrid mail client
 */
export function getSendGridClient(): typeof sgMail {
  if (!env.SENDGRID_API_KEY) {
    throw new Error("SendGrid is not configured. Set SENDGRID_API_KEY environment variable.");
  }
  return sgMail;
}

/**
 * Get default from email
 */
export function getSendGridFromEmail(): string {
  return env.SENDGRID_FROM_EMAIL || "no-reply@puretask.com";
}
