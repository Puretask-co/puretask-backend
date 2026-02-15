// src/integrations/twilio.ts
// Centralized Twilio client initialization

import twilio from "twilio";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Twilio client instance
 * Initialized once and reused across the application
 */
export const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

// Log Twilio initialization (without exposing credentials)
logger.info("twilio_client_initialized", {
  hasAccountSid: !!env.TWILIO_ACCOUNT_SID,
  hasAuthToken: !!env.TWILIO_AUTH_TOKEN,
  isConfigured: !!twilioClient,
  fromNumber: env.TWILIO_FROM_NUMBER || "not_configured",
});

/**
 * Get Twilio from number
 */
export function getTwilioFromNumber(): string {
  return env.TWILIO_FROM_NUMBER || "";
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!twilioClient;
}
