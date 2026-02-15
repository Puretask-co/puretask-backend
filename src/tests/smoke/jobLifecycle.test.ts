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
    // Wait a bit for database connection to be ready (setup.ts may still be retrying)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create test users with retry logic for database connection issues
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        client = await createTestClient();
        cleaner = await createTestCleaner();
        return; // Success, exit retry loop
      } catch (error: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            `Failed to create test users after ${maxAttempts} attempts: ${error.message}`
          );
        }
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempts - 1)));
      }
    }
  }, 120000); // 120 second timeout for user creation with retries (increased from 90s)

  beforeEach(async () => {
    // Verify users still exist, recreate if needed (test isolation)
    const { query } = await import("../../db/client");
    const clientCheck = await query(`SELECT id FROM users WHERE id = $1`, [client.id]);
    const cleanerCheck = await query(`SELECT id FROM users WHERE id = $1`, [cleaner.id]);

    // Recreate users if they were deleted (test isolation issue)
    if (clientCheck.rows.length === 0) {
      console.warn(`Test client user ${client.id} was deleted, recreating...`);
      client = await createTestClient();
    }
    if (cleanerCheck.rows.length === 0) {
      console.warn(`Test cleaner user ${cleaner.id} was deleted, recreating...`);
      cleaner = await createTestCleaner();
    }

    // Add credits to client for each test to ensure test isolation
    // Credits are consumed during job creation, so we need fresh credits for each test
    // Use the current client.id (which may have been updated if user was recreated)
    try {
      await addCreditsToUser(client.id, 500);
    } catch (error: any) {
      // If adding credits fails, log and rethrow with context
      console.error(`Failed to add credits to user ${client.id}:`, error.message);
      throw new Error(`Cannot add credits to test client: ${error.message}`);
    }
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } catch (error) {
      // Log but don't fail test - cleanup errors shouldn't break test suite
      console.warn("Cleanup failed (non-critical):", error);
    }
  });

  it("runs through the happy path: requested → accepted → on_my_way → in_progress → awaiting_approval → completed", async () => {
    // 1. Client creates job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        address: "123 Happy Path St",
        credit_amount: 100,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data?.job).toBeDefined();
    const jobId = createRes.body.data.job.id;
    expect(jobId).toBeTruthy();
    expect(createRes.body.data.job.status).toBe("requested");

    // 2. Cleaner accepts job
    const acceptRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_accepted" });

    expect(acceptRes.status).toBe(200);
    expect((acceptRes.body.data?.job ?? acceptRes.body.job)?.status).toBe("accepted");
    expect((acceptRes.body.data?.job ?? acceptRes.body.job)?.cleaner_id).toBe(cleaner.id);

    // 3. Cleaner marks on_my_way
    const omwRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "cleaner_on_my_way" });

    expect(omwRes.status).toBe(200);
    expect((omwRes.body.data?.job ?? omwRes.body.job)?.status).toBe("on_my_way");

    // 4. Cleaner starts job (check in)
    const startRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({
        event_type: "job_started",
        payload: { latitude: 37.7749, longitude: -122.4194 },
      });

    expect(startRes.status).toBe(200);
    expect((startRes.body.data?.job ?? startRes.body.job)?.status).toBe("in_progress");
    expect((startRes.body.data?.job ?? startRes.body.job)?.actual_start_at).toBeTruthy();

    // 5. Cleaner completes job (check out)
    const completeRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_completed" });

    expect(completeRes.status).toBe(200);
    expect((completeRes.body.data?.job ?? completeRes.body.job)?.status).toBe("awaiting_approval");
    expect((completeRes.body.data?.job ?? completeRes.body.job)?.actual_end_at).toBeTruthy();

    // 6. Client approves job with rating
    const approveRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        event_type: "client_approved",
        payload: { rating: 5 },
      });

    expect(approveRes.status).toBe(200);
    expect((approveRes.body.data?.job ?? approveRes.body.job)?.status).toBe("completed");
    expect((approveRes.body.data?.job ?? approveRes.body.job)?.rating).toBe(5);
  });

  it("allows client to cancel a requested job", async () => {
    // Create job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        address: "456 Cancel St",
        credit_amount: 50,
      });

    expect(createRes.status).toBe(201);
    const jobId = createRes.body.data?.job?.id ?? createRes.body.job?.id;

    // Cancel job
    const cancelRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ event_type: "job_cancelled" });

    expect(cancelRes.status).toBe(200);
    expect((cancelRes.body.data?.job ?? cancelRes.body.job)?.status).toBe("cancelled");
  });

  it("prevents invalid state transitions", async () => {
    // Create job
    const createRes = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
        scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        address: "789 Invalid St",
        credit_amount: 50,
      });

    const jobId = createRes.body.data?.job?.id ?? createRes.body.job?.id;

    // Try to complete without accepting first
    const invalidRes = await request(app)
      .post(`/jobs/${jobId}/transition`)
      .set("Authorization", `Bearer ${cleaner.token}`)
      .send({ event_type: "job_completed" });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error?.code).toBe("BAD_TRANSITION");
  });
});
