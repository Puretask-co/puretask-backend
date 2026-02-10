/**
 * Add Enhanced Templates & Quick Responses
 * 
 * Runs migration 029 to add 11 more templates and 15 more quick responses
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function addEnhancedTemplates() {
  let client;
  
  try {
    console.log('📝 Adding Enhanced Templates & Quick Responses...\n');

    const migrationPath = path.join(__dirname, '..', 'DB', 'migrations', '029_enhanced_cleaner_ai_templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    client = await pool.connect();
    console.log('✓ Connected to database');

    console.log('✓ Running migration 029...');
    await client.query(migrationSQL);
    console.log('✓ Migration completed successfully\n');

    // Get updated stats
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM cleaner_ai_templates) as total_templates,
        (SELECT COUNT(*) FROM cleaner_quick_responses) as total_responses,
        (SELECT COUNT(*) FROM cleaner_ai_templates WHERE template_type = 'job_complete') as job_complete,
        (SELECT COUNT(*) FROM cleaner_ai_templates WHERE template_type = 'review_request') as review_request,
        (SELECT COUNT(*) FROM cleaner_quick_responses WHERE response_category = 'payment') as payment_responses,
        (SELECT COUNT(*) FROM cleaner_quick_responses WHERE response_category = 'cancellation') as cancellation_responses
    `);

    const result = stats.rows[0];

    console.log('📊 Enhancement Complete!\n');
    console.log('='.repeat(60));
    console.log(`Total Templates Now:        ${result.total_templates} (was 3)`);
    console.log(`Total Quick Responses Now:  ${result.total_responses} (was 3)`);
    console.log('='.repeat(60));
    console.log('\n✨ New Templates Added:');
    console.log('  ✅ Job Completion Message');
    console.log('  ✅ Review Request');
    console.log('  ✅ Rescheduling Notification');
    console.log('  ✅ Running Late Alert');
    console.log('  ✅ Special Instructions Reminder');
    console.log('  ✅ Payment Thank You');
    console.log('  ✅ Vacation Auto-Reply');
    console.log('  ✅ Weather Delay');
    console.log('  ✅ First Time Client Welcome');
    console.log('  ✅ Issue Resolution');
    console.log('  ✅ Referral Thank You');
    console.log('\n💬 New Quick Responses Added:');
    console.log('  ✅ Payment Methods');
    console.log('  ✅ Cancellation Policy');
    console.log('  ✅ Pet-Friendly Policies');
    console.log('  ✅ Supply Preferences');
    console.log('  ✅ Special Requests');
    console.log('  ✅ Parking & Access');
    console.log('  ✅ Post-Service Issues');
    console.log('  ✅ Tipping Policy');
    console.log('  ✅ Service Frequency');
    console.log('  ✅ Eco-Friendly Products');
    console.log('  ✅ Time Estimates');
    console.log('  ✅ Background Check Info');
    console.log('  ✅ Move-In/Out Cleaning');
    console.log('  ✅ Same-Day Service');
    console.log('  ✅ What\'s Included');
    console.log('\n🎉 Cleaners now have a comprehensive library!\n');

  } catch (error) {
    console.error('❌ Error adding enhanced templates:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

addEnhancedTemplates();

