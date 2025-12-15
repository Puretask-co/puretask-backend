// scripts/test-v1-features.ts
// Quick test script for V1 core features (reliability, top 3 selection, payout flow)

import { query } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { createJob } from "../src/services/jobsService";
import { findMatchingCleaners, broadcastJobToCleaners } from "../src/services/jobMatchingService";
import { updateCleanerReliability, getCleanerReliabilityInfo } from "../src/services/reliabilityService";
import { getCleanerPayoutPercent } from "../src/services/payoutsService";
import { addLedgerEntry } from "../src/services/creditsService";
import { TEST_PASSWORD_HASH } from "../src/tests/helpers/testConstants";

async function testV1Features() {
  console.log("=".repeat(60));
  console.log("V1 Core Features Test");
  console.log("=".repeat(60));

  const clientId = crypto.randomUUID();
  const cleaner1Id = crypto.randomUUID();
  const cleaner2Id = crypto.randomUUID();

  try {
    // 1. Create test users
    console.log("\n1. Creating test users...");
    await query(
      `INSERT INTO users (id, email, role, password_hash) VALUES 
        ($1, $4, 'client', $7),
        ($2, $5, 'cleaner', $7),
        ($3, $6, 'cleaner', $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        clientId,
        cleaner1Id,
        cleaner2Id,
        `test-client-${Date.now()}@test.com`,
        `test-cleaner-1-${Date.now()}@test.com`,
        `test-cleaner-2-${Date.now()}@test.com`,
        TEST_PASSWORD_HASH,
      ]
    );

    // Create cleaner profiles with different tiers
    await query(
      `INSERT INTO cleaner_profiles (user_id, reliability_score, tier, hourly_rate_credits, is_available)
       VALUES 
         ($1, 95, 'platinum', 50, true),
         ($2, 85, 'gold', 45, true)
       ON CONFLICT (user_id) DO UPDATE SET
         reliability_score = EXCLUDED.reliability_score,
         tier = EXCLUDED.tier`,
      [cleaner1Id, cleaner2Id]
    );

    // Give client credits
    await addLedgerEntry({
      userId: clientId,
      deltaCredits: 5000,
      reason: "adjustment",
    });

    console.log("✅ Test users created");

    // 2. Test reliability endpoint
    console.log("\n2. Testing reliability system...");
    const reliability1 = await getCleanerReliabilityInfo(cleaner1Id);
    console.log(`   Cleaner 1: Score=${reliability1.score}, Tier=${reliability1.tier}`);
    if (Number(reliability1.score) !== 95) throw new Error(`Expected score 95, got ${reliability1.score}`);
    if (reliability1.tier !== "platinum") throw new Error(`Expected tier platinum, got ${reliability1.tier}`);
    console.log("✅ Reliability endpoint works");

    // 3. Test tier-based payout
    console.log("\n3. Testing tier-based payout...");
    const payoutPercent1 = await getCleanerPayoutPercent(cleaner1Id);
    const payoutPercent2 = await getCleanerPayoutPercent(cleaner2Id);
    console.log(`   Platinum (95): ${payoutPercent1}%`);
    console.log(`   Gold (85): ${payoutPercent2}%`);
    if (payoutPercent1 !== 85) throw new Error(`Expected 85%, got ${payoutPercent1}%`);
    if (payoutPercent2 !== 84) throw new Error(`Expected 84%, got ${payoutPercent2}%`);
    console.log("✅ Tier-based payout works");

    // 4. Test top 3 selection
    console.log("\n4. Testing top 3 cleaner selection...");
    const scheduledStart = new Date();
    scheduledStart.setHours(scheduledStart.getHours() + 2);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + 2);

    const job = await createJob({
      clientId,
      scheduledStartAt: scheduledStart.toISOString(),
      scheduledEndAt: scheduledEnd.toISOString(),
      address: "123 Test Street, Test City, TC 12345",
      creditAmount: 100,
    });

    console.log(`   Job created: ${job.id}`);

    // Get candidates (should not auto-assign)
    const matchResult = await findMatchingCleaners(job, {
      limit: 10,
      autoAssign: false, // V1: Client must select
    });

    console.log(`   Found ${matchResult.candidates.length} candidates`);
    console.log(`   Auto-assigned: ${matchResult.autoAssigned}`);
    if (matchResult.autoAssigned !== false) throw new Error("Expected autoAssigned to be false");
    if (matchResult.candidates.length === 0) throw new Error("Expected at least one candidate");

    // Select top 2 cleaners
    const topCleaners = matchResult.candidates.slice(0, 2);
    const cleanerIds = topCleaners.map((c) => c.cleanerId);
    console.log(`   Selected cleaners: ${cleanerIds.join(", ")}`);

    // Send offers
    await broadcastJobToCleaners(job, cleanerIds, 30);
    console.log("   Offers sent");

    // Verify offers
    const offers = await query(
      `SELECT * FROM job_offers WHERE job_id = $1 AND status = 'pending'`,
      [job.id]
    );
    console.log(`   Offers created: ${offers.rows.length}`);
    if (offers.rows.length !== 2) throw new Error(`Expected 2 offers, got ${offers.rows.length}`);
    console.log("✅ Top 3 selection works");

    // 5. Test reliability update
    console.log("\n5. Testing reliability update...");
    const update = await updateCleanerReliability(cleaner2Id, "job_completed");
    console.log(`   Updated: ${update.previousScore} → ${update.newScore}`);
    console.log("✅ Reliability update works");

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    throw error;
  } finally {
    // Cleanup
    console.log("\nCleaning up...");
    await query(`DELETE FROM job_offers WHERE job_id IN (SELECT id FROM jobs WHERE client_id = $1)`, [clientId]);
    await query(`DELETE FROM credit_ledger WHERE user_id IN ($1, $2, $3)`, [clientId, cleaner1Id, cleaner2Id]);
    await query(`DELETE FROM jobs WHERE client_id = $1`, [clientId]);
    await query(`DELETE FROM cleaner_profiles WHERE user_id IN ($1, $2)`, [cleaner1Id, cleaner2Id]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [clientId, cleaner1Id, cleaner2Id]);
    console.log("✅ Cleanup complete");
  }
}


testV1Features()
  .then(() => {
    console.log("\n✅ All V1 features working correctly!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });

