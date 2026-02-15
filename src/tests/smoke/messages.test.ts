// src/tests/smoke/messages.test.ts
// Messages routes smoke tests

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { createTestClient } from "../helpers/testUtils";

describe("Messages Smoke Tests", () => {
  let client: { token: string };

  beforeAll(async () => {
    client = await createTestClient();
  });

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
      .set("Authorization", `Bearer ${client.token}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBeDefined();
  });
});
