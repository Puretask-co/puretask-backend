"use strict";
// src/routes/stripe.ts
// Stripe webhook and payment intent routes
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const paymentService_1 = require("../services/paymentService");
const webhookRetryService_1 = require("../services/webhookRetryService");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const zod_1 = require("zod");
const stripeRouter = (0, express_1.Router)();
const stripe = new stripe_1.default(env_1.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});
/**
 * POST /stripe/create-payment-intent
 * Create a Stripe PaymentIntent for a job
 */
const createPaymentIntentSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid(),
    amountCents: zod_1.z.number().int().positive(),
    currency: zod_1.z.string().optional().default("usd"),
    customerId: zod_1.z.string().optional(),
});
stripeRouter.post("/create-payment-intent", auth_1.authMiddleware, (0, validation_1.validateBody)(createPaymentIntentSchema), async (req, res) => {
    try {
        const { jobId, amountCents, currency, customerId } = req.body;
        const clientId = req.user.id;
        const paymentIntent = await (0, paymentService_1.createPaymentIntent)({
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
    }
    catch (error) {
        logger_1.logger.error("create_payment_intent_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "PAYMENT_INTENT_CREATION_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * POST /stripe/webhook
 * Handle Stripe webhook events
 * Note: This endpoint requires raw body for signature verification
 * The raw body should be provided by Express middleware in index.ts
 */
stripeRouter.post("/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        logger_1.logger.warn("stripe_webhook_no_signature");
        return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    let event;
    try {
        // Get raw body - if Express parsed it, we need to reconstruct it
        // In production, configure Express to skip JSON parsing for this route
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(rawBody, sig, env_1.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        logger_1.logger.error("stripe_webhook_signature_verification_failed", {
            error: err.message,
        });
        return res.status(400).json({
            error: {
                code: "WEBHOOK_SIGNATURE_VERIFICATION_FAILED",
                message: err.message,
            },
        });
    }
    try {
        await (0, paymentService_1.handleStripeEvent)(event);
        res.json({ received: true });
    }
    catch (error) {
        logger_1.logger.error("stripe_webhook_processing_failed", {
            error: error.message,
            eventId: event.id,
            eventType: event.type,
        });
        // Queue failed webhook for retry
        try {
            await (0, webhookRetryService_1.queueWebhookForRetry)({
                source: "stripe",
                eventId: event.id,
                eventType: event.type,
                payload: event,
                errorMessage: error.message,
            });
            logger_1.logger.info("stripe_webhook_queued_for_retry", {
                eventId: event.id,
                eventType: event.type,
            });
        }
        catch (queueError) {
            logger_1.logger.error("stripe_webhook_queue_failed", {
                error: queueError.message,
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
stripeRouter.get("/payment-intent/:jobId", auth_1.authMiddleware, async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.id;
        const paymentIntent = await (0, paymentService_1.getPaymentIntentByJobId)(jobId);
        if (!paymentIntent) {
            return res.status(404).json({
                error: {
                    code: "PAYMENT_INTENT_NOT_FOUND",
                    message: "Payment intent not found for this job",
                },
            });
        }
        // Verify user has access (client who created it)
        if (paymentIntent.client_id !== userId && req.user.role !== "admin") {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You don't have access to this payment intent",
                },
            });
        }
        res.json({ paymentIntent });
    }
    catch (error) {
        logger_1.logger.error("get_payment_intent_failed", {
            error: error.message,
            jobId: req.params.jobId,
        });
        res.status(500).json({
            error: {
                code: "GET_PAYMENT_INTENT_FAILED",
                message: error.message,
            },
        });
    }
});
exports.default = stripeRouter;
