// scripts/simple-seed.ts
// Simple seed - just users for testing

import { pool } from '../src/db/client';
import bcrypt from 'bcryptjs';

async function simpleSeed() {
  console.log('🌱 Starting simple seed...\n');

  try {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);

    // Create test clients
    console.log('👥 Creating 5 test clients...');
    for (let i = 1; i <= 5; i++) {
      await pool.query(`
        INSERT INTO users (email, password_hash, role, first_name, last_name)
        VALUES ($1, $2, 'client', $3, $4)
        ON CONFLICT (email) DO NOTHING
      `, [`testclient${i}@test.com`, passwordHash, `TestClient`, `${i}`]);
    }
    console.log('✅ Clients created');

    // Create test cleaners
    console.log('👥 Creating 3 test cleaners...');
    for (let i = 1; i <= 3; i++) {
      await pool.query(`
        INSERT INTO users (email, password_hash, role, first_name, last_name)
        VALUES ($1, $2, 'cleaner', $3, $4)
        ON CONFLICT (email) DO NOTHING
      `, [`testcleaner${i}@test.com`, passwordHash, `TestCleaner`, `${i}`]);
    }
    console.log('✅ Cleaners created');

    // Create test admin
    console.log('👥 Creating test admin...');
    await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name)
      VALUES ($1, $2, 'admin', 'Test', 'Admin')
      ON CONFLICT (email) DO NOTHING
    `, ['testadmin@test.com', passwordHash]);
    console.log('✅ Admin created');

    console.log('\n🎉 Seeding complete!\n');
    console.log('📊 Summary:');
    console.log('   - 5 test clients');
    console.log('   - 3 test cleaners');
    console.log('   - 1 test admin\n');
    console.log('📧 Test Accounts (all use password: TestPass123!):');
    console.log('   testclient1@test.com through testclient5@test.com');
    console.log('   testcleaner1@test.com through testcleaner3@test.com');
    console.log('   testadmin@test.com\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

simpleSeed()
  .then(() => {
    console.log('✅ Seed completed successfully!');
    process.exit(0);
  })
  .catch(() => {
    console.log('❌ Seed failed!');
    process.exit(1);
  });

