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

export type PaymentPurpose = "wallet_topup" | "job_charge";

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
}): Promise<Stripe.PaymentIntent> {
  const { jobId, amountCents, currency = "usd", customerId } = options;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: customerId,
      metadata: {
        job_id: jobId,
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
          stripe_payment_intent_id,
          status,
          amount_cents,
          currency,
          purpose
        )
        VALUES ($1, $2, $3, $4, $5, 'job_charge')
        ON CONFLICT (stripe_payment_intent_id) DO UPDATE
        SET status = EXCLUDED.status,
            updated_at = NOW()
      `,
      [jobId, paymentIntent.id, paymentIntent.status, amountCents, currency]
    );

    logger.info("payment_intent_created", {
      jobId,
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

// ============================================
// Webhook Handler
// ============================================

/**
 * Main Stripe webhook handler
 * - Upserts stripe_events for idempotency
 * - Processes payment_intent.succeeded for both purposes
 * - Updates payment_intents status
 */
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
        await handlePaymentIntentSucceeded(event as Stripe.PaymentIntentSucceededEvent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event as Stripe.PaymentIntentPaymentFailedEvent);
        break;

      case "transfer.created":
      case "transfer.paid":
      case "transfer.failed":
        await handleTransferEvent(event);
        break;

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
  }

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
 * Handle Stripe Connect transfer events
 */
async function handleTransferEvent(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;
  const newStatus =
    event.type === "transfer.paid"
      ? "paid"
      : event.type === "transfer.failed"
      ? "failed"
      : "pending";

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
