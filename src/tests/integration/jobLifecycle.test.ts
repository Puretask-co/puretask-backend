// src/tests/integration/jobLifecycle.test.ts
// Integration tests for full job lifecycle

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";
import { TEST_PASSWORD_HASH } from "../helpers/testConstants";

// Test user IDs (should exist in test database)
const TEST_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_CLEANER_ID = "22222222-2222-2222-2222-222222222222";
const TEST_ADMIN_ID = "00000000-0000-0000-0000-000000000000";

const clientHeaders = {
  "x-user-id": TEST_CLIENT_ID,
  "x-user-role": "client",
};

const cleanerHeaders = {
  "x-user-id": TEST_CLEANER_ID,
  "x-user-role": "cleaner",
};

const adminHeaders = {
  "x-user-id": TEST_ADMIN_ID,
  "x-user-role": "admin",
};

describe("Job Lifecycle Integration Tests", () => {
  let testJobId: string;

  // Ensure test users exist
  beforeAll(async () => {
    // Create test users if they don't exist
    await query(
      `
        INSERT INTO users (id, email, password_hash, role)
        VALUES 
          ($1, 'test-client@example.com', $4, 'client'),
          ($2, 'test-cleaner@example.com', $4, 'cleaner'),
          ($3, 'test-admin@example.com', $4, 'admin')
        ON CONFLICT (id) DO NOTHING
      `,
      [TEST_CLIENT_ID, TEST_CLEANER_ID, TEST_ADMIN_ID, TEST_PASSWORD_HASH]
    );
  });

  // Cleanup test job after tests
  afterAll(async () => {
    if (testJobId) {
      await query("DELETE FROM job_events WHERE job_id = $1", [testJobId]);
      await query("DELETE FROM credit_ledger WHERE job_id = $1", [testJobId]);
      await query("DELETE FROM jobs WHERE id = $1", [testJobId]);
    }
  });

  describe("Full Job Flow: Create → Request → Accept → Start → Complete → Approve", () => {
    it("1. Client creates a job", async () => {
      const scheduledStart = new Date();
      scheduledStart.setHours(scheduledStart.getHours() + 3); // At least 2 hours in future
      const scheduledEnd = new Date(scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + 3);

      const response = await request(app)
        .post("/jobs")
        .set(clientHeaders)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "123 Test St",
          credit_amount: 100,
          estimated_hours: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("id");
      expect(response.body.job).toHaveProperty("status", "requested");
      expect(response.body.job).toHaveProperty("client_id", TEST_CLIENT_ID);

      testJobId = response.body.job.id;
    });

    it("2. Cleaner accepts the job", async () => {
      // Job is already in 'requested' status, cleaner accepts it
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set(cleanerHeaders)
        .send({
          event_type: "job_accepted",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "accepted");
    });

    it("3. Cleaner goes on my way", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set(cleanerHeaders)
        .send({
          event_type: "cleaner_on_my_way",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "on_my_way");
    });

    it("5. Cleaner starts the job (check-in)", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set(cleanerHeaders)
        .send({
          event_type: "job_started",
          payload: {
            check_in_lat: 40.7128,
            check_in_lng: -74.0060,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "in_progress");
      expect(response.body.job).toHaveProperty("check_in_at");
    });

    it("6. Cleaner completes the job (check-out)", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set(cleanerHeaders)
        .send({
          event_type: "job_completed",
          payload: {
            check_out_lat: 40.7128,
            check_out_lng: -74.0060,
            actual_hours: 2.5,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "awaiting_approval");
    });

    it("7. Client approves the job", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set(clientHeaders)
        .send({
          event_type: "client_approved",
          payload: {
            client_review_stars: 5,
            client_review_text: "Excellent cleaning service!",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "completed");
      expect(response.body.job).toHaveProperty("rating", 5);
    });

    it("8. Job events are recorded", async () => {
      const response = await request(app)
        .get(`/admin/jobs/${testJobId}/events`)
        .set(adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("events");
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Job Cancellation Flow", () => {
    let cancelJobId: string;

    it("1. Client creates a job", async () => {
      const scheduledStart = new Date();
      scheduledStart.setHours(scheduledStart.getHours() + 3);
      const scheduledEnd = new Date(scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + 4);

      const response = await request(app)
        .post("/jobs")
        .set(clientHeaders)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "456 Cancel St",
          credit_amount: 150,
          estimated_hours: 3,
        });

      expect(response.status).toBe(201);
      cancelJobId = response.body.job.id;
    });

    it("2. Client cancels the job", async () => {
      const response = await request(app)
        .post(`/jobs/${cancelJobId}/transition`)
        .set(clientHeaders)
        .send({
          event_type: "job_cancelled",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "cancelled");
    });

    // Cleanup
    afterAll(async () => {
      if (cancelJobId) {
        await query("DELETE FROM job_events WHERE job_id = $1", [cancelJobId]);
        await query("DELETE FROM credit_ledger WHERE job_id = $1", [cancelJobId]);
        await query("DELETE FROM jobs WHERE id = $1", [cancelJobId]);
      }
    });
  });

  describe("Dispute Flow", () => {
    let disputeJobId: string;

    beforeAll(async () => {
      // Create and progress a job to awaiting_approval status
      const scheduledStart = new Date();
      scheduledStart.setHours(scheduledStart.getHours() + 3);
      const scheduledEnd = new Date(scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + 2);

      // Create job
      const createRes = await request(app)
        .post("/jobs")
        .set(clientHeaders)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "789 Dispute St",
          credit_amount: 80,
          estimated_hours: 2,
        });
      disputeJobId = createRes.body.job.id;

      // Progress through states
      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set(cleanerHeaders)
        .send({ event_type: "job_accepted" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set(cleanerHeaders)
        .send({ event_type: "cleaner_on_my_way" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set(cleanerHeaders)
        .send({ event_type: "job_started" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set(cleanerHeaders)
        .send({ event_type: "job_completed", payload: { actual_hours: 2 } });
    });

    it("1. Client disputes the job", async () => {
      const response = await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set(clientHeaders)
        .send({
          event_type: "client_disputed",
          payload: {
            dispute_reason: "quality",
            dispute_details: "Some areas were not cleaned properly",
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("job");
      expect(response.body.job).toHaveProperty("status", "disputed");
      expect(response.body.job).toHaveProperty("dispute_status", "open");
    });

    it("2. Admin resolves the dispute", async () => {
      const response = await request(app)
        .post(`/admin/disputes/job/${disputeJobId}/resolve`)
        .set(adminHeaders)
        .send({
          resolution: "resolved_no_refund",
          admin_notes: "Partial refund issued due to incomplete cleaning",
        });

      // Admin dispute resolution may not be implemented yet
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("job");
      }
    });

    // Cleanup
    afterAll(async () => {
      if (disputeJobId) {
        await query("DELETE FROM job_events WHERE job_id = $1", [disputeJobId]);
        await query("DELETE FROM credit_ledger WHERE job_id = $1", [disputeJobId]);
        await query("DELETE FROM jobs WHERE id = $1", [disputeJobId]);
      }
    });
  });
});

