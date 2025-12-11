"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const refundProcessor_1 = require("../../services/refundProcessor");
const chargebackProcessor_1 = require("../../services/chargebackProcessor");
const ledger = [];
const jobUpdates = [];
const payoutFlags = [];
jest.mock("../../services/creditsService", () => ({
    addLedgerEntry: jest.fn(async (input) => {
        ledger.push(input);
        return input;
    }),
}));
jest.mock("../../db/client", () => ({
    query: jest.fn(async (sql, params) => {
        if (sql.includes("UPDATE jobs SET status = 'cancelled'")) {
            jobUpdates.push({ jobId: params[0], status: "cancelled" });
            return { rows: [] };
        }
        if (sql.includes("UPDATE payouts") && sql.includes("dispute_flag")) {
            payoutFlags.push({ payoutId: params[0], flag: sql.includes("true") });
            return { rows: [] };
        }
        if (sql.includes("FROM payouts p") && sql.includes("JOIN earnings")) {
            return { rows: [{ payout_id: "payout123" }] };
        }
        return { rows: [] };
    }),
}));
describe("refundProcessor and chargebackProcessor", () => {
    beforeEach(() => {
        ledger.length = 0;
        jobUpdates.length = 0;
        payoutFlags.length = 0;
    });
    it("refundProcessor returns credits to client for job", async () => {
        await (0, refundProcessor_1.processStripeRefund)({
            chargeId: "ch_1",
            paymentIntentId: "pi_1",
            jobId: "job1",
            clientId: "client1",
            purpose: "job_charge",
            amount: 1000, // cents, with default 10 cents/credit => 100 credits
            currency: "usd",
        });
        expect(ledger[0]).toMatchObject({
            userId: "client1",
            jobId: "job1",
            deltaCredits: 100,
            reason: "refund",
        });
        expect(jobUpdates[0]).toMatchObject({ jobId: "job1", status: "cancelled" });
    });
    it("chargebackProcessor refunds client and clears payout flag on lost dispute", async () => {
        await (0, chargebackProcessor_1.processChargeDispute)({
            disputeId: "dp_1",
            chargeId: "ch_1",
            paymentIntentId: "pi_1",
            jobId: "job1",
            clientId: "client1",
            amount: 1000,
            currency: "usd",
            status: "lost",
            eventType: "charge.dispute.closed",
            reason: "test",
        });
        expect(ledger[0]).toMatchObject({
            userId: "client1",
            jobId: "job1",
            deltaCredits: 100,
            reason: "refund",
        });
        expect(jobUpdates[0]).toMatchObject({ jobId: "job1", status: "cancelled" });
        expect(payoutFlags.find((p) => p.payoutId === "payout123")).toBeTruthy();
    });
});
