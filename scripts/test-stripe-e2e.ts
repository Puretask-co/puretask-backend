// scripts/test-stripe-e2e.ts
// V1 HARDENING: Stripe end-to-end test script
// Tests complete Stripe integration flow: purchase → escrow → completion → payout

import Stripe from "stripe";
import { query } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { env } from "../src/config/env";
import { getUserBalance, escrowCreditsWithTransaction } from "../src/services/creditsService";
import { createJob } from "../src/services/jobsService";
import { approveJob } from "../src/services/jobTrackingService";
import { handleStripeEvent } from "../src/services/paymentService";
import { TEST_PASSWORD_HASH } from "../src/tests/helpers/testConstants";
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// Test user IDs
const TEST_CLIENT_ID = `test-client-stripe-${Date.now()}`;
const TEST_CLEANER_ID = `test-cleaner-stripe-${Date.now()}`;

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
}

async function step1_CreateTestUsers(): Promise<TestResult> {
  try {
    logger.info("step1_creating_test_users");

    // Create client
    await query(
      `INSERT INTO users (id, email, role, password_hash, created_at)
       VALUES ($1, $2, 'client', $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TEST_CLIENT_ID, `${TEST_CLIENT_ID}@test.com`, TEST_PASSWORD_HASH]
    );

    // Create cleaner
    await query(
      `INSERT INTO users (id, email, role, password_hash, created_at)
       VALUES ($1, $2, 'cleaner', $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TEST_CLEANER_ID, `${TEST_CLEANER_ID}@test.com`, TEST_PASSWORD_HASH]
    );

    logger.info("step1_users_created", { clientId: TEST_CLIENT_ID, cleanerId: TEST_CLEANER_ID });

    return { step: "1. Create Test Users", success: true };
  } catch (error) {
    return { step: "1. Create Test Users", success: false, error: (error as Error).message };
  }
}

async function step2_CreateStripeCustomer(): Promise<TestResult> {
  try {
    logger.info("step2_creating_stripe_customer");

    const customer = await stripe.customers.create({
      email: `${TEST_CLIENT_ID}@test.com`,
      metadata: {
        userId: TEST_CLIENT_ID,
        test: "true",
      },
    });

    // Store Stripe customer ID
    await query(
      `INSERT INTO stripe_customers (user_id, stripe_customer_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
      [TEST_CLIENT_ID, customer.id]
    );

    logger.info("step2_customer_created", { customerId: customer.id });

    return { step: "2. Create Stripe Customer", success: true, data: { customerId: customer.id } };
  } catch (error) {
    return { step: "2. Create Stripe Customer", success: false, error: (error as Error).message };
  }
}

async function step3_CreatePaymentIntent(): Promise<TestResult> {
  try {
    logger.info("step3_creating_payment_intent");

    // Get customer
    const customerResult = await query(
      `SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1`,
      [TEST_CLIENT_ID]
    );

    if (customerResult.rows.length === 0) {
      throw new Error("Stripe customer not found");
    }

    const customerId = customerResult.rows[0].stripe_customer_id;

    // Create payment intent for $10 (1000 cents, or 100 credits at 10 cents per credit)
    const amount = 1000; // $10.00 in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      metadata: {
        userId: TEST_CLIENT_ID,
        purpose: "credit_purchase",
        test: "true",
      },
    });

    logger.info("step3_payment_intent_created", { paymentIntentId: paymentIntent.id });

    return {
      step: "3. Create Payment Intent",
      success: true,
      data: { paymentIntentId: paymentIntent.id, amount },
    };
  } catch (error) {
    return { step: "3. Create Payment Intent", success: false, error: (error as Error).message };
  }
}

async function step4_SimulateWebhookPaymentSucceeded(paymentIntentId: string): Promise<TestResult> {
  try {
    logger.info("step4_simulating_webhook");

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Create mock webhook event
    const mockEvent = {
      id: `evt_test_${Date.now()}`,
      type: "payment_intent.succeeded",
      data: {
        object: paymentIntent,
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: "2024-06-20",
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    // Process webhook
    await handleStripeEvent(mockEvent);

    // Verify credits were added
    const balance = await getUserBalance(TEST_CLIENT_ID);
    const expectedCredits = paymentIntent.amount / env.CENTS_PER_CREDIT; // 1000 cents / 10 = 100 credits

    if (balance < expectedCredits) {
      throw new Error(`Expected ${expectedCredits} credits, got ${balance}`);
    }

    logger.info("step4_webhook_processed", { balance, expectedCredits });

    return {
      step: "4. Simulate Webhook (Payment Succeeded)",
      success: true,
      data: { balance, expectedCredits },
    };
  } catch (error) {
    return {
      step: "4. Simulate Webhook (Payment Succeeded)",
      success: false,
      error: (error as Error).message,
    };
  }
}

async function step5_CreateJob(): Promise<TestResult> {
  try {
    logger.info("step5_creating_job");

    const scheduledStart = new Date();
    scheduledStart.setHours(scheduledStart.getHours() + 2);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + 2);

    const job = await createJob({
      clientId: TEST_CLIENT_ID,
      scheduledStartAt: scheduledStart.toISOString(),
      scheduledEndAt: scheduledEnd.toISOString(),
      address: "123 Test Street, Test City, TC 12345",
      creditAmount: 50, // 50 credits = $5.00
    });

    logger.info("step5_job_created", { jobId: job.id });

    return { step: "5. Create Job", success: true, data: { jobId: job.id } };
  } catch (error) {
    return { step: "5. Create Job", success: false, error: (error as Error).message };
  }
}

async function step6_CompleteJob(jobId: string): Promise<TestResult> {
  try {
    logger.info("step6_completing_job");

    // Update job to awaiting_approval
    await query(
      `UPDATE jobs SET status = 'awaiting_approval', cleaner_id = $2 WHERE id = $1`,
      [jobId, TEST_CLEANER_ID]
    );

    // Approve job (atomic: updates status, releases credits, records earnings)
    await approveJob(jobId, TEST_CLIENT_ID, 5);

    // Verify job status
    const jobResult = await query(`SELECT status FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows[0].status !== "completed") {
      throw new Error(`Job status should be 'completed', got '${jobResult.rows[0].status}'`);
    }

    // Verify cleaner has credits
    const cleanerBalance = await getUserBalance(TEST_CLEANER_ID);
    if (cleanerBalance < 50) {
      throw new Error(`Cleaner should have at least 50 credits, got ${cleanerBalance}`);
    }

    logger.info("step6_job_completed", { jobId, cleanerBalance });

    return { step: "6. Complete Job", success: true, data: { jobId, cleanerBalance } };
  } catch (error) {
    return { step: "6. Complete Job", success: false, error: (error as Error).message };
  }
}

