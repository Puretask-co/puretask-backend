// src/services/stripeConnectService.ts
// Stripe Connect onboarding for cleaners

import Stripe from "stripe";
import { env } from "../config/env";
import { query } from "../db/client";
import { logger } from "../lib/logger";
import { CleanerProfile } from "../types/db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ============================================
// Account Management
// ============================================

/**
 * Ensure a cleaner has a Stripe Connect account
 * Creates one if it doesn't exist
 */
export async function ensureCleanerStripeAccount(cleanerId: string): Promise<string> {
  const result = await query<CleanerProfile & { stripe_account_id: string | null }>(
    `SELECT * FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const profile = result.rows[0];
  if (!profile) {
    throw Object.assign(new Error("Cleaner profile not found"), { statusCode: 404 });
  }

  // Return existing account if present
  if (profile.stripe_account_id) {
    return profile.stripe_account_id;
  }

  // Get cleaner email for the account
  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [cleanerId]
  );
  const email = userResult.rows[0]?.email;

  // Create new Express account
  const account = await stripe.accounts.create({
    type: "express",
    email,
    metadata: {
      cleaner_id: cleanerId,
      source: "puretask",
    },
    capabilities: {
      transfers: { requested: true },
    },
  });

  // Save to profile
  await query(
    `
      UPDATE cleaner_profiles
      SET stripe_account_id = $2, updated_at = NOW()
      WHERE user_id = $1
    `,
    [cleanerId, account.id]
  );

  logger.info("stripe_account_created", {
    cleanerId,
    stripeAccountId: account.id,
  });

  return account.id;
}

/**
 * Create a Stripe Connect onboarding link
 */
export async function createStripeOnboardingLink(params: {
  cleanerId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const stripeAccountId = await ensureCleanerStripeAccount(params.cleanerId);

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });

  logger.info("onboarding_link_created", {
    cleanerId: params.cleanerId,
    stripeAccountId,
  });

  return link.url;
}

/**
 * Create a Stripe dashboard login link for a cleaner
 */
export async function createStripeDashboardLink(cleanerId: string): Promise<string> {
  const result = await query<{ stripe_account_id: string | null }>(
    `SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const stripeAccountId = result.rows[0]?.stripe_account_id;
  if (!stripeAccountId) {
    throw Object.assign(new Error("No Stripe account connected"), { statusCode: 400 });
  }

  const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);

  return loginLink.url;
}

/**
 * Check if cleaner's Stripe account is fully onboarded
 */
export async function isCleanerPayoutsEnabled(cleanerId: string): Promise<{
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const result = await query<{ stripe_account_id: string | null }>(
    `SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const stripeAccountId = result.rows[0]?.stripe_account_id;
  if (!stripeAccountId) {
    return {
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      connected: true,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  } catch (err) {
    logger.error("stripe_account_retrieve_failed", {
      cleanerId,
      stripeAccountId,
      error: (err as Error).message,
    });

    return {
      connected: true,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }
}

/**
 * Get cleaner's Stripe account status
 */
export async function getCleanerStripeStatus(cleanerId: string): Promise<{
  hasAccount: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  requirements?: Stripe.Account.Requirements;
}> {
  const result = await query<{ stripe_account_id: string | null }>(
    `SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  const stripeAccountId = result.rows[0]?.stripe_account_id;
  if (!stripeAccountId) {
    return {
      hasAccount: false,
      accountId: null,
      payoutsEnabled: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      hasAccount: true,
      accountId: stripeAccountId,
      payoutsEnabled: account.payouts_enabled ?? false,
      requirements: account.requirements ?? undefined,
    };
  } catch (err) {
    return {
      hasAccount: true,
      accountId: stripeAccountId,
      payoutsEnabled: false,
    };
  }
}

/**
 * Handle Stripe Connect webhook events
 */
export async function handleConnectWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const cleanerId = account.metadata?.cleaner_id;

      if (cleanerId) {
        logger.info("stripe_account_updated", {
          cleanerId,
          accountId: account.id,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        });
      }
      break;
    }

    case "account.application.deauthorized": {
      const application = event.data.object as Stripe.Application;
      const account = application as unknown as Stripe.Account;
      const cleanerId = account.metadata?.cleaner_id;

      if (cleanerId) {
        // Clear the stripe_account_id when deauthorized
        await query(
          `UPDATE cleaner_profiles SET stripe_account_id = NULL WHERE user_id = $1`,
          [cleanerId]
        );

        logger.warn("stripe_account_deauthorized", {
          cleanerId,
          accountId: account.id,
        });
      }
      break;
    }

    default:
      // Log unhandled Connect events
      logger.debug("stripe_connect_event_ignored", { type: event.type });
  }
}

