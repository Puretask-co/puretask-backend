// src/tests/mocks/stripe.ts
// Stripe API mocks for testing

import Stripe from "stripe";

/**
 * Mock Stripe PaymentIntent
 */
export function createMockPaymentIntent(
  overrides?: Partial<Stripe.PaymentIntent>
): Stripe.PaymentIntent {
  return {
    id: "pi_test_123",
    object: "payment_intent",
    amount: 10000,
    currency: "usd",
    status: "succeeded",
    client_secret: "pi_test_123_secret_test",
    metadata: {},
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.PaymentIntent;
}

/**
 * Mock Stripe Event
 */
export function createMockStripeEvent(
  type: string,
  data: any,
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
  return {
    id: "evt_test_123",
    object: "event",
    type: type as Stripe.Event.Type,
    data: {
      object: data,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: "req_test_123",
      idempotency_key: null,
    },
    ...overrides,
  } as Stripe.Event;
}

/**
 * Mock Stripe Customer
 */
export function createMockCustomer(overrides?: Partial<Stripe.Customer>): Stripe.Customer {
  return {
    id: "cus_test_123",
    object: "customer",
    email: "test@example.com",
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.Customer;
}

/**
 * Mock Stripe Connect Account
 */
export function createMockConnectAccount(overrides?: Partial<Stripe.Account>): Stripe.Account {
  return {
    id: "acct_test_123",
    object: "account",
    type: "express",
    charges_enabled: true,
    payouts_enabled: true,
    ...overrides,
  } as Stripe.Account;
}

/**
 * Mock Stripe Transfer
 */
export function createMockTransfer(overrides?: Partial<Stripe.Transfer>): Stripe.Transfer {
  return {
    id: "tr_test_123",
    object: "transfer",
    amount: 10000,
    currency: "usd",
    destination: "acct_test_123",
    status: "paid",
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.Transfer;
}
