// src/routes/stripe.ts
// Stripe webhook and payment intent routes

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { logger } from "../lib/logger";
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
 * POST /stripe/create-payment-intent
 * Create a Stripe PaymentIntent for a job
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
 * POST /stripe/webhook
 * Handle Stripe webhook events
 * Note: This endpoint requires raw body for signature verification
 * The raw body should be provided by Express middleware in index.ts
 */
stripeRouter.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    logger.warn("stripe_webhook_no_signature");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    // Get raw body - if Express parsed it, we need to reconstruct it
    // In production, configure Express to skip JSON parsing for this route
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
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

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    logger.error("stripe_webhook_processing_failed", {
      error: (error as Error).message,
      eventId: event.id,
      eventType: event.type,
    });

    // Queue failed webhook for retry
    try {
      await queueWebhookForRetry({
        source: "stripe",
        eventId: event.id,
        eventType: event.type,
        payload: event,
        errorMessage: (error as Error).message,
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

    // Still return 200 to Stripe to prevent their retries (we handle our own)
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

