// src/tests/smoke/health.test.ts
// Smoke tests for health endpoint

import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../../index";

describe("Health Endpoint", () => {
  it("GET /health should return ok status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("ok", true);
    expect(response.body).toHaveProperty("service", "puretask-backend");
    expect(response.body).toHaveProperty("time");
  });
});

