// src/routes/payments.ts
// Payment routes for both wallet top-up and job charge flows
// 
// Key pricing difference:
// - Wallet top-ups: base price (CENTS_PER_CREDIT)
// - Direct job charge: base price + surcharge (NON_CREDIT_SURCHARGE_PERCENT)

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { requireIdempotency } from "../lib/idempotency";
import { sendSuccess } from "../lib/response";
import { requireAuth } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { query } from "../db/client";
import {
  createWalletTopupIntent,
  createJobPaymentIntent,
  getPaymentIntentsForClient,
  createCheckoutSession,
} from "../services/paymentService";
import { getJobForClient } from "../services/jobsService";
import { getUserCreditBalance } from "../services/creditsService";
import { env } from "../config/env";

const paymentsRouter = Router();

// All payment routes require authentication
paymentsRouter.use(requireAuth);

// ============================================
// Wallet Top-up Flow
// ============================================

/**
 * @swagger
 * /payments/credits:
 *   post:
 *     summary: Create payment intent for buying credits
 *     description: |
 *       Create a PaymentIntent for buying credits (wallet top-up).
 *       Supports Idempotency-Key header to prevent duplicate charges.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credits
 *             properties:
 *               credits:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 10000
 *                 description: Number of credits to purchase
 *                 example: 100
 *               stripeCustomerId:
 *                 type: string
 *                 description: Stripe customer ID (optional, will be created if not provided)
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                       description: Stripe client secret for payment confirmation
 *                     paymentIntentId:
 *                       type: string
 *                       description: Stripe payment intent ID
 *                     credits:
 *                       type: number
 *                       description: Number of credits
 *                     amountCents:
 *                       type: number
 *                       description: Amount in cents
 *                     amountFormatted:
 *                       type: string
 *                       description: Formatted amount (e.g., $50.00)
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded (duplicate request)
 */
const buyCreditsSchema = z.object({
  credits: z.number().int().positive().min(10).max(10000),
  stripeCustomerId: z.string().optional(),
});

