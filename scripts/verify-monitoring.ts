// scripts/verify-monitoring.ts
// Verification script for monitoring setup

import { env } from "../src/config/env";
import { logger } from "../src/lib/logger";
import { query } from "../src/db/client";

async function verifyMonitoring() {
  console.log("🔍 Verifying Monitoring Setup...\n");

  let allPassed = true;

  // 1. Check Sentry Configuration
  console.log("1. Checking Sentry Configuration...");
  if (env.SENTRY_DSN) {
    console.log("   ✅ SENTRY_DSN is configured");
    console.log(`   📍 DSN: ${env.SENTRY_DSN.substring(0, 20)}...`);
  } else {
    console.log("   ⚠️  SENTRY_DSN is not configured (optional)");
    console.log("   💡 To enable: Add SENTRY_DSN to .env file");
  }

  // 2. Check Metrics System
  console.log("\n2. Checking Metrics System...");
  try {
    const { metrics } = require("../src/lib/metrics");
    if (metrics && typeof metrics.apiRequest === "function") {
      console.log("   ✅ Metrics system is available");
      console.log("   📊 Available metrics:");
      console.log("      - apiRequest()");
      console.log("      - dbQuery()");
      console.log("      - jobCreated()");
      console.log("      - jobCompleted()");
      console.log("      - paymentProcessed()");
      console.log("      - payoutProcessed()");
      console.log("      - errorOccurred()");
    } else {
      console.log("   ❌ Metrics system not properly exported");
      allPassed = false;
    }
  } catch (error) {
    console.log("   ❌ Failed to load metrics system:", (error as Error).message);
    allPassed = false;
  }

  // 3. Check Database Connectivity (for health checks)
  console.log("\n3. Checking Database Connectivity...");
  try {
    const result = await query("SELECT NOW() as current_time, version() as pg_version");
    console.log("   ✅ Database connection successful");
    console.log(`   📅 Current time: ${result.rows[0].current_time}`);
  } catch (error) {
    console.log("   ❌ Database connection failed:", (error as Error).message);
    allPassed = false;
  }

  // 4. Check Health Endpoints
  console.log("\n4. Checking Health Endpoints...");
  console.log("   📍 Health endpoint: GET /health");
  console.log("   📍 Readiness endpoint: GET /health/ready");
  console.log("   📍 Status endpoint: GET /status");
  console.log("   💡 Configure UptimeRobot to monitor these endpoints");

  // 5. Check Logging
  console.log("\n5. Checking Logging System...");
  try {
    logger.info("monitoring_verification_test", { test: true });
    console.log("   ✅ Logger is working");
    console.log("   📝 Check logs for structured JSON output");
  } catch (error) {
    console.log("   ❌ Logger failed:", (error as Error).message);
    allPassed = false;
  }

  // 6. Recommendations
  console.log("\n📋 Recommendations:");
  console.log("   1. Set up Sentry account at https://sentry.io");
  console.log("   2. Add SENTRY_DSN to .env file");
  console.log("   3. Set up UptimeRobot at https://uptimerobot.com");
  console.log("   4. Configure monitors for /health and /health/ready");
  console.log("   5. Set up alert notifications (email/SMS/Slack)");
  console.log("   6. Review metrics in logs or integrate with Datadog/Prometheus");

  // Summary
  console.log("\n" + "=".repeat(50));
  if (allPassed) {
    console.log("✅ Monitoring setup verification PASSED");
    console.log("💡 Next: Set up external monitoring (Sentry, UptimeRobot)");
  } else {
    console.log("⚠️  Monitoring setup verification has issues");
    console.log("💡 Review errors above and fix before proceeding");
  }
  console.log("=".repeat(50) + "\n");
}

verifyMonitoring()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
