#!/usr/bin/env node
/**
 * Check what the payouts_cleaner_id_fkey foreign key constraint actually references
 * Run with: node scripts/check-payouts-fk.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPayoutsFK() {
  try {
    console.log("Checking payouts_cleaner_id_fkey foreign key constraint...\n");

    // Get the foreign key constraint definition
    const fkResult = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'payouts'
        AND tc.constraint_name = 'payouts_cleaner_id_fkey';
    `);

    if (fkResult.rows.length === 0) {
      console.log("❌ Foreign key constraint 'payouts_cleaner_id_fkey' not found!");
      console.log("   This might mean the constraint has a different name or doesn't exist.");
      
      // List all foreign keys on payouts table
      const allFKs = await pool.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'payouts';
      `);
      
      console.log("\nAll foreign keys on payouts table:");
      allFKs.rows.forEach(fk => {
        console.log(`  ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      const fk = fkResult.rows[0];
      console.log("✓ Found foreign key constraint:");
      console.log(`  Constraint: ${fk.constraint_name}`);
      console.log(`  Column: ${fk.column_name}`);
      console.log(`  References: ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      
      if (fk.foreign_table_name !== 'users' || fk.foreign_column_name !== 'id') {
        console.log("\n⚠️  ISSUE: Foreign key references wrong table/column!");
        console.log(`   Expected: users.id`);
        console.log(`   Actual: ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      } else {
        console.log("\n✓ Foreign key correctly references users.id");
      }
    }

    // Check if cleaner_profiles table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'cleaner_profiles'
      ) AS exists;
    `);

    if (tableCheck.rows[0].exists) {
      console.log("\n✓ cleaner_profiles table exists");
    } else {
      console.log("\n❌ cleaner_profiles table does NOT exist");
      console.log("   This might be why the foreign key is failing if it references cleaner_profiles");
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error checking foreign key:", error);
    await pool.end();
    process.exit(1);
  }
}

checkPayoutsFK();

