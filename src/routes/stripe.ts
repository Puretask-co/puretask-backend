// src/routes/stripe.ts
// Stripe webhook and payment intent routes

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { query } from "../db/client";
import { createPaymentIntent, handleStripeEvent, getPaymentIntentByJobId } from "../services/paymentService";
import { queueWebhookForRetry } from "../services/webhookRetryService";
import { requireAuth, requireClient, AuthedRequest } from "../middleware/authCanonical";
import { validateBody } from "../lib/validation";
import { z } from "zod";

const stripeRouter = Router();
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

/**
 * @swagger
 * /stripe/create-payment-intent:
 *   post:
 *     summary: Create Stripe PaymentIntent
 *     description: Create a Stripe PaymentIntent for a job payment.
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
 *               - jobId
 *               - amountCents
 *             properties:
 *               jobId:
 *                 type: string
 *                 format: uuid
 *               amountCents:
 *                 type: integer
 *                 minimum: 1
 *               currency:
 *                 type: string
 *                 default: usd
 *               customerId:
 *                 type: string
 *                 description: Stripe customer ID
 *     responses:
 *       200:
 *         description: PaymentIntent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret: { type: 'string' }
 *                 paymentIntentId: { type: 'string' }
 *       500:
 *         description: Failed to create PaymentIntent
 */
const createPaymentIntentSchema = z.object({
  jobId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().optional().default("usd"),
  customerId: z.string().optional(),
});

stripeRouter.post(
  "/create-payment-intent",
  requireAuth,
  requireClient,
  validateBody(createPaymentIntentSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId, amountCents, currency, customerId } = req.body;
      const clientId = req.user!.id;

      const paymentIntent = await createPaymentIntent({
        jobId,
        clientId,
        amountCents,
        currency,
        customerId,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      logger.error("create_payment_intent_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "PAYMENT_INTENT_CREATION_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * @swagger
 * /stripe/webhook:
 *   post:
 *     summary: Stripe webhook handler
 *     description: |
 *       Handle Stripe webhook events. Requires raw body for signature verification.
 *       This endpoint is called by Stripe, not by clients.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid signature or webhook data
 */
stripeRouter.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    logger.warn("stripe_webhook_no_signature");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  // Phase 4: Raw body required — do not JSON.stringify; signature verification fails if body was mutated
  if (!Buffer.isBuffer(req.body)) {
    logger.warn("stripe_webhook_raw_body_required");
    return res.status(400).json({
      error: {
        code: "WEBHOOK_RAW_BODY_REQUIRED",
        message: "Webhook must receive raw body; ensure this route is mounted before JSON parser.",
      },
    });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      getStripeWebhookSecret()
    );
  } catch (err) {
    logger.error("stripe_webhook_signature_verification_failed", {
      error: (err as Error).message,
    });
    return res.status(400).json({
      error: {
        code: "WEBHOOK_SIGNATURE_VERIFICATION_FAILED",
        message: (err as Error).message,
      },
    });
  }

  // Phase 4: Canonical intake — store in webhook_events first; idempotent on (provider, event_id)
  const inserted = await query<{ id: string }>(
    `
      INSERT INTO webhook_events (provider, event_id, event_type, signature_verified, payload_json, processing_status)
      VALUES ('stripe', $1, $2, true, $3::jsonb, 'pending')
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id
    `,
    [event.id, event.type, JSON.stringify(event)]
  );
  if (!inserted.rows[0]) {
    logger.info("stripe_webhook_already_received", { eventId: event.id, eventType: event.type });
    return res.status(200).json({ received: true });
  }

  const webhookRowId = inserted.rows[0].id;

  try {
    await handleStripeEvent(event);
    await query(
      `UPDATE webhook_events SET processing_status = 'done', processed_at = NOW(), attempt_count = attempt_count + 1 WHERE id = $1`,
      [webhookRowId]
    );
    res.json({ received: true });
  } catch (error) {
    const errMsg = (error as Error).message;
    logger.error("stripe_webhook_processing_failed", {
      error: errMsg,
      eventId: event.id,
      eventType: event.type,
    });
    await query(
      `UPDATE webhook_events SET processing_status = 'failed', last_error = $2, attempt_count = attempt_count + 1 WHERE id = $1`,
      [webhookRowId, errMsg]
    );

    try {
      await queueWebhookForRetry({
        source: "stripe",
        eventId: event.id,
        eventType: event.type,
        payload: event,
        errorMessage: errMsg,
      });
      logger.info("stripe_webhook_queued_for_retry", {
        eventId: event.id,
        eventType: event.type,
      });
    } catch (queueError) {
      logger.error("stripe_webhook_queue_failed", {
        error: (queueError as Error).message,
        eventId: event.id,
      });
    }

    res.status(200).json({ received: true, queued_for_retry: true });
  }
});

/**
 * GET /stripe/payment-intent/:jobId
 * Get payment intent for a job
 */
stripeRouter.get(
  "/payment-intent/:jobId",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      const paymentIntent = await getPaymentIntentByJobId(jobId);

      if (!paymentIntent) {
        return res.status(404).json({
          error: {
            code: "PAYMENT_INTENT_NOT_FOUND",
            message: "Payment intent not found for this job",
          },
        });
      }

      // Verify user has access (client who created it)
      if (paymentIntent.client_id !== userId && req.user!.role !== "admin") {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You don't have access to this payment intent",
          },
        });
      }

      res.json({ paymentIntent });
    } catch (error) {
      logger.error("get_payment_intent_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
      });
      res.status(500).json({
        error: {
          code: "GET_PAYMENT_INTENT_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

export default stripeRouter;

