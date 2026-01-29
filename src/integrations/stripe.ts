// src/integrations/stripe.ts
// Centralized Stripe client initialization

import Stripe from "stripe";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Stripe client instance
 * Initialized once and reused across the application
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
  maxNetworkRetries: 3,
  timeout: 30000,
});

// Log Stripe initialization (without exposing keys)
logger.info("stripe_client_initialized", {
  apiVersion: "2024-12-18.acacia",
  hasSecretKey: !!env.STRIPE_SECRET_KEY,
  isTestMode: env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
});

/**
 * Get Stripe webhook secret
 */
export function getStripeWebhookSecret(): string {
  return env.STRIPE_WEBHOOK_SECRET;
}
