// src/tests/smoke/jobs.test.ts
// Smoke tests for jobs endpoints

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { createTestClient, createTestAdmin, type TestUser } from "../helpers/testUtils";

describe("Jobs API - Smoke Tests", () => {
  let client: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    client = await createTestClient();
    admin = await createTestAdmin();
  });

  const clientAuth = () => ({ Authorization: `Bearer ${client.token}` });
  const adminAuth = () => ({ Authorization: `Bearer ${admin.token}` });
  describe("Authentication", () => {
    it("should return 401 without auth headers", async () => {
      const response = await request(app).get("/jobs");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "UNAUTHENTICATED");
    });

    it("should return 200 with valid auth headers", async () => {
      const response = await request(app).get("/jobs").set(clientAuth());

      expect(response.status).toBe(200);
      expect(response.body.data?.jobs ?? response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.data?.jobs ?? response.body.jobs)).toBe(true);
    });
  });

  describe("GET /jobs", () => {
    it("should return jobs list for authenticated client", async () => {
      const response = await request(app).get("/jobs").set(clientAuth());

      expect(response.status).toBe(200);
      expect(response.body.data?.jobs ?? response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.data?.jobs ?? response.body.jobs)).toBe(true);
    });
  });

  describe("POST /jobs", () => {
    it("should require cleaning_type", async () => {
      const response = await request(app).post("/jobs").set(clientAuth()).send({
        scheduled_start_at: new Date().toISOString(),
        estimated_hours: 2,
        base_rate_cph: 25,
        total_rate_cph: 25,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should require estimated_hours", async () => {
      const response = await request(app).post("/jobs").set(clientAuth()).send({
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
  let client: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    client = await createTestClient();
    admin = await createTestAdmin();
  });

  const clientAuth = () => ({ Authorization: `Bearer ${client.token}` });
  const adminAuth = () => ({ Authorization: `Bearer ${admin.token}` });

  describe("GET /admin/jobs", () => {
    it("should return 403 for non-admin users", async () => {
      const response = await request(app).get("/admin/jobs").set(clientAuth());

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should return jobs for admin users", async () => {
      const response = await request(app).get("/admin/jobs").set(adminAuth());

      expect(response.status).toBe(200);
      expect(response.body.jobs ?? response.body.data?.jobs).toBeDefined();
    });
  });

  describe("GET /admin/kpis", () => {
    it("should return 403 for non-admin users", async () => {
      const response = await request(app).get("/admin/kpis").set(clientAuth());

      expect(response.status).toBe(403);
    });

    it("should return KPIs for admin users", async () => {
      const response = await request(app).get("/admin/kpis").set(adminAuth());

      expect(response.status).toBe(200);
      const kpis = response.body.kpis ?? response.body.data?.kpis;
      expect(kpis).toBeDefined();
      expect(kpis).toHaveProperty("totalJobs");
      expect(kpis).toHaveProperty("activeJobs");
      expect(kpis).toHaveProperty("completedJobs");
    });
  });
});
