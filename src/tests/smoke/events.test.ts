// src/tests/smoke/events.test.ts
// Smoke tests for events endpoint

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index";
import { computeN8nSignature } from "../../lib/auth";

describe("Events API - Smoke Tests", () => {
  describe("POST /n8n/events", () => {
    it("should reject invalid signature", async () => {
      const body = { eventType: "test_event" };
      const response = await request(app)
        .post("/n8n/events")
        .set("x-n8n-signature", "invalid")
        .send(body);
      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe("INVALID_SIGNATURE");
    });

    it("should accept valid event with correct signature", async () => {
      const body = { eventType: "n8n_test", payload: { source: "n8n" } };
      const signature = computeN8nSignature(body);
      const response = await request(app)
        .post("/n8n/events")
        .set("x-n8n-signature", signature)
        .send(body);
      expect(response.status).toBe(204);
    });
  });

  describe("POST /events", () => {
    it("should reject invalid webhook secret", async () => {
      const body = { event_type: "test_event" };
      const invalidSignature = "invalid_signature";

      const response = await request(app)
        .post("/events")
        .set("x-n8n-signature", invalidSignature)
        .send(body);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "INVALID_SIGNATURE");
    });

    it("should reject request without signature header", async () => {
      const body = { event_type: "test_event" };

      const response = await request(app).post("/events").send(body);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "MISSING_SIGNATURE");
    });

    it("should accept valid event with correct signature", async () => {
      const body = {
        eventType: "test_event", // Route expects camelCase 'eventType', not snake_case 'event_type'
        payload: { test: true },
      };
      const signature = computeN8nSignature(body);

      const response = await request(app)
        .post("/events")
        .set("x-n8n-signature", signature)
        .send(body);

      expect(response.status).toBe(204); // API returns 204 No Content
    });

    it("should require event_type", async () => {
      const body = {}; // Missing event_type
      const signature = computeN8nSignature(body);

      const response = await request(app)
        .post("/events")
        .set("x-n8n-signature", signature)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should accept event with job_id", async () => {
      const body = {
        jobId: "12345678-1234-1234-1234-123456789012",
        eventType: "custom_event",
        actorType: "system" as const,
        payload: { action: "test" },
      };
      const signature = computeN8nSignature(body);

      const response = await request(app)
        .post("/events")
        .set("x-n8n-signature", signature)
        .send(body);

      expect(response.status).toBe(204); // API returns 204 No Content
    });
  });
});
