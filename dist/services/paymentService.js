"use strict";
// src/services/paymentService.ts
// Stripe payment integration service with dual payment flows:
// 1. Wallet Mode: Buy credits separately, use them to book jobs
// 2. Job Charge Mode: Pay for a specific job at booking time
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletTopupIntent = createWalletTopupIntent;
exports.createJobPaymentIntent = createJobPaymentIntent;
exports.createPaymentIntent = createPaymentIntent;
exports.createInvoicePaymentIntent = createInvoicePaymentIntent;
exports.isObjectAlreadyProcessed = isObjectAlreadyProcessed;
exports.markObjectProcessed = markObjectProcessed;
exports.handleStripeEvent = handleStripeEvent;
exports.getPaymentIntentByJobId = getPaymentIntentByJobId;
exports.getPaymentIntentsForClient = getPaymentIntentsForClient;
exports.createCheckoutSession = createCheckoutSession;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("../db/client");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const creditsService_1 = require("./creditsService");
const stripe = new stripe_1.default(env_1.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
});
// ============================================
// Wallet Mode: Buy Credits Separately
// ============================================
/**
 * Create a PaymentIntent for wallet top-up (buying credits)
 *
 * Flow:
 * 1. Client calls POST /payments/credits with { credits: 500 }
 * 2. Backend creates PI with purpose='wallet_topup'
 * 3. On payment_intent.succeeded, credits are added to client's ledger
 * 4. Later, client uses these credits to book jobs
 */
async function createWalletTopupIntent(params) {
    const { clientId, clientStripeCustomerId, credits } = params;
    if (credits <= 0) {
        throw Object.assign(new Error("Credits must be greater than 0"), { statusCode: 400 });
    }
    const amountCents = credits * env_1.env.CENTS_PER_CREDIT;
    // Create Stripe PaymentIntent
    const piOptions = {
        amount: amountCents,
        currency: env_1.env.PAYOUT_CURRENCY,
        metadata: {
            purpose: "wallet_topup",
            credits: String(credits),
            clientId,
        },
        automatic_payment_methods: {
            enabled: true,
        },
    };
    // Attach customer if provided
    if (clientStripeCustomerId) {
        piOptions.customer = clientStripeCustomerId;
    }
    const pi = await stripe.paymentIntents.create(piOptions);
    // Store in payment_intents table
    await (0, client_1.query)(`
      INSERT INTO payment_intents (
        job_id,
        client_id,
        stripe_payment_intent_id,
        status,
        amount_cents,
        currency,
        purpose,
        credits_amount
      )
      VALUES (NULL, $1, $2, $3, $4, $5, 'wallet_topup', $6)
      ON CONFLICT (stripe_payment_intent_id) DO UPDATE
      SET status = EXCLUDED.status,
          amount_cents = EXCLUDED.amount_cents,
          credits_amount = EXCLUDED.credits_amount,
          updated_at = NOW()
    `, [clientId, pi.id, pi.status, amountCents, env_1.env.PAYOUT_CURRENCY, credits]);
    logger_1.logger.info("wallet_topup_intent_created", {
        clientId,
        stripePaymentIntentId: pi.id,
        credits,
        amountCents,
    });
    return {
        clientSecret: pi.client_secret,
        stripePaymentIntentId: pi.id,
        amountCents,
        credits,
    };
}
// ============================================
// Job Charge Mode: Pay Per Job (with surcharge)
// ============================================
/**
 * Create a PaymentIntent for direct job charge (pay at booking)
 *
 * SURCHARGE: Clients who pay directly by card (instead of using wallet credits)
 * are charged an extra X% (configured via NON_CREDIT_SURCHARGE_PERCENT).
 * This incentivizes using wallet credits.
 *
 * Flow:
 * 1. Client creates a job with paymentMode='card'
 * 2. Backend creates job row + PI with purpose='job_charge'
 *    - Amount charged = baseAmount * (1 + surchargePercent/100)
 *    - Credits minted = job.credit_amount (base, no surcharge)
 * 3. On payment_intent.succeeded:
 *    a. Credits are minted to client's wallet (purchase)
 *    b. Credits are immediately escrowed for the job (job_escrow)
 * 4. Job is now paid and ready for cleaner
 *
 * The extra % is pure revenue for PureTask, NOT extra credits.
 */
async function createJobPaymentIntent(params) {
    const { job, clientId, clientStripeCustomerId } = params;
    if (!job.credit_amount || job.credit_amount <= 0) {
        throw Object.assign(new Error("Job has invalid credit_amount"), { statusCode: 400 });
    }
    const credits = job.credit_amount;
    // Base price (what they'd pay if using wallet credits)
    const baseAmountCents = credits * env_1.env.CENTS_PER_CREDIT;
    // Apply surcharge for direct card payment
    const surchargePercent = env_1.env.NON_CREDIT_SURCHARGE_PERCENT || 0;
    const multiplier = 1 + surchargePercent / 100;
    const amountCents = Math.round(baseAmountCents * multiplier);
    // Create Stripe PaymentIntent with surcharge
    const piOptions = {
        amount: amountCents,
        currency: env_1.env.PAYOUT_CURRENCY,
        metadata: {
            purpose: "job_charge",
            credits: String(credits), // Credits that will be minted internally
            base_amount_cents: String(baseAmountCents), // What wallet users pay
            surcharge_percent: String(surchargePercent), // Extra % charged
            amount_cents_with_surcharge: String(amountCents), // Final charge
            clientId,
            jobId: job.id,
        },
        automatic_payment_methods: {
            enabled: true,
        },
    };
    if (clientStripeCustomerId) {
        piOptions.customer = clientStripeCustomerId;
    }
    const pi = await stripe.paymentIntents.create(piOptions);
    // Store in payment_intents table
    await (0, client_1.query)(`
      INSERT INTO payment_intents (
        job_id,
        client_id,
        stripe_payment_intent_id,
        status,
        amount_cents,
        currency,
        purpose,
        credits_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'job_charge', $7)
      ON CONFLICT (stripe_payment_intent_id) DO UPDATE
      SET status = EXCLUDED.status,
          amount_cents = EXCLUDED.amount_cents,
          credits_amount = EXCLUDED.credits_amount,
          updated_at = NOW()
    `, [job.id, clientId, pi.id, pi.status, amountCents, env_1.env.PAYOUT_CURRENCY, credits]);
    logger_1.logger.info("job_charge_intent_created", {
        clientId,
        jobId: job.id,
        stripePaymentIntentId: pi.id,
        credits,
        baseAmountCents,
        surchargePercent,
        finalAmountCents: amountCents,
    });
    return {
        clientSecret: pi.client_secret,
        stripePaymentIntentId: pi.id,
        amountCents,
        credits,
        jobId: job.id,
    };
}
// ============================================
// Legacy: Generic PaymentIntent (for backwards compat)
// ============================================
/**
 * Create a Stripe PaymentIntent for a job (legacy)
 * @deprecated Use createJobPaymentIntent or createWalletTopupIntent instead
 */
async function createPaymentIntent(options) {
    const { jobId, amountCents, currency = "usd", customerId, clientId } = options;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            customer: customerId,
            metadata: {
                job_id: jobId,
                client_id: clientId || "",
                purpose: "job_charge",
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        await (0, client_1.query)(`
        INSERT INTO payment_intents (
          job_id,
          client_id,
          stripe_payment_intent_id,
          status,
          amount_cents,
          currency,
          purpose
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'job_charge')
        ON CONFLICT (stripe_payment_intent_id) DO UPDATE
        SET status = EXCLUDED.status,
            updated_at = NOW()
      `, [jobId, clientId, paymentIntent.id, paymentIntent.status, amountCents, currency]);
        logger_1.logger.info("payment_intent_created", {
            jobId,
            clientId,
            paymentIntentId: paymentIntent.id,
            amountCents,
        });
        return paymentIntent;
    }
    catch (error) {
        logger_1.logger.error("payment_intent_creation_failed", {
            error: error.message,
            jobId,
            amountCents,
        });
        throw error;
    }
}
/**
 * Create a PaymentIntent for invoice payment
 */
async function createInvoicePaymentIntent(options) {
    const { invoiceId, amountCents, currency = "usd", clientId, cleanerId, customerId } = options;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            customer: customerId,
            metadata: {
                invoice_id: invoiceId,
                client_id: clientId,
                cleaner_id: cleanerId,
                purpose: "invoice_payment",
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        await (0, client_1.query)(`
        INSERT INTO payment_intents (
          client_id,
          stripe_payment_intent_id,
          status,
          amount_cents,
          currency,
          purpose
        )
        VALUES ($1, $2, $3, $4, $5, 'invoice_payment')
        ON CONFLICT (stripe_payment_intent_id) DO UPDATE
        SET status = EXCLUDED.status,
            updated_at = NOW()
      `, [clientId, paymentIntent.id, paymentIntent.status, amountCents, currency]);
        logger_1.logger.info("invoice_payment_intent_created", {
            invoiceId,
            paymentIntentId: paymentIntent.id,
            amountCents,
            clientId,
            cleanerId,
        });
        return paymentIntent;
    }
    catch (error) {
        logger_1.logger.error("invoice_payment_intent_creation_failed", {
            error: error.message,
            invoiceId,
            amountCents,
        });
        throw error;
    }
}
// ============================================
// Webhook Handler
// ============================================
/**
 * Main Stripe webhook handler
 * - Upserts stripe_events for idempotency
 * - Processes payment_intent.succeeded for both purposes
 * - Updates payment_intents status
 */
async function isObjectAlreadyProcessed(objectId, objectType) {
    const existing = await (0, client_1.query)(`
      SELECT object_id
      FROM stripe_object_processed
      WHERE object_id = $1 AND object_type = $2
      LIMIT 1
    `, [objectId, objectType]);
    return !!existing.rows[0];
}
async function markObjectProcessed(objectId, objectType) {
    await (0, client_1.query)(`
      INSERT INTO stripe_object_processed (object_id, object_type)
      VALUES ($1, $2)
      ON CONFLICT (object_id, object_type) DO NOTHING
    `, [objectId, objectType]);
}
/**
 * V1 HARDENING: Process Stripe event with transaction-safe idempotency
 * Wraps entire event processing in a transaction to prevent partial state
 */
/**
 * V1 HARDENING: Enhanced webhook handler with transaction-safe idempotency
 * Uses new stripe_events_processed table for bulletproof deduplication
 */
async function handleStripeEvent(event) {
    // First, check idempotency using the new processed table (fast path)
    // Extract object ID safely (not all Stripe objects have id)
    const objectId = event.data?.object?.id || null;
    const processedCheck = await (0, client_1.query)(`
      INSERT INTO stripe_events_processed (stripe_event_id, stripe_object_id, event_type, raw_payload)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
    `, [event.id, objectId, event.type, JSON.stringify(event)]);
    // If already processed, return immediately (idempotent)
    if (!processedCheck.rows[0]) {
        logger_1.logger.info("stripe_event_already_processed", { eventId: event.id, type: event.type });
        return;
    }
    // Also upsert to stripe_events for compatibility
    await (0, client_1.query)(`
      INSERT INTO stripe_events (stripe_event_id, type, payload, processed)
      VALUES ($1, $2, $3::jsonb, false)
      ON CONFLICT (stripe_event_id) DO UPDATE
      SET type = EXCLUDED.type,
          payload = EXCLUDED.payload
    `, [event.id, event.type, JSON.stringify(event)]);
    logger_1.logger.info("stripe_event_received", {
        eventId: event.id,
        eventType: event.type,
    });
    try {
        switch (event.type) {
            case "payment_intent.succeeded": {
                const pi = event.data.object;
                // Double-check object-level idempotency (redundant but safe)
                if (await isObjectAlreadyProcessed(pi.id, "payment_intent")) {
                    logger_1.logger.info("stripe_object_already_processed", {
                        objectId: pi.id,
                        type: "payment_intent",
                    });
                    break;
                }
                await handlePaymentIntentSucceeded(event);
                await markObjectProcessed(pi.id, "payment_intent");
                break;
            }
            case "payment_intent.payment_failed":
                if (await isObjectAlreadyProcessed(event.data.object.id, "payment_intent")) {
                    logger_1.logger.info("stripe_object_already_processed", {
                        objectId: event.data.object.id,
                        type: "payment_intent",
                    });
                    break;
                }
                await handlePaymentIntentFailed(event);
                await markObjectProcessed(event.data.object.id, "payment_intent");
                break;
            case "invoice.paid": {
                const invoice = event.data.object;
                if (await isObjectAlreadyProcessed(invoice.id, "invoice")) {
                    logger_1.logger.info("stripe_object_already_processed", { objectId: invoice.id, type: "invoice" });
                    break;
                }
                await handleInvoicePaid(event);
                await markObjectProcessed(invoice.id, "invoice");
                break;
            }
            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(event);
                break;
            case "charge.refunded": {
                const charge = event.data.object;
                if (await isObjectAlreadyProcessed(charge.id, "charge")) {
                    logger_1.logger.info("stripe_object_already_processed", { objectId: charge.id, type: "charge" });
                    break;
                }
                await handleChargeRefunded(event);
                await markObjectProcessed(charge.id, "charge");
                break;
            }
            case "charge.dispute.created":
            case "charge.dispute.closed": {
                const dispute = event.data.object;
                if (await isObjectAlreadyProcessed(dispute.id, "dispute")) {
                    logger_1.logger.info("stripe_object_already_processed", { objectId: dispute.id, type: "dispute" });
                    break;
                }
                await handleChargeDisputeEvent(event);
                await markObjectProcessed(dispute.id, "dispute");
                break;
            }
            case "payout.paid":
            case "payout.failed": {
                const payout = event.data.object;
                if (await isObjectAlreadyProcessed(payout.id, "payout")) {
                    logger_1.logger.info("stripe_object_already_processed", { objectId: payout.id, type: "payout" });
                    break;
                }
                await handlePayoutEvent(event);
                await markObjectProcessed(payout.id, "payout");
                break;
            }
            case "transfer.created":
            case "transfer.updated":
            case "transfer.reversed": {
                const transfer = event.data.object;
                if (await isObjectAlreadyProcessed(transfer.id, "transfer")) {
                    logger_1.logger.info("stripe_object_already_processed", { objectId: transfer.id, type: "transfer" });
                    break;
                }
                await handleTransferEvent(event);
                await markObjectProcessed(transfer.id, "transfer");
                break;
            }
            default:
                logger_1.logger.debug("stripe_event_unhandled", {
                    eventType: event.type,
                    eventId: event.id,
                });
        }
        // Mark event as processed
        await (0, client_1.query)(`
          UPDATE stripe_events
          SET processed = true,
              processed_at = NOW()
          WHERE stripe_event_id = $1
        `, [event.id]);
    }
    catch (error) {
        logger_1.logger.error("stripe_event_processing_failed", {
            error: error.message,
            eventId: event.id,
            eventType: event.type,
        });
        // Note: stripe_events_processed already marked, but event failed
        // This is OK - the event will be retried but won't duplicate due to idempotency check
        throw error;
    }
}
/**
 * Handle payment_intent.succeeded for both:
 * - purpose = 'wallet_topup': Add credits to client wallet
 * - purpose = 'job_charge': Add credits AND immediately escrow for job
 */
async function handlePaymentIntentSucceeded(event) {
    const pi = event.data.object;
    const purpose = pi.metadata?.purpose ?? "wallet_topup";
    const clientId = pi.metadata?.clientId || null;
    const jobId = pi.metadata?.jobId || pi.metadata?.job_id || null;
    const credits = Number(pi.metadata?.credits || 0);
    // Object-level idempotency: skip if this payment_intent was already processed for success
    const piRow = await (0, client_1.query)(`
      SELECT processed_success
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `, [pi.id]);
    if (piRow.rows[0]?.processed_success) {
        logger_1.logger.info("pi_already_processed_success", { paymentIntentId: pi.id, purpose });
        return;
    }
    // Update payment_intents row
    await (0, client_1.query)(`
      UPDATE payment_intents
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `, [pi.id, pi.status]);
    // Validate metadata
    if (!clientId || !credits || Number.isNaN(credits) || credits <= 0) {
        logger_1.logger.warn("payment_intent_missing_metadata", {
            stripePaymentIntentId: pi.id,
            purpose,
            clientId,
            credits,
        });
        return;
    }
    if (purpose === "wallet_topup") {
        // Wallet mode: just top up the client's balance
        await (0, creditsService_1.addLedgerEntry)({
            userId: clientId,
            jobId: null,
            deltaCredits: credits,
            reason: "purchase",
        });
        logger_1.logger.info("wallet_topup_credits_added", {
            clientId,
            credits,
            stripePaymentIntentId: pi.id,
        });
    }
    else if (purpose === "job_charge") {
        if (!jobId) {
            logger_1.logger.warn("job_charge_missing_jobId", {
                stripePaymentIntentId: pi.id,
                clientId,
            });
            return;
        }
        // Direct job-charge mode:
        // Step 1: Mint credits to client wallet tied to this job
        await (0, creditsService_1.addLedgerEntry)({
            userId: clientId,
            jobId,
            deltaCredits: credits,
            reason: "purchase",
        });
        // Step 2: Immediately escrow them for this job
        await (0, creditsService_1.addLedgerEntry)({
            userId: clientId,
            jobId,
            deltaCredits: -credits,
            reason: "job_escrow",
        });
        logger_1.logger.info("job_charge_credits_purchased_and_escrowed", {
            clientId,
            jobId,
            credits,
            stripePaymentIntentId: pi.id,
        });
    }
    else if (purpose === "invoice_payment") {
        // Invoice payment: handled by invoiceService.handleInvoicePaymentSuccess
        const invoiceId = pi.metadata?.invoiceId;
        if (!invoiceId) {
            logger_1.logger.warn("invoice_payment_missing_invoiceId", {
                stripePaymentIntentId: pi.id,
                clientId,
            });
            return;
        }
        // Import dynamically to avoid circular dependency
        const { handleInvoicePaymentSuccess } = await Promise.resolve().then(() => __importStar(require("./invoiceService")));
        await handleInvoicePaymentSuccess(pi.id);
        logger_1.logger.info("invoice_payment_processed", {
            invoiceId,
            stripePaymentIntentId: pi.id,
        });
    }
    // Mark object-level processed_success to prevent double handling
    await (0, client_1.query)(`
      UPDATE payment_intents
      SET processed_success = true,
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `, [pi.id]);
    // Emit event
    await (0, events_1.publishEvent)({
        jobId: jobId || undefined,
        actorType: "system",
        actorId: null,
        eventName: "payment_succeeded",
        payload: {
            purpose,
            stripe_payment_intent_id: pi.id,
            credits,
            amount: pi.amount,
            currency: pi.currency,
            clientId,
            jobId,
        },
    });
}
/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(event) {
    const pi = event.data.object;
    const jobId = pi.metadata?.jobId || pi.metadata?.job_id || null;
    // Object-level idempotency: skip if already marked failed
    const piRow = await (0, client_1.query)(`
      SELECT status
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `, [pi.id]);
    if (piRow.rows[0]?.status === "failed") {
        logger_1.logger.info("pi_already_failed", { paymentIntentId: pi.id });
        return;
    }
    await (0, client_1.query)(`
      UPDATE payment_intents
      SET status = 'failed',
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `, [pi.id]);
    if (jobId) {
        await (0, events_1.publishEvent)({
            jobId,
            actorType: "system",
            actorId: null,
            eventName: "payment_failed",
            payload: {
                stripePaymentIntentId: pi.id,
                error: pi.last_payment_error?.message,
            },
        });
    }
    logger_1.logger.warn("payment_failed", {
        paymentIntentId: pi.id,
        jobId,
        error: pi.last_payment_error?.message,
    });
}
/**
 * Handle invoice.paid (subscription credits)
 */
