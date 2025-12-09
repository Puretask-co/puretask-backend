"use strict";
// src/tests/smoke/auth.test.ts
// Authentication smoke tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const index_1 = __importDefault(require("../../index"));
const testUtils_1 = require("../helpers/testUtils");
(0, vitest_1.describe)("Auth Smoke Tests", () => {
    const testEmail = `auth_test_${Date.now()}@test.puretask.com`;
    const testPassword = "securepassword123";
    let authToken;
    (0, vitest_1.afterAll)(async () => {
        await (0, testUtils_1.cleanupTestData)();
    });
    (0, vitest_1.describe)("POST /auth/register", () => {
        (0, vitest_1.it)("registers a new client successfully", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/register")
                .send({
                email: testEmail,
                password: testPassword,
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.token).toBeTruthy();
            (0, vitest_1.expect)(res.body.user.id).toBeTruthy();
            (0, vitest_1.expect)(res.body.user.email).toBe(testEmail);
            (0, vitest_1.expect)(res.body.user.role).toBe("client");
            authToken = res.body.token;
        });
        (0, vitest_1.it)("rejects duplicate email registration", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/register")
                .send({
                email: testEmail,
                password: testPassword,
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
            (0, vitest_1.expect)(res.body.error.code).toBe("EMAIL_EXISTS");
        });
        (0, vitest_1.it)("rejects invalid email format", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/register")
                .send({
                email: "not-an-email",
                password: testPassword,
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
        (0, vitest_1.it)("rejects short password", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/register")
                .send({
                email: "new@test.puretask.com",
                password: "short",
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
        (0, vitest_1.it)("rejects admin role registration", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/register")
                .send({
                email: "admin@test.puretask.com",
                password: testPassword,
                role: "admin",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
    });
    (0, vitest_1.describe)("POST /auth/login", () => {
        (0, vitest_1.it)("logs in with correct credentials", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/login")
                .send({
                email: testEmail,
                password: testPassword,
            });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.token).toBeTruthy();
            (0, vitest_1.expect)(res.body.user.email).toBe(testEmail);
        });
        (0, vitest_1.it)("rejects wrong password", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/login")
                .send({
                email: testEmail,
                password: "wrongpassword",
            });
            (0, vitest_1.expect)(res.status).toBe(401);
            (0, vitest_1.expect)(res.body.error.code).toBe("INVALID_CREDENTIALS");
        });
        (0, vitest_1.it)("rejects non-existent email", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/login")
                .send({
                email: "nonexistent@test.puretask.com",
                password: testPassword,
            });
            (0, vitest_1.expect)(res.status).toBe(401);
        });
    });
    (0, vitest_1.describe)("GET /auth/me", () => {
        (0, vitest_1.it)("returns current user with valid token", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get("/auth/me")
                .set("Authorization", `Bearer ${authToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.user.email).toBe(testEmail);
            (0, vitest_1.expect)(res.body.user.role).toBe("client");
        });
        (0, vitest_1.it)("rejects request without token", async () => {
            const res = await (0, supertest_1.default)(index_1.default).get("/auth/me");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)("rejects request with invalid token", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get("/auth/me")
                .set("Authorization", "Bearer invalid_token_here");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
    });
    (0, vitest_1.describe)("POST /auth/refresh", () => {
        (0, vitest_1.it)("refreshes token for authenticated user", async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post("/auth/refresh")
                .set("Authorization", `Bearer ${authToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.token).toBeTruthy();
            (0, vitest_1.expect)(res.body.token).not.toBe(authToken); // New token
        });
    });
});
