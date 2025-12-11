#!/usr/bin/env node
/**
 * Check if event_name column exists in job_events table
 * Run with: node scripts/check-event-name-column.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEventNameColumn() {
  try {
    console.log("Checking for event_name column in job_events table...\n");

    // Check if event_name column exists
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'job_events'
      AND column_name IN ('event_name', 'event_type', 'type')
      ORDER BY column_name;
    `);

    console.log("Found columns:");
    console.log("=".repeat(80));
    if (result.rows.length === 0) {
      console.log("  No matching columns found!");
    } else {
      result.rows.forEach((row) => {
        console.log(
          `  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} nullable: ${row.is_nullable} default: ${row.column_default || "none"}`
        );
      });
    }

    // Check all columns to see the full picture
    const allColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'job_events'
      ORDER BY ordinal_position;
    `);

    console.log("\n" + "=".repeat(80));
    console.log("All columns in job_events table:");
    allColumns.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.column_name}`);
    });

    const hasEventName = result.rows.some((r) => r.column_name === "event_name");
    const hasEventType = result.rows.some((r) => r.column_name === "event_type");
    const hasType = result.rows.some((r) => r.column_name === "type");

    console.log("\n" + "=".repeat(80));
    console.log("Summary:");
    console.log(`  event_name:  ${hasEventName ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  event_type:  ${hasEventType ? "✓ EXISTS" : "✗ MISSING"}`);
    console.log(`  type:        ${hasType ? "✓ EXISTS" : "✗ MISSING"}`);

    if (hasEventName && hasEventType) {
      console.log("\n⚠️  ISSUE: Both 'event_name' and 'event_type' exist!");
      console.log("   The code uses 'event_type', but 'event_name' might have a NOT NULL constraint.");
      console.log("   Solution: Drop the 'event_name' column if it's not needed:");
      console.log("   ALTER TABLE job_events DROP COLUMN IF EXISTS event_name;");
    } else if (hasEventName && !hasEventType) {
      console.log("\n⚠️  ISSUE: Database has 'event_name' but code expects 'event_type'");
      console.log("   Solution: Rename the column:");
      console.log("   ALTER TABLE job_events RENAME COLUMN event_name TO event_type;");
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error checking columns:", error);
    await pool.end();
    process.exit(1);
  }
}

checkEventNameColumn();

