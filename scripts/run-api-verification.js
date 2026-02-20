#!/usr/bin/env node
/**
 * API verification script: health + login
 * Usage:
 *   TEST_PASSWORD=YourPassword node scripts/run-api-verification.js
 *   API_BASE=http://localhost:4000 TEST_EMAIL=you@example.com TEST_PASSWORD=YourPassword node scripts/run-api-verification.js
 * Default email: testcleaner.pt@gmail.com. Set TEST_PASSWORD (required for login check).
 * Requires: backend running (npm run dev), user must exist in DB.
 */

const API_BASE = process.env.API_BASE || "http://localhost:4000";
const TEST_EMAIL = process.env.TEST_EMAIL || "testcleaner.pt@gmail.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "";

async function main() {
  let passed = 0;
  let failed = 0;

  // 1. GET /health
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok === true) {
      console.log("✅ GET /health passes");
      passed++;
    } else {
      console.log("❌ GET /health failed:", res.status, data);
      failed++;
    }
  } catch (err) {
    console.log("❌ GET /health error:", err.message);
    failed++;
  }

  // 2. POST /auth/login
  if (!TEST_PASSWORD) {
    console.log("⏭️  POST /auth/login skipped (set TEST_PASSWORD to run login check)");
  } else {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        console.log("✅ POST /auth/login passes (token received)");
        passed++;
      } else {
        console.log("❌ POST /auth/login failed:", res.status, data.error || data.message || data);
        failed++;
      }
    } catch (err) {
      console.log("❌ POST /auth/login error:", err.message);
      failed++;
    }
  }

  console.log("");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
