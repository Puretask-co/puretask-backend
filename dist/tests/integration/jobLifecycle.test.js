"use strict";
// src/tests/integration/jobLifecycle.test.ts
// Integration tests for full job lifecycle
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
const client_1 = require("../../db/client");
// Test user IDs (should exist in test database)
const TEST_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_CLEANER_ID = "22222222-2222-2222-2222-222222222222";
const TEST_ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const clientHeaders = {
    "x-user-id": TEST_CLIENT_ID,
    "x-user-role": "client",
};
const cleanerHeaders = {
    "x-user-id": TEST_CLEANER_ID,
    "x-user-role": "cleaner",
};
const adminHeaders = {
    "x-user-id": TEST_ADMIN_ID,
    "x-user-role": "admin",
};
(0, vitest_1.describe)("Job Lifecycle Integration Tests", () => {
    let testJobId;
    // Ensure test users exist
    (0, vitest_1.beforeAll)(async () => {
        // Create test users if they don't exist
        await (0, client_1.query)(`
        INSERT INTO users (id, email, role, status, wallet_credits_balance)
        VALUES 
          ($1, 'test-client@example.com', 'client', 'active', 1000),
          ($2, 'test-cleaner@example.com', 'cleaner', 'active', 0),
          ($3, 'test-admin@example.com', 'admin', 'active', 0)
        ON CONFLICT (id) DO UPDATE SET wallet_credits_balance = 1000
      `, [TEST_CLIENT_ID, TEST_CLEANER_ID, TEST_ADMIN_ID]);
    });
    // Cleanup test job after tests
    (0, vitest_1.afterAll)(async () => {
        if (testJobId) {
            await (0, client_1.query)("DELETE FROM app_events WHERE job_id = $1", [testJobId]);
            await (0, client_1.query)("DELETE FROM credit_transactions WHERE job_id = $1", [testJobId]);
            await (0, client_1.query)("DELETE FROM jobs WHERE id = $1", [testJobId]);
        }
    });
    (0, vitest_1.describe)("Full Job Flow: Create → Request → Accept → Start → Complete → Approve", () => {
        (0, vitest_1.it)("1. Client creates a job", async () => {
            const scheduledStart = new Date();
            scheduledStart.setHours(scheduledStart.getHours() + 24);
            const response = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set(clientHeaders)
                .send({
                cleaning_type: "basic",
                scheduled_start_at: scheduledStart.toISOString(),
                estimated_hours: 3,
                base_rate_cph: 25,
                total_rate_cph: 25,
            });
            (0, vitest_1.expect)(response.status).toBe(201);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("id");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "created");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("client_id", TEST_CLIENT_ID);
            testJobId = response.body.job.id;
        });
        (0, vitest_1.it)("2. Client requests the job (submits for matching)", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(clientHeaders)
                .send({
                event_type: "job_requested",
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "request");
        });
        (0, vitest_1.it)("3. Cleaner accepts the job", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(cleanerHeaders)
                .send({
                event_type: "job_accepted",
                payload: {
                    cleaner_id: TEST_CLEANER_ID,
                },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "accepted");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("cleaner_id", TEST_CLEANER_ID);
        });
        (0, vitest_1.it)("4. Cleaner goes en route", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(cleanerHeaders)
                .send({
                event_type: "cleaner_en_route",
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "en_route");
        });
        (0, vitest_1.it)("5. Cleaner starts the job (check-in)", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(cleanerHeaders)
                .send({
                event_type: "job_started",
                payload: {
                    check_in_lat: 40.7128,
                    check_in_lng: -74.0060,
                },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "in_progress");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("check_in_at");
        });
        (0, vitest_1.it)("6. Cleaner completes the job (check-out)", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(cleanerHeaders)
                .send({
                event_type: "job_completed",
                payload: {
                    check_out_lat: 40.7128,
                    check_out_lng: -74.0060,
                    actual_hours: 2.5,
                },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "awaiting_client");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("check_out_at");
        });
        (0, vitest_1.it)("7. Client approves the job", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${testJobId}/transition`)
                .set(clientHeaders)
                .send({
                event_type: "client_approved",
                payload: {
                    client_review_stars: 5,
                    client_review_text: "Excellent cleaning service!",
                },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "approved");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("client_review_stars", 5);
        });
        (0, vitest_1.it)("8. Job events are recorded", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .get(`/admin/jobs/${testJobId}/events`)
                .set(adminHeaders);
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("events");
            (0, vitest_1.expect)(Array.isArray(response.body.events)).toBe(true);
            (0, vitest_1.expect)(response.body.events.length).toBeGreaterThanOrEqual(1);
        });
    });
    (0, vitest_1.describe)("Job Cancellation Flow", () => {
        let cancelJobId;
        (0, vitest_1.it)("1. Client creates a job", async () => {
            const scheduledStart = new Date();
            scheduledStart.setHours(scheduledStart.getHours() + 48);
            const response = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set(clientHeaders)
                .send({
                cleaning_type: "deep",
                scheduled_start_at: scheduledStart.toISOString(),
                estimated_hours: 4,
                base_rate_cph: 30,
                addon_rate_cph: 10,
                total_rate_cph: 40,
            });
            (0, vitest_1.expect)(response.status).toBe(201);
            cancelJobId = response.body.job.id;
        });
        (0, vitest_1.it)("2. Client cancels the job", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${cancelJobId}/transition`)
                .set(clientHeaders)
                .send({
                event_type: "job_cancelled",
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "cancelled");
        });
        // Cleanup
        (0, vitest_1.afterAll)(async () => {
            if (cancelJobId) {
                await (0, client_1.query)("DELETE FROM app_events WHERE job_id = $1", [cancelJobId]);
                await (0, client_1.query)("DELETE FROM credit_transactions WHERE job_id = $1", [cancelJobId]);
                await (0, client_1.query)("DELETE FROM jobs WHERE id = $1", [cancelJobId]);
            }
        });
    });
    (0, vitest_1.describe)("Dispute Flow", () => {
        let disputeJobId;
        (0, vitest_1.beforeAll)(async () => {
            // Create and progress a job to awaiting_client status
            const scheduledStart = new Date();
            scheduledStart.setHours(scheduledStart.getHours() + 24);
            // Create job
            const createRes = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set(clientHeaders)
                .send({
                cleaning_type: "basic",
                scheduled_start_at: scheduledStart.toISOString(),
                estimated_hours: 2,
                base_rate_cph: 25,
                total_rate_cph: 25,
            });
            disputeJobId = createRes.body.job.id;
            // Progress through states
            await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(clientHeaders)
                .send({ event_type: "job_requested" });
            await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(cleanerHeaders)
                .send({ event_type: "job_accepted", payload: { cleaner_id: TEST_CLEANER_ID } });
            await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(cleanerHeaders)
                .send({ event_type: "cleaner_en_route" });
            await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(cleanerHeaders)
                .send({ event_type: "job_started" });
            await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(cleanerHeaders)
                .send({ event_type: "job_completed", payload: { actual_hours: 2 } });
        });
        (0, vitest_1.it)("1. Client disputes the job", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${disputeJobId}/transition`)
                .set(clientHeaders)
                .send({
                event_type: "client_disputed",
                payload: {
                    dispute_reason: "quality",
                    dispute_details: "Some areas were not cleaned properly",
                },
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "disputed");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("dispute_status", "open");
        });
        (0, vitest_1.it)("2. Admin resolves the dispute", async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post(`/admin/disputes/${disputeJobId}/resolve`)
                .set(adminHeaders)
                .send({
                resolution: "resolved_client",
                notes: "Partial refund issued due to incomplete cleaning",
            });
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body).toHaveProperty("job");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("status", "approved");
            (0, vitest_1.expect)(response.body.job).toHaveProperty("dispute_status", "resolved_client");
        });
        // Cleanup
        (0, vitest_1.afterAll)(async () => {
            if (disputeJobId) {
                await (0, client_1.query)("DELETE FROM app_events WHERE job_id = $1", [disputeJobId]);
                await (0, client_1.query)("DELETE FROM credit_transactions WHERE job_id = $1", [disputeJobId]);
                await (0, client_1.query)("DELETE FROM jobs WHERE id = $1", [disputeJobId]);
            }
        });
    });
});
