"use strict";
// src/tests/smoke/credits.test.ts
// Credits routes smoke tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
(0, vitest_1.describe)("Credits Smoke Tests", () => {
    (0, vitest_1.it)("GET /credits/packages should return packages (no auth required)", async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .get("/credits/packages")
            .set("x-user-id", "test-user")
            .set("x-user-role", "client");
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.packages).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(res.body.packages)).toBe(true);
    });
    (0, vitest_1.it)("GET /credits/balance should require auth", async () => {
        const res = await (0, supertest_1.default)(index_1.default).get("/credits/balance");
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)("POST /credits/checkout should require auth", async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post("/credits/checkout")
            .send({});
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
