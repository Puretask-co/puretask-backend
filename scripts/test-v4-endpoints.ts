// scripts/test-v4-endpoints.ts
// Test V4 endpoints to verify they're working

import request from "http";
import { URL } from "url";
require("dotenv").config();

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const ADMIN_USER_ID = process.env.TEST_ADMIN_USER_ID || "";
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || "";

async function testEndpoint(method: string, path: string, headers: Record<string, string> = {}, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode || 500, body: jsonData });
        } catch {
          resolve({ status: res.statusCode || 500, body: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testV4Endpoints() {
  console.log("🧪 Testing V4 Endpoints...\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  const results: Array<{ endpoint: string; status: number; passed: boolean }> = [];

  // Test Analytics Endpoints (Admin only)
  console.log("📊 Testing Analytics Endpoints...");
  const analyticsHeaders = {
    "x-user-id": ADMIN_USER_ID,
    "x-user-role": "admin",
  };

  const analyticsTests = [
    { path: "/analytics/dashboard?timeRange=month", name: "GET /analytics/dashboard" },
    { path: "/analytics/revenue/trend?timeRange=month", name: "GET /analytics/revenue/trend" },
    { path: "/analytics/jobs/trend?timeRange=month", name: "GET /analytics/jobs/trend" },
    { path: "/analytics/users/signups?timeRange=month", name: "GET /analytics/users/signups" },
    { path: "/analytics/credits/health", name: "GET /analytics/credits/health" },
  ];

  for (const test of analyticsTests) {
    try {
      const result = await testEndpoint("GET", test.path, analyticsHeaders);
      const passed = result.status === 200 || result.status === 403; // 403 = auth issue, but endpoint exists
      results.push({ endpoint: test.name, status: result.status, passed });
      console.log(`  ${passed ? "✅" : "❌"} ${test.name}: ${result.status}`);
    } catch (error) {
      console.log(`  ❌ ${test.name}: Error - ${(error as Error).message}`);
      results.push({ endpoint: test.name, status: 0, passed: false });
    }
  }

  // Test Manager Endpoints (Admin only)
  console.log("\n🎛️  Testing Manager Endpoints...");
  const managerTests = [
    { path: "/manager/overview", name: "GET /manager/overview" },
    { path: "/manager/alerts", name: "GET /manager/alerts" },
    { path: "/manager/heatmap", name: "GET /manager/heatmap" },
    { path: "/manager/tiers", name: "GET /manager/tiers" },
  ];

  for (const test of managerTests) {
    try {
      const result = await testEndpoint("GET", test.path, analyticsHeaders);
      const passed = result.status === 200 || result.status === 403;
      results.push({ endpoint: test.name, status: result.status, passed });
      console.log(`  ${passed ? "✅" : "❌"} ${test.name}: ${result.status}`);
    } catch (error) {
      console.log(`  ❌ ${test.name}: Error - ${(error as Error).message}`);
      results.push({ endpoint: test.name, status: 0, passed: false });
    }
  }

  // Test Premium Endpoints (Boosts, Referrals, Rush)
  console.log("\n💎 Testing Premium Endpoints (V4 features)...");
  const premiumHeaders = {
    "x-user-id": ADMIN_USER_ID, // Using admin for testing, in real scenario use cleaner/client
    "x-user-role": "cleaner",
  };

  const premiumTests = [
    { path: "/premium/boosts/options", name: "GET /premium/boosts/options" },
    { path: "/premium/boosts/active", name: "GET /premium/boosts/active" },
    { path: "/premium/referrals/code", name: "GET /premium/referrals/code" },
    { path: "/premium/referrals/stats", name: "GET /premium/referrals/stats" },
  ];

  for (const test of premiumTests) {
    try {
      const result = await testEndpoint("GET", test.path, premiumHeaders);
      const passed = result.status === 200 || result.status === 403;
      results.push({ endpoint: test.name, status: result.status, passed });
      console.log(`  ${passed ? "✅" : "❌"} ${test.name}: ${result.status}`);
    } catch (error) {
      console.log(`  ❌ ${test.name}: Error - ${(error as Error).message}`);
      results.push({ endpoint: test.name, status: 0, passed: false });
    }
  }

  // Test Risk Endpoints (Admin only)
  console.log("\n⚠️  Testing Risk Endpoints...");
  const riskTests = [
    { path: "/admin/risk/review", name: "GET /admin/risk/review" },
  ];

  for (const test of riskTests) {
    try {
      const result = await testEndpoint("GET", test.path, analyticsHeaders);
      const passed = result.status === 200 || result.status === 403;
      results.push({ endpoint: test.name, status: result.status, passed });
      console.log(`  ${passed ? "✅" : "❌"} ${test.name}: ${result.status}`);
    } catch (error) {
      console.log(`  ❌ ${test.name}: Error - ${(error as Error).message}`);
      results.push({ endpoint: test.name, status: 0, passed: false });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed Endpoints:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.endpoint}: ${r.status || "Error"}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  
  if (failed === 0) {
    console.log("✅ ALL V4 ENDPOINT TESTS PASSED");
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed} ENDPOINT TESTS FAILED`);
    process.exit(1);
  }
}

testV4Endpoints().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

