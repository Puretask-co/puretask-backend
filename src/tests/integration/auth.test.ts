// src/tests/integration/auth.test.ts
// Integration tests for authentication flow

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";

describe("Authentication Integration Tests", () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "TestPassword123!",
    role: "client" as const,
  };

  beforeAll(async () => {
    // Clean up any existing test users
    await query("DELETE FROM users WHERE email LIKE $1", ["test-%@example.com"]);
  });

  afterAll(async () => {
    // Clean up test user
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: testUser.email,
          password: testUser.password,
          role: testUser.role,
        })
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject duplicate email", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: testUser.email,
          password: testUser.password,
          role: testUser.role,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should reject invalid email", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "invalid-email",
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should reject weak password", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: `test-${Date.now()}@example.com`,
          password: "short",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /auth/login", () => {
    it("should login with correct credentials", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject incorrect password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword",
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should reject non-existent user", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "password",
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /auth/me", () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      authToken = response.body.token;
    });

    it("should return user info with valid token", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject request without token", async () => {
      const response = await request(app)
        .get("/auth/me")
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});
