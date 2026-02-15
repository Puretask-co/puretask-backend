// src/tests/integration/migrations.test.ts
// Integration tests for database migrations

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "../../db/client";

describe("Database Migrations", () => {
  beforeAll(async () => {
    // Ensure test database is set up
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe("035_onboarding_enhancements.sql", () => {
    it("has onboarding_current_step column in cleaner_profiles", async () => {
      const result = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cleaner_profiles' 
        AND column_name = 'onboarding_current_step'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("has onboarding_reminder_sent_at column", async () => {
      const result = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cleaner_profiles' 
        AND column_name = 'onboarding_reminder_sent_at'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("has index for abandoned onboarding", async () => {
      const result = await query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'cleaner_profiles' 
        AND indexname = 'idx_cleaner_profiles_abandoned_onboarding'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe("Migration Idempotency", () => {
    it("can query onboarding columns without errors", async () => {
      // Test that columns exist and can be queried
      const result = await query(`
        SELECT onboarding_current_step, onboarding_reminder_sent_at
        FROM cleaner_profiles
        LIMIT 1
      `);

      expect(result.rows).toBeDefined();
    });
  });
});
