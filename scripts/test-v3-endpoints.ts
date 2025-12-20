// scripts/test-v3-endpoints.ts
// Test script for V3 endpoints: Pricing, Subscriptions, Earnings

import request from "supertest";
import app from "../src/index";
import { createTestClient, createTestCleaner, cleanupTestData, TestUser } from "../src/tests/helpers/testUtils";

async function main() {
  console.log("🧪 Testing V3 Endpoints...\n");

  let client: TestUser;
  let cleaner: TestUser;

  try {
    // Setup test users
    console.log("📝 Creating test users...");
    client = await createTestClient();
    cleaner = await createTestCleaner();
    console.log("✅ Test users created\n");

    // ============================================
    // 1. Test Pricing Endpoints
    // ============================================
    console.log("💰 Testing Pricing Endpoints...\n");

    // Test: Get pricing estimate for all tiers
    console.log("  Testing GET /pricing/estimate?hours=3");
    const estimateRes = await request(app)
      .get("/pricing/estimate?hours=3")
      .set("Authorization", `Bearer ${client.token}`);

    if (estimateRes.status === 200) {
      console.log("  ✅ Pricing estimate endpoint working");
      console.log(`     Min Price: $${estimateRes.body.estimate.minPrice}`);
      console.log(`     Max Price: $${estimateRes.body.estimate.maxPrice}`);
    } else {
      console.log(`  ❌ Pricing estimate failed: ${estimateRes.status}`);
      console.log(`     Error: ${JSON.stringify(estimateRes.body)}`);
    }

    // Test: Get pricing for specific tier
    console.log("\n  Testing GET /pricing/estimate?hours=3&tier=gold");
    const goldEstimateRes = await request(app)
      .get("/pricing/estimate?hours=3&tier=gold")
      .set("Authorization", `Bearer ${client.token}`);

    if (goldEstimateRes.status === 200) {
      console.log("  ✅ Gold tier pricing endpoint working");
      console.log(`     Total: $${goldEstimateRes.body.breakdown.totalUsd}`);
    } else {
      console.log(`  ❌ Gold tier pricing failed: ${goldEstimateRes.status}`);
    }

    // Test: Get tier price bands
    console.log("\n  Testing GET /pricing/tiers");
    const tiersRes = await request(app)
      .get("/pricing/tiers")
      .set("Authorization", `Bearer ${client.token}`);

    if (tiersRes.status === 200) {
      console.log("  ✅ Tier price bands endpoint working");
      console.log(`     Tiers: ${Object.keys(tiersRes.body.priceBands).join(", ")}`);
    } else {
      console.log(`  ❌ Tier price bands failed: ${tiersRes.status}`);
    }

    // ============================================
    // 2. Test Subscription Endpoints
    // ============================================
    console.log("\n📅 Testing Subscription Endpoints...\n");

    // Test: Create subscription
    console.log("  Testing POST /premium/subscriptions");
    const createSubRes = await request(app)
      .post("/premium/subscriptions")
      .set("x-user-id", client.id)
      .set("x-user-role", client.role)
      .send({
        frequency: "weekly",
        dayOfWeek: 1,
        preferredTime: "10:00",
        address: "123 Test Street",
        creditAmount: 100,
      });

    let subscriptionId: number | null = null;
    if ([200, 201].includes(createSubRes.status)) {
      console.log("  ✅ Create subscription endpoint working");
      subscriptionId = createSubRes.body.subscription?.id;
      console.log(`     Subscription ID: ${subscriptionId}`);
    } else {
      console.log(`  ❌ Create subscription failed: ${createSubRes.status}`);
      console.log(`     Error: ${JSON.stringify(createSubRes.body)}`);
    }

    // Test: Get subscriptions
    console.log("\n  Testing GET /premium/subscriptions");
    const getSubsRes = await request(app)
      .get("/premium/subscriptions")
      .set("x-user-id", client.id)
      .set("x-user-role", client.role);

    if (getSubsRes.status === 200) {
      console.log("  ✅ Get subscriptions endpoint working");
      console.log(`     Found ${getSubsRes.body.subscriptions?.length || 0} subscriptions`);
    } else {
      console.log(`  ❌ Get subscriptions failed: ${getSubsRes.status}`);
    }

    // Cleanup subscription if created
    if (subscriptionId) {
      await request(app)
        .delete(`/premium/subscriptions/${subscriptionId}`)
        .set("x-user-id", client.id)
        .set("x-user-role", client.role);
    }

    // ============================================
    // 3. Test Earnings Dashboard
    // ============================================
    console.log("\n💵 Testing Earnings Dashboard...\n");

    console.log("  Testing GET /cleaner/earnings");
    const earningsRes = await request(app)
      .get("/cleaner/earnings")
      .set("Authorization", `Bearer ${cleaner.token}`);

    if (earningsRes.status === 200) {
      console.log("  ✅ Earnings dashboard endpoint working");
      const earnings = earningsRes.body.earnings;
      console.log(`     Pending: ${earnings.pendingEarnings.credits} credits ($${earnings.pendingEarnings.usd})`);
      console.log(`     Paid Out: ${earnings.paidOut.credits} credits ($${earnings.paidOut.usd})`);
      console.log(`     Next Payout: ${earnings.nextPayout.date}`);
    } else {
      console.log(`  ❌ Earnings dashboard failed: ${earningsRes.status}`);
      console.log(`     Error: ${JSON.stringify(earningsRes.body)}`);
    }

    // ============================================
    // Summary
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("✅ V3 Endpoint Testing Complete!");
    console.log("=".repeat(50) + "\n");

  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    await cleanupTestData();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

