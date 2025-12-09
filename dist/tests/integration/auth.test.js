"use strict";
// src/tests/integration/auth.test.ts
// Authentication system tests
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../../index");
const client_1 = require("../../db/client");
const TEST_EMAIL = `test-${Date.now()}@puretask.test`;
const TEST_PASSWORD = "TestPassword123!";
let authToken;
let userId;
(0, vitest_1.describe)("Authentication System", () => {
    (0, vitest_1.afterAll)(async () => {
        // Cleanup test user
        if (userId) {
            await (0, client_1.query)(`DELETE FROM users WHERE id = $1`, [userId]);
        }
    });
    (0, vitest_1.describe)("POST /auth/register", () => {
        (0, vitest_1.it)("should register a new user", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/register")
                .send({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                fullName: "Test User",
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(201);
            (0, vitest_1.expect)(res.body.user).toBeDefined();
            (0, vitest_1.expect)(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
            (0, vitest_1.expect)(res.body.accessToken).toBeDefined();
            (0, vitest_1.expect)(res.body.expiresIn).toBeGreaterThan(0);
            userId = res.body.user.id;
            authToken = res.body.accessToken;
        });
        (0, vitest_1.it)("should reject duplicate email", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/register")
                .send({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                fullName: "Test User 2",
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(409);
            (0, vitest_1.expect)(res.body.error.code).toBe("EMAIL_EXISTS");
        });
        (0, vitest_1.it)("should reject invalid email", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/register")
                .send({
                email: "not-an-email",
                password: TEST_PASSWORD,
                fullName: "Test User",
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
        (0, vitest_1.it)("should reject short password", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/register")
                .send({
                email: "another@test.com",
                password: "short",
                fullName: "Test User",
                role: "client",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
    });
    (0, vitest_1.describe)("POST /auth/login", () => {
        (0, vitest_1.it)("should login with valid credentials", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/login")
                .send({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
            });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.user).toBeDefined();
            (0, vitest_1.expect)(res.body.accessToken).toBeDefined();
            authToken = res.body.accessToken;
        });
        (0, vitest_1.it)("should reject invalid password", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/login")
                .send({
                email: TEST_EMAIL,
                password: "wrongpassword",
            });
            (0, vitest_1.expect)(res.status).toBe(401);
            (0, vitest_1.expect)(res.body.error.code).toBe("LOGIN_FAILED");
        });
        (0, vitest_1.it)("should reject unknown email", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/login")
                .send({
                email: "unknown@test.com",
                password: TEST_PASSWORD,
            });
            (0, vitest_1.expect)(res.status).toBe(401);
        });
    });
    (0, vitest_1.describe)("GET /auth/me", () => {
        (0, vitest_1.it)("should return current user with valid token", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .get("/auth/me")
                .set("Authorization", `Bearer ${authToken}`);
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.user).toBeDefined();
            (0, vitest_1.expect)(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
        });
        (0, vitest_1.it)("should reject without token", async () => {
            const res = await (0, supertest_1.default)(index_1.app).get("/auth/me");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
        (0, vitest_1.it)("should reject invalid token", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .get("/auth/me")
                .set("Authorization", "Bearer invalid-token");
            (0, vitest_1.expect)(res.status).toBe(401);
        });
    });
    (0, vitest_1.describe)("PATCH /auth/me", () => {
        (0, vitest_1.it)("should update user profile", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .patch("/auth/me")
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                fullName: "Updated Name",
            });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.user.fullName).toBe("Updated Name");
        });
    });
    (0, vitest_1.describe)("POST /auth/change-password", () => {
        const NEW_PASSWORD = "NewPassword456!";
        (0, vitest_1.it)("should change password with correct current password", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/change-password")
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                currentPassword: TEST_PASSWORD,
                newPassword: NEW_PASSWORD,
            });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        });
        (0, vitest_1.it)("should login with new password", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/login")
                .send({
                email: TEST_EMAIL,
                password: NEW_PASSWORD,
            });
            (0, vitest_1.expect)(res.status).toBe(200);
        });
        (0, vitest_1.it)("should reject incorrect current password", async () => {
            const res = await (0, supertest_1.default)(index_1.app)
                .post("/auth/change-password")
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                currentPassword: "wrongpassword",
                newPassword: "AnotherPassword789!",
            });
            (0, vitest_1.expect)(res.status).toBe(400);
        });
    });
});
