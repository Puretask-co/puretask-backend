// src/tests/integration/v3Features.test.ts
// V3 FEATURES: Tests for Tier-Aware Pricing, Subscriptions, Earnings Dashboard

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";
import {
  createTestClient,
  createTestCleaner,
  cleanupTestData,
  TestUser,
} from "../helpers/testUtils";

describe("V3 Features Integration Tests", () => {
  let client: TestUser;
  let cleaner: TestUser;
  let subscriptionId: number;

  beforeAll(async () => {
    // Create test users
    client = await createTestClient();
    cleaner = await createTestCleaner();
  });

  afterAll(async () => {
    // Cleanup test data
    if (subscriptionId) {
      await query(`DELETE FROM cleaning_subscriptions WHERE id = $1`, [subscriptionId]);
    }
    await cleanupTestData();
  });

  describe("Tier-Aware Pricing", () => {
    it("should get pricing estimate for all tiers", async () => {
      const res = await request(app)
        .get("/pricing/estimate?hours=3")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(200);
      expect(res.body.estimate).toBeDefined();
      expect(res.body.estimate.minPrice).toBeDefined();
      expect(res.body.estimate.maxPrice).toBeDefined();
      expect(res.body.estimate.breakdown).toBeDefined();
      expect(res.body.estimate.breakdown.bronze).toBeDefined();
      expect(res.body.estimate.breakdown.silver).toBeDefined();
      expect(res.body.estimate.breakdown.gold).toBeDefined();
      expect(res.body.estimate.breakdown.platinum).toBeDefined();
    });

    it("should get pricing estimate for specific tier", async () => {
      const res = await request(app)
        .get("/pricing/estimate?hours=3&tier=gold")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("gold");
      expect(res.body.breakdown).toBeDefined();
      expect(res.body.breakdown.totalPrice).toBeGreaterThan(0);
      expect(res.body.breakdown.tierAdjustment).toBeDefined();
      expect(res.body.breakdown.platformFee).toBeDefined();
    });

    it("should get tier price bands", async () => {
      const res = await request(app)
        .get("/pricing/tiers")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(200);
      expect(res.body.priceBands).toBeDefined();
      expect(res.body.priceBands.bronze).toBeDefined();
      expect(res.body.priceBands.silver).toBeDefined();
      expect(res.body.priceBands.gold).toBeDefined();
      expect(res.body.priceBands.platinum).toBeDefined();
    });

    it("should reject invalid tier", async () => {
      const res = await request(app)
        .get("/pricing/estimate?hours=3&tier=invalid")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(400);
    });

    it("should reject missing hours parameter", async () => {
      const res = await request(app)
        .get("/pricing/estimate")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("Subscription Engine", () => {
    it("should create a subscription", async () => {
      const res = await request(app)
        .post("/premium/subscriptions")
        .set("x-user-id", client.id)
        .set("x-user-role", client.role)
        .send({
          frequency: "weekly",
          dayOfWeek: 1, // Monday
          preferredTime: "10:00",
          address: "123 Test Street",
          creditAmount: 100,
        });

      // Subscription creation may return 200 or 201 depending on implementation
      expect([200, 201]).toContain(res.status);
      expect(res.body.subscription).toBeDefined();
      expect(res.body.subscription.frequency).toBe("weekly");
      expect(res.body.subscription.status).toBe("active");
      subscriptionId = res.body.subscription.id;
    });

    it("should get client subscriptions", async () => {
      const res = await request(app)
        .get("/premium/subscriptions")
        .set("x-user-id", client.id)
        .set("x-user-role", client.role);

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toBeDefined();
      expect(Array.isArray(res.body.subscriptions)).toBe(true);
    });

    it("should pause a subscription", async () => {
      if (!subscriptionId) return;

      const res = await request(app)
        .patch(`/premium/subscriptions/${subscriptionId}/status`)
        .set("x-user-id", client.id)
        .set("x-user-role", client.role)
        .send({
          status: "paused",
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe("paused");
    });

    it("should resume a subscription", async () => {
      if (!subscriptionId) return;

      const res = await request(app)
        .patch(`/premium/subscriptions/${subscriptionId}/status`)
        .set("x-user-id", client.id)
        .set("x-user-role", client.role)
        .send({
          status: "active",
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe("active");
    });

    it("should cancel a subscription", async () => {
      if (!subscriptionId) return;

      const res = await request(app)
        .delete(`/premium/subscriptions/${subscriptionId}`)
        .set("x-user-id", client.id)
        .set("x-user-role", client.role);

      expect(res.status).toBe(200);
    });
  });

  describe("Earnings Dashboard", () => {
    it("should get cleaner earnings", async () => {
      const res = await request(app)
        .get("/cleaner/earnings")
        .set("Authorization", `Bearer ${cleaner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.earnings).toBeDefined();
      expect(res.body.earnings.pendingEarnings).toBeDefined();
      expect(res.body.earnings.paidOut).toBeDefined();
      expect(res.body.earnings.nextPayout).toBeDefined();
      expect(res.body.earnings.payoutSchedule).toBeDefined();

      // Check structure
      expect(res.body.earnings.pendingEarnings.credits).toBeGreaterThanOrEqual(0);
      expect(res.body.earnings.pendingEarnings.usd).toBeGreaterThanOrEqual(0);
      expect(res.body.earnings.pendingEarnings.jobs).toBeGreaterThanOrEqual(0);

      expect(res.body.earnings.paidOut.credits).toBeGreaterThanOrEqual(0);
      expect(res.body.earnings.paidOut.usd).toBeGreaterThanOrEqual(0);
      expect(res.body.earnings.paidOut.jobs).toBeGreaterThanOrEqual(0);
    });

    it("should reject non-cleaner access to earnings", async () => {
      const res = await request(app)
        .get("/cleaner/earnings")
        .set("Authorization", `Bearer ${client.token}`);

      expect(res.status).toBe(403);
    });
  });
});

