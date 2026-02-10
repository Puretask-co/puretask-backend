/**
 * Setup Cleaner AI Settings Suite
 * 
 * Runs migration 028 to create comprehensive AI Assistant settings for cleaners
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function setupCleanerAISettings() {
  let client;
  
  try {
    console.log('🤖 Setting up Cleaner AI Settings Suite...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'DB', 'migrations', '028_cleaner_ai_settings_suite.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    client = await pool.connect();
    console.log('✓ Connected to database');

    // Run the migration
    console.log('✓ Running migration 028...');
    await client.query(migrationSQL);
    console.log('✓ Migration completed successfully\n');

    // Get stats
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM cleaner_ai_settings) as settings_count,
        (SELECT COUNT(*) FROM cleaner_ai_templates) as templates_count,
        (SELECT COUNT(*) FROM cleaner_quick_responses) as responses_count,
        (SELECT COUNT(*) FROM cleaner_ai_preferences) as preferences_count,
        (SELECT COUNT(DISTINCT user_id) FROM cleaner_profiles) as cleaners_count
    `);

    const result = stats.rows[0];

    console.log('📊 Setup Complete!\n');
    console.log('='.repeat(50));
    console.log(`Total Cleaners:        ${result.cleaners_count}`);
    console.log(`AI Settings Created:   ${result.settings_count}`);
    console.log(`Default Templates:     ${result.templates_count}`);
    console.log(`Quick Responses:       ${result.responses_count}`);
    console.log(`AI Preferences:        ${result.preferences_count}`);
    console.log('='.repeat(50));
    console.log('\n✨ Cleaner AI Settings Suite is ready!\n');
    console.log('📍 API Endpoints Available:');
    console.log('   GET    /cleaner/ai/settings');
    console.log('   GET    /cleaner/ai/settings/:category');
    console.log('   PATCH  /cleaner/ai/settings/:settingKey');
    console.log('   POST   /cleaner/ai/settings/bulk-update');
    console.log('   GET    /cleaner/ai/templates');
    console.log('   POST   /cleaner/ai/templates');
    console.log('   PATCH  /cleaner/ai/templates/:templateId');
    console.log('   DELETE /cleaner/ai/templates/:templateId');
    console.log('   GET    /cleaner/ai/quick-responses');
    console.log('   POST   /cleaner/ai/quick-responses');
    console.log('   PATCH  /cleaner/ai/quick-responses/:responseId');
    console.log('   DELETE /cleaner/ai/quick-responses/:responseId');
    console.log('   GET    /cleaner/ai/preferences');
    console.log('   PATCH  /cleaner/ai/preferences');
    console.log('   GET    /cleaner/ai/insights\n');

  } catch (error) {
    console.error('❌ Error setting up cleaner AI settings:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupCleanerAISettings();

