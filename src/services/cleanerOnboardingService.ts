// src/services/cleanerOnboardingService.ts
// Cleaner onboarding with Stripe Connect

import Stripe from "stripe";
import { query } from "../db/client";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { User } from "../types/db";

const APP_URL = env.APP_URL;

// Extended type for cleaner users joined with cleaner_profiles
interface CleanerUserRow extends User {
  stripe_connect_id: string | null;
  tier: string | null;
  base_rate_cph: number | null;
  deep_addon_cph: number | null;
  moveout_addon_cph: number | null;
  reliability_score: number | null;
  payout_percentage: number | null;
  avg_rating: number | null;
  jobs_completed: number;
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export interface CleanerProfile {
  id: string;
  userId: string;
  tier: string | null;
  baseRateCph: number | null;
  deepAddonCph: number | null;
  moveoutAddonCph: number | null;
  reliabilityScore: number | null;
  payoutPercentage: number | null;
  stripeConnectId: string | null;
  stripeOnboardingComplete: boolean;
  avgRating: number | null;
  jobsCompleted: number;
  availabilityJson: any;
  bio: string | null;
  serviceAreas: string[];
}

/**
 * Create Stripe Connect account for cleaner
 */
export async function createStripeConnectAccount(
  cleanerId: string
): Promise<{ accountId: string; onboardingUrl: string }> {
  // Get cleaner info with profile
  const userResult = await query<CleanerUserRow>(
    `SELECT u.*, cp.stripe_connect_id, cp.tier, cp.base_rate_cph, 
            cp.deep_addon_cph, cp.moveout_addon_cph, cp.reliability_score,
            cp.payout_percentage, cp.avg_rating, cp.jobs_completed
     FROM users u
     LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'cleaner'`,
    [cleanerId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("Cleaner not found");
  }

  const user = userResult.rows[0];

  // Check if already has Connect account
  if (user.stripe_connect_id) {
    // Get existing account link
    const accountLink = await stripe.accountLinks.create({
      account: user.stripe_connect_id,
      refresh_url: `${APP_URL}/cleaner/onboarding/refresh`,
      return_url: `${APP_URL}/cleaner/onboarding/complete`,
      type: "account_onboarding",
    });

    return {
      accountId: user.stripe_connect_id,
      onboardingUrl: accountLink.url,
    };
  }

  // Create new Connect account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: user.email || undefined,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      cleaner_id: cleanerId,
    },
  });

  // Store Connect account ID
  await query(
    `
      UPDATE users
      SET stripe_connect_id = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [account.id, cleanerId]
  );

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${APP_URL}/cleaner/onboarding/refresh`,
    return_url: `${APP_URL}/cleaner/onboarding/complete`,
    type: "account_onboarding",
  });

  logger.info("stripe_connect_account_created", {
    cleanerId,
    accountId: account.id,
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

/**
 * Check Stripe Connect account status
 */
export async function getStripeConnectStatus(cleanerId: string): Promise<{
  hasAccount: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
}> {
  const userResult = await query<{ stripe_connect_id: string | null }>(
    `SELECT stripe_connect_id FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].stripe_connect_id) {
    return {
      hasAccount: false,
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    };
  }

  const accountId = userResult.rows[0].stripe_connect_id;

  try {
    const account = await stripe.accounts.retrieve(accountId);

    return {
      hasAccount: true,
      accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      onboardingComplete:
        account.charges_enabled &&
        account.payouts_enabled &&
        account.details_submitted,
    };
  } catch (error) {
    logger.error("stripe_connect_status_failed", {
      cleanerId,
      accountId,
      error: (error as Error).message,
    });

    return {
      hasAccount: true,
      accountId,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    };
  }
}

/**
 * Get Stripe Connect dashboard link
 */
export async function getStripeDashboardLink(
  cleanerId: string
): Promise<string> {
  const userResult = await query<{ stripe_connect_id: string | null }>(
    `SELECT stripe_connect_id FROM cleaner_profiles WHERE user_id = $1`,
    [cleanerId]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].stripe_connect_id) {
    throw new Error("No Stripe Connect account found");
  }

  const loginLink = await stripe.accounts.createLoginLink(
    userResult.rows[0].stripe_connect_id
  );

  return loginLink.url;
}

/**
 * Update cleaner profile/rates
 */
export async function updateCleanerProfile(
  cleanerId: string,
  updates: {
    baseRateCph?: number;
    deepAddonCph?: number;
    moveoutAddonCph?: number;
    bio?: string;
    serviceAreas?: string[];
  }
): Promise<CleanerUserRow> {
  const fields: string[] = ["updated_at = NOW()"];
  const values: any[] = [cleanerId];
  let paramIndex = 2;

  if (updates.baseRateCph !== undefined) {
    fields.push(`base_rate_cph = $${paramIndex++}`);
    values.push(updates.baseRateCph);
  }

  if (updates.deepAddonCph !== undefined) {
    fields.push(`deep_addon_cph = $${paramIndex++}`);
    values.push(updates.deepAddonCph);
  }

  if (updates.moveoutAddonCph !== undefined) {
    fields.push(`moveout_addon_cph = $${paramIndex++}`);
    values.push(updates.moveoutAddonCph);
  }

  const result = await query<CleanerUserRow>(
    `
      UPDATE cleaner_profiles
      SET ${fields.join(", ")}
      WHERE user_id = $1
      RETURNING *, user_id as id
    `,
    values
  );

  if (result.rows.length === 0) {
    throw new Error("Cleaner not found");
  }

  return result.rows[0];
}

/**
 * Update cleaner availability
 */
export async function updateCleanerAvailability(
  cleanerId: string,
  availability: {
    monday?: { start: string; end: string }[];
    tuesday?: { start: string; end: string }[];
    wednesday?: { start: string; end: string }[];
    thursday?: { start: string; end: string }[];
    friday?: { start: string; end: string }[];
    saturday?: { start: string; end: string }[];
    sunday?: { start: string; end: string }[];
  }
): Promise<void> {
  await query(
    `
      INSERT INTO cleaner_availability (cleaner_id, availability_json, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (cleaner_id) DO UPDATE SET
        availability_json = EXCLUDED.availability_json,
        updated_at = NOW()
    `,
    [cleanerId, JSON.stringify(availability)]
  );

  logger.info("cleaner_availability_updated", { cleanerId });
}

/**
 * Get cleaner availability
 */
export async function getCleanerAvailability(cleanerId: string): Promise<any> {
  const result = await query<{ availability_json: any }>(
    `SELECT availability_json FROM cleaner_availability WHERE cleaner_id = $1`,
    [cleanerId]
  );

  return result.rows[0]?.availability_json || {};
}

/**
 * Get cleaner profile with stats
 */
export async function getCleanerProfile(
  cleanerId: string
): Promise<CleanerProfile | null> {
  const result = await query<CleanerUserRow>(
    `SELECT u.*, cp.tier, cp.base_rate_cph, cp.deep_addon_cph, cp.moveout_addon_cph,
            cp.reliability_score, cp.payout_percentage, cp.stripe_connect_id,
            cp.avg_rating, COALESCE(cp.jobs_completed, 0) as jobs_completed
     FROM users u
     LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'cleaner'`,
    [cleanerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  const stripeStatus = await getStripeConnectStatus(cleanerId);
  const availability = await getCleanerAvailability(cleanerId);

  return {
    id: user.id,
    userId: user.id,
    tier: user.tier,
    baseRateCph: user.base_rate_cph,
    deepAddonCph: user.deep_addon_cph,
    moveoutAddonCph: user.moveout_addon_cph,
    reliabilityScore: user.reliability_score,
    payoutPercentage: user.payout_percentage,
    stripeConnectId: user.stripe_connect_id,
    stripeOnboardingComplete: stripeStatus.onboardingComplete,
    avgRating: user.avg_rating,
    jobsCompleted: user.jobs_completed ?? 0,
    availabilityJson: availability,
    bio: null, // Add to schema if needed
    serviceAreas: [], // Add to schema if needed
  };
}

