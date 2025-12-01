// src/tests/smoke/jobLifecycle.test.ts
// Full job lifecycle smoke test

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import {
  createTestClient,
  createTestCleaner,
  addCreditsToUser,
  cleanupTestData,
  TestUser,
} from "../helpers/testUtils";

describe("Job Lifecycle Smoke Test", () => {
  let client: TestUser;
  let cleaner: TestUser;

  beforeAll(async () => {
    // Create test users
    client = await createTestClient();
    cleaner = await createTestCleaner();

    // Add credits to client for job creation
    await addCreditsToUser(client.id, 500);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("runs through the happy path: requested → accepted → on_my_way → in_progress → awaiting_approval → completed", async () => {
    // 1. Client creates job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date().toISOString(),
        scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        address: "123 Happy Path St",
        credit_amount: 100,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.job).toBeDefined();
    const jobId = createRes.body.job.id;
    expect(jobId).toBeTruthy();
    expect(createRes.body.job.status).toBe("requested");

    // 2. Cleaner accepts job
    const acceptRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_accepted" });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.job.status).toBe("accepted");
    expect(acceptRes.body.job.cleaner_id).toBe(cleaner.id);

    // 3. Cleaner marks on_my_way
    const omwRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "cleaner_on_my_way" });

    expect(omwRes.status).toBe(200);
    expect(omwRes.body.job.status).toBe("on_my_way");

    // 4. Cleaner starts job (check in)
    const startRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({
        event_type: "job_started",
        payload: { latitude: 37.7749, longitude: -122.4194 },
      });

    expect(startRes.status).toBe(200);
    expect(startRes.body.job.status).toBe("in_progress");
    expect(startRes.body.job.actual_start_at).toBeTruthy();

    // 5. Cleaner completes job (check out)
    const completeRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_completed" });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.job.status).toBe("awaiting_approval");
    expect(completeRes.body.job.actual_end_at).toBeTruthy();

    // 6. Client approves job with rating
    const approveRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        event_type: "client_approved",
        payload: { rating: 5 },
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.job.status).toBe("completed");
    expect(approveRes.body.job.rating).toBe(5);
  });

  it("allows client to cancel a requested job", async () => {
    // Create job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date().toISOString(),
        scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        address: "456 Cancel St",
        credit_amount: 50,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.job.id;

    // Cancel job
    const cancelRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ event_type: "job_cancelled" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.job.status).toBe("cancelled");
  });

  it("prevents invalid state transitions", async () => {
    // Create job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date().toISOString(),
        scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        address: "789 Invalid St",
        credit_amount: 50,
      });

    const jobId = createRes.body.job.id;

    // Try to complete without accepting first
    const invalidRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_completed" });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe("BAD_TRANSITION");
  });
});

