// src/lib/stripeWrapper.ts
// Wrapper for Stripe operations with circuit breaker protection
// Note: Stripe SDK already has maxNetworkRetries, but we add circuit breaker for additional resilience

import { stripe } from "../integrations/stripe";
import { circuitBreakers } from "./circuitBreaker";
import { retryWithBackoff, retryConfigs } from "./retry";
import Stripe from "stripe";

/**
 * Execute Stripe operation with circuit breaker and retry
 * Stripe SDK already has maxNetworkRetries, but this adds circuit breaker protection
 */
export async function executeStripeOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await circuitBreakers.stripe.execute(() =>
      retryWithBackoff(
        async () => {
          return await operation();
        },
        {
          ...retryConfigs.stripe,
          // Stripe SDK already retries, so we use fewer retries here
          maxAttempts: 2,
        }
      )
    );
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Stripe ${operationName} failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Wrapper for common Stripe operations
 */
export const stripeOperations = {
  /**
   * Create payment intent with circuit breaker
   */
  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams
  ): Promise<Stripe.PaymentIntent> {
    return executeStripeOperation(
      () => stripe.paymentIntents.create(params),
      "createPaymentIntent"
    );
  },

  /**
   * Create transfer with circuit breaker
   */
  async createTransfer(params: Stripe.TransferCreateParams): Promise<Stripe.Transfer> {
    return executeStripeOperation(() => stripe.transfers.create(params), "createTransfer");
  },

  /**
   * Create account with circuit breaker
   */
  async createAccount(params: Stripe.AccountCreateParams): Promise<Stripe.Account> {
    return executeStripeOperation(() => stripe.accounts.create(params), "createAccount");
  },

  /**
   * Create account link with circuit breaker
   */
  async createAccountLink(params: Stripe.AccountLinkCreateParams): Promise<Stripe.AccountLink> {
    return executeStripeOperation(() => stripe.accountLinks.create(params), "createAccountLink");
  },

  /**
   * Retrieve payment intent with circuit breaker
   */
  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return executeStripeOperation(
      () => stripe.paymentIntents.retrieve(id),
      "retrievePaymentIntent"
    );
  },
};
