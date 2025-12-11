// src/tests/smoke/jobs.test.ts
// Smoke tests for jobs endpoints

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../index";

// Test user headers
const clientHeaders = {
  "x-user-id": "11111111-1111-1111-1111-111111111111",
  "x-user-role": "client",
};

const adminHeaders = {
  "x-user-id": "00000000-0000-0000-0000-000000000000",
  "x-user-role": "admin",
};

describe("Jobs API - Smoke Tests", () => {
  describe("Authentication", () => {
    it("should return 401 without auth headers", async () => {
      const response = await request(app).get("/jobs");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "UNAUTHENTICATED");
    });

    it("should return 200 with valid auth headers", async () => {
      const response = await request(app)
        .get("/jobs")
        .set(clientHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("jobs");
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });
  });

  describe("GET /jobs", () => {
    it("should return jobs list for authenticated client", async () => {
      const response = await request(app)
        .get("/jobs")
        .set(clientHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("jobs");
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });
  });

  describe("POST /jobs", () => {
    it("should require cleaning_type", async () => {
      const response = await request(app)
        .post("/jobs")
        .set(clientHeaders)
        .send({
          scheduled_start_at: new Date().toISOString(),
          estimated_hours: 2,
          base_rate_cph: 25,
          total_rate_cph: 25,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should require estimated_hours", async () => {
      const response = await request(app)
        .post("/jobs")
        .set(clientHeaders)
        .send({
          cleaning_type: "basic",
          scheduled_start_at: new Date().toISOString(),
          base_rate_cph: 25,
          total_rate_cph: 25,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });
});

describe("Admin Jobs API - Smoke Tests", () => {
  describe("GET /admin/jobs", () => {
    it("should return 403 for non-admin users", async () => {
      const response = await request(app)
        .get("/admin/jobs")
        .set(clientHeaders);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should return jobs for admin users", async () => {
      const response = await request(app)
        .get("/admin/jobs")
        .set(adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("jobs");
    });
  });

  describe("GET /admin/kpis", () => {
    it("should return 403 for non-admin users", async () => {
      const response = await request(app)
        .get("/admin/kpis")
        .set(clientHeaders);

      expect(response.status).toBe(403);
    });

    it("should return KPIs for admin users", async () => {
      const response = await request(app)
        .get("/admin/kpis")
        .set(adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("kpis");
      expect(response.body.kpis).toHaveProperty("totalJobs");
      expect(response.body.kpis).toHaveProperty("activeJobs");
      expect(response.body.kpis).toHaveProperty("completedJobs");
    });
  });
});

