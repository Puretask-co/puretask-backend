// src/tests/integration/trustE2EFlow.test.ts
// E2E flow: Register → Login → Credits → Billing → Live Appointment

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { createTestClient, createTestCleaner, addCreditsToUser, cleanupTestData } from "../helpers/testUtils";
import { query } from "../../db/client";

describe("Trust E2E Flow: Login → Credits → Billing → Live", { timeout: 30000, hookTimeout: 30000 }, () => {
  let clientToken: string;
  let clientId: string;
  let jobId: string;

  beforeAll(async () => {
    const client = await createTestClient();
    const cleaner = await createTestCleaner();
    clientToken = client.token;
    clientId = client.id;

    await addCreditsToUser(client.id, 200);

    jobId = crypto.randomUUID();
    const start = new Date(Date.now() + 3600000);
    const end = new Date(start.getTime() + 7200000);
    await query(
      `INSERT INTO jobs (id, client_id, cleaner_id, status, credit_amount, scheduled_start_at, scheduled_end_at, address, cleaning_type)
       VALUES ($1, $2, $3, 'accepted', 100, $4, $5, '123 Test St', 'basic')
       ON CONFLICT (id) DO NOTHING`,
      [jobId, client.id, cleaner.id, start, end]
    );
  });

  afterAll(async () => {
    if (jobId) {
      await query("DELETE FROM job_events WHERE job_id = $1", [jobId]);
      await query("DELETE FROM credit_ledger WHERE job_id = $1", [jobId]);
      await query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
    try {
      await cleanupTestData();
    } catch {
      // Ignore FK errors during cleanup
    }
  });

  const api = (path: string) =>
    request(app)
      .get(path)
      .set("Authorization", `Bearer ${clientToken}`);

  it("1. Auth: token from login works for /auth/me", async () => {
    const meRes = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${clientToken}`)
      .expect(200);

    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.id).toBe(clientId);
    expect(meRes.body.user.email).toBeDefined();
  });

  it("2. GET /api/credits/balance returns balance after login", async () => {
    const res = await api("/api/credits/balance").expect(200);

    expect(res.body.balance).toBe(200);
    expect(res.body.currency).toBe("USD");
    expect(res.body.lastUpdatedISO).toBeDefined();
  });

  it("3. GET /api/credits/ledger returns entries", async () => {
    const res = await api("/api/credits/ledger").expect(200);

    expect(res.body.entries).toBeDefined();
    expect(Array.isArray(res.body.entries)).toBe(true);
    const adjustment = res.body.entries.find((e: { type: string }) => e.type === "adjustment");
    expect(adjustment).toBeDefined();
    expect(adjustment.amount).toBe(200);
  });

  it("4. GET /api/billing/invoices returns list (may be empty)", async () => {
    const res = await api("/api/billing/invoices").expect(200);

    expect(res.body.invoices).toBeDefined();
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });

  it("5. GET /api/appointments/:id/live returns live state", async () => {
    const res = await api(`/api/appointments/${jobId}/live`).expect(200);

    expect(res.body.bookingId).toBe(jobId);
    expect(res.body.state).toBeDefined();
    expect(["scheduled", "en_route", "arrived", "checked_in", "completed", "cancelled"]).toContain(
      res.body.state
    );
    expect(res.body.events).toBeDefined();
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it("6. 401 on protected route without token redirects to login (backend returns 401)", async () => {
    const res = await request(app).get("/api/credits/balance").expect(401);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toMatch(/UNAUTHENTICATED|INVALID_TOKEN/);
  });
});
