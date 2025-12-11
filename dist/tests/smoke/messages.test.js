"use strict";
// src/tests/smoke/messages.test.ts
// Messages routes smoke tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
(0, vitest_1.describe)("Messages Smoke Tests", () => {
    (0, vitest_1.it)("GET /messages/unread should require auth", async () => {
        const res = await (0, supertest_1.default)(index_1.default).get("/messages/unread");
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)("GET /messages/conversations should require auth", async () => {
        const res = await (0, supertest_1.default)(index_1.default).get("/messages/conversations");
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)("GET /messages/unread should work with auth", async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .get("/messages/unread")
            .set("x-user-id", "test-user")
            .set("x-user-role", "client");
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.unreadCount).toBeDefined();
    });
});
