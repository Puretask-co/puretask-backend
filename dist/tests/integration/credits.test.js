"use strict";
// src/tests/integration/credits.test.ts
// Credit system integration tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const index_1 = __importDefault(require("../../index"));
const client_1 = require("../../db/client");
const testUtils_1 = require("../helpers/testUtils");
const creditsService_1 = require("../../services/creditsService");
(0, vitest_1.describe)("Credit System Integration", () => {
    let client;
    let cleaner;
    (0, vitest_1.beforeAll)(async () => {
        client = await (0, testUtils_1.createTestClient)();
        cleaner = await (0, testUtils_1.createTestCleaner)();
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, testUtils_1.cleanupTestData)();
    });
    (0, vitest_1.describe)("Credit purchases", () => {
        (0, vitest_1.it)("adds credits via purchaseCredits service", async () => {
            const initialBalance = await (0, creditsService_1.getUserCreditBalance)(client.id);
            await (0, creditsService_1.purchaseCredits)({
                userId: client.id,
                creditsAmount: 200,
                paymentIntentId: `pi_test_${Date.now()}`,
            });
            const newBalance = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(newBalance).toBe(initialBalance + 200);
        });
        (0, vitest_1.it)("records purchase in credit_ledger", async () => {
            await (0, creditsService_1.purchaseCredits)({
                userId: client.id,
                creditsAmount: 100,
                paymentIntentId: `pi_test_${Date.now()}`,
            });
            const entries = await (0, client_1.query)(`
          SELECT delta_credits, reason
          FROM credit_ledger
          WHERE user_id = $1 AND reason = 'purchase'
          ORDER BY created_at DESC
          LIMIT 1
        `, [client.id]);
            (0, vitest_1.expect)(entries.rows.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(entries.rows[0].delta_credits).toBe(100);
        });
    });
    (0, vitest_1.describe)("Job escrow", () => {
        (0, vitest_1.it)("deducts credits when job is created", async () => {
            // Add credits first
            await (0, testUtils_1.addCreditsToUser)(client.id, 500);
            const balanceBefore = await (0, creditsService_1.getUserCreditBalance)(client.id);
            // Create job
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set("Authorization", `Bearer ${client.token}`)
                .send({
                scheduled_start_at: new Date().toISOString(),
                scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                address: "Credit Test St",
                credit_amount: 150,
            });
            (0, vitest_1.expect)(res.status).toBe(201);
            const balanceAfter = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(balanceAfter).toBe(balanceBefore - 150);
            // Verify escrow entry
            const jobId = res.body.job.id;
            const entries = await (0, client_1.query)(`SELECT delta_credits, reason FROM credit_ledger WHERE job_id = $1 AND reason = 'job_escrow'`, [jobId]);
            (0, vitest_1.expect)(entries.rows.length).toBe(1);
            (0, vitest_1.expect)(entries.rows[0].delta_credits).toBe(-150);
        });
        (0, vitest_1.it)("prevents job creation with insufficient credits", async () => {
            // Ensure client has low balance
            const balance = await (0, creditsService_1.getUserCreditBalance)(client.id);
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set("Authorization", `Bearer ${client.token}`)
                .send({
                scheduled_start_at: new Date().toISOString(),
                scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                address: "No Money St",
                credit_amount: balance + 10000, // More than available
            });
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.error.code).toBe("INSUFFICIENT_CREDITS");
        });
    });
    (0, vitest_1.describe)("Credit release on completion", () => {
        (0, vitest_1.it)("releases credits to cleaner on job approval", async () => {
            await (0, testUtils_1.addCreditsToUser)(client.id, 300);
            const cleanerBalanceBefore = await (0, creditsService_1.getUserCreditBalance)(cleaner.id);
            // Create job
            const jobRes = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set("Authorization", `Bearer ${client.token}`)
                .send({
                scheduled_start_at: new Date().toISOString(),
                scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                address: "Release Test St",
                credit_amount: 100,
            });
            const jobId = jobRes.body.job.id;
            // Fast-forward to awaiting_approval with cleaner assigned
            await (0, testUtils_1.transitionJobTo)(jobId, "awaiting_approval", cleaner.id);
            // Client approves
            const approveRes = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${jobId}/transition`)
                .set("Authorization", `Bearer ${client.token}`)
                .send({ event_type: "client_approved", payload: { rating: 5 } });
            (0, vitest_1.expect)(approveRes.status).toBe(200);
            const cleanerBalanceAfter = await (0, creditsService_1.getUserCreditBalance)(cleaner.id);
            (0, vitest_1.expect)(cleanerBalanceAfter).toBe(cleanerBalanceBefore + 100);
            // Verify release entry
            const entries = await (0, client_1.query)(`SELECT delta_credits FROM credit_ledger WHERE user_id = $1 AND job_id = $2 AND reason = 'job_release'`, [cleaner.id, jobId]);
            (0, vitest_1.expect)(entries.rows.length).toBe(1);
            (0, vitest_1.expect)(entries.rows[0].delta_credits).toBe(100);
        });
    });
    (0, vitest_1.describe)("Credit refund on cancellation", () => {
        (0, vitest_1.it)("refunds credits when job is cancelled", async () => {
            await (0, testUtils_1.addCreditsToUser)(client.id, 200);
            const balanceBefore = await (0, creditsService_1.getUserCreditBalance)(client.id);
            // Create job
            const jobRes = await (0, supertest_1.default)(index_1.default)
                .post("/jobs")
                .set("Authorization", `Bearer ${client.token}`)
                .send({
                scheduled_start_at: new Date().toISOString(),
                scheduled_end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                address: "Cancel Refund St",
                credit_amount: 80,
            });
            const jobId = jobRes.body.job.id;
            const balanceAfterCreate = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(balanceAfterCreate).toBe(balanceBefore - 80);
            // Cancel job
            const cancelRes = await (0, supertest_1.default)(index_1.default)
                .post(`/jobs/${jobId}/transition`)
                .set("Authorization", `Bearer ${client.token}`)
                .send({ event_type: "job_cancelled" });
            (0, vitest_1.expect)(cancelRes.status).toBe(200);
            const balanceAfterCancel = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(balanceAfterCancel).toBe(balanceBefore); // Full refund
            // Verify refund entry
            const entries = await (0, client_1.query)(`SELECT delta_credits FROM credit_ledger WHERE user_id = $1 AND job_id = $2 AND reason = 'refund'`, [client.id, jobId]);
            (0, vitest_1.expect)(entries.rows.length).toBe(1);
            (0, vitest_1.expect)(entries.rows[0].delta_credits).toBe(80);
        });
    });
    (0, vitest_1.describe)("Admin adjustments", () => {
        (0, vitest_1.it)("allows admin to adjust credits", async () => {
            const balanceBefore = await (0, creditsService_1.getUserCreditBalance)(client.id);
            await (0, creditsService_1.adjustCredits)({
                userId: client.id,
                amount: 50,
                reason: "Courtesy credit",
                adminId: "admin-123",
            });
            const balanceAfter = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(balanceAfter).toBe(balanceBefore + 50);
        });
        (0, vitest_1.it)("allows negative adjustments", async () => {
            await (0, testUtils_1.addCreditsToUser)(client.id, 100); // Ensure sufficient balance
            const balanceBefore = await (0, creditsService_1.getUserCreditBalance)(client.id);
            await (0, creditsService_1.adjustCredits)({
                userId: client.id,
                amount: -30,
                reason: "Penalty",
                adminId: "admin-123",
            });
            const balanceAfter = await (0, creditsService_1.getUserCreditBalance)(client.id);
            (0, vitest_1.expect)(balanceAfter).toBe(balanceBefore - 30);
        });
    });
});
