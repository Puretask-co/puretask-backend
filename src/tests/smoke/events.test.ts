// src/tests/smoke/events.test.ts
// Smoke tests for events endpoint

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index";
import { env } from "../../config/env";

describe("Events API - Smoke Tests", () => {
  describe("POST /events", () => {
    it("should reject invalid webhook secret", async () => {
      const response = await request(app)
        .post("/events")
        .send({
          event_type: "test_event",
          webhook_secret: "invalid_secret",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should accept valid event with correct webhook secret", async () => {
      const response = await request(app)
        .post("/events")
        .send({
          event_type: "test_event",
          webhook_secret: env.N8N_WEBHOOK_SECRET,
          payload: { test: true },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("eventType", "test_event");
    });

    it("should require event_type", async () => {
      const response = await request(app)
        .post("/events")
        .send({
          webhook_secret: env.N8N_WEBHOOK_SECRET,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should accept event with job_id", async () => {
      const response = await request(app)
        .post("/events")
        .send({
          job_id: "12345678-1234-1234-1234-123456789012",
          event_type: "custom_event",
          webhook_secret: env.N8N_WEBHOOK_SECRET,
          actor_type: "system",
          payload: { action: "test" },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("jobId", "12345678-1234-1234-1234-123456789012");
    });
  });
});

