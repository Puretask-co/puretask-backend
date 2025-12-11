"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin_1 = require("../../routes/admin");
describe("dispute routing schema", () => {
    it("accepts allowed queues", () => {
        expect(() => admin_1.routeDisputeSchema.parse({ routeTo: "ops" })).not.toThrow();
        expect(() => admin_1.routeDisputeSchema.parse({ routeTo: "finance" })).not.toThrow();
        expect(() => admin_1.routeDisputeSchema.parse({ routeTo: "trust_safety" })).not.toThrow();
        expect(() => admin_1.routeDisputeSchema.parse({ routeTo: "support" })).not.toThrow();
    });
    it("rejects unknown queues", () => {
        expect(() => admin_1.routeDisputeSchema.parse({ routeTo: "bad" })).toThrow();
    });
});
