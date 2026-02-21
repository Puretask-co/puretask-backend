/**
 * Integration test: onboarding progress with real auth (no mocks).
 * Requires DATABASE_URL and migrated DB. Proves cleaner can hit onboarding route with valid token.
 * See TROUBLESHOOTING "Integration tests: known skips and status".
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../index";
import { createTestCleaner, cleanupTestData, TestUser } from "../helpers/testUtils";

describe("Onboarding with real auth (integration)", () => {
  let cleaner: TestUser;

  beforeAll(async () => {
    cleaner = await createTestCleaner();
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } catch (e) {
      // Cleanup can fail due to FK order (e.g. cleaner_teams); don't fail the test run
    }
  });

  it("GET /cleaner/onboarding/progress returns 200 with valid cleaner token", async () => {
    const res = await request(app)
      .get("/cleaner/onboarding/progress")
      .set("Authorization", `Bearer ${cleaner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // Progress may be empty or have steps; we only assert route + auth work
    if (res.body.progress != null) {
      expect(typeof res.body.progress).toBe("object");
    }
  });
});
