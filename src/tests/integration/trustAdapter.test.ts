// src/tests/integration/trustAdapter.test.ts
// Integration tests for Trust-Fintech API adapter (/api/credits, /api/billing, /api/appointments)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import {
  createTestClient,
  createTestCleaner,
  addCreditsToUser,
  cleanupTestData,
  type TestUser,
} from "../helpers/testUtils";
import { query } from "../../db/client";

describe("Trust Adapter Integration Tests", { timeout: 30000, hookTimeout: 30000 }, () => {
  let client: TestUser;
  let cleaner: TestUser;
  let jobId: string;

  beforeAll(async () => {
    client = await createTestClient();
    cleaner = await createTestCleaner();
    await addCreditsToUser(client.id, 150);

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
      // Ignore FK errors during cleanup (e.g. properties_client_id_fkey)
    }
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe("GET /api/credits/balance", () => {
    it("returns 401 without token", async () => {
      await request(app).get("/api/credits/balance").expect(401);
    });

    it("returns 403 for cleaner role", async () => {
      await request(app)
        .get("/api/credits/balance")
        .set(auth(cleaner.token))
        .expect(403);
    });

    it("returns Trust contract shape for client", async () => {
      const res = await request(app)
        .get("/api/credits/balance")
        .set(auth(client.token))
        .expect(200);

      expect(res.body).toHaveProperty("balance");
      expect(res.body).toHaveProperty("currency", "USD");
      expect(res.body).toHaveProperty("lastUpdatedISO");
      expect(typeof res.body.balance).toBe("number");
      expect(res.body.balance).toBe(150);
    });
  });

  describe("GET /api/credits/ledger", () => {
    it("returns 401 without token", async () => {
      await request(app).get("/api/credits/ledger").expect(401);
    });

    it("returns Trust contract shape with entries array", async () => {
      const res = await request(app)
        .get("/api/credits/ledger")
        .set(auth(client.token))
        .expect(200);

      expect(res.body).toHaveProperty("entries");
      expect(Array.isArray(res.body.entries)).toBe(true);
      if (res.body.entries.length > 0) {
        const e = res.body.entries[0];
        expect(e).toHaveProperty("id");
        expect(e).toHaveProperty("createdAtISO");
        expect(e).toHaveProperty("type");
        expect(e).toHaveProperty("amount");
        expect(e).toHaveProperty("currency", "USD");
        expect(e).toHaveProperty("description");
        expect(e).toHaveProperty("status", "posted");
      }
    });

    it("supports query params from, to, type, limit", async () => {
      const res = await request(app)
        .get("/api/credits/ledger?limit=5")
        .set(auth(client.token))
        .expect(200);

      expect(res.body.entries.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/billing/invoices", () => {
    it("returns 401 without token", async () => {
      await request(app).get("/api/billing/invoices").expect(401);
    });

    it("returns Trust contract shape with invoices array", async () => {
      const res = await request(app)
        .get("/api/billing/invoices")
        .set(auth(client.token))
        .expect(200);

      expect(res.body).toHaveProperty("invoices");
      expect(Array.isArray(res.body.invoices)).toBe(true);
      if (res.body.invoices.length > 0) {
        const inv = res.body.invoices[0];
        expect(inv).toHaveProperty("id");
        expect(inv).toHaveProperty("createdAtISO");
        expect(inv).toHaveProperty("status");
        expect(inv).toHaveProperty("subtotal");
        expect(inv).toHaveProperty("tax");
        expect(inv).toHaveProperty("total");
        expect(inv).toHaveProperty("currency", "USD");
      }
    });
  });

  describe("GET /api/billing/invoices/:id", () => {
    it("returns 404 for non-existent invoice", async () => {
      await request(app)
        .get("/api/billing/invoices/00000000-0000-0000-0000-000000000000")
        .set(auth(client.token))
        .expect(404);
    });
  });

  describe("GET /api/appointments/:bookingId/live", () => {
    it("returns 401 without token", async () => {
      await request(app).get(`/api/appointments/${jobId}/live`).expect(401);
    });

    it("returns 404 for non-existent booking", async () => {
      await request(app)
        .get("/api/appointments/00000000-0000-0000-0000-000000000000/live")
        .set(auth(client.token))
        .expect(404);
    });

    it("returns Trust contract shape for client with job", async () => {
      const res = await request(app)
        .get(`/api/appointments/${jobId}/live`)
        .set(auth(client.token))
        .expect(200);

      expect(res.body).toHaveProperty("bookingId", jobId);
      expect(res.body).toHaveProperty("state");
      expect(res.body).toHaveProperty("gps");
      expect(res.body).toHaveProperty("photos");
      expect(res.body).toHaveProperty("checklist");
      expect(res.body).toHaveProperty("events");
      expect(Array.isArray(res.body.gps)).toBe(true);
      expect(Array.isArray(res.body.photos)).toBe(true);
      expect(Array.isArray(res.body.checklist)).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it("returns Trust contract for cleaner with job", async () => {
      const res = await request(app)
        .get(`/api/appointments/${jobId}/live`)
        .set(auth(cleaner.token))
        .expect(200);

      expect(res.body.bookingId).toBe(jobId);
    });
  });

  describe("POST /api/appointments/:bookingId/events", () => {
    it("returns 401 without token", async () => {
      await request(app)
        .post(`/api/appointments/${jobId}/events`)
        .send({ type: "note", note: "test" })
        .expect(401);
    });

    it("returns 403 for client (cleaner-only endpoint)", async () => {
      await request(app)
        .post(`/api/appointments/${jobId}/events`)
        .set(auth(client.token))
        .send({ type: "note", note: "test" })
        .expect(403);
    });

    it("returns 501 for check_in (use tracking API)", async () => {
      const res = await request(app)
        .post(`/api/appointments/${jobId}/events`)
        .set(auth(cleaner.token))
        .send({ type: "check_in" })
        .expect(501);

      expect(res.body.message).toContain("check-in");
    });

    it("records note event for cleaner", async () => {
      const res = await request(app)
        .post(`/api/appointments/${jobId}/events`)
        .set(auth(cleaner.token))
        .send({ type: "note", note: "On my way!" })
        .expect(200);

      expect(res.body).toEqual({ ok: true });
    });
  });
});
