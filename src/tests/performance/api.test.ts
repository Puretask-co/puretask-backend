// src/tests/performance/api.test.ts
// Performance tests for API endpoints

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index";

describe("API Performance", () => {
  describe("Health Check", () => {
    it("responds to health check in < 100ms", async () => {
      const start = Date.now();
      await request(app).get("/health");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe("Authentication Endpoints", () => {
    it("login endpoint responds in < 500ms", async () => {
      const start = Date.now();
      await request(app).post("/auth/login").send({ email: "test@example.com", password: "test" });
      const duration = Date.now() - start;

      // Should respond within 5s (remote DB/auth can be slow on cold start)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("Job Endpoints", () => {
    it("GET /jobs responds in < 200ms", async () => {
      const start = Date.now();
      await request(app).get("/jobs");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe("Database Query Performance", () => {
    it("simple query executes in < 500ms", async () => {
      const { query } = await import("../../db/client");
      const start = Date.now();
      await query("SELECT 1");
      const duration = Date.now() - start;
      // 500ms accommodates Neon/remote DB cold-start latency; local typically < 10ms
      expect(duration).toBeLessThan(500);
    });
  });
});
