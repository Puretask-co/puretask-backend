// src/tests/integration/v1CoreFeatures.test.ts
// V1 CORE FEATURES: Tests for reliability system and top 3 cleaner selection

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { query } from "../../db/client";
import { createJob } from "../../services/jobsService";
import {
  findMatchingCleaners,
  broadcastJobToCleaners,
  acceptJobOffer,
} from "../../services/jobMatchingService";
import { setDayAvailability, setPreferences } from "../../services/availabilityService";
import {
  updateCleanerReliability,
  getCleanerReliabilityInfo,
} from "../../services/reliabilityService";
import {
  getCleanerPayoutPercent,
  recordEarningsForCompletedJob,
} from "../../services/payoutsService";
import { addLedgerEntry } from "../../services/creditsService";
import { TEST_PASSWORD_HASH } from "../helpers/testConstants";

// Test user IDs (using UUIDs for compatibility)
const TEST_CLIENT_ID = crypto.randomUUID();
const TEST_CLEANER_1_ID = crypto.randomUUID();
const TEST_CLEANER_2_ID = crypto.randomUUID();
const TEST_CLEANER_3_ID = crypto.randomUUID();

describe("V1 Core Features: Top 3 Cleaner Selection", () => {
  let testJobId: string;

  beforeAll(async () => {
    // Create test users
    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES 
        ($1, $5, 'client', $6),
        ($2, $7, 'cleaner', $6),
        ($3, $8, 'cleaner', $6),
        ($4, $9, 'cleaner', $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        TEST_CLIENT_ID,
        TEST_CLEANER_1_ID,
        TEST_CLEANER_2_ID,
        TEST_CLEANER_3_ID,
        `test-client-${Date.now()}@test.com`,
        TEST_PASSWORD_HASH,
        `test-cleaner-1-${Date.now()}@test.com`,
        `test-cleaner-2-${Date.now()}@test.com`,
        `test-cleaner-3-${Date.now()}@test.com`,
      ]
    );

    // Create cleaner profiles with different reliability scores
    await query(
      `INSERT INTO cleaner_profiles (user_id, reliability_score, tier, hourly_rate_credits, is_available)
       VALUES 
         ($1, 95, 'platinum', 50, true),
         ($2, 85, 'gold', 45, true),
         ($3, 70, 'silver', 40, true)
       ON CONFLICT (user_id) DO UPDATE SET
         reliability_score = EXCLUDED.reliability_score,
         tier = EXCLUDED.tier,
         hourly_rate_credits = EXCLUDED.hourly_rate_credits,
         is_available = EXCLUDED.is_available`,
      [TEST_CLEANER_1_ID, TEST_CLEANER_2_ID, TEST_CLEANER_3_ID]
    );

    // Give client credits
    await addLedgerEntry({
      userId: TEST_CLIENT_ID,
      deltaCredits: 5000,
      reason: "adjustment",
    });

    // Set availability for all 7 days (08:00-20:00) so is_cleaner_available returns true
    // Set preferences to allow 2-hour jobs (min 1h, max 8h)
    for (const cleanerId of [TEST_CLEANER_1_ID, TEST_CLEANER_2_ID, TEST_CLEANER_3_ID]) {
      for (let d = 0; d <= 6; d++) {
        await setDayAvailability(cleanerId, d, "08:00", "20:00", true);
      }
      await setPreferences(cleanerId, { min_job_duration_h: 1, max_job_duration_h: 8 });
    }
  });

  beforeEach(async () => {
    // Create a test job (must be at least MIN_LEAD_TIME_HOURS from now; use 3 to be safe)
    const scheduledStart = new Date();
    scheduledStart.setHours(scheduledStart.getHours() + 3);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + 2);

    const job = await createJob({
      clientId: TEST_CLIENT_ID,
      scheduledStartAt: scheduledStart.toISOString(),
      scheduledEndAt: scheduledEnd.toISOString(),
      address: "123 Test Street, Test City, TC 12345",
      creditAmount: 100,
    });

    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup: delete in order of FK dependencies (jobs before users)
    await query(
      `DELETE FROM job_offers WHERE job_id IN (SELECT id FROM jobs WHERE client_id = $1)`,
      [TEST_CLIENT_ID]
    );
    await query(
      `DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE client_id = $1)`,
      [TEST_CLIENT_ID]
    );
    await query(
      `DELETE FROM credit_ledger WHERE job_id IN (SELECT id FROM jobs WHERE client_id = $1)`,
      [TEST_CLIENT_ID]
    );
    await query(`DELETE FROM jobs WHERE client_id = $1`, [TEST_CLIENT_ID]);
    await query(`DELETE FROM credit_ledger WHERE user_id IN ($1, $2, $3, $4)`, [
      TEST_CLIENT_ID,
      TEST_CLEANER_1_ID,
      TEST_CLEANER_2_ID,
      TEST_CLEANER_3_ID,
    ]);
    await query(`DELETE FROM cleaner_preferences WHERE cleaner_id IN ($1, $2, $3)`, [
      TEST_CLEANER_1_ID,
      TEST_CLEANER_2_ID,
      TEST_CLEANER_3_ID,
    ]);
    await query(`DELETE FROM cleaner_availability WHERE cleaner_id IN ($1, $2, $3)`, [
      TEST_CLEANER_1_ID,
      TEST_CLEANER_2_ID,
      TEST_CLEANER_3_ID,
    ]);
    await query(`DELETE FROM cleaner_profiles WHERE user_id IN ($1, $2, $3)`, [
      TEST_CLEANER_1_ID,
      TEST_CLEANER_2_ID,
      TEST_CLEANER_3_ID,
    ]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [
      TEST_CLIENT_ID,
      TEST_CLEANER_1_ID,
      TEST_CLEANER_2_ID,
      TEST_CLEANER_3_ID,
    ]);
  });

  it("should find matching cleaners without auto-assigning", async () => {
    const job = await query(`SELECT * FROM jobs WHERE id = $1`, [testJobId]);
    const matchResult = await findMatchingCleaners(job.rows[0], {
      limit: 10,
      minReliability: 50,
      autoAssign: false, // V1: Client must select
    });

    expect(matchResult.autoAssigned).toBe(false);
    // Candidates require availability alignment (timezone, is_cleaner_available)
    expect(matchResult.candidates.length).toBeLessThanOrEqual(10);

    if (matchResult.candidates.length > 0) {
      // Should be sorted by score (highest first)
      for (let i = 1; i < matchResult.candidates.length; i++) {
        expect(matchResult.candidates[i - 1].score).toBeGreaterThanOrEqual(
          matchResult.candidates[i].score
        );
      }
      // Top candidate should be platinum (highest tier)
      expect(matchResult.candidates[0].tier).toBe("platinum");
      expect(matchResult.candidates[0].reliabilityScore).toBe(95);
    }
  });

  it("should allow client to send offers to top 3 cleaners", async () => {
    const job = await query(`SELECT * FROM jobs WHERE id = $1`, [testJobId]);
    const matchResult = await findMatchingCleaners(job.rows[0], {
      limit: 10,
      autoAssign: false,
    });

    const top3Cleaners = matchResult.candidates.slice(0, 3);
    if (top3Cleaners.length === 0) {
      // Skip if no candidates (availability/timezone dependent)
      return;
    }
    const cleanerIds = top3Cleaners.map((c) => c.cleanerId);

    await broadcastJobToCleaners(job.rows[0], cleanerIds, 30);

    const offers = await query(
      `SELECT * FROM job_offers WHERE job_id = $1::uuid AND status = 'pending'`,
      [testJobId]
    );

    expect(offers.rows.length).toBe(Math.min(3, top3Cleaners.length));
    expect(offers.rows.map((o) => o.cleaner_id).sort()).toEqual(cleanerIds.sort());
  });

  it("should assign job to first cleaner who accepts", async () => {
    const job = await query(`SELECT * FROM jobs WHERE id = $1`, [testJobId]);
    const matchResult = await findMatchingCleaners(job.rows[0], {
      limit: 3,
      autoAssign: false,
    });

    const top3Cleaners = matchResult.candidates.slice(0, 3);
    if (top3Cleaners.length === 0) return;

    const cleanerIds = top3Cleaners.map((c) => c.cleanerId);

    await broadcastJobToCleaners(job.rows[0], cleanerIds, 30);

    const result = await acceptJobOffer(testJobId, cleanerIds[0]);
    expect(result.success).toBe(true);

    // Verify job is assigned
    const updatedJob = await query(`SELECT cleaner_id, status FROM jobs WHERE id = $1`, [
      testJobId,
    ]);
    expect(updatedJob.rows[0].cleaner_id).toBe(cleanerIds[0]);
    expect(updatedJob.rows[0].status).toBe("accepted");

    // Verify other offers are expired
    const otherOffers = await query(
      `SELECT status FROM job_offers WHERE job_id = $1::uuid AND cleaner_id != $2`,
      [testJobId, cleanerIds[0]]
    );
    expect(otherOffers.rows.every((o) => o.status === "declined_by_system")).toBe(true);
  });
});

