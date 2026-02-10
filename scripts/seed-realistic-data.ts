// scripts/seed-realistic-data.ts
// Generate realistic test data for PureTask platform

import { pool } from '../src/db/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

interface User {
  id: string;
  email: string;
  role: 'client' | 'cleaner' | 'admin';
}

const users: User[] = [];
const cleaners: any[] = [];
const clients: any[] = [];

async function seedDatabase() {
  console.log('🌱 Starting database seeding with realistic data...\n');

  try {
    // 1. Create Users
    console.log('👥 Creating 100 users...');
    await createUsers(80, 'client');  // 80 clients
    await createUsers(18, 'cleaner');  // 18 cleaners
    await createUsers(2, 'admin');     // 2 admins
    console.log('✅ Users created\n');

    // 2. Create Cleaner Profiles
    console.log('🧹 Creating cleaner profiles...');
    await createCleanerProfiles();
    console.log('✅ Cleaner profiles created\n');

    // 3. Create Bookings
    console.log('📅 Creating 500 bookings...');
    await createBookings(500);
    console.log('✅ Bookings created\n');

    // 4. Create Messages
    console.log('💬 Creating 1000 messages...');
    await createMessages(1000);
    console.log('✅ Messages created\n');

    // 5. Create Reviews
    console.log('⭐ Creating 200 reviews...');
    await createReviews(200);
    console.log('✅ Reviews created\n');

    // 6. Create Transactions
    console.log('💰 Creating transactions...');
    await createTransactions();
    console.log('✅ Transactions created\n');

    console.log('🎉 Database seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Cleaners: ${cleaners.length}`);
    console.log(`   - Clients: ${clients.length}`);
    console.log(`   - Bookings: 500`);
    console.log(`   - Messages: 1000`);
    console.log(`   - Reviews: 200`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function createUsers(count: number, role: 'client' | 'cleaner' | 'admin') {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${role}${i}@puretask.test`;
    
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, email, role
    `, [email, passwordHash, role, firstName, lastName, faker.phone.number()]);
    
    const user = result.rows[0];
    users.push(user);
    
    if (role === 'client') {
      clients.push(user);
    } else if (role === 'cleaner') {
      cleaners.push(user);
    }
  }
}

async function createCleanerProfiles() {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  
  for (const cleaner of cleaners) {
    const tier = faker.helpers.arrayElement(tiers);
    const hourlyRate = tier === 'bronze' ? 50 : tier === 'silver' ? 75 : tier === 'gold' ? 100 : 150;
    const totalJobs = faker.number.int({ min: 5, max: 500 });
    const avgRating = faker.number.float({ min: 3.5, max: 5.0, precision: 0.1 });
    
    await pool.query(`
      INSERT INTO cleaners (user_id, tier, hourly_rate_credits, total_jobs_completed, avg_rating, bio, skills)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      cleaner.id,
      tier,
      hourlyRate,
      totalJobs,
      avgRating,
      faker.lorem.paragraph(),
      JSON.stringify(faker.helpers.arrayElements([
        'Deep Cleaning',
        'Move In/Out',
        'Pet-Friendly',
        'Eco-Friendly Products',
        'Window Cleaning',
        'Carpet Cleaning'
      ], faker.number.int({ min: 2, max: 5 })))
    ]);
  }
}

async function createBookings(count: number) {
  const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const serviceTypes = ['standard', 'deep', 'move_in_out'];
  
  for (let i = 0; i < count; i++) {
    const client = faker.helpers.arrayElement(clients);
    const cleaner = faker.helpers.arrayElement(cleaners);
    const status = faker.helpers.arrayElement(statuses);
    const serviceType = faker.helpers.arrayElement(serviceTypes);
    const durationHours = faker.helpers.arrayElement([2, 3, 4, 6, 8]);
    const scheduledDate = faker.date.between({
      from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
      to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)    // 3 months from now
    });
    
    await pool.query(`
      INSERT INTO jobs (
        client_id, cleaner_id, status, service_type, duration_hours,
        scheduled_date, address, city, state, zip_code, total_credits
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      client.id,
      cleaner.id,
      status,
      serviceType,
      durationHours,
      scheduledDate,
      faker.location.streetAddress(),
      faker.location.city(),
      faker.location.state({ abbreviated: true }),
      faker.location.zipCode(),
      durationHours * 50
    ]);
  }
}

async function createMessages(count: number) {
  for (let i = 0; i < count; i++) {
    const sender = faker.helpers.arrayElement(users);
    const receiver = faker.helpers.arrayElement(users.filter(u => u.id !== sender.id));
    
    await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      sender.id,
      receiver.id,
      faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
      faker.datatype.boolean(),
      faker.date.recent({ days: 30 })
    ]);
  }
}

async function createReviews(count: number) {
  for (let i = 0; i < count; i++) {
    const client = faker.helpers.arrayElement(clients);
    const cleaner = faker.helpers.arrayElement(cleaners);
    const rating = faker.number.int({ min: 3, max: 5 });
    
    await pool.query(`
      INSERT INTO reviews (client_id, cleaner_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      client.id,
      cleaner.id,
      rating,
      rating >= 4 ? faker.lorem.sentences(2) : faker.lorem.sentence(),
      faker.date.recent({ days: 90 })
    ]);
  }
}

async function createTransactions() {
  // Create transactions for completed bookings
  const completedJobs = await pool.query(`
    SELECT id, client_id, cleaner_id, total_credits 
    FROM jobs 
    WHERE status = 'completed' 
    LIMIT 100
  `);
  
  for (const job of completedJobs.rows) {
    await pool.query(`
      INSERT INTO transactions (
        user_id, amount_credits, type, status, description, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      job.client_id,
      -job.total_credits,
      'payment',
      'completed',
      `Payment for job #${job.id}`,
      faker.date.recent({ days: 60 })
    ]);
    
    await pool.query(`
      INSERT INTO transactions (
        user_id, amount_credits, type, status, description, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      job.cleaner_id,
      job.total_credits * 0.85, // 15% platform fee
      'payout',
      'completed',
      `Payout for job #${job.id}`,
      faker.date.recent({ days: 60 })
    ]);
  }
}

// Run seeding
seedDatabase()
  .then(() => {
    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });

