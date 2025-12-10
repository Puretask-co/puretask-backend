// src/services/paymentService.ts
// Stripe payment integration service with dual payment flows:
// 1. Wallet Mode: Buy credits separately, use them to book jobs
// 2. Job Charge Mode: Pay for a specific job at booking time

import Stripe from "stripe";
import { query } from "../db/client";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { addLedgerEntry } from "./creditsService";
import { PaymentIntent, Job } from "../types/db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ============================================
// Types
// ============================================

export type PaymentPurpose = "wallet_topup" | "job_charge" | "invoice_payment";

export interface CreateWalletTopupResult {
  clientSecret: string;
  stripePaymentIntentId: string;
  amountCents: number;
  credits: number;
}

export interface CreateJobChargeResult {
  clientSecret: string;
  stripePaymentIntentId: string;
  amountCents: number;
  credits: number;
  jobId: string;
}

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
export async function createWalletTopupIntent(params: {
  clientId: string;
  clientStripeCustomerId?: string;
  credits: number;
}): Promise<CreateWalletTopupResult> {
  const { clientId, clientStripeCustomerId, credits } = params;

  if (credits <= 0) {
    throw Object.assign(new Error("Credits must be greater than 0"), { statusCode: 400 });
  }

  const amountCents = credits * env.CENTS_PER_CREDIT;

  // Create Stripe PaymentIntent
  const piOptions: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: env.PAYOUT_CURRENCY,
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
  await query(
    `
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
    `,
    [clientId, pi.id, pi.status, amountCents, env.PAYOUT_CURRENCY, credits]
  );

  logger.info("wallet_topup_intent_created", {
    clientId,
    stripePaymentIntentId: pi.id,
    credits,
    amountCents,
  });

  return {
    clientSecret: pi.client_secret!,
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
export async function createJobPaymentIntent(params: {
  job: Job;
  clientId: string;
  clientStripeCustomerId?: string;
}): Promise<CreateJobChargeResult> {
  const { job, clientId, clientStripeCustomerId } = params;

  if (!job.credit_amount || job.credit_amount <= 0) {
    throw Object.assign(new Error("Job has invalid credit_amount"), { statusCode: 400 });
  }

  const credits = job.credit_amount;
  
  // Base price (what they'd pay if using wallet credits)
  const baseAmountCents = credits * env.CENTS_PER_CREDIT;
  
  // Apply surcharge for direct card payment
  const surchargePercent = env.NON_CREDIT_SURCHARGE_PERCENT || 0;
  const multiplier = 1 + surchargePercent / 100;
  const amountCents = Math.round(baseAmountCents * multiplier);

  // Create Stripe PaymentIntent with surcharge
  const piOptions: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: env.PAYOUT_CURRENCY,
    metadata: {
      purpose: "job_charge",
      credits: String(credits),                       // Credits that will be minted internally
      base_amount_cents: String(baseAmountCents),     // What wallet users pay
      surcharge_percent: String(surchargePercent),    // Extra % charged
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
  await query(
    `
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
    `,
    [job.id, clientId, pi.id, pi.status, amountCents, env.PAYOUT_CURRENCY, credits]
  );

  logger.info("job_charge_intent_created", {
    clientId,
    jobId: job.id,
    stripePaymentIntentId: pi.id,
    credits,
    baseAmountCents,
    surchargePercent,
    finalAmountCents: amountCents,
  });

  return {
    clientSecret: pi.client_secret!,
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
export async function createPaymentIntent(options: {
  jobId: string;
  amountCents: number;
  currency?: string;
  customerId?: string;
  clientId?: string;
}): Promise<Stripe.PaymentIntent> {
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

    await query(
      `
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
      `,
      [jobId, clientId, paymentIntent.id, paymentIntent.status, amountCents, currency]
    );

    logger.info("payment_intent_created", {
      jobId,
      clientId,
      paymentIntentId: paymentIntent.id,
      amountCents,
    });

    return paymentIntent;
  } catch (error) {
    logger.error("payment_intent_creation_failed", {
      error: (error as Error).message,
      jobId,
      amountCents,
    });
    throw error;
  }
}

/**
 * Create a PaymentIntent for invoice payment
 */
export async function createInvoicePaymentIntent(options: {
  invoiceId: string;
  amountCents: number;
  currency?: string;
  clientId: string;
  cleanerId: string;
  customerId?: string;
}): Promise<Stripe.PaymentIntent> {
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

    await query(
      `
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
      `,
      [clientId, paymentIntent.id, paymentIntent.status, amountCents, currency]
    );

    logger.info("invoice_payment_intent_created", {
      invoiceId,
      paymentIntentId: paymentIntent.id,
      amountCents,
      clientId,
      cleanerId,
    });

    return paymentIntent;
  } catch (error) {
    logger.error("invoice_payment_intent_creation_failed", {
      error: (error as Error).message,
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
export async function isObjectAlreadyProcessed(objectId: string, objectType: string): Promise<boolean> {
  const existing = await query<{ object_id: string }>(
    `
      SELECT object_id
      FROM stripe_object_processed
      WHERE object_id = $1 AND object_type = $2
      LIMIT 1
    `,
    [objectId, objectType]
  );
  return !!existing.rows[0];
}

export async function markObjectProcessed(objectId: string, objectType: string): Promise<void> {
  await query(
    `
      INSERT INTO stripe_object_processed (object_id, object_type)
      VALUES ($1, $2)
      ON CONFLICT (object_id, object_type) DO NOTHING
    `,
    [objectId, objectType]
  );
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Upsert stripe_events record
  const existingResult = await query<{ id: string; processed: boolean }>(
    `
      INSERT INTO stripe_events (stripe_event_id, type, payload, processed)
      VALUES ($1, $2, $3::jsonb, false)
      ON CONFLICT (stripe_event_id) DO UPDATE
      SET type = EXCLUDED.type,
          payload = EXCLUDED.payload
      RETURNING id, processed
    `,
    [event.id, event.type, JSON.stringify(event)]
  );

  const existing = existingResult.rows[0];
  if (existing?.processed) {
    logger.info("stripe_event_already_processed", { eventId: event.id, type: event.type });
    return;
  }

  logger.info("stripe_event_received", {
    eventId: event.id,
    eventType: event.type,
  });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        if (
          await isObjectAlreadyProcessed(
            (event as Stripe.PaymentIntentSucceededEvent).data.object.id,
            "payment_intent"
          )
        ) {
          logger.info("stripe_object_already_processed", {
            objectId: (event as Stripe.PaymentIntentSucceededEvent).data.object.id,
            type: "payment_intent",
          });
          break;
        }
        await handlePaymentIntentSucceeded(event as Stripe.PaymentIntentSucceededEvent);
        await markObjectProcessed((event as Stripe.PaymentIntentSucceededEvent).data.object.id, "payment_intent");
        break;

      case "payment_intent.payment_failed":
        if (
          await isObjectAlreadyProcessed(
            (event as Stripe.PaymentIntentPaymentFailedEvent).data.object.id,
            "payment_intent"
          )
        ) {
          logger.info("stripe_object_already_processed", {
            objectId: (event as Stripe.PaymentIntentPaymentFailedEvent).data.object.id,
            type: "payment_intent",
          });
          break;
        }
        await handlePaymentIntentFailed(event as Stripe.PaymentIntentPaymentFailedEvent);
        await markObjectProcessed((event as Stripe.PaymentIntentPaymentFailedEvent).data.object.id, "payment_intent");
        break;

      case "invoice.paid": {
        const invoice = (event as Stripe.InvoicePaidEvent).data.object;
        if (await isObjectAlreadyProcessed(invoice.id, "invoice")) {
          logger.info("stripe_object_already_processed", { objectId: invoice.id, type: "invoice" });
          break;
        }
        await handleInvoicePaid(event as Stripe.InvoicePaidEvent);
        await markObjectProcessed(invoice.id, "invoice");
        break;
      }

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event as Stripe.InvoicePaymentFailedEvent);
        break;

      case "charge.refunded": {
        const charge = (event as Stripe.ChargeRefundedEvent).data.object;
        if (await isObjectAlreadyProcessed(charge.id, "charge")) {
          logger.info("stripe_object_already_processed", { objectId: charge.id, type: "charge" });
          break;
        }
        await handleChargeRefunded(event as Stripe.ChargeRefundedEvent);
        await markObjectProcessed(charge.id, "charge");
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const dispute = (event as Stripe.ChargeDisputeCreatedEvent).data.object;
        if (await isObjectAlreadyProcessed(dispute.id, "dispute")) {
          logger.info("stripe_object_already_processed", { objectId: dispute.id, type: "dispute" });
          break;
        }
        await handleChargeDisputeEvent(event);
        await markObjectProcessed(dispute.id, "dispute");
        break;
      }

      case "payout.paid":
      case "payout.failed": {
        const payout = (event as Stripe.PayoutPaidEvent).data.object;
        if (await isObjectAlreadyProcessed(payout.id, "payout")) {
          logger.info("stripe_object_already_processed", { objectId: payout.id, type: "payout" });
          break;
        }
        await handlePayoutEvent(event);
        await markObjectProcessed(payout.id, "payout");
        break;
      }

      case "transfer.created":
      case "transfer.updated":
      case "transfer.reversed": {
        const transfer = (event as Stripe.Event).data.object as { id: string };
        if (await isObjectAlreadyProcessed(transfer.id, "transfer")) {
          logger.info("stripe_object_already_processed", { objectId: transfer.id, type: "transfer" });
          break;
        }
        await handleTransferEvent(event);
        await markObjectProcessed(transfer.id, "transfer");
        break;
      }

      default:
        logger.debug("stripe_event_unhandled", {
          eventType: event.type,
          eventId: event.id,
        });
    }

    // Mark event as processed
    await query(
      `
        UPDATE stripe_events
        SET processed = true,
            processed_at = NOW()
        WHERE stripe_event_id = $1
      `,
      [event.id]
    );
  } catch (error) {
    logger.error("stripe_event_processing_failed", {
      error: (error as Error).message,
      eventId: event.id,
      eventType: event.type,
    });
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded for both:
 * - purpose = 'wallet_topup': Add credits to client wallet
 * - purpose = 'job_charge': Add credits AND immediately escrow for job
 */
async function handlePaymentIntentSucceeded(
  event: Stripe.PaymentIntentSucceededEvent
): Promise<void> {
  const pi = event.data.object;

  const purpose = (pi.metadata?.purpose as PaymentPurpose) ?? "wallet_topup";
  const clientId = pi.metadata?.clientId || null;
  const jobId = pi.metadata?.jobId || pi.metadata?.job_id || null;
  const credits = Number(pi.metadata?.credits || 0);

  // Object-level idempotency: skip if this payment_intent was already processed for success
  const piRow = await query<{ processed_success: boolean }>(
    `
      SELECT processed_success
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `,
    [pi.id]
  );
  if (piRow.rows[0]?.processed_success) {
    logger.info("pi_already_processed_success", { paymentIntentId: pi.id, purpose });
    return;
  }

  // Update payment_intents row
  await query(
    `
      UPDATE payment_intents
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `,
    [pi.id, pi.status]
  );

  // Validate metadata
  if (!clientId || !credits || Number.isNaN(credits) || credits <= 0) {
    logger.warn("payment_intent_missing_metadata", {
      stripePaymentIntentId: pi.id,
      purpose,
      clientId,
      credits,
    });
    return;
  }

  if (purpose === "wallet_topup") {
    // Wallet mode: just top up the client's balance
    await addLedgerEntry({
      userId: clientId,
      jobId: null,
      deltaCredits: credits,
      reason: "purchase",
    });

    logger.info("wallet_topup_credits_added", {
      clientId,
      credits,
      stripePaymentIntentId: pi.id,
    });
  } else if (purpose === "job_charge") {
    if (!jobId) {
      logger.warn("job_charge_missing_jobId", {
        stripePaymentIntentId: pi.id,
        clientId,
      });
      return;
    }

    // Direct job-charge mode:
    // Step 1: Mint credits to client wallet tied to this job
    await addLedgerEntry({
      userId: clientId,
      jobId,
      deltaCredits: credits,
      reason: "purchase",
    });

    // Step 2: Immediately escrow them for this job
    await addLedgerEntry({
      userId: clientId,
      jobId,
      deltaCredits: -credits,
      reason: "job_escrow",
    });

    logger.info("job_charge_credits_purchased_and_escrowed", {
      clientId,
      jobId,
      credits,
      stripePaymentIntentId: pi.id,
    });
  } else if (purpose === "invoice_payment") {
    // Invoice payment: handled by invoiceService.handleInvoicePaymentSuccess
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) {
      logger.warn("invoice_payment_missing_invoiceId", {
        stripePaymentIntentId: pi.id,
        clientId,
      });
      return;
    }

    // Import dynamically to avoid circular dependency
    const { handleInvoicePaymentSuccess } = await import("./invoiceService");
    await handleInvoicePaymentSuccess(pi.id);

    logger.info("invoice_payment_processed", {
      invoiceId,
      stripePaymentIntentId: pi.id,
    });
  }

  // Mark object-level processed_success to prevent double handling
  await query(
    `
      UPDATE payment_intents
      SET processed_success = true,
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `,
    [pi.id]
  );

  // Emit event
  await publishEvent({
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
async function handlePaymentIntentFailed(
  event: Stripe.PaymentIntentPaymentFailedEvent
): Promise<void> {
  const pi = event.data.object;
  const jobId = pi.metadata?.jobId || pi.metadata?.job_id || null;

  // Object-level idempotency: skip if already marked failed
  const piRow = await query<{ status: string | null }>(
    `
      SELECT status
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `,
    [pi.id]
  );
  if (piRow.rows[0]?.status === "failed") {
    logger.info("pi_already_failed", { paymentIntentId: pi.id });
    return;
  }

  await query(
    `
      UPDATE payment_intents
      SET status = 'failed',
          updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `,
    [pi.id]
  );

  if (jobId) {
    await publishEvent({
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

  logger.warn("payment_failed", {
    paymentIntentId: pi.id,
    jobId,
    error: pi.last_payment_error?.message,
  });
}

/**
 * Handle invoice.paid (subscription credits)
 */
async function handleInvoicePaid(event: Stripe.InvoicePaidEvent): Promise<void> {
  const invoice = event.data.object;
  const customerId = invoice.customer as string | null;

  logger.info("invoice_paid_received", { invoiceId: invoice.id, customerId });

  if (!customerId) {
    logger.warn("invoice_paid_missing_customer", { invoiceId: invoice.id });
    return;
  }

  const userId = await resolveUserIdByStripeCustomer(customerId);
  if (!userId) {
    logger.warn("invoice_paid_no_user_mapping", { invoiceId: invoice.id, customerId });
    return;
  }

  // Determine credits to grant; prefer metadata.credits or metadata.credits_per_cycle
  const rawCredits =
    (invoice.metadata && (invoice.metadata.credits || invoice.metadata.credits_per_cycle)) ||
    null;
  const { env } = await import("../config/env");
  const credits = rawCredits ? Number(rawCredits) : env.SUBSCRIPTION_DEFAULT_CREDITS;

  if (!credits || Number.isNaN(credits) || credits <= 0) {
    logger.warn("invoice_paid_missing_credits_metadata", {
      invoiceId: invoice.id,
      customerId,
      userId,
    });
    return;
  }

  // Grant subscription credits (dedicated reason)
  await addLedgerEntry({
    userId,
    jobId: null,
    deltaCredits: credits,
    reason: "subscription_credit",
  });

  // Mark invoice processed in stripe_events already by idempotency; also can upsert payment_intents if stored.
  logger.info("subscription_credits_granted", {
    userId,
    customerId,
    invoiceId: invoice.id,
    credits,
  });
}

/**
 * Handle invoice.payment_failed (dunning)
 */
async function handleInvoicePaymentFailed(event: Stripe.InvoicePaymentFailedEvent): Promise<void> {
  const invoice = event.data.object;
  const customerId = invoice.customer as string | null;

  logger.warn("invoice_payment_failed", { invoiceId: invoice.id, customerId });

  // TODO: Implement dunning flag/notification per subscription spec.
}

/**
 * Handle charge.refunded
 */
async function handleChargeRefunded(event: Stripe.ChargeRefundedEvent): Promise<void> {
  const charge = event.data.object;
  logger.info("charge_refunded_received", { chargeId: charge.id, paymentIntent: charge.payment_intent });

  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) {
    logger.warn("charge_refunded_no_payment_intent", { chargeId: charge.id });
    return;
  }

  const paymentIntentRow = await query<{ job_id: string | null; client_id: string | null; purpose: string | null }>(
    `
      SELECT job_id, client_id, purpose
      FROM payment_intents
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `,
    [paymentIntentId]
  );

  const { job_id: jobId = null, client_id: clientId = null, purpose = null } = paymentIntentRow.rows[0] || {};

  // Directly invoke refund processor (scaffolded). Uses stripe_events idempotency to avoid double work.
  const { processStripeRefund } = await import("./refundProcessor");
  await processStripeRefund({
    chargeId: charge.id,
    paymentIntentId,
    jobId,
    clientId,
    purpose,
    amount: charge.amount_refunded,
    currency: charge.currency,
  });

  logger.info("refund_processing_enqueued", {
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
async function handleChargeDisputeEvent(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  logger.info("charge_dispute_event", { disputeId: dispute.id, type: event.type, chargeId: dispute.charge });

  const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
  if (!chargeId) return;

  // Attempt to find payment_intent from charge (if included)
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;

  // Resolve job/client if possible
  let jobId: string | null = null;
  let clientId: string | null = null;

  if (paymentIntentId) {
    const paymentIntentRow = await query<{ job_id: string | null; client_id: string | null; purpose: string | null }>(
      `
        SELECT job_id, client_id, purpose
        FROM payment_intents
        WHERE stripe_payment_intent_id = $1
        LIMIT 1
      `,
      [paymentIntentId]
    );
    if (paymentIntentRow.rows[0]) {
      jobId = paymentIntentRow.rows[0].job_id;
      clientId = paymentIntentRow.rows[0].client_id;
    }
  }

  // Process via chargeback processor (scaffold)
  const { processChargeDispute } = await import("./chargebackProcessor");
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
async function handlePayoutEvent(event: Stripe.Event): Promise<void> {
  const payout = event.data.object as Stripe.Payout;
  const newStatus = event.type === "payout.paid" ? "paid" : "failed";

  // Object-level idempotency: skip if already in this status
  const existing = await query<{ status: string | null }>(
    `
      SELECT status
      FROM payouts
      WHERE stripe_payout_id = $1
      LIMIT 1
    `,
    [payout.id]
  );

  if (existing.rows[0]?.status === newStatus) {
    logger.info("payout_event_already_applied", { payoutId: payout.id, status: newStatus });
    return;
  }

  const result = await query(
    `
      UPDATE payouts
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_payout_id = $1
    `,
    [payout.id, newStatus]
  );

  if (result.rowCount === 0) {
    logger.warn("payout_event_no_row_updated", { payoutId: payout.id, status: newStatus });
  }

  logger.info("payout_status_updated", { payoutId: payout.id, status: newStatus });
}

/**
 * Resolve user_id from stripe_customer_id
 */
async function resolveUserIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  // Try client_profiles first
  const clientResult = await query<{ user_id: string }>(
    `
      SELECT user_id
      FROM client_profiles
      WHERE stripe_customer_id = $1
      LIMIT 1
    `,
    [stripeCustomerId]
  );
  if (clientResult.rows[0]?.user_id) return clientResult.rows[0].user_id;

  // Fallback to stripe_customers table if present
  const stripeResult = await query<{ user_id: string }>(
    `
      SELECT user_id
      FROM stripe_customers
      WHERE stripe_customer_id = $1
      LIMIT 1
    `,
    [stripeCustomerId]
  );
  if (stripeResult.rows[0]?.user_id) return stripeResult.rows[0].user_id;

  return null;
}

/**
 * Handle Stripe Connect transfer events
 */
async function handleTransferEvent(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;
  // Map transfer status to our payout status
  // Stripe transfer statuses: pending, paid, failed, reversed, canceled
  let newStatus: string;
  if (transfer.reversed) {
    newStatus = "reversed";
  } else if (event.type === "transfer.reversed") {
    newStatus = "reversed";
  } else {
    // For transfer.created and transfer.updated, use the transfer's status
    newStatus = transfer.reversed ? "reversed" : "pending";
  }

  await query(
    `
      UPDATE payouts
      SET status = $2,
          updated_at = NOW()
      WHERE stripe_transfer_id = $1
    `,
    [transfer.id, newStatus]
  );

  logger.info("transfer_status_updated", {
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
export async function getPaymentIntentByJobId(
  jobId: string
): Promise<PaymentIntent | null> {
  const result = await query<PaymentIntent>(
    `
      SELECT *
      FROM payment_intents
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] ?? null;
}

/**
 * Get payment intents for a client
 */
export async function getPaymentIntentsForClient(
  clientId: string,
  purpose?: PaymentPurpose,
  limit = 50
): Promise<PaymentIntent[]> {
  let queryText = `
    SELECT *
    FROM payment_intents
    WHERE client_id = $1
  `;
  const params: unknown[] = [clientId];

  if (purpose) {
    queryText += ` AND purpose = $2`;
    params.push(purpose);
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query<PaymentIntent>(queryText, params);
  return result.rows;
}

/**
 * Create a Checkout Session for credit purchases (alternative flow)
 */
export async function createCheckoutSession(options: {
  userId: string;
  creditAmount: number;
  priceInCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
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

  logger.info("checkout_session_created", {
    sessionId: session.id,
    userId,
    creditAmount,
    priceInCents,
  });

  return session;
}
