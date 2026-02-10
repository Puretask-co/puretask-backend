// src/services/creditsPurchaseService.ts
// Credits purchase flow with Stripe
// Matches 001_init.sql + 002_supplementary.sql schema

import { stripe } from "../integrations/stripe";
import { query } from "../db/client";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { purchaseCredits, getUserBalance } from "./creditsService";
import { notifyCreditsLow } from "./notifications";

// Credit packages
export const CREDIT_PACKAGES = [
  { id: "credits_50", credits: 50, priceUsd: 50, popular: false },
  { id: "credits_100", credits: 100, priceUsd: 95, popular: true },
  { id: "credits_200", credits: 200, priceUsd: 180, popular: false },
  { id: "credits_500", credits: 500, priceUsd: 425, popular: false },
] as const;

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]["id"];

export interface CreditPurchaseRecord {
  id: string;
  user_id: string;
  package_id: string;
  credits_amount: number;
  price_usd: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: "pending" | "completed" | "failed" | "refunded";
  created_at: string;
  completed_at: string | null;
}

/**
 * Get available credit packages
 */
export function getCreditPackages() {
  return CREDIT_PACKAGES;
}

/**
 * Get a specific package
 */
export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find((p) => p.id === packageId);
}

/**
 * Create a Stripe Checkout session for credit purchase
 */
export async function createCreditCheckoutSession(options: {
  userId: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const { userId, packageId, successUrl, cancelUrl } = options;

  const pkg = getCreditPackage(packageId);
  if (!pkg) {
    throw new Error("Invalid credit package");
  }

  // Get user email for Stripe
  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: userResult.rows[0].email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${pkg.credits} PureTask Credits`,
            description: `Add ${pkg.credits} credits to your wallet`,
          },
          unit_amount: pkg.priceUsd * 100, // cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: userId,
      package_id: packageId,
      credits_amount: pkg.credits.toString(),
      type: "credit_purchase",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // Store purchase record
  await query(
    `
      INSERT INTO credit_purchases (
        user_id,
        package_id,
        credits_amount,
        price_usd,
        stripe_checkout_session_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `,
    [userId, packageId, pkg.credits, pkg.priceUsd, session.id]
  );

  logger.info("credit_checkout_created", {
    userId,
    packageId,
    sessionId: session.id,
    credits: pkg.credits,
    priceUsd: pkg.priceUsd,
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Handle successful checkout (called from webhook)
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const metadata = session.metadata;

  if (metadata?.type !== "credit_purchase") {
    return; // Not a credit purchase
  }

  const userId = metadata.user_id;
  const creditsAmount = parseInt(metadata.credits_amount, 10);

  // Check if already processed
  const existing = await query<CreditPurchaseRecord>(
    `
      SELECT * FROM credit_purchases
      WHERE stripe_checkout_session_id = $1
    `,
    [session.id]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === "completed") {
    logger.warn("credit_purchase_already_completed", {
      sessionId: session.id,
    });
    return;
  }

  // Add credits to user wallet via credit_ledger
  await purchaseCredits({
    userId,
    creditAmount: creditsAmount,
  });

  // Update purchase record
  await query(
    `
      UPDATE credit_purchases
      SET status = 'completed',
          stripe_payment_intent_id = $2,
          completed_at = NOW()
      WHERE stripe_checkout_session_id = $1
    `,
    [session.id, session.payment_intent]
  );

  logger.info("credit_purchase_completed", {
    userId,
    creditsAmount,
    sessionId: session.id,
  });
}

/**
 * Get purchase history for a user
 */
export async function getPurchaseHistory(
  userId: string,
  limit: number = 50
): Promise<CreditPurchaseRecord[]> {
  const result = await query<CreditPurchaseRecord>(
    `
      SELECT *
      FROM credit_purchases
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Check if user has low credits and notify
 */
export async function checkAndNotifyLowCredits(
  userId: string,
  threshold: number = 20
): Promise<void> {
  const balance = await getUserBalance(userId);

  if (balance > 0 && balance < threshold) {
    notifyCreditsLow(userId, balance).catch((e) =>
      logger.error("low_credits_notification_failed", { error: e.message })
    );
  }
}
