// src/tests/smoke/auth.test.ts
// Authentication smoke tests

import request from "supertest";
import { describe, it, expect, afterAll } from "vitest";
import app from "../../index";
import { cleanupTestData } from "../helpers/testUtils";

describe("Auth Smoke Tests", () => {
  const testEmail = `auth_test_${Date.now()}@test.puretask.com`;
  const testPassword = "securepassword123";
  let authToken: string;

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("POST /auth/register", () => {
    it("registers a new client successfully", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: testEmail,
          password: testPassword,
          role: "client",
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.id).toBeTruthy();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe("client");

      authToken = res.body.token;
    });

    it("rejects duplicate email registration", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: testEmail,
          password: testPassword,
          role: "client",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("EMAIL_EXISTS");
    });

    it("rejects invalid email format", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "not-an-email",
          password: testPassword,
          role: "client",
        });

      expect(res.status).toBe(400);
    });

    it("rejects short password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "new@test.puretask.com",
          password: "short",
          role: "client",
        });

      expect(res.status).toBe(400);
    });

    it("rejects admin role registration", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "admin@test.puretask.com",
          password: testPassword,
          role: "admin",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with correct credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(testEmail);
    });

    it("rejects wrong password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: testEmail,
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects non-existent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@test.puretask.com",
          password: testPassword,
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns current user with valid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe("client");
    });

    it("rejects request without token", async () => {
      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(401);
    });

    it("rejects request with invalid token", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid_token_here");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("refreshes token for authenticated user", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.token).not.toBe(authToken); // New token
    });
  });
});
