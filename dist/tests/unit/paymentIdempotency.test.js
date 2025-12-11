"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paymentService_1 = require("../../services/paymentService");
jest.mock("../../db/client", () => {
    const processed = new Set();
    return {
        query: jest.fn(async (sql, params) => {
            if (sql.includes("SELECT object_id")) {
                const key = `${params[0]}|${params[1]}`;
                return { rows: processed.has(key) ? [{ object_id: params[0] }] : [] };
            }
            if (sql.includes("INSERT INTO stripe_object_processed")) {
                const key = `${params[0]}|${params[1]}`;
                processed.add(key);
                return { rows: [] };
            }
            return { rows: [] };
        }),
    };
});
describe("stripe object idempotency helpers", () => {
    it("marks and detects processed objects", async () => {
        const id = "pi_123";
        const type = "payment_intent";
        expect(await (0, paymentService_1.isObjectAlreadyProcessed)(id, type)).toBe(false);
        await (0, paymentService_1.markObjectProcessed)(id, type);
        expect(await (0, paymentService_1.isObjectAlreadyProcessed)(id, type)).toBe(true);
    });
});
