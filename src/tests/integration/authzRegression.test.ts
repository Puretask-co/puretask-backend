// src/tests/integration/authzRegression.test.ts
// AuthZ regression: unauthenticated → 401; wrong-owner resource → 403 (audit)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";
import {
  createTestClient,
  createTestCleaner,
  addCreditsToUser,
} from "@/tests/helpers/testUtils";

describe("AuthZ regression (ownership matrix)", () => {
  let client: { id: string; token: string };
  let otherCleaner: { id: string; token: string };
  let jobId: string;

  beforeAll(async () => {
    client = await createTestClient();
    otherCleaner = await createTestCleaner();
    await addCreditsToUser(client.id, 500);

    const start = new Date();
    start.setHours(start.getHours() + 3);
    const end = new Date(start);
    end.setHours(end.getHours() + 3);

    const res = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${client.token}`)
      .set("Idempotency-Key", `authz-create-${jobId || Date.now()}`)
      .send({
        scheduled_start_at: start.toISOString(),
        scheduled_end_at: end.toISOString(),
        address: "123 Authz Test St",
        credit_amount: 100,
        estimated_hours: 2,
      });
    expect(res.status).toBe(201);
    jobId = (res.body.data?.job ?? res.body.job).id;

    // Assign job to a different cleaner so otherCleaner is not client and not assignee
    const assigneeCleaner = await createTestCleaner();
    await query(
      `UPDATE jobs SET status = 'accepted', cleaner_id = $1 WHERE id = $2`,
      [assigneeCleaner.id, jobId]
    );
  });

  afterAll(async () => {
    if (jobId) {
      await query("DELETE FROM job_events WHERE job_id = $1", [jobId]);
      await query("DELETE FROM credit_ledger WHERE job_id = $1", [jobId]);
      await query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
  });

  it("returns 401 for protected route without token", async () => {
    const res = await request(app).get(`/jobs/${jobId}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when cleaner accesses job not assigned to them", async () => {
    // Job is owned by client and assigned to assigneeCleaner; otherCleaner is neither
    const res = await request(app)
      .get(`/jobs/${jobId}`)
      .set("Authorization", `Bearer ${otherCleaner.token}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 when client owner accesses job", async () => {
    const res = await request(app)
      .get(`/jobs/${jobId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(res.status).toBe(200);
  });
});