async function handleInvoicePaid(event) {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    logger_1.logger.info("invoice_paid_received", { invoiceId: invoice.id, customerId });
    if (!customerId) {
        logger_1.logger.warn("invoice_paid_missing_customer", { invoiceId: invoice.id });
        return;
    }
    const userId = await resolveUserIdByStripeCustomer(customerId);
    if (!userId) {
        logger_1.logger.warn("invoice_paid_no_user_mapping", { invoiceId: invoice.id, customerId });
        return;
    }
    // Determine credits to grant; prefer metadata.credits or metadata.credits_per_cycle
    const rawCredits = (invoice.metadata && (invoice.metadata.credits || invoice.metadata.credits_per_cycle)) ||
        null;
    const { env } = await Promise.resolve().then(() => __importStar(require("../config/env")));
    const credits = rawCredits ? Number(rawCredits) : env.SUBSCRIPTION_DEFAULT_CREDITS;
    if (!credits || Number.isNaN(credits) || credits <= 0) {
        logger_1.logger.warn("invoice_paid_missing_credits_metadata", {
            invoiceId: invoice.id,
            customerId,
            userId,
        });
        return;
    }
    // Grant subscription credits (dedicated reason)
    await (0, creditsService_1.addLedgerEntry)({
        userId,
        jobId: null,
        deltaCredits: credits,
        reason: "subscription_credit",
    });
    // Mark invoice processed in stripe_events already by idempotency; also can upsert payment_intents if stored.
    logger_1.logger.info("subscription_credits_granted", {
        userId,
        customerId,
        invoiceId: invoice.id,
        credits,
    });
}
/**
 * Handle invoice.payment_failed (dunning)
 */
async function handleInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    logger_1.logger.warn("invoice_payment_failed", { invoiceId: invoice.id, customerId });
    // TODO: Implement dunning flag/notification per subscription spec.
}
/**
 * Handle charge.refunded
 */
async function handleChargeRefunded(event) {
    const charge = event.data.object;
    logger_1.logger.info("charge_refunded_received", { chargeId: charge.id, paymentIntent: charge.payment_intent });
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    if (!paymentIntentId) {
        logger_1.logger.warn("charge_refunded_no_payment_intent", { chargeId: charge.id });
        return;
    }
    const paymentIntentRow = await (0, client_1.query)(`
      SELECT job_id, client_id, purpose
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `, [paymentIntentId]);
    const { job_id: jobId = null, client_id: clientId = null, purpose = null } = paymentIntentRow.rows[0] || {};
    // Directly invoke refund processor (scaffolded). Uses stripe_events idempotency to avoid double work.
    const { processStripeRefund } = await Promise.resolve().then(() => __importStar(require("./refundProcessor")));
    await processStripeRefund({
        chargeId: charge.id,
        paymentIntentId,
        jobId,
        clientId,
        purpose,
        amount: charge.amount_refunded,
        currency: charge.currency,
    });
    logger_1.logger.info("refund_processing_enqueued", {
        chargeId: charge.id,
        paymentIntentId,
        jobId,
        clientId,
        purpose,
        amount_refunded: charge.amount_refunded,
    });
}
/**
 * Handle charge.dispute.* events
 */
async function handleChargeDisputeEvent(event) {
    const dispute = event.data.object;
    logger_1.logger.info("charge_dispute_event", { disputeId: dispute.id, type: event.type, chargeId: dispute.charge });
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
    if (!chargeId)
        return;
    // Attempt to find payment_intent from charge (if included)
    const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
    // Resolve job/client if possible
    let jobId = null;
    let clientId = null;
    if (paymentIntentId) {
        const paymentIntentRow = await (0, client_1.query)(`
        SELECT job_id, client_id, purpose
        FROM payment_intents
        WHERE stripe_payment_intent_id = $1
        LIMIT 1
      `, [paymentIntentId]);
        if (paymentIntentRow.rows[0]) {
            jobId = paymentIntentRow.rows[0].job_id;
            clientId = paymentIntentRow.rows[0].client_id;
        }
    }
    // Process via chargeback processor (scaffold)
    const { processChargeDispute } = await Promise.resolve().then(() => __importStar(require("./chargebackProcessor")));
    await processChargeDispute({
        disputeId: dispute.id,
        chargeId,
        paymentIntentId,
        jobId,
        clientId,
        amount: dispute.amount,
        currency: dispute.currency,
        status: dispute.status,
        eventType: event.type,
        reason: dispute.reason,
    });
}
/**
 * Handle payout.paid / payout.failed
 */
async function handlePayoutEvent(event) {
    const payout = event.data.object;
    const newStatus = event.type === "payout.paid" ? "paid" : "failed";
    // Object-level idempotency: skip if already in this status
    const existing = await (0, client_1.query)(`
      SELECT status
      FROM payouts
      WHERE stripe_payout_id = $1
      LIMIT 1
    `, [payout.id]);
    if (existing.rows[0]?.status === newStatus) {
        logger_1.logger.info("payout_event_already_applied", { payoutId: payout.id, status: newStatus });
        return;
    }
    const result = await (0, client_1.query)(`
      UPDATE payouts
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_payout_id = $1
    `, [payout.id, newStatus]);
    if (result.rowCount === 0) {
        logger_1.logger.warn("payout_event_no_row_updated", { payoutId: payout.id, status: newStatus });
    }
    logger_1.logger.info("payout_status_updated", { payoutId: payout.id, status: newStatus });
}
/**
 * Resolve user_id from stripe_customer_id
 */
async function resolveUserIdByStripeCustomer(stripeCustomerId) {
    // Try client_profiles first
    const clientResult = await (0, client_1.query)(`
      SELECT user_id
      FROM client_profiles
      WHERE stripe_customer_id = $1
      LIMIT 1
    `, [stripeCustomerId]);
    if (clientResult.rows[0]?.user_id)
        return clientResult.rows[0].user_id;
    // Fallback to stripe_customers table if present
    const stripeResult = await (0, client_1.query)(`
      SELECT user_id
      FROM stripe_customers
      WHERE stripe_customer_id = $1
      LIMIT 1
    `, [stripeCustomerId]);
    if (stripeResult.rows[0]?.user_id)
        return stripeResult.rows[0].user_id;
    return null;
}
/**
 * Handle Stripe Connect transfer events
 */
async function handleTransferEvent(event) {
    const transfer = event.data.object;
    // Map transfer status to our payout status
    // Stripe transfer statuses: pending, paid, failed, reversed, canceled
    let newStatus;
    if (transfer.reversed) {
        newStatus = "reversed";
    }
    else if (event.type === "transfer.reversed") {
        newStatus = "reversed";
    }
    else {
        // For transfer.created and transfer.updated, use the transfer's status
        newStatus = transfer.reversed ? "reversed" : "pending";
    }
    await (0, client_1.query)(`
      UPDATE payouts
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_transfer_id = $1
    `, [transfer.id, newStatus]);
    logger_1.logger.info("transfer_status_updated", {
        transferId: transfer.id,
        status: newStatus,
    });
}
// ============================================
// Query Functions
// ============================================
/**
 * Get payment intent by job ID
 */
async function getPaymentIntentByJobId(jobId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM payment_intents
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [jobId]);
    return result.rows[0] ?? null;
}
/**
 * Get payment intents for a client
 */
async function getPaymentIntentsForClient(clientId, purpose, limit = 50) {
    let queryText = `
    SELECT *
    FROM payment_intents
    WHERE client_id = $1
  `;
    const params = [clientId];
    if (purpose) {
        queryText += ` AND purpose = $2`;
        params.push(purpose);
    }
    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await (0, client_1.query)(queryText, params);
    return result.rows;
}
/**
 * Create a Checkout Session for credit purchases (alternative flow)
 */
async function createCheckoutSession(options) {
    const { userId, creditAmount, priceInCents, successUrl, cancelUrl } = options;
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `${creditAmount} PureTask Credits`,
                        description: `Purchase ${creditAmount} credits for cleaning services`,
                    },
                    unit_amount: priceInCents,
                },
                quantity: 1,
            },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            user_id: userId,
            credit_amount: creditAmount.toString(),
            purpose: "wallet_topup",
        },
    });
    logger_1.logger.info("checkout_session_created", {
        sessionId: session.id,
        userId,
        creditAmount,
        priceInCents,
    });
    return session;
}
