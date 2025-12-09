"use strict";
// src/routes/payments.ts
// Payment routes for both wallet top-up and job charge flows
// 
// Key pricing difference:
// - Wallet top-ups: base price (CENTS_PER_CREDIT)
// - Direct job charge: base price + surcharge (NON_CREDIT_SURCHARGE_PERCENT)
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const auth_1 = require("../lib/auth");
const logger_1 = require("../lib/logger");
const client_1 = require("../db/client");
const paymentService_1 = require("../services/paymentService");
const jobsService_1 = require("../services/jobsService");
const creditsService_1 = require("../services/creditsService");
const env_1 = require("../config/env");
const paymentsRouter = (0, express_1.Router)();
// All payment routes require authentication
paymentsRouter.use((0, auth_1.auth)());
// ============================================
// Wallet Top-up Flow
// ============================================
/**
 * POST /payments/credits
 * Create a PaymentIntent for buying credits (wallet top-up)
 */
const buyCreditsSchema = zod_1.z.object({
    credits: zod_1.z.number().int().positive().min(10).max(10000),
    stripeCustomerId: zod_1.z.string().optional(),
});
paymentsRouter.post("/credits", (0, validation_1.validateBody)(buyCreditsSchema), async (req, res) => {
    try {
        const clientId = req.user.id;
        const { credits, stripeCustomerId } = req.body;
        const result = await (0, paymentService_1.createWalletTopupIntent)({
            clientId,
            clientStripeCustomerId: stripeCustomerId,
            credits,
        });
        res.json({
            clientSecret: result.clientSecret,
            paymentIntentId: result.stripePaymentIntentId,
            credits: result.credits,
            amountCents: result.amountCents,
            amountFormatted: `$${(result.amountCents / 100).toFixed(2)}`,
        });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("create_wallet_topup_failed", {
            error: err.message,
            userId: req.user?.id,
        });
        res.status(err.statusCode || 500).json({
            error: { code: "PAYMENT_FAILED", message: err.message },
        });
    }
});
/**
 * POST /payments/checkout
 * Create a Stripe Checkout Session for credit purchases
 */
const checkoutSchema = zod_1.z.object({
    credits: zod_1.z.number().int().positive().min(10).max(10000),
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
});
paymentsRouter.post("/checkout", (0, validation_1.validateBody)(checkoutSchema), async (req, res) => {
    try {
        const { credits, successUrl, cancelUrl } = req.body;
        const priceInCents = credits * env_1.env.CENTS_PER_CREDIT;
        const session = await (0, paymentService_1.createCheckoutSession)({
            userId: req.user.id,
            creditAmount: credits,
            priceInCents,
            successUrl,
            cancelUrl,
        });
        res.json({
            sessionId: session.id,
            url: session.url,
        });
    }
    catch (error) {
        logger_1.logger.error("create_checkout_session_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout session" },
        });
    }
});
// ============================================
// Helper: Get Client Stripe Customer ID
// ============================================
/**
 * Get Stripe customer id for a client from client_profiles.
 * Returns null if not set (payment can still proceed without saved customer).
 */
async function getClientStripeCustomerId(clientId) {
    const result = await (0, client_1.query)(`
      SELECT stripe_customer_id
      FROM client_profiles
      WHERE user_id = $1
    `, [clientId]);
    const row = result.rows[0];
    return row?.stripe_customer_id ?? null;
}
// ============================================
// Job Charge Flow (with surcharge)
// ============================================
/**
 * POST /payments/job/:jobId
 * Create a PaymentIntent for a specific job (direct charge)
 *
 * NOTE: This charges base price + surcharge (NON_CREDIT_SURCHARGE_PERCENT).
 * Use wallet credits to avoid the surcharge.
 */
const jobChargeSchema = zod_1.z.object({
    stripeCustomerId: zod_1.z.string().optional(),
});
paymentsRouter.post("/job/:jobId", (0, validation_1.validateBody)(jobChargeSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const clientId = req.user.id;
        const { stripeCustomerId: providedCustomerId } = req.body;
        // Get job with ownership check
        const job = await (0, jobsService_1.getJobForClient)(jobId, clientId);
        // Only allow payment for jobs in 'requested' status
        if (job.status !== "requested") {
            return res.status(400).json({
                error: {
                    code: "INVALID_STATUS",
                    message: "Job is not in payable state (expected 'requested')",
                    currentStatus: job.status,
                },
            });
        }
        // Check if there's already an existing job_charge PI for this job
        const existingPis = await (0, client_1.query)(`
          SELECT status
          FROM payment_intents
          WHERE job_id = $1
            AND purpose = 'job_charge'
        `, [jobId]);
        const hasActivePi = existingPis.rows.some((pi) => ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "succeeded"].includes(pi.status));
        if (hasActivePi) {
            return res.status(400).json({
                error: {
                    code: "PAYMENT_EXISTS",
                    message: "Payment for this job already exists or has been processed",
                },
            });
        }
        // Get Stripe customer ID (from request or profile)
        const stripeCustomerId = providedCustomerId || await getClientStripeCustomerId(clientId);
        const result = await (0, paymentService_1.createJobPaymentIntent)({
            job,
            clientId,
            clientStripeCustomerId: stripeCustomerId ?? undefined,
        });
        // Calculate pricing info for response
        const baseAmountCents = job.credit_amount * env_1.env.CENTS_PER_CREDIT;
        const surchargePercent = env_1.env.NON_CREDIT_SURCHARGE_PERCENT;
        const surchargeAmountCents = result.amountCents - baseAmountCents;
        res.json({
            clientSecret: result.clientSecret,
            paymentIntentId: result.stripePaymentIntentId,
            jobId: result.jobId,
            credits: result.credits,
            // Pricing breakdown
            baseAmountCents,
            surchargePercent,
            surchargeAmountCents,
            totalAmountCents: result.amountCents,
            totalAmountFormatted: `$${(result.amountCents / 100).toFixed(2)}`,
            // Helpful message
            pricingNote: surchargePercent > 0
                ? `Includes ${surchargePercent}% convenience fee. Use wallet credits to save!`
                : undefined,
        });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("create_job_payment_failed", {
            error: err.message,
            userId: req.user?.id,
            jobId: req.params.jobId,
        });
        res.status(err.statusCode || 500).json({
            error: { code: "PAYMENT_FAILED", message: err.message },
        });
    }
});
// ============================================
// Balance & History
// ============================================
/**
 * GET /payments/balance
 * Get current credit balance
 */
