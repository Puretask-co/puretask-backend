// src/tests/smoke/messages.test.ts
// Messages routes smoke tests

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../index";

describe("Messages Smoke Tests", () => {
  it("GET /messages/unread should require auth", async () => {
    const res = await request(app).get("/messages/unread");

    expect(res.status).toBe(401);
  });

  it("GET /messages/conversations should require auth", async () => {
    const res = await request(app).get("/messages/conversations");

    expect(res.status).toBe(401);
  });

  it("GET /messages/unread should work with auth", async () => {
    const res = await request(app)
      .get("/messages/unread")
      .set("x-user-id", "test-user")
      .set("x-user-role", "client");

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBeDefined();
  });
});

