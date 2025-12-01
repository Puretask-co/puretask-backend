// src/tests/smoke/credits.test.ts
// Credits routes smoke tests

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../index";

describe("Credits Smoke Tests", () => {
  it("GET /credits/packages should return packages (no auth required)", async () => {
    const res = await request(app)
      .get("/credits/packages")
      .set("x-user-id", "test-user")
      .set("x-user-role", "client");

    expect(res.status).toBe(200);
    expect(res.body.packages).toBeDefined();
    expect(Array.isArray(res.body.packages)).toBe(true);
  });

  it("GET /credits/balance should require auth", async () => {
    const res = await request(app).get("/credits/balance");

    expect(res.status).toBe(401);
  });

  it("POST /credits/checkout should require auth", async () => {
    const res = await request(app)
      .post("/credits/checkout")
      .send({});

    expect(res.status).toBe(401);
  });
});