paymentsRouter.get("/balance", async (req, res) => {
    try {
        const balance = await (0, creditsService_1.getUserCreditBalance)(req.user.id);
        res.json({
            balance,
            balanceFormatted: `${balance} credits`,
            valueInCents: balance * env_1.env.CENTS_PER_CREDIT,
            valueFormatted: `$${((balance * env_1.env.CENTS_PER_CREDIT) / 100).toFixed(2)}`,
        });
    }
    catch (error) {
        logger_1.logger.error("get_balance_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "BALANCE_FAILED", message: "Failed to get balance" },
        });
    }
});
/**
 * GET /payments/history
 * Get payment history for the current user
 */
paymentsRouter.get("/history", async (req, res) => {
    try {
        const { purpose, limit = "50" } = req.query;
        const payments = await (0, paymentService_1.getPaymentIntentsForClient)(req.user.id, purpose, parseInt(limit, 10));
        res.json({
            payments: payments.map((p) => ({
                id: p.id,
                purpose: p.purpose || "wallet_topup",
                status: p.status,
                amountCents: p.amount_cents,
                amountFormatted: `$${(p.amount_cents / 100).toFixed(2)}`,
                credits: p.credits_amount,
                jobId: p.job_id,
                createdAt: p.created_at,
            })),
            count: payments.length,
        });
    }
    catch (error) {
        logger_1.logger.error("get_payment_history_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "HISTORY_FAILED", message: "Failed to get payment history" },
        });
    }
});
/**
 * GET /payments/pricing
 * Get credit pricing information including surcharge details
 *
 * Shows both wallet (base) pricing and direct card pricing (with surcharge).
 */
paymentsRouter.get("/pricing", (_req, res) => {
    const centsPerCredit = env_1.env.CENTS_PER_CREDIT;
    const surchargePercent = env_1.env.NON_CREDIT_SURCHARGE_PERCENT;
    const surchargeMultiplier = 1 + surchargePercent / 100;
    // Helper to format prices
    const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;
    // Build packages with both wallet and card prices
    const buildPackage = (credits, options) => {
        const walletPrice = credits * centsPerCredit;
        const cardPrice = Math.round(walletPrice * surchargeMultiplier);
        const savings = cardPrice - walletPrice;
        return {
            credits,
            // Wallet price (using pre-purchased credits)
            walletPrice,
            walletPriceFormatted: formatCents(walletPrice),
            // Card price (direct payment with surcharge)
            cardPrice,
            cardPriceFormatted: formatCents(cardPrice),
            // Savings from using wallet
            savingsWithWallet: savings,
            savingsFormatted: formatCents(savings),
            ...options,
        };
    };
    res.json({
        // Base conversion rate
        centsPerCredit,
        currency: env_1.env.PAYOUT_CURRENCY,
        // Surcharge info
        surchargePercent,
        surchargeNote: surchargePercent > 0
            ? `Direct card payments include a ${surchargePercent}% convenience fee. Buy credits to save!`
            : "No surcharge on direct payments",
        // Credit packages (for wallet top-up)
        packages: [
            buildPackage(50),
            buildPackage(100),
            buildPackage(250, { popular: true }),
            buildPackage(500),
            buildPackage(1000, { bestValue: true }),
        ],
        // Example pricing for a 100-credit job
        example: {
            jobCredits: 100,
            walletPrice: 100 * centsPerCredit,
            walletPriceFormatted: formatCents(100 * centsPerCredit),
            cardPrice: Math.round(100 * centsPerCredit * surchargeMultiplier),
            cardPriceFormatted: formatCents(Math.round(100 * centsPerCredit * surchargeMultiplier)),
            description: `A 100-credit job costs ${formatCents(100 * centsPerCredit)} with wallet credits, or ${formatCents(Math.round(100 * centsPerCredit * surchargeMultiplier))} with direct card payment.`,
        },
    });
});
exports.default = paymentsRouter;
