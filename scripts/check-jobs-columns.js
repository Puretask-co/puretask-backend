#!/usr/bin/env node
/**
 * Check what columns exist in the jobs table
 * This helps diagnose schema mismatches
 * Run with: node scripts/check-jobs-columns.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkJobsColumns() {
  try {
    console.log("Checking jobs table columns...\n");

    // Get all columns in the jobs table
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'jobs'
      ORDER BY ordinal_position;
    `);

    console.log("Columns in jobs table:");
    console.log("=" .repeat(80));
    result.rows.forEach((row) => {
      console.log(
        `  ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} nullable: ${row.is_nullable} default: ${row.column_default || "none"}`
      );
    });

    // Check specifically for scheduled_start vs scheduled_start_at
    const hasScheduledStart = result.rows.some((r) => r.column_name === "scheduled_start");
    const hasScheduledStartAt = result.rows.some((r) => r.column_name === "scheduled_start_at");
    const hasScheduledEnd = result.rows.some((r) => r.column_name === "scheduled_end");
    const hasScheduledEndAt = result.rows.some((r) => r.column_name === "scheduled_end_at");

    console.log("\n" + "=".repeat(80));
    console.log("Column Name Analysis:");
    console.log(`  scheduled_start:      ${hasScheduledStart ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  scheduled_start_at:    ${hasScheduledStartAt ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  scheduled_end:         ${hasScheduledEnd ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  scheduled_end_at:      ${hasScheduledEndAt ? "✓ EXISTS" : "✗ MISSING"}`);

    if (hasScheduledStart && !hasScheduledStartAt) {
      console.log("\n⚠️  ISSUE: Database has 'scheduled_start' but code expects 'scheduled_start_at'");
      console.log("   Run the fix script: DB/migrations/000_fix_missing_schema.sql");
    }
    if (hasScheduledEnd && !hasScheduledEndAt) {
      console.log("\n⚠️  ISSUE: Database has 'scheduled_end' but code expects 'scheduled_end_at'");
      console.log("   Run the fix script: DB/migrations/000_fix_missing_schema.sql");
    }

    // Check for other critical columns
    const criticalColumns = ["address", "credit_amount", "scheduled_start_at", "scheduled_end_at"];
    const missingColumns = criticalColumns.filter(
      (col) => !result.rows.some((r) => r.column_name === col)
    );

    if (missingColumns.length > 0) {
      console.log("\n⚠️  MISSING CRITICAL COLUMNS:");
      missingColumns.forEach((col) => console.log(`   - ${col}`));
      console.log("\n   Run the fix script: DB/migrations/000_fix_missing_schema.sql");
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error checking columns:", error);
    await pool.end();
    process.exit(1);
  }
}

checkJobsColumns();

