// src/tests/integration/stripeWebhook.test.ts
// Stripe webhook integration tests

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "../../db/client";
import { handleStripeEvent } from "../../services/paymentService";
import {
  createTestClient,
  addCreditsToUser,
  cleanupTestData,
  TestUser,
} from "../helpers/testUtils";

describe("Stripe Webhook Integration", () => {
  let client: TestUser;
  let testJobId: string;

  beforeAll(async () => {
    client = await createTestClient();
    await addCreditsToUser(client.id, 500);

    // Create a test job directly in DB for webhook testing
    const jobResult = await query<{ id: string }>(
      `
        INSERT INTO jobs (
          client_id,
          status,
          scheduled_start_at,
          scheduled_end_at,
          address,
          credit_amount
        )
        VALUES ($1, 'requested', NOW(), NOW() + INTERVAL '2 hours', 'Test Address', 100)
        RETURNING id
      `,
      [client.id]
    );
    testJobId = jobResult.rows[0].id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("payment_intent.succeeded", () => {
    it("records event and updates payment_intents status", async () => {
      const stripePaymentIntentId = `pi_test_${Date.now()}`;

      // Pre-insert a payment_intents row
      await query(
        `
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'requires_payment_method', 10000, 'usd')
        `,
        [testJobId, stripePaymentIntentId]
      );

      const fakeEvent = {
        id: `evt_test_${Date.now()}`,
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: stripePaymentIntentId,
            object: "payment_intent",
            amount: 10000,
            currency: "usd",
            status: "succeeded",
            metadata: {
              job_id: testJobId,
              user_id: client.id,
            },
          },
        },
      };

      await handleStripeEvent(fakeEvent as any);

      // Assert stripe_events row exists
      const events = await query<{ stripe_event_id: string; processed: boolean }>(
        `SELECT stripe_event_id, processed FROM stripe_events WHERE stripe_event_id = $1`,
        [fakeEvent.id]
      );
      expect(events.rows.length).toBe(1);
      expect(events.rows[0].processed).toBe(true);

      // Assert payment_intents status updated
      const pis = await query<{ status: string }>(
        `SELECT status FROM payment_intents WHERE stripe_payment_intent_id = $1`,
        [stripePaymentIntentId]
      );
      expect(pis.rows.length).toBe(1);
      expect(pis.rows[0].status).toBe("succeeded");
    });

    it("handles duplicate events idempotently", async () => {
      const stripePaymentIntentId = `pi_dupe_test_${Date.now()}`;
      const eventId = `evt_dupe_${Date.now()}`;

      // Pre-insert payment_intent
      await query(
        `
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'requires_payment_method', 5000, 'usd')
        `,
        [testJobId, stripePaymentIntentId]
      );

      const fakeEvent = {
        id: eventId,
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: stripePaymentIntentId,
            object: "payment_intent",
            amount: 5000,
            currency: "usd",
            status: "succeeded",
            metadata: { job_id: testJobId },
          },
        },
      };

      // Process twice
      await handleStripeEvent(fakeEvent as any);
      await handleStripeEvent(fakeEvent as any);

      // Should only have one event row
      const events = await query<{ id: string }>(
        `SELECT id FROM stripe_events WHERE stripe_event_id = $1`,
        [eventId]
      );
      expect(events.rows.length).toBe(1);
    });
  });

  describe("payment_intent.payment_failed", () => {
    it("records failure event and updates status", async () => {
      const stripePaymentIntentId = `pi_failed_${Date.now()}`;

      await query(
        `
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'processing', 7500, 'usd')
        `,
        [testJobId, stripePaymentIntentId]
      );

      const fakeEvent = {
        id: `evt_failed_${Date.now()}`,
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: stripePaymentIntentId,
            object: "payment_intent",
            amount: 7500,
            currency: "usd",
            status: "requires_payment_method",
            last_payment_error: {
              message: "Your card was declined.",
              code: "card_declined",
            },
            metadata: { job_id: testJobId },
          },
        },
      };

      await handleStripeEvent(fakeEvent as any);

      const pis = await query<{ status: string }>(
        `SELECT status FROM payment_intents WHERE stripe_payment_intent_id = $1`,
        [stripePaymentIntentId]
      );
      expect(pis.rows[0].status).toBe("failed");
    });
  });
});

