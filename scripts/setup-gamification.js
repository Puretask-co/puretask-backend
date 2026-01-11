/**
 * Setup Gamification & Onboarding System
 * 
 * Runs migration 030 to create interactive onboarding, achievements, and template library
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function setupGamification() {
  let client;
  
  try {
    console.log('🎮 Setting up Gamification & Onboarding System...\n');

    const migrationPath = path.join(__dirname, '..', 'DB', 'migrations', '030_onboarding_gamification_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    client = await pool.connect();
    console.log('✓ Connected to database');

    console.log('✓ Running migration 030...');
    await client.query(migrationSQL);
    console.log('✓ Migration completed successfully\n');

    // Get stats
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM achievements) as total_achievements,
        (SELECT COUNT(*) FROM certifications) as total_certifications,
        (SELECT COUNT(*) FROM template_library) as library_templates,
        (SELECT COUNT(*) FROM cleaner_onboarding_progress) as cleaners_initialized,
        (SELECT COUNT(*) FROM app_tooltips) as tooltips_defined
    `);

    const result = stats.rows[0];

    console.log('📊 Setup Complete!\n');
    console.log('='.repeat(60));
    console.log(`Achievements Available:      ${result.total_achievements}`);
    console.log(`Certifications Available:    ${result.total_certifications}`);
    console.log(`Template Library Items:      ${result.library_templates}`);
    console.log(`Cleaners Initialized:        ${result.cleaners_initialized}`);
    console.log(`Tooltips Defined:            ${result.tooltips_defined}`);
    console.log('='.repeat(60));
    
    console.log('\n✨ Gamification System is ready!\n');
    console.log('🎯 Features Enabled:');
    console.log('  ✅ Interactive onboarding tracking');
    console.log('  ✅ Profile completion percentage');
    console.log('  ✅ 14 achievement badges');
    console.log('  ✅ 4-tier certification program');
    console.log('  ✅ Template library with ratings');
    console.log('  ✅ In-app tooltip system');
    console.log('  ✅ Progress tracking & analytics\n');

    console.log('📍 New API Endpoints Available:');
    console.log('   GET    /cleaner/onboarding/progress');
    console.log('   POST   /cleaner/onboarding/update');
    console.log('   GET    /cleaner/achievements');
    console.log('   GET    /cleaner/certifications');
    console.log('   GET    /template-library');
    console.log('   POST   /template-library/save');
    console.log('   POST   /template-library/rate');
    console.log('   GET    /tooltips');
    console.log('   POST   /tooltips/dismiss\n');

  } catch (error) {
    console.error('❌ Error setting up gamification:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupGamification();

