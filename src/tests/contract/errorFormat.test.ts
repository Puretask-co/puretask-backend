/**
 * Section 7: Contract tests - error format, status codes
 * Ensures API errors conform to canonical shape
 */

import request from "supertest";
import app from "../../index";

describe("API Error Format Contract", () => {
  it("404 returns canonical error shape", async () => {
    const res = await request(app).get("/api/v1/nonexistent-route-xyz");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
    if (res.body.requestId) {
      expect(typeof res.body.requestId).toBe("string");
    }
  });

  it("401 on protected route without token has canonical shape", async () => {
    const res = await request(app).get("/api/v1/jobs");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });

  it("error response does not leak stack trace", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\w+.*\(.*\)/);
  });
});
