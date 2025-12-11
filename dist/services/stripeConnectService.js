"use strict";
// src/services/stripeConnectService.ts
// Stripe Connect onboarding for cleaners
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCleanerStripeAccount = ensureCleanerStripeAccount;
exports.createStripeOnboardingLink = createStripeOnboardingLink;
exports.createStripeDashboardLink = createStripeDashboardLink;
exports.isCleanerPayoutsEnabled = isCleanerPayoutsEnabled;
exports.getCleanerStripeStatus = getCleanerStripeStatus;
exports.handleConnectWebhookEvent = handleConnectWebhookEvent;
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const stripe = new stripe_1.default(env_1.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});
// ============================================
// Account Management
// ============================================
/**
 * Ensure a cleaner has a Stripe Connect account
 * Creates one if it doesn't exist
 */
async function ensureCleanerStripeAccount(cleanerId) {
    const result = await (0, client_1.query)(`SELECT * FROM cleaner_profiles WHERE user_id = $1`, [cleanerId]);
    const profile = result.rows[0];
    if (!profile) {
        throw Object.assign(new Error("Cleaner profile not found"), { statusCode: 404 });
    }
    // Return existing account if present
    if (profile.stripe_account_id) {
        return profile.stripe_account_id;
    }
    // Get cleaner email for the account
    const userResult = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1`, [cleanerId]);
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
    await (0, client_1.query)(`
      UPDATE cleaner_profiles
      SET stripe_account_id = $2, updated_at = NOW()
      WHERE user_id = $1
    `, [cleanerId, account.id]);
    logger_1.logger.info("stripe_account_created", {
        cleanerId,
        stripeAccountId: account.id,
    });
    return account.id;
}
/**
 * Create a Stripe Connect onboarding link
 */
async function createStripeOnboardingLink(params) {
    const stripeAccountId = await ensureCleanerStripeAccount(params.cleanerId);
    const link = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
        type: "account_onboarding",
    });
    logger_1.logger.info("onboarding_link_created", {
        cleanerId: params.cleanerId,
        stripeAccountId,
    });
    return link.url;
}
/**
 * Create a Stripe dashboard login link for a cleaner
 */
async function createStripeDashboardLink(cleanerId) {
    const result = await (0, client_1.query)(`SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`, [cleanerId]);
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
async function isCleanerPayoutsEnabled(cleanerId) {
    const result = await (0, client_1.query)(`SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`, [cleanerId]);
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
    }
    catch (err) {
        logger_1.logger.error("stripe_account_retrieve_failed", {
            cleanerId,
            stripeAccountId,
            error: err.message,
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
async function getCleanerStripeStatus(cleanerId) {
    const result = await (0, client_1.query)(`SELECT stripe_account_id FROM cleaner_profiles WHERE user_id = $1`, [cleanerId]);
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
    }
    catch (err) {
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
async function handleConnectWebhookEvent(event) {
    switch (event.type) {
        case "account.updated": {
            const account = event.data.object;
            const cleanerId = account.metadata?.cleaner_id;
            if (cleanerId) {
                logger_1.logger.info("stripe_account_updated", {
                    cleanerId,
                    accountId: account.id,
                    payoutsEnabled: account.payouts_enabled,
                    detailsSubmitted: account.details_submitted,
                });
            }
            break;
        }
        case "account.application.deauthorized": {
            const application = event.data.object;
            const account = application;
            const cleanerId = account.metadata?.cleaner_id;
            if (cleanerId) {
                // Clear the stripe_account_id when deauthorized
                await (0, client_1.query)(`UPDATE cleaner_profiles SET stripe_account_id = NULL WHERE user_id = $1`, [cleanerId]);
                logger_1.logger.warn("stripe_account_deauthorized", {
                    cleanerId,
                    accountId: account.id,
                });
            }
            break;
        }
        default:
            // Log unhandled Connect events
            logger_1.logger.debug("stripe_connect_event_ignored", { type: event.type });
    }
}
