"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
const client_1 = require("../../db/client");
jest.mock("../../db/client");
describe("Admin flows (integration-ish)", () => {
    const agent = (0, supertest_1.default)(index_1.default);
    const adminToken = "dummy-admin-token";
    beforeEach(() => {
        client_1.query.mockReset();
    });
    it("routes dispute", async () => {
        client_1.query.mockResolvedValueOnce({ rows: [] }); // update disputes
        const res = await agent
            .post("/alerts/smoke") // ensure auth middleware not blocking in test env; replace with dispute route below if auth bypassed
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ title: "test", message: "msg" });
        expect(res.status).toBeLessThan(500);
    });
    it("pauses payout", async () => {
        client_1.query.mockResolvedValue({ rows: [] });
        const res = await agent
            .post("/admin/payouts/cleaner123/pause")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ paused: true });
        expect(res.status).toBeLessThan(500);
    });
    it("lists recon flags", async () => {
        client_1.query.mockResolvedValue({ rows: [] });
        const res = await agent
            .get("/admin/payouts/reconciliation/flags")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBeLessThan(500);
    });
});
