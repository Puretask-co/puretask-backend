"use strict";
// src/tests/smoke/jobLifecycle.test.ts
// Full job lifecycle smoke test
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const index_1 = __importDefault(require("../../index"));
const testUtils_1 = require("../helpers/testUtils");
(0, vitest_1.describe)("Job Lifecycle Smoke Test", () => {
    let client;
    let cleaner;
    (0, vitest_1.beforeAll)(async () => {
        // Create test users
        client = await (0, testUtils_1.createTestClient)();
        cleaner = await (0, testUtils_1.createTestCleaner)();
        // Add credits to client for job creation
        await (0, testUtils_1.addCreditsToUser)(client.id, 500);
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, testUtils_1.cleanupTestData)();
    });
    (0, vitest_1.it)("runs through the happy path: requested → accepted → on_my_way → in_progress → awaiting_approval → completed", async () => {
        // 1. Client creates job
        const createRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
            scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
            address: "123 Happy Path St",
            credit_amount: 100,
        });
        (0, vitest_1.expect)(createRes.status).toBe(201);
        (0, vitest_1.expect)(createRes.body.job).toBeDefined();
        const jobId = createRes.body.job.id;
        (0, vitest_1.expect)(jobId).toBeTruthy();
        (0, vitest_1.expect)(createRes.body.job.status).toBe("requested");
        // 2. Cleaner accepts job
        const acceptRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({ event_type: "job_accepted" });
        (0, vitest_1.expect)(acceptRes.status).toBe(200);
        (0, vitest_1.expect)(acceptRes.body.job.status).toBe("accepted");
        (0, vitest_1.expect)(acceptRes.body.job.cleaner_id).toBe(cleaner.id);
        // 3. Cleaner marks on_my_way
        const omwRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({ event_type: "cleaner_on_my_way" });
        (0, vitest_1.expect)(omwRes.status).toBe(200);
        (0, vitest_1.expect)(omwRes.body.job.status).toBe("on_my_way");
        // 4. Cleaner starts job (check in)
        const startRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({
            event_type: "job_started",
            payload: { latitude: 37.7749, longitude: -122.4194 },
        });
        (0, vitest_1.expect)(startRes.status).toBe(200);
        (0, vitest_1.expect)(startRes.body.job.status).toBe("in_progress");
        (0, vitest_1.expect)(startRes.body.job.actual_start_at).toBeTruthy();
        // 5. Cleaner completes job (check out)
        const completeRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({ event_type: "job_completed" });
        (0, vitest_1.expect)(completeRes.status).toBe(200);
        (0, vitest_1.expect)(completeRes.body.job.status).toBe("awaiting_approval");
        (0, vitest_1.expect)(completeRes.body.job.actual_end_at).toBeTruthy();
        // 6. Client approves job with rating
        const approveRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            event_type: "client_approved",
            payload: { rating: 5 },
        });
        (0, vitest_1.expect)(approveRes.status).toBe(200);
        (0, vitest_1.expect)(approveRes.body.job.status).toBe("completed");
        (0, vitest_1.expect)(approveRes.body.job.rating).toBe(5);
    });
    (0, vitest_1.it)("allows client to cancel a requested job", async () => {
        // Create job
        const createRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
            scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
            address: "456 Cancel St",
            credit_amount: 50,
        });
        (0, vitest_1.expect)(createRes.status).toBe(201);
        const jobId = createRes.body.job.id;
        // Cancel job
        const cancelRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({ event_type: "job_cancelled" });
        (0, vitest_1.expect)(cancelRes.status).toBe(200);
        (0, vitest_1.expect)(cancelRes.body.job.status).toBe("cancelled");
    });
    (0, vitest_1.it)("prevents invalid state transitions", async () => {
        // Create job
        const createRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now (must be at least 2 hours)
            scheduled_end_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
            address: "789 Invalid St",
            credit_amount: 50,
        });
        const jobId = createRes.body.job.id;
        // Try to complete without accepting first
        const invalidRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({ event_type: "job_completed" });
        (0, vitest_1.expect)(invalidRes.status).toBe(400);
        (0, vitest_1.expect)(invalidRes.body.error.code).toBe("BAD_TRANSITION");
    });
});
