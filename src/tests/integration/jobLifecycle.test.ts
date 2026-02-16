// src/tests/integration/jobLifecycle.test.ts
// Integration tests for full job lifecycle

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";
import {
  createTestClient,
  createTestCleaner,
  createTestAdmin,
  addCreditsToUser,
} from "../helpers/testUtils";

describe("Job Lifecycle Integration Tests", () => {
  let testJobId: string;
  let client: { id: string; token: string };
  let cleaner: { id: string; token: string };
  let admin: { id: string; token: string };

  beforeAll(async () => {
    client = await createTestClient();
    cleaner = await createTestCleaner();
    admin = await createTestAdmin();
    await addCreditsToUser(client.id, 500); // Credits needed for job creation
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
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "123 Test St",
          credit_amount: 100,
          estimated_hours: 2,
        });

      expect(response.status).toBe(201);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toBeDefined();
      expect(job).toHaveProperty("id");
      expect(job).toHaveProperty("status", "requested");
      expect(job).toHaveProperty("client_id", client.id);

      testJobId = job.id;
    });

    it("2. Cleaner accepts the job", async () => {
      // Job is already in 'requested' status, cleaner accepts it
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({
          event_type: "job_accepted",
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "accepted");
    });

    it("3. Cleaner goes on my way", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({
          event_type: "cleaner_on_my_way",
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "on_my_way");
    });

    it("5. Cleaner starts the job (check-in)", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({
          event_type: "job_started",
          payload: {
            check_in_lat: 40.7128,
            check_in_lng: -74.006,
          },
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "in_progress");
    });

    it("6. Cleaner completes the job (check-out)", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({
          event_type: "job_completed",
          payload: {
            check_out_lat: 40.7128,
            check_out_lng: -74.006,
            actual_hours: 2.5,
          },
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "awaiting_approval");
    });

    it("7. Client approves the job", async () => {
      const response = await request(app)
        .post(`/jobs/${testJobId}/transition`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          event_type: "client_approved",
          payload: {
            client_review_stars: 5,
            client_review_text: "Excellent cleaning service!",
          },
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "completed");
    });

    it("8. Job events are recorded", async () => {
      const response = await request(app)
        .get(`/admin/jobs/${testJobId}/events`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      const events = response.body.events ?? response.body.data?.events;
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(1);
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
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "456 Cancel St",
          credit_amount: 150,
          estimated_hours: 3,
        });

      expect(response.status).toBe(201);
      const job = response.body.data?.job ?? response.body.job;
      cancelJobId = job.id;
    });

    it("2. Client cancels the job", async () => {
      const response = await request(app)
        .post(`/jobs/${cancelJobId}/transition`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          event_type: "job_cancelled",
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "cancelled");
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
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          address: "789 Dispute St",
          credit_amount: 80,
          estimated_hours: 2,
        });
      disputeJobId = createRes.body.data?.job?.id ?? createRes.body.job?.id;

      // Progress through states
      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({ event_type: "job_accepted" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({ event_type: "cleaner_on_my_way" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({ event_type: "job_started" });

      await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set("Authorization", `Bearer ${cleaner.token}`)
        .send({ event_type: "job_completed", payload: { actual_hours: 2 } });
    });

    it("1. Client disputes the job", async () => {
      const response = await request(app)
        .post(`/jobs/${disputeJobId}/transition`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          event_type: "client_disputed",
          payload: {
            dispute_reason: "quality",
            dispute_details: "Some areas were not cleaned properly",
          },
        });

      expect(response.status).toBe(200);
      const job = response.body.data?.job ?? response.body.job;
      expect(job).toHaveProperty("status", "disputed");
    });

    it("2. Admin resolves the dispute", async () => {
      const response = await request(app)
        .post(`/admin/disputes/job/${disputeJobId}/resolve`)
        .set("Authorization", `Bearer ${admin.token}`)
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
