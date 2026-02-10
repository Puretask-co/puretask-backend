// scripts/quick-seed.ts
// Quick seed script for testing

import { pool } from '../src/db/client';
import bcrypt from 'bcryptjs';

async function quickSeed() {
  console.log('🌱 Starting quick seed...\n');

  try {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);

    // Create 10 test users
    console.log('👥 Creating test users...');
    for (let i = 1; i <= 5; i++) {
      await pool.query(`
        INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
        VALUES ($1, $2, 'client', $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [`testclient${i}@test.com`, passwordHash, `Client${i}`, `Test`, `+1555000000${i}`]);
    }

    for (let i = 1; i <= 3; i++) {
      const result = await pool.query(`
        INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
        VALUES ($1, $2, 'cleaner', $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [`testcleaner${i}@test.com`, passwordHash, `Cleaner${i}`, `Test`, `+1555000010${i}`]);
      
      if (result.rows.length > 0) {
        // Create cleaner profile
        await pool.query(`
          INSERT INTO cleaners (user_id, tier, hourly_rate_credits, total_jobs_completed, avg_rating, bio)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id) DO NOTHING
        `, [result.rows[0].id, 'silver', 75, 10, 4.5, 'Experienced professional cleaner']);
      }
    }

    console.log('✅ Test users created\n');
    console.log('📊 Summary:');
    console.log('   - 5 test clients created');
    console.log('   - 3 test cleaners created');
    console.log('\n🎉 Seeding complete!\n');
    console.log('📧 Test Accounts:');
    console.log('   Clients: testclient1@test.com through testclient5@test.com');
    console.log('   Cleaners: testcleaner1@test.com through testcleaner3@test.com');
    console.log('   Password: TestPass123!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

quickSeed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

