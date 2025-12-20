// scripts/verify-v4-deployment.js
// Verify V4 features are properly deployed and functional

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyV4Deployment() {
  console.log("🔍 Verifying V4 Deployment...\n");
  
  const checks = {
    routes: { passed: 0, failed: 0, details: [] },
    database: { passed: 0, failed: 0, details: [] },
    workers: { passed: 0, failed: 0, details: [] },
  };

  try {
    // 1. Check Database Tables
    console.log("📊 Checking Database Tables...");
    
    // Check cleaner_boosts table
    try {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'cleaner_boosts' 
        ORDER BY ordinal_position
      `);
      
      if (result.rows.length > 0) {
        console.log("  ✅ cleaner_boosts table exists");
        checks.database.passed++;
        checks.database.details.push("cleaner_boosts table exists");
      } else {
        console.log("  ❌ cleaner_boosts table missing");
        checks.database.failed++;
        checks.database.details.push("cleaner_boosts table missing");
      }
    } catch (error) {
      console.log(`  ❌ Error checking cleaner_boosts: ${error.message}`);
      checks.database.failed++;
      checks.database.details.push(`cleaner_boosts check failed: ${error.message}`);
    }

    // Check kpi_snapshots table (used by analytics)
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'kpi_snapshots' 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        console.log("  ✅ kpi_snapshots table exists");
        checks.database.passed++;
        checks.database.details.push("kpi_snapshots table exists");
      } else {
        console.log("  ⚠️  kpi_snapshots table missing (analytics may not work fully)");
        checks.database.details.push("kpi_snapshots table missing (optional)");
      }
    } catch (error) {
      console.log(`  ⚠️  kpi_snapshots check failed (optional): ${error.message}`);
    }

    // Check referral_codes table
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'referral_codes' 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        console.log("  ✅ referral_codes table exists");
        checks.database.passed++;
        checks.database.details.push("referral_codes table exists");
      } else {
        console.log("  ❌ referral_codes table missing");
        checks.database.failed++;
        checks.database.details.push("referral_codes table missing");
      }
    } catch (error) {
      console.log(`  ❌ Error checking referral_codes: ${error.message}`);
      checks.database.failed++;
      checks.database.details.push(`referral_codes check failed: ${error.message}`);
    }

    // 2. Check for Active Boosts
    console.log("\n🚀 Checking Active Boosts...");
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM cleaner_boosts 
        WHERE status = 'active' 
        AND expires_at > NOW()
      `);
      const count = parseInt(result.rows[0].count, 10);
      console.log(`  ℹ️  Active boosts: ${count}`);
      checks.database.details.push(`Active boosts: ${count}`);
    } catch (error) {
      console.log(`  ⚠️  Could not check active boosts: ${error.message}`);
    }

    // 3. Check KPI Snapshots
    console.log("\n📈 Checking KPI Snapshots...");
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM kpi_snapshots 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      const count = parseInt(result.rows[0]?.count || 0, 10);
      if (count > 0) {
        console.log(`  ✅ KPI snapshots exist: ${count} total`);
        checks.database.details.push(`KPI snapshots: ${count}`);
      } else {
        console.log(`  ⚠️  No KPI snapshots found (worker may need to run)`);
        checks.database.details.push("No KPI snapshots (worker needs to run)");
      }
    } catch (error) {
      console.log(`  ⚠️  Could not check KPI snapshots: ${error.message}`);
    }

    // 4. Check Referral Codes
    console.log("\n🎫 Checking Referral Codes...");
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM referral_codes 
        WHERE is_active = true
      `);
      const count = parseInt(result.rows[0].count, 10);
      console.log(`  ℹ️  Active referral codes: ${count}`);
      checks.database.details.push(`Active referral codes: ${count}`);
    } catch (error) {
      console.log(`  ⚠️  Could not check referral codes: ${error.message}`);
    }

    // 5. Verify Routes are Mounted (check via code inspection)
    console.log("\n🛣️  Checking Routes...");
    console.log("  ℹ️  Routes should be mounted in src/index.ts:");
    console.log("    - /analytics/* (analyticsRouter)");
    console.log("    - /manager/* (managerRouter)");
    console.log("    - /premium/* (premiumRouter - already enabled for V3)");
    checks.routes.details.push("Verify routes mounted in src/index.ts");

    // 6. Verify Workers are Active (check via code inspection)
    console.log("\n⚙️  Checking Workers...");
    console.log("  ℹ️  Workers should be in src/workers/ (not disabled/):");
    console.log("    - expireBoosts.ts");
    console.log("    - kpiDailySnapshot.ts");
    console.log("    - weeklySummary.ts");
    checks.workers.details.push("Verify workers in src/workers/ directory");

    console.log("\n" + "=".repeat(60));
    console.log("📋 VERIFICATION SUMMARY");
    console.log("=".repeat(60));
    
    console.log(`\n✅ Database Checks: ${checks.database.passed} passed, ${checks.database.failed} failed`);
    checks.database.details.forEach(detail => {
      console.log(`   - ${detail}`);
    });

    console.log(`\n⚠️  Route Checks: Manual verification needed`);
    checks.routes.details.forEach(detail => {
      console.log(`   - ${detail}`);
    });

    console.log(`\n⚠️  Worker Checks: Manual verification needed`);
    checks.workers.details.forEach(detail => {
      console.log(`   - ${detail}`);
    });

    const totalPassed = checks.database.passed;
    const totalFailed = checks.database.failed;

    console.log("\n" + "=".repeat(60));
    if (totalFailed === 0) {
      console.log("✅ V4 DEPLOYMENT VERIFICATION: PASSED");
      console.log("=".repeat(60));
      process.exit(0);
    } else {
      console.log(`⚠️  V4 DEPLOYMENT VERIFICATION: ${totalFailed} ISSUES FOUND`);
      console.log("=".repeat(60));
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyV4Deployment().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

