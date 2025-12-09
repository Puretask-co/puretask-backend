"use strict";
// src/tests/integration/stripeWebhook.test.ts
// Stripe webhook integration tests
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("../../db/client");
const paymentService_1 = require("../../services/paymentService");
const testUtils_1 = require("../helpers/testUtils");
(0, vitest_1.describe)("Stripe Webhook Integration", () => {
    let client;
    let testJobId;
    (0, vitest_1.beforeAll)(async () => {
        client = await (0, testUtils_1.createTestClient)();
        await (0, testUtils_1.addCreditsToUser)(client.id, 500);
        // Create a test job directly in DB for webhook testing
        const jobResult = await (0, client_1.query)(`
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
      `, [client.id]);
        testJobId = jobResult.rows[0].id;
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, testUtils_1.cleanupTestData)();
    });
    (0, vitest_1.describe)("payment_intent.succeeded", () => {
        (0, vitest_1.it)("records event and updates payment_intents status", async () => {
            const stripePaymentIntentId = `pi_test_${Date.now()}`;
            // Pre-insert a payment_intents row
            await (0, client_1.query)(`
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'requires_payment_method', 10000, 'usd')
        `, [testJobId, stripePaymentIntentId]);
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
            await (0, paymentService_1.handleStripeEvent)(fakeEvent);
            // Assert stripe_events row exists
            const events = await (0, client_1.query)(`SELECT stripe_event_id, processed FROM stripe_events WHERE stripe_event_id = $1`, [fakeEvent.id]);
            (0, vitest_1.expect)(events.rows.length).toBe(1);
            (0, vitest_1.expect)(events.rows[0].processed).toBe(true);
            // Assert payment_intents status updated
            const pis = await (0, client_1.query)(`SELECT status FROM payment_intents WHERE stripe_payment_intent_id = $1`, [stripePaymentIntentId]);
            (0, vitest_1.expect)(pis.rows.length).toBe(1);
            (0, vitest_1.expect)(pis.rows[0].status).toBe("succeeded");
        });
        (0, vitest_1.it)("handles duplicate events idempotently", async () => {
            const stripePaymentIntentId = `pi_dupe_test_${Date.now()}`;
            const eventId = `evt_dupe_${Date.now()}`;
            // Pre-insert payment_intent
            await (0, client_1.query)(`
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'requires_payment_method', 5000, 'usd')
        `, [testJobId, stripePaymentIntentId]);
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
            await (0, paymentService_1.handleStripeEvent)(fakeEvent);
            await (0, paymentService_1.handleStripeEvent)(fakeEvent);
            // Should only have one event row
            const events = await (0, client_1.query)(`SELECT id FROM stripe_events WHERE stripe_event_id = $1`, [eventId]);
            (0, vitest_1.expect)(events.rows.length).toBe(1);
        });
    });
    (0, vitest_1.describe)("payment_intent.payment_failed", () => {
        (0, vitest_1.it)("records failure event and updates status", async () => {
            const stripePaymentIntentId = `pi_failed_${Date.now()}`;
            await (0, client_1.query)(`
          INSERT INTO payment_intents (
            job_id,
            stripe_payment_intent_id,
            status,
            amount_cents,
            currency
          )
          VALUES ($1, $2, 'processing', 7500, 'usd')
        `, [testJobId, stripePaymentIntentId]);
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
            await (0, paymentService_1.handleStripeEvent)(fakeEvent);
            const pis = await (0, client_1.query)(`SELECT status FROM payment_intents WHERE stripe_payment_intent_id = $1`, [stripePaymentIntentId]);
            (0, vitest_1.expect)(pis.rows[0].status).toBe("failed");
        });
    });
});
