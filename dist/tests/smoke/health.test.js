"use strict";
// src/tests/smoke/health.test.ts
// Smoke tests for health endpoint
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
(0, vitest_1.describe)("Health Endpoint", () => {
    (0, vitest_1.it)("GET /health should return ok status", async () => {
        const response = await (0, supertest_1.default)(index_1.default).get("/health");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toHaveProperty("ok", true);
        (0, vitest_1.expect)(response.body).toHaveProperty("service", "puretask-backend");
        (0, vitest_1.expect)(response.body).toHaveProperty("time");
    });
});
