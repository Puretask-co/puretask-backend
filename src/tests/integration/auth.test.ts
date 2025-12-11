// src/tests/integration/auth.test.ts
// Authentication system tests

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";

const TEST_EMAIL = `test-${Date.now()}@puretask.test`;
const TEST_PASSWORD = "TestPassword123!";
let authToken: string;
let userId: string;

describe("Authentication System", () => {
  afterAll(async () => {
    // Cleanup test user
    if (userId) {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
  });

  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          fullName: "Test User",
          role: "client",
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.expiresIn).toBeGreaterThan(0);

      userId = res.body.user.id;
      authToken = res.body.accessToken;
    });

    it("should reject duplicate email", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          fullName: "Test User 2",
          role: "client",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_EXISTS");
    });

    it("should reject invalid email", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "not-an-email",
          password: TEST_PASSWORD,
          fullName: "Test User",
          role: "client",
        });

      expect(res.status).toBe(400);
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "another@test.com",
          password: "short",
          fullName: "Test User",
          role: "client",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeDefined();

      authToken = res.body.accessToken;
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: TEST_EMAIL,
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("LOGIN_FAILED");
    });

    it("should reject unknown email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "unknown@test.com",
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("should return current user with valid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(TEST_EMAIL.toLowerCase());
    });

    it("should reject without token", async () => {
      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /auth/me", () => {
    it("should update user profile", async () => {
      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          fullName: "Updated Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.fullName).toBe("Updated Name");
    });
  });

  describe("POST /auth/change-password", () => {
    const NEW_PASSWORD = "NewPassword456!";

    it("should change password with correct current password", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: NEW_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should login with new password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: TEST_EMAIL,
          password: NEW_PASSWORD,
        });

      expect(res.status).toBe(200);
    });

    it("should reject incorrect current password", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          currentPassword: "wrongpassword",
          newPassword: "AnotherPassword789!",
        });

      expect(res.status).toBe(400);
    });
  });
});

