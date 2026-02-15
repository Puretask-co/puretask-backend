// src/tests/integration/stripeE2E.test.ts
// E2E tests for Stripe webhooks and payment flows (require TEST_DATABASE_URL, STRIPE_SECRET_KEY)
// Uses real DB and handleStripeEvent with wallet_topup metadata

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "../../db/client";
import { handleStripeEvent } from "../../services/paymentService";
import { addLedgerEntry, getUserBalance } from "../../services/creditsService";
import Stripe from "stripe";
import { TEST_PASSWORD_HASH } from "../helpers/testConstants";
import { env } from "../../config/env";

const CENTS_PER_CREDIT = env.CENTS_PER_CREDIT ?? 10;
const TEST_CLIENT_ID = `e2e-stripe-client-${Date.now()}`;

describe("Stripe E2E: Webhook and Payment Flow", () => {
  beforeAll(async () => {
    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, 'client', $3) ON CONFLICT (id) DO NOTHING`,
      [TEST_CLIENT_ID, `e2e-stripe-${Date.now()}@test.com`, TEST_PASSWORD_HASH]
    );
    await addLedgerEntry({
      userId: TEST_CLIENT_ID,
      deltaCredits: 100,
      reason: "adjustment",
    });
  });

  afterAll(async () => {
    await query(`DELETE FROM payment_intents WHERE client_id = $1`, [TEST_CLIENT_ID]);
    await query(`DELETE FROM credit_ledger WHERE user_id = $1`, [TEST_CLIENT_ID]);
    await query(`DELETE FROM users WHERE id = $1`, [TEST_CLIENT_ID]);
  });

  it("handleStripeEvent processes wallet_topup and credits user", async () => {
    const stripePaymentIntentId = `pi_e2e_${Date.now()}`;
    const credits = 50;
    const amountCents = credits * CENTS_PER_CREDIT;

    await query(
      `INSERT INTO payment_intents (job_id, client_id, stripe_payment_intent_id, status, amount_cents, purpose, credits_amount)
       VALUES (NULL, $1, $2, 'requires_payment_method', $3, 'wallet_topup', $4)`,
      [TEST_CLIENT_ID, stripePaymentIntentId, amountCents, credits]
    );

    const beforeBalance = await getUserBalance(TEST_CLIENT_ID);

    const event = {
      id: `evt_e2e_${Date.now()}`,
      type: "payment_intent.succeeded" as const,
      data: {
        object: {
          id: stripePaymentIntentId,
          amount: amountCents,
          currency: "usd",
          status: "succeeded",
          metadata: {
            purpose: "wallet_topup",
            clientId: TEST_CLIENT_ID,
            credits: String(credits),
          },
        } as Stripe.PaymentIntent,
      },
    } as Stripe.PaymentIntentSucceededEvent;

    await handleStripeEvent(event);

    const afterBalance = await getUserBalance(TEST_CLIENT_ID);
    expect(afterBalance).toBe(beforeBalance + credits);

    const pi = await query(
      `SELECT status FROM payment_intents WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );
    expect(pi.rows[0]?.status).toBe("succeeded");
  });

  it("handleStripeEvent is idempotent (duplicate event does not double-credit)", async () => {
    const stripePaymentIntentId = `pi_e2e_dupe_${Date.now()}`;
    const credits = 25;
    const amountCents = credits * CENTS_PER_CREDIT;

    await query(
      `INSERT INTO payment_intents (job_id, client_id, stripe_payment_intent_id, status, amount_cents, purpose, credits_amount)
       VALUES (NULL, $1, $2, 'requires_payment_method', $3, 'wallet_topup', $4)`,
      [TEST_CLIENT_ID, stripePaymentIntentId, amountCents, credits]
    );

    const event = {
      id: `evt_e2e_dupe_${Date.now()}`,
      type: "payment_intent.succeeded" as const,
      data: {
        object: {
          id: stripePaymentIntentId,
          amount: amountCents,
          currency: "usd",
          status: "succeeded",
          metadata: {
            purpose: "wallet_topup",
            clientId: TEST_CLIENT_ID,
            credits: String(credits),
          },
        } as Stripe.PaymentIntent,
      },
    } as Stripe.PaymentIntentSucceededEvent;

    const beforeBalance = await getUserBalance(TEST_CLIENT_ID);
    await handleStripeEvent(event);
    const afterFirst = await getUserBalance(TEST_CLIENT_ID);
    await handleStripeEvent(event);
    const afterSecond = await getUserBalance(TEST_CLIENT_ID);

    expect(afterFirst).toBe(beforeBalance + credits);
    expect(afterSecond).toBe(afterFirst);
  });
});