async function step7_VerifyIdempotency(paymentIntentId: string): Promise<TestResult> {
  try {
    logger.info("step7_verifying_idempotency");

    // Get payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Create duplicate webhook event
    const mockEvent = {
      id: `evt_test_${Date.now()}_duplicate`,
      type: "payment_intent.succeeded",
      data: {
        object: paymentIntent,
      },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      api_version: "2024-06-20",
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    const balanceBefore = await getUserBalance(TEST_CLIENT_ID);

    // Process duplicate webhook (should be idempotent)
    await handleStripeEvent(mockEvent);

    const balanceAfter = await getUserBalance(TEST_CLIENT_ID);

    // Balance should not increase (idempotent)
    if (balanceAfter > balanceBefore) {
      throw new Error(`Webhook was not idempotent: balance increased from ${balanceBefore} to ${balanceAfter}`);
    }

    logger.info("step7_idempotency_verified", { balanceBefore, balanceAfter });

    return {
      step: "7. Verify Webhook Idempotency",
      success: true,
      data: { balanceBefore, balanceAfter },
    };
  } catch (error) {
    return {
      step: "7. Verify Webhook Idempotency",
      success: false,
      error: (error as Error).message,
    };
  }
}

async function cleanup(): Promise<void> {
  logger.info("cleanup_starting");

  try {
    // Delete test data
    await query(`DELETE FROM credit_ledger WHERE user_id IN ($1, $2)`, [TEST_CLIENT_ID, TEST_CLEANER_ID]);
    await query(`DELETE FROM jobs WHERE client_id = $1 OR cleaner_id = $2`, [TEST_CLIENT_ID, TEST_CLEANER_ID]);
    await query(`DELETE FROM stripe_customers WHERE user_id = $1`, [TEST_CLIENT_ID]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [TEST_CLIENT_ID, TEST_CLEANER_ID]);

    logger.info("cleanup_complete");
  } catch (error) {
    logger.error("cleanup_failed", { error: (error as Error).message });
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("V1 HARDENING: Stripe End-to-End Test");
  console.log("=".repeat(60));
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Stripe Mode: ${env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "TEST"}`);
  console.log(`Credits Enabled: ${env.CREDITS_ENABLED}`);
  console.log(`Payouts Enabled: ${env.PAYOUTS_ENABLED}`);
  console.log("=".repeat(60));
  console.log();

  if (env.NODE_ENV === "production") {
    console.error("❌ ERROR: This test should not run in production!");
    process.exit(1);
  }

  const results: TestResult[] = [];
  let paymentIntentId: string | undefined;
  let jobId: string | undefined;

  try {
    // Step 1: Create test users
    const result1 = await step1_CreateTestUsers();
    results.push(result1);
    if (!result1.success) throw new Error(result1.error);

    // Step 2: Create Stripe customer
    const result2 = await step2_CreateStripeCustomer();
    results.push(result2);
    if (!result2.success) throw new Error(result2.error);

    // Step 3: Create payment intent
    const result3 = await step3_CreatePaymentIntent();
    results.push(result3);
    if (!result3.success) throw new Error(result3.error);
    paymentIntentId = result3.data?.paymentIntentId;

    // Step 4: Simulate webhook
    if (paymentIntentId) {
      const result4 = await step4_SimulateWebhookPaymentSucceeded(paymentIntentId);
      results.push(result4);
      if (!result4.success) throw new Error(result4.error);
    }

    // Step 5: Create job
    const result5 = await step5_CreateJob();
    results.push(result5);
    if (!result5.success) throw new Error(result5.error);
    jobId = result5.data?.jobId;

    // Step 6: Complete job
    if (jobId) {
      const result6 = await step6_CompleteJob(jobId);
      results.push(result6);
      if (!result6.success) throw new Error(result6.error);
    }

    // Step 7: Verify idempotency
    if (paymentIntentId) {
      const result7 = await step7_VerifyIdempotency(paymentIntentId);
      results.push(result7);
      // Idempotency failure is a warning, not fatal
    }
  } catch (error) {
    logger.error("test_failed", { error: (error as Error).message });
  } finally {
    // Cleanup
    await cleanup();
  }

  // Summary
  console.log("=".repeat(60));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(60));

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    console.log(`${icon} ${result.step}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  });

  console.log("=".repeat(60));

  const failed = results.filter((r) => !r.success).length;
  if (failed > 0) {
    console.log(`❌ ${failed} step(s) failed`);
    process.exit(1);
  } else {
    console.log("✅ All steps passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  logger.error("stripe_e2e_main_failed", { error: (error as Error).message });
  console.error("Fatal error:", error);
  process.exit(1);
});