paymentsRouter.post(
  "/credits",
  requireIdempotency,
  validateBody(buyCreditsSchema),
  async (req, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { credits, stripeCustomerId } = req.body;

      const result = await createWalletTopupIntent({
        clientId,
        clientStripeCustomerId: stripeCustomerId,
        credits,
      });

      sendSuccess(res, {
        clientSecret: result.clientSecret,
        paymentIntentId: result.stripePaymentIntentId,
        credits: result.credits,
        amountCents: result.amountCents,
        amountFormatted: `$${(result.amountCents / 100).toFixed(2)}`,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("create_wallet_topup_failed", {
        error: err.message,
        userId: req.user?.id,
      });
      res.status(err.statusCode || 500).json({
        error: { code: "PAYMENT_FAILED", message: err.message },
      });
    }
  }
);

/**
 * @swagger
 * /payments/checkout:
 *   post:
 *     summary: Create Stripe checkout session for credit purchases
 *     description: Create a Stripe Checkout Session for credit purchases. User will be redirected to Stripe's hosted checkout page.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credits
 *               - successUrl
 *               - cancelUrl
 *             properties:
 *               credits:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 10000
 *                 description: Number of credits to purchase
 *                 example: 100
 *               successUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after successful payment
 *                 example: "https://app.puretask.com/payment/success"
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect if payment is cancelled
 *                 example: "https://app.puretask.com/payment/cancel"
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                   description: Stripe checkout session ID
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Checkout URL to redirect user to
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
const checkoutSchema = z.object({
  credits: z.number().int().positive().min(10).max(10000),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

paymentsRouter.post(
  "/checkout",
  validateBody(checkoutSchema),
  async (req, res: Response) => {
    try {
      const { credits, successUrl, cancelUrl } = req.body;
      const priceInCents = credits * env.CENTS_PER_CREDIT;

      const session = await createCheckoutSession({
        userId: req.user!.id,
        creditAmount: credits,
        priceInCents,
        successUrl,
        cancelUrl,
      });

      res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      logger.error("create_checkout_session_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout session" },
      });
    }
  }
);

// ============================================
// Helper: Get Client Stripe Customer ID
// ============================================

/**
 * Get Stripe customer id for a client from client_profiles.
 * Returns null if not set (payment can still proceed without saved customer).
 */
async function getClientStripeCustomerId(clientId: string): Promise<string | null> {
  const result = await query<{ stripe_customer_id: string | null }>(
    `
      SELECT stripe_customer_id
      FROM client_profiles
      WHERE user_id = $1
    `,
    [clientId]
  );

  const row = result.rows[0];
  return row?.stripe_customer_id ?? null;
}

// ============================================
// Job Charge Flow (with surcharge)
// ============================================

/**
 * @swagger
 * /payments/job/{jobId}:
 *   post:
 *     summary: Create payment intent for job charge
 *     description: |
 *       Create a PaymentIntent for a specific job (direct charge).
 *       **NOTE**: This charges base price + surcharge. Use wallet credits to avoid the surcharge.
 *     tags: [Payments, Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stripeCustomerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment intent created
 *       400:
 *         description: Invalid job status or payment already exists
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job not found
 */
const jobChargeSchema = z.object({
  stripeCustomerId: z.string().optional(),
});

paymentsRouter.post(
  "/job/:jobId",
  validateBody(jobChargeSchema),
  async (req, res: Response) => {
    try {
      const { jobId } = req.params;
      const clientId = req.user!.id;
      const { stripeCustomerId: providedCustomerId } = req.body;

      // Get job with ownership check
      const job = await getJobForClient(jobId, clientId);

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
      const existingPis = await query<{ status: string }>(
        `
          SELECT status
          FROM payment_intents
          WHERE job_id = $1
            AND purpose = 'job_charge'
        `,
        [jobId]
      );

      const hasActivePi = existingPis.rows.some((pi) =>
        ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "succeeded"].includes(pi.status)
      );

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

      const result = await createJobPaymentIntent({
        job,
        clientId,
        clientStripeCustomerId: stripeCustomerId ?? undefined,
      });

      // Calculate pricing info for response
      const baseAmountCents = job.credit_amount * env.CENTS_PER_CREDIT;
      const surchargePercent = env.NON_CREDIT_SURCHARGE_PERCENT;
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
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("create_job_payment_failed", {
        error: err.message,
        userId: req.user?.id,
        jobId: req.params.jobId,
      });
      res.status(err.statusCode || 500).json({
        error: { code: "PAYMENT_FAILED", message: err.message },
      });
    }
  }
);

// ============================================
// Balance & History
// ============================================

/**
 * GET /payments/balance
 * Get current credit balance
 */
paymentsRouter.get("/balance", async (req, res: Response) => {
  try {
    const balance = await getUserCreditBalance(req.user!.id);

    res.json({
      balance,
      balanceFormatted: `${balance} credits`,
      valueInCents: balance * env.CENTS_PER_CREDIT,
      valueFormatted: `$${((balance * env.CENTS_PER_CREDIT) / 100).toFixed(2)}`,
    });
  } catch (error) {
    logger.error("get_balance_failed", {
      error: (error as Error).message,
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
paymentsRouter.get("/history", async (req, res: Response) => {
  try {
    const { purpose, limit = "50" } = req.query;

    const payments = await getPaymentIntentsForClient(
      req.user!.id,
      purpose as "wallet_topup" | "job_charge" | undefined,
      parseInt(limit as string, 10)
    );

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        purpose: (p as any).purpose || "wallet_topup",
        status: p.status,
        amountCents: p.amount_cents,
        amountFormatted: `$${(p.amount_cents / 100).toFixed(2)}`,
        credits: (p as any).credits_amount,
        jobId: p.job_id,
        createdAt: p.created_at,
      })),
      count: payments.length,
    });
  } catch (error) {
    logger.error("get_payment_history_failed", {
      error: (error as Error).message,
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
paymentsRouter.get("/pricing", (_req, res: Response) => {
  const centsPerCredit = env.CENTS_PER_CREDIT;
  const surchargePercent = env.NON_CREDIT_SURCHARGE_PERCENT;
  const surchargeMultiplier = 1 + surchargePercent / 100;

  // Helper to format prices
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Build packages with both wallet and card prices
  const buildPackage = (credits: number, options?: { popular?: boolean; bestValue?: boolean }) => {
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
    currency: env.PAYOUT_CURRENCY,
    
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

export default paymentsRouter;

