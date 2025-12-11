#!/usr/bin/env node
/**
 * Check what columns exist in the job_events table
 * This helps diagnose schema mismatches
 * Run with: node scripts/check-job-events-columns.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkJobEventsColumns() {
  try {
    console.log("Checking job_events table columns...\n");

    // Get all columns in the job_events table
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'job_events'
      ORDER BY ordinal_position;
    `);

    console.log("Columns in job_events table:");
    console.log("=".repeat(80));
    result.rows.forEach((row) => {
      console.log(
        `  ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} nullable: ${row.is_nullable} default: ${row.column_default || "none"}`
      );
    });

    // Check specifically for type/event_name vs event_type
    const hasType = result.rows.some((r) => r.column_name === "type");
    const hasEventName = result.rows.some((r) => r.column_name === "event_name");
    const hasEventType = result.rows.some((r) => r.column_name === "event_type");

    console.log("\n" + "=".repeat(80));
    console.log("Column Name Analysis:");
    console.log(`  type:            ${hasType ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  event_name:      ${hasEventName ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  event_type:       ${hasEventType ? "✓ EXISTS" : "✗ MISSING"}`);

    if (hasType && !hasEventType) {
      console.log("\n⚠️  ISSUE: Database has 'type' but code expects 'event_type'");
      console.log("   Run this command in Neon SQL Editor:");
      console.log("   ALTER TABLE job_events RENAME COLUMN type TO event_type;");
    } else if (hasEventName && !hasEventType) {
      console.log("\n⚠️  ISSUE: Database has 'event_name' but code expects 'event_type'");
      console.log("   Run this command in Neon SQL Editor:");
      console.log("   ALTER TABLE job_events RENAME COLUMN event_name TO event_type;");
    } else if (hasEventType) {
      console.log("\n✅ Column 'event_type' exists - schema is correct!");
    } else {
      console.log("\n⚠️  ISSUE: Neither 'type', 'event_name', nor 'event_type' found");
      console.log("   The job_events table may be missing the event type column entirely");
    }

    // Check for other critical columns
    const criticalColumns = ["actor_type", "actor_id", "event_type"];
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

checkJobEventsColumns();

