"use strict";
// src/services/creditsPurchaseService.ts
// Credits purchase flow with Stripe
// Matches 001_init.sql + 002_supplementary.sql schema
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_PACKAGES = void 0;
exports.getCreditPackages = getCreditPackages;
exports.getCreditPackage = getCreditPackage;
exports.createCreditCheckoutSession = createCreditCheckoutSession;
exports.handleCheckoutCompleted = handleCheckoutCompleted;
exports.getPurchaseHistory = getPurchaseHistory;
exports.checkAndNotifyLowCredits = checkAndNotifyLowCredits;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("../db/client");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const creditsService_1 = require("./creditsService");
const notifications_1 = require("./notifications");
const stripe = new stripe_1.default(env_1.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});
// Credit packages
exports.CREDIT_PACKAGES = [
    { id: "credits_50", credits: 50, priceUsd: 50, popular: false },
    { id: "credits_100", credits: 100, priceUsd: 95, popular: true },
    { id: "credits_200", credits: 200, priceUsd: 180, popular: false },
    { id: "credits_500", credits: 500, priceUsd: 425, popular: false },
];
/**
 * Get available credit packages
 */
function getCreditPackages() {
    return exports.CREDIT_PACKAGES;
}
/**
 * Get a specific package
 */
function getCreditPackage(packageId) {
    return exports.CREDIT_PACKAGES.find((p) => p.id === packageId);
}
/**
 * Create a Stripe Checkout session for credit purchase
 */
async function createCreditCheckoutSession(options) {
    const { userId, packageId, successUrl, cancelUrl } = options;
    const pkg = getCreditPackage(packageId);
    if (!pkg) {
        throw new Error("Invalid credit package");
    }
    // Get user email for Stripe
    const userResult = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1`, [userId]);
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
    await (0, client_1.query)(`
      INSERT INTO credit_purchases (
        user_id,
        package_id,
        credits_amount,
        price_usd,
        stripe_checkout_session_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [userId, packageId, pkg.credits, pkg.priceUsd, session.id]);
    logger_1.logger.info("credit_checkout_created", {
        userId,
        packageId,
        sessionId: session.id,
        credits: pkg.credits,
        priceUsd: pkg.priceUsd,
    });
    return {
        sessionId: session.id,
        url: session.url,
    };
}
/**
 * Handle successful checkout (called from webhook)
 */
async function handleCheckoutCompleted(session) {
    const metadata = session.metadata;
    if (metadata?.type !== "credit_purchase") {
        return; // Not a credit purchase
    }
    const userId = metadata.user_id;
    const creditsAmount = parseInt(metadata.credits_amount, 10);
    // Check if already processed
    const existing = await (0, client_1.query)(`
      SELECT * FROM credit_purchases
      WHERE stripe_checkout_session_id = $1
    `, [session.id]);
    if (existing.rows.length > 0 && existing.rows[0].status === "completed") {
        logger_1.logger.warn("credit_purchase_already_completed", {
            sessionId: session.id,
        });
        return;
    }
    // Add credits to user wallet via credit_ledger
    await (0, creditsService_1.purchaseCredits)({
        userId,
        creditAmount: creditsAmount,
    });
    // Update purchase record
    await (0, client_1.query)(`
      UPDATE credit_purchases
      SET status = 'completed',
          stripe_payment_intent_id = $2,
          completed_at = NOW()
      WHERE stripe_checkout_session_id = $1
    `, [session.id, session.payment_intent]);
    logger_1.logger.info("credit_purchase_completed", {
        userId,
        creditsAmount,
        sessionId: session.id,
    });
}
/**
 * Get purchase history for a user
 */
async function getPurchaseHistory(userId, limit = 50) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM credit_purchases
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);
    return result.rows;
}
/**
 * Check if user has low credits and notify
 */
async function checkAndNotifyLowCredits(userId, threshold = 20) {
    const balance = await (0, creditsService_1.getUserBalance)(userId);
    if (balance > 0 && balance < threshold) {
        (0, notifications_1.notifyCreditsLow)(userId, balance).catch((e) => logger_1.logger.error("low_credits_notification_failed", { error: e.message }));
    }
}
