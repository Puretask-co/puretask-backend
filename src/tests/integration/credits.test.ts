// src/tests/integration/credits.test.ts
// Credit system integration tests

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { query } from "../../db/client";
import {
  createTestClient,
  createTestCleaner,
  addCreditsToUser,
  getUserBalance,
  cleanupTestData,
  transitionJobTo,
  TestUser,
} from "../helpers/testUtils";
import {
  purchaseCredits,
  getUserCreditBalance,
  adjustCredits,
} from "../../services/creditsService";

describe("Credit System Integration", () => {
  let client: TestUser;
  let cleaner: TestUser;

  beforeAll(async () => {
    client = await createTestClient();
    cleaner = await createTestCleaner();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("Credit purchases", () => {
    it("adds credits via purchaseCredits service", async () => {
      const initialBalance = await getUserCreditBalance(client.id);

      await purchaseCredits({
        userId: client.id,
        creditsAmount: 200,
        paymentIntentId: `pi_test_${Date.now()}`,
      });

      const newBalance = await getUserCreditBalance(client.id);
      expect(newBalance).toBe(initialBalance + 200);
    });

    it("records purchase in credit_ledger", async () => {
      await purchaseCredits({
        userId: client.id,
        creditsAmount: 100,
        paymentIntentId: `pi_test_${Date.now()}`,
      });

      const entries = await query<{ amount: number; direction: string; reason: string }>(
        `
          SELECT amount, direction, reason
          FROM credit_ledger
          WHERE user_id = $1 AND reason = 'purchase'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [client.id]
      );

      expect(entries.rows.length).toBeGreaterThan(0);
      expect(entries.rows[0].amount).toBe(100);
      expect(entries.rows[0].direction).toBe('credit');
    });
  });

  describe("Job escrow", () => {
    it("deducts credits when job is created", async () => {
      // Add credits first
      await addCreditsToUser(client.id, 500);
      const balanceBefore = await getUserCreditBalance(client.id);

      // Create job
      const res = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          address: "Credit Test St",
          credit_amount: 150,
          estimated_hours: 2,
        });

      expect(res.status).toBe(201);

      const balanceAfter = await getUserCreditBalance(client.id);
      expect(balanceAfter).toBe(balanceBefore - 150);

      // Verify escrow entry
      const jobId = res.body.job.id;
      const entries = await query<{ amount: number; direction: string; reason: string }>(
        `SELECT amount, direction, reason FROM credit_ledger WHERE job_id = $1 AND reason = 'job_escrow'`,
        [jobId]
      );
      expect(entries.rows.length).toBe(1);
      expect(entries.rows[0].amount).toBe(150);
      expect(entries.rows[0].direction).toBe('debit');
    });

    it("prevents job creation with insufficient credits", async () => {
      // Ensure client has low balance
      const balance = await getUserCreditBalance(client.id);

      const res = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          address: "No Money St",
          credit_amount: balance + 10000, // More than available
          estimated_hours: 2,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INSUFFICIENT_CREDITS");
    });
  });

  describe("Credit release on completion", () => {
    it("releases credits to cleaner on job approval", async () => {
      await addCreditsToUser(client.id, 300);
      const cleanerBalanceBefore = await getUserCreditBalance(cleaner.id);

      // Create job
      const jobRes = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          address: "Release Test St",
          credit_amount: 100,
          estimated_hours: 2,
        });

      const jobId = jobRes.body.job.id;

      // Fast-forward to awaiting_approval with cleaner assigned
      await transitionJobTo(jobId, "awaiting_approval", cleaner.id);

      // Client approves
      const approveRes = await request(app)
        .post(`/jobs/${jobId}/transition`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({ event_type: "client_approved", payload: { rating: 5 } });

      expect(approveRes.status).toBe(200);

      const cleanerBalanceAfter = await getUserCreditBalance(cleaner.id);
      expect(cleanerBalanceAfter).toBe(cleanerBalanceBefore + 100);

      // Verify release entry
      const entries = await query<{ amount: number; direction: string }>(
        `SELECT amount, direction FROM credit_ledger WHERE user_id = $1 AND job_id = $2 AND reason = 'job_release'`,
        [cleaner.id, jobId]
      );
      expect(entries.rows.length).toBe(1);
      expect(entries.rows[0].amount).toBe(100);
      expect(entries.rows[0].direction).toBe('credit');
    });
  });

  describe("Credit refund on cancellation", () => {
    it("refunds credits when job is cancelled", async () => {
      await addCreditsToUser(client.id, 200);
      const balanceBefore = await getUserCreditBalance(client.id);

      // Create job
      const jobRes = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          address: "Cancel Refund St",
          credit_amount: 80,
          estimated_hours: 2,
        });

      const jobId = jobRes.body.job.id;
      const balanceAfterCreate = await getUserCreditBalance(client.id);
      expect(balanceAfterCreate).toBe(balanceBefore - 80);

      // Cancel job
      const cancelRes = await request(app)
        .post(`/jobs/${jobId}/transition`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({ event_type: "job_cancelled" });

      expect(cancelRes.status).toBe(200);

      const balanceAfterCancel = await getUserCreditBalance(client.id);
      expect(balanceAfterCancel).toBe(balanceBefore); // Full refund

      // Verify refund entry
      const entries = await query<{ amount: number; direction: string }>(
        `SELECT amount, direction FROM credit_ledger WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'`,
        [client.id, jobId]
      );
      expect(entries.rows.length).toBe(1);
      expect(entries.rows[0].amount).toBe(80);
      expect(entries.rows[0].direction).toBe('credit');
    });
  });

  describe("Admin adjustments", () => {
    it("allows admin to adjust credits", async () => {
      const balanceBefore = await getUserCreditBalance(client.id);

      await adjustCredits({
        userId: client.id,
        amount: 50,
        reason: "Courtesy credit",
        adminId: "admin-123",
      });

      const balanceAfter = await getUserCreditBalance(client.id);
      expect(balanceAfter).toBe(balanceBefore + 50);
    });

    it("allows negative adjustments", async () => {
      await addCreditsToUser(client.id, 100); // Ensure sufficient balance
      const balanceBefore = await getUserCreditBalance(client.id);

      await adjustCredits({
        userId: client.id,
        amount: -30,
        reason: "Penalty",
        adminId: "admin-123",
      });

      const balanceAfter = await getUserCreditBalance(client.id);
      expect(balanceAfter).toBe(balanceBefore - 30);
    });
  });
});
