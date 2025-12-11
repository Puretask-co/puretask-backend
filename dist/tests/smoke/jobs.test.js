"use strict";
// src/tests/smoke/jobs.test.ts
// Smoke tests for jobs endpoints
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
// Test user headers
const clientHeaders = {
    "x-user-id": "11111111-1111-1111-1111-111111111111",
    "x-user-role": "client",
};
const adminHeaders = {
    "x-user-id": "00000000-0000-0000-0000-000000000000",
    "x-user-role": "admin",
};
(0, vitest_1.describe)("Jobs API - Smoke Tests", () => {
    (0, vitest_1.describe)("Authentication", () => {
        (0, vitest_1.it)("should return 401 without auth headers", async () => {
            const response = await (0, supertest_1.default)(index_1.default).get("/jobs");
            (0, vitest_1.expect)(response.status).toBe(401);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
            (0, vitest_1.expect)(response.body.error).toHaveProperty("code", "UNAUTHENTICATED");
        });
        (0, vitest_1.it)("should return 200 with valid auth headers", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/jobs")
                .set(clientHeaders);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("jobs");
            (0, vitest_1.expect)(Array.isArray(response.body.jobs)).toBe(true);
        });
    });
    (0, vitest_1.describe)("GET /jobs", () => {
        (0, vitest_1.it)("should return jobs list for authenticated client", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/jobs")
                .set(clientHeaders);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("jobs");
            (0, vitest_1.expect)(Array.isArray(response.body.jobs)).toBe(true);
        });
    });
    (0, vitest_1.describe)("POST /jobs", () => {
        (0, vitest_1.it)("should require cleaning_type", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set(clientHeaders)
                .send({
                scheduled_start_at: new Date().toISOString(),
                estimated_hours: 2,
                base_rate_cph: 25,
                total_rate_cph: 25,
            });
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
        });
        (0, vitest_1.it)("should require estimated_hours", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set(clientHeaders)
                .send({
                cleaning_type: "basic",
                scheduled_start_at: new Date().toISOString(),
                base_rate_cph: 25,
                total_rate_cph: 25,
            });
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
        });
    });
});
(0, vitest_1.describe)("Admin Jobs API - Smoke Tests", () => {
    (0, vitest_1.describe)("GET /admin/jobs", () => {
        (0, vitest_1.it)("should return 403 for non-admin users", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/admin/jobs")
                .set(clientHeaders);
            (0, vitest_1.expect)(response.status).toBe(403);
            (0, vitest_1.expect)(response.body).toHaveProperty("error");
            (0, vitest_1.expect)(response.body.error).toHaveProperty("code", "FORBIDDEN");
        });
        (0, vitest_1.it)("should return jobs for admin users", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/admin/jobs")
                .set(adminHeaders);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("jobs");
        });
    });
    (0, vitest_1.describe)("GET /admin/kpis", () => {
        (0, vitest_1.it)("should return 403 for non-admin users", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/admin/kpis")
                .set(clientHeaders);
            (0, vitest_1.expect)(response.status).toBe(403);
        });
        (0, vitest_1.it)("should return KPIs for admin users", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get("/admin/kpis")
                .set(adminHeaders);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("kpis");
            (0, vitest_1.expect)(response.body.kpis).toHaveProperty("totalJobs");
            (0, vitest_1.expect)(response.body.kpis).toHaveProperty("activeJobs");
            (0, vitest_1.expect)(response.body.kpis).toHaveProperty("completedJobs");
        });
    });
});
