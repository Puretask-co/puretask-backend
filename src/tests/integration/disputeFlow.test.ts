// src/tests/integration/disputeFlow.test.ts
// Dispute flow integration tests

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { query } from "../../db/client";
import {
  createTestClient,
  createTestCleaner,
  createTestAdmin,
  addCreditsToUser,
  cleanupTestData,
  transitionJobTo,
  TestUser,
} from "../helpers/testUtils";

describe("Dispute Flow Integration", () => {
  let client: TestUser;
  let cleaner: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    client = await createTestClient();
    cleaner = await createTestCleaner();
    admin = await createTestAdmin();

    // Add credits for job creation
    await addCreditsToUser(client.id, 500);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("opens a dispute and resolves it with a refund", async () => {
    // 1. Client creates job
    const jobRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        address: "456 Dispute St",
        credit_amount: 75,
        estimated_hours: 2,
      });

    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.data?.job?.id ?? jobRes.body.job?.id;
    expect(jobId).toBeDefined();

    // 2. Fast-forward: assign cleaner and move to awaiting_approval
    await transitionJobTo(jobId, "awaiting_approval", cleaner.id);

    // 3. Client disputes via endpoint
    const disputeRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        event_type: "client_disputed",
        payload: {
          dispute_reason: "quality",
          dispute_details: "Not satisfied with the cleaning",
        },
      });

    expect(disputeRes.status).toBe(200);
    const disputedJob = disputeRes.body.data?.job ?? disputeRes.body.job;
    expect(disputedJob?.status).toBe("disputed");

    // 4. Verify dispute record created
    const disputes = await query<{ id: string; status: string; client_notes: string }>(
      `SELECT id, status, client_notes FROM disputes WHERE job_id = $1`,
      [jobId]
    );
    expect(disputes.rows.length).toBe(1);
    const disputeRow = disputes.rows[0];
    expect(disputeRow).toBeDefined();
    expect(disputeRow!.status).toBe("open");
    const disputeId = disputeRow!.id;

    // 5. Admin resolves dispute with refund
    const resolveRes = await request(app)
      .post(`/admin/disputes/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        resolution: "resolved_refund",
        admin_notes: "Refund approved after review",
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.dispute?.status).toBe("resolved_refund");

    // 6. Verify refund in credit_ledger (delta_credits positive for refund)
    const ledgerRows = await query<{ delta_credits: number; reason: string }>(
      `
        SELECT delta_credits, reason
        FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'
      `,
      [client.id, jobId]
    );

    expect(ledgerRows.rows.length).toBe(1);
    expect(ledgerRows.rows[0].delta_credits).toBe(75);
    expect(ledgerRows.rows[0].reason).toBe("refund");
  });

  it("resolves dispute without refund", async () => {
    // 1. Create and setup job
    const jobRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        address: "789 No Refund St",
        credit_amount: 60,
        estimated_hours: 2,
      });

    const jobId = jobRes.body.data?.job?.id ?? jobRes.body.job?.id;
    expect(jobId).toBeDefined();
    await transitionJobTo(jobId, "awaiting_approval", cleaner.id);

    // 2. Open dispute
    await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        event_type: "client_disputed",
        payload: {
          dispute_reason: "quality",
          dispute_details: "Minor issue",
        },
      });

    const disputes = await query<{ id: string }>(`SELECT id FROM disputes WHERE job_id = $1`, [
      jobId,
    ]);
    expect(disputes.rows.length).toBeGreaterThanOrEqual(1);
    const disputeId = disputes.rows[0]!.id;

    // 3. Resolve without refund
    const resolveRes = await request(app)
      .post(`/admin/disputes/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        resolution: "resolved_no_refund",
        admin_notes: "Work was satisfactory upon review",
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.dispute?.status).toBe("resolved_no_refund");

    // 4. Verify NO refund entry
    const refundRows = await query<{ id: string }>(
      `
        SELECT id FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'
      `,
      [client.id, jobId]
    );

    expect(refundRows.rows.length).toBe(0);
  });

  it("prevents non-clients from disputing", async () => {
    // Create job
    const jobRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        address: "111 Forbidden St",
        credit_amount: 40,
        estimated_hours: 2,
      });

    const jobId = jobRes.body.data?.job?.id ?? jobRes.body.job?.id;
    expect(jobId).toBeDefined();
    await transitionJobTo(jobId, "awaiting_approval", cleaner.id);

    // Cleaner tries to dispute
    const disputeRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({
        event_type: "client_disputed",
        payload: {
          dispute_reason: "quality",
          dispute_details: "Cleaner trying to dispute",
        },
      });

    // Cleaner disputing: backend may return 403 Forbidden or 400 Bad Request
    expect([400, 403]).toContain(disputeRes.status);
  });

  it("prevents non-admin from resolving disputes", async () => {
    // Create and dispute job
    const jobRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        address: "222 Admin Only St",
        credit_amount: 50,
        estimated_hours: 2,
      });

    const jobId = jobRes.body.data?.job?.id ?? jobRes.body.job?.id;
    expect(jobId).toBeDefined();
    await transitionJobTo(jobId, "awaiting_approval", cleaner.id);

    await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        event_type: "client_disputed",
        payload: {
          dispute_reason: "quality",
          dispute_details: "Issue",
        },
      });

    const disputes = await query<{ id: string }>(`SELECT id FROM disputes WHERE job_id = $1`, [
      jobId,
    ]);
    expect(disputes.rows.length).toBeGreaterThanOrEqual(1);
    const disputeId = disputes.rows[0]!.id;

    // Client tries to resolve
    const resolveRes = await request(app)
      .post(`/admin/disputes/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        resolution: "resolved_refund",
        admin_notes: "Self-refund attempt",
      });

    expect(resolveRes.status).toBe(403);
  });
});
