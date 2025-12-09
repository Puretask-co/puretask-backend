"use strict";
// src/tests/smoke/events.test.ts
// Smoke tests for events endpoint
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../../index");
const env_1 = require("../../config/env");
(0, vitest_1.describe)("Events API - Smoke Tests", () => {
    (0, vitest_1.describe)("POST /events", () => {
        (0, vitest_1.it)("should reject invalid webhook secret", async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post("/events")
                .send({
                event_type: "test_event",
                webhook_secret: "invalid_secret",
            });
            (0, vitest_1.expect)(response.status).toBe(401);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
            (0, vitest_1.expect)(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
        });
        (0, vitest_1.it)("should accept valid event with correct webhook secret", async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post("/events")
                .send({
                event_type: "test_event",
                webhook_secret: env_1.env.N8N_WEBHOOK_SECRET,
                payload: { test: true },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("success", true);
            (0, vitest_1.expect)(response.body).toHaveProperty("eventType", "test_event");
        });
        (0, vitest_1.it)("should require event_type", async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post("/events")
                .send({
                webhook_secret: env_1.env.N8N_WEBHOOK_SECRET,
            });
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
        });
        (0, vitest_1.it)("should accept event with job_id", async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post("/events")
                .send({
                job_id: "12345678-1234-1234-1234-123456789012",
                event_type: "custom_event",
                webhook_secret: env_1.env.N8N_WEBHOOK_SECRET,
                actor_type: "system",
                payload: { action: "test" },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("success", true);
            (0, vitest_1.expect)(response.body).toHaveProperty("jobId", "12345678-1234-1234-1234-123456789012");
        });
    });
});
