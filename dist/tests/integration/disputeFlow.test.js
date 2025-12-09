"use strict";
// src/tests/integration/disputeFlow.test.ts
// Dispute flow integration tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const index_1 = __importDefault(require("../../index"));
const client_1 = require("../../db/client");
const testUtils_1 = require("../helpers/testUtils");
(0, vitest_1.describe)("Dispute Flow Integration", () => {
    let client;
    let cleaner;
    let admin;
    (0, vitest_1.beforeAll)(async () => {
        client = await (0, testUtils_1.createTestClient)();
        cleaner = await (0, testUtils_1.createTestCleaner)();
        admin = await (0, testUtils_1.createTestAdmin)();
        // Add credits for job creation
        await (0, testUtils_1.addCreditsToUser)(client.id, 500);
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, testUtils_1.cleanupTestData)();
    });
    (0, vitest_1.it)("opens a dispute and resolves it with a refund", async () => {
        // 1. Client creates job
        const jobRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date().toISOString(),
            scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            address: "456 Dispute St",
            credit_amount: 75,
        });
        (0, vitest_1.expect)(jobRes.status).toBe(201);
        const jobId = jobRes.body.job.id;
        // 2. Fast-forward: assign cleaner and move to awaiting_approval
        await (0, testUtils_1.transitionJobTo)(jobId, "awaiting_approval", cleaner.id);
        // 3. Client disputes via endpoint
        const disputeRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            event_type: "job_disputed",
            payload: { notes: "Not satisfied with the cleaning" },
        });
        (0, vitest_1.expect)(disputeRes.status).toBe(200);
        (0, vitest_1.expect)(disputeRes.body.job.status).toBe("disputed");
        // 4. Verify dispute record created
        const disputes = await (0, client_1.query)(`SELECT id, status, client_notes FROM disputes WHERE job_id = $1`, [jobId]);
        (0, vitest_1.expect)(disputes.rows.length).toBe(1);
        (0, vitest_1.expect)(disputes.rows[0].status).toBe("open");
        const disputeId = disputes.rows[0].id;
        // 5. Admin resolves dispute with refund
        const resolveRes = await (0, supertest_1.default)(index_1.default)
            .post(`/admin/disputes/${disputeId}/resolve`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({
            resolution: "resolved_refund",
            admin_notes: "Refund approved after review",
        });
        (0, vitest_1.expect)(resolveRes.status).toBe(200);
        (0, vitest_1.expect)(resolveRes.body.dispute.status).toBe("resolved_refund");
        // 6. Verify refund in credit_ledger
        const ledgerRows = await (0, client_1.query)(`
        SELECT delta_credits, reason
        FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'
      `, [client.id, jobId]);
        (0, vitest_1.expect)(ledgerRows.rows.length).toBe(1);
        (0, vitest_1.expect)(ledgerRows.rows[0].delta_credits).toBe(75);
        (0, vitest_1.expect)(ledgerRows.rows[0].reason).toBe("refund");
    });
    (0, vitest_1.it)("resolves dispute without refund", async () => {
        // 1. Create and setup job
        const jobRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date().toISOString(),
            scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            address: "789 No Refund St",
            credit_amount: 60,
        });
        const jobId = jobRes.body.job.id;
        await (0, testUtils_1.transitionJobTo)(jobId, "awaiting_approval", cleaner.id);
        // 2. Open dispute
        await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            event_type: "job_disputed",
            payload: { notes: "Minor issue" },
        });
        const disputes = await (0, client_1.query)(`SELECT id FROM disputes WHERE job_id = $1`, [jobId]);
        const disputeId = disputes.rows[0].id;
        // 3. Resolve without refund
        const resolveRes = await (0, supertest_1.default)(index_1.default)
            .post(`/admin/disputes/${disputeId}/resolve`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({
            resolution: "resolved_no_refund",
            admin_notes: "Work was satisfactory upon review",
        });
        (0, vitest_1.expect)(resolveRes.status).toBe(200);
        (0, vitest_1.expect)(resolveRes.body.dispute.status).toBe("resolved_no_refund");
        // 4. Verify NO refund entry
        const refundRows = await (0, client_1.query)(`
        SELECT id FROM credit_ledger
        WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'
      `, [client.id, jobId]);
        (0, vitest_1.expect)(refundRows.rows.length).toBe(0);
    });
    (0, vitest_1.it)("prevents non-clients from disputing", async () => {
        // Create job
        const jobRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date().toISOString(),
            scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            address: "111 Forbidden St",
            credit_amount: 40,
        });
        const jobId = jobRes.body.job.id;
        await (0, testUtils_1.transitionJobTo)(jobId, "awaiting_approval", cleaner.id);
        // Cleaner tries to dispute
        const disputeRes = await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${cleaner.token}`)
            .send({
            event_type: "job_disputed",
            payload: { notes: "Cleaner trying to dispute" },
        });
        (0, vitest_1.expect)(disputeRes.status).toBe(403);
    });
    (0, vitest_1.it)("prevents non-admin from resolving disputes", async () => {
        // Create and dispute job
        const jobRes = await (0, supertest_1.default)(index_1.default)
            .post("/jobs")
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            scheduled_start_at: new Date().toISOString(),
            scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            address: "222 Admin Only St",
            credit_amount: 50,
        });
        const jobId = jobRes.body.job.id;
        await (0, testUtils_1.transitionJobTo)(jobId, "awaiting_approval", cleaner.id);
        await (0, supertest_1.default)(index_1.default)
            .post(`/jobs/${jobId}/transition`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({ event_type: "job_disputed", payload: { notes: "Issue" } });
        const disputes = await (0, client_1.query)(`SELECT id FROM disputes WHERE job_id = $1`, [jobId]);
        const disputeId = disputes.rows[0].id;
        // Client tries to resolve
        const resolveRes = await (0, supertest_1.default)(index_1.default)
            .post(`/admin/disputes/${disputeId}/resolve`)
            .set("Authorization", `Bearer ${client.token}`)
            .send({
            resolution: "resolved_refund",
            admin_notes: "Self-refund attempt",
        });
        (0, vitest_1.expect)(resolveRes.status).toBe(403);
    });
});