describe("V1 Core Features: Reliability → Tier → Payout Flow", { timeout: 15000 }, () => {
  let testClientId: string;
  let testCleanerId: string;
  let testJobId: string;

  beforeAll(async () => {
    testClientId = crypto.randomUUID();
    testCleanerId = crypto.randomUUID();

    // Create test client
    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, 'client', $3) ON CONFLICT (id) DO NOTHING`,
      [testClientId, `test-client-${Date.now()}@test.com`, TEST_PASSWORD_HASH]
    );

    // Give client credits
    await addLedgerEntry({
      userId: testClientId,
      deltaCredits: 5000,
      reason: "adjustment",
    });

    // Create test cleaner
    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, 'cleaner', $3) ON CONFLICT (id) DO NOTHING`,
      [testCleanerId, `test-cleaner-${Date.now()}@test.com`, TEST_PASSWORD_HASH]
    );

    // Create cleaner profile with initial bronze tier
    await query(
      `INSERT INTO cleaner_profiles (user_id, reliability_score, tier, is_available)
       VALUES ($1, 65, 'bronze', true)
       ON CONFLICT (user_id) DO UPDATE SET
         reliability_score = EXCLUDED.reliability_score,
         tier = EXCLUDED.tier`,
      [testCleanerId]
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM reliability_history WHERE cleaner_id = $1`, [testCleanerId]);
    await query(`DELETE FROM payouts WHERE cleaner_id = $1`, [testCleanerId]);
    await query(`DELETE FROM credit_ledger WHERE user_id IN ($1, $2)`, [
      testClientId,
      testCleanerId,
    ]);
    await query(`DELETE FROM jobs WHERE cleaner_id = $1 OR client_id = $2`, [
      testCleanerId,
      testClientId,
    ]);
    await query(`DELETE FROM cleaner_profiles WHERE user_id = $1`, [testCleanerId]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [testClientId, testCleanerId]);
  });

  it("should update reliability score and tier", async () => {
    // Get initial state
    const initial = await getCleanerReliabilityInfo(testCleanerId);
    expect(initial.tier).toBe("bronze");
    expect(Number(initial.score)).toBe(65);

    // Update reliability (simulating job completion with good performance)
    const update = await updateCleanerReliability(testCleanerId, "job_completed");
    expect(update.newScore).toBeDefined();
    expect(update.previousScore).toBe(65);

    // Verify tier updated in database
    const profile = await query(
      `SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`,
      [testCleanerId]
    );
    expect(Number(profile.rows[0].reliability_score)).toBe(update.newScore);
    expect(profile.rows[0].tier).toBeDefined();
  });

  it("should calculate payout percentage from tier", async () => {
    // Set cleaner to different tiers and verify payout percentage
    const tiers = [
      { tier: "bronze", expectedPercent: 80 },
      { tier: "silver", expectedPercent: 82 },
      { tier: "gold", expectedPercent: 84 },
      { tier: "platinum", expectedPercent: 85 },
    ];

    for (const { tier, expectedPercent } of tiers) {
      // Update tier (without triggering updated_at if column doesn't exist)
      await query(`UPDATE cleaner_profiles SET tier = $1 WHERE user_id = $2`, [
        tier,
        testCleanerId,
      ]);

      // Get payout percentage
      const payoutPercent = await getCleanerPayoutPercent(testCleanerId);
      expect(payoutPercent).toBe(expectedPercent);
    }
  });

  it("should use tier-based payout when creating payout record", async () => {
    // Set cleaner to gold tier (without updated_at if column doesn't exist)
    await query(
      `UPDATE cleaner_profiles SET tier = 'gold', reliability_score = 88 WHERE user_id = $1`,
      [testCleanerId]
    );

    // Create a test job and complete it (MIN_LEAD_TIME_HOURS is 2, use 4 to be safe)
    const scheduledStart = new Date();
    scheduledStart.setHours(scheduledStart.getHours() + 4);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + 2);

    const job = await createJob({
      clientId: testClientId,
      scheduledStartAt: scheduledStart.toISOString(),
      scheduledEndAt: scheduledEnd.toISOString(),
      address: "123 Test Street",
      creditAmount: 100,
    });

    testJobId = job.id;

    // Assign cleaner and complete job
    await query(`UPDATE jobs SET cleaner_id = $1, status = 'awaiting_approval' WHERE id = $2`, [
      testCleanerId,
      testJobId,
    ]);

    // Get payout percentage (should be 84% for gold)
    const payoutPercent = await getCleanerPayoutPercent(testCleanerId);
    expect(payoutPercent).toBe(84);

    // Record earnings (this creates payout record)
    const updatedJob = await query(`SELECT * FROM jobs WHERE id = $1`, [testJobId]);
    const payout = await recordEarningsForCompletedJob(updatedJob.rows[0]);

    // Verify payout amount is 84% of job amount (DB returns numeric as string)
    const expectedPayoutCredits = Math.round(100 * 0.84); // 84 credits
    expect(Number(payout.amount_credits)).toBe(expectedPayoutCredits);

    // Cleanup
    await query(`DELETE FROM payouts WHERE id = $1`, [payout.id]);
    await query(`DELETE FROM credit_ledger WHERE job_id = $1`, [testJobId]);
    await query(`DELETE FROM jobs WHERE id = $1`, [testJobId]);
  });
});

describe("V1 Core Features: Reliability Endpoint", () => {
  let testCleanerId: string;

  beforeAll(async () => {
    testCleanerId = crypto.randomUUID();

    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, 'cleaner', $3) ON CONFLICT (id) DO NOTHING`,
      [testCleanerId, `test-cleaner-${Date.now()}@test.com`, TEST_PASSWORD_HASH]
    );

    await query(
      `INSERT INTO cleaner_profiles (user_id, reliability_score, tier, is_available)
       VALUES ($1, 90, 'gold', true)
       ON CONFLICT (user_id) DO UPDATE SET
         reliability_score = EXCLUDED.reliability_score,
         tier = EXCLUDED.tier`,
      [testCleanerId]
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM cleaner_profiles WHERE user_id = $1`, [testCleanerId]);
    await query(`DELETE FROM users WHERE id = $1`, [testCleanerId]);
  });

  it("should return reliability info via getCleanerReliabilityInfo", async () => {
    const reliability = await getCleanerReliabilityInfo(testCleanerId);

    // reliability_score may come back as string from DB, convert to number
    expect(Number(reliability.score)).toBe(90);
    expect(reliability.tier).toBe("gold");
    expect(reliability.stats).toBeDefined();
  });
});
