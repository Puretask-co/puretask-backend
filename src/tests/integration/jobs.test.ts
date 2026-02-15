// src/tests/integration/jobs.test.ts
// Integration tests for job creation and management

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";

describe("Jobs Integration Tests", () => {
  let clientToken: string;
  let cleanerToken: string;
  let clientId: string;
  let cleanerId: string;

  beforeAll(async () => {
    // Create test client
    const clientEmail = `client-${Date.now()}@example.com`;
    const clientRes = await request(app).post("/auth/register").send({
      email: clientEmail,
      password: "TestPassword123!",
      role: "client",
    });
    clientToken = clientRes.body.token;
    clientId = clientRes.body.user.id;

    // Create test cleaner
    const cleanerEmail = `cleaner-${Date.now()}@example.com`;
    const cleanerRes = await request(app).post("/auth/register").send({
      email: cleanerEmail,
      password: "TestPassword123!",
      role: "cleaner",
    });
    cleanerToken = cleanerRes.body.token;
    cleanerId = cleanerRes.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await query("DELETE FROM jobs WHERE client_id = $1 OR cleaner_id = $1", [clientId]);
    await query("DELETE FROM users WHERE id IN ($1, $2)", [clientId, cleanerId]);
  });

  describe("POST /jobs", () => {
    it("should create a job as client", async () => {
      const jobData = {
        scheduled_start_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        scheduled_end_at: new Date(Date.now() + 86400000 + 7200000).toISOString(), // +2 hours
        address: "123 Test St, Test City, TS 12345",
        credit_amount: 100, // $10
        client_notes: "Test job",
      };

      const response = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${clientToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty("job");
      expect(response.body.job.address).toBe(jobData.address);
      expect(response.body.job.credit_amount).toBe(jobData.credit_amount);
    });

    it("should reject job creation without authentication", async () => {
      const response = await request(app)
        .post("/jobs")
        .send({
          scheduled_start_at: new Date().toISOString(),
          address: "123 Test St",
          credit_amount: 100,
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should reject job with invalid data", async () => {
      const response = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({
          address: "123 Test St",
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /jobs", () => {
    it("should list jobs for client", async () => {
      const response = await request(app)
        .get("/jobs")
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("jobs");
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });

    it("should list available jobs for cleaner", async () => {
      const response = await request(app)
        .get("/jobs/available")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("jobs");
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });
  });
});
