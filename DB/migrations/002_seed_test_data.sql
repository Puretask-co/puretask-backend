-- 002_seed_test_data.sql
-- Seed initial test users, profiles, job, and job event for PureTask

-- 1) USERS (client + cleaner)
INSERT INTO users (id, email, phone, password_hash, role, first_name, last_name)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'client@test.com',
    '+155555501',
    NULL,
    'customer',
    'Test',
    'Client'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'cleaner@test.com',
    '+155555502',
    NULL,
    'cleaner',
    'Test',
    'Cleaner'
  )
ON CONFLICT (id) DO NOTHING;

-- 2) CUSTOMER PROFILE
INSERT INTO customers (id, user_id, address, city, state, zipcode)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '123 Main St',
  'Springfield',
  'CA',
  '90001'
)
ON CONFLICT (id) DO NOTHING;

-- 3) CLEANER PROFILE
INSERT INTO cleaners (id, user_id, bio, rating, hourly_rate, status)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000002',
  'Experienced test cleaner used for development & QA.',
  4.9,
  35.00,
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 4) TEST JOB (links test customer + cleaner)
INSERT INTO jobs (
  id,
  client_id,
  cleaner_id,
  status,
  cleaning_type,
  estimated_hours,
  actual_hours,
  snapshot_total_rate_cph,
  final_charge_credits,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000010',  -- customers.id
  '00000000-0000-0000-0000-000000000020',  -- cleaners.id
  'created',
  'basic',
  2.5,
  NULL,
  40.00,
  NULL,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 5) JOB EVENT FOR TEST JOB
INSERT INTO job_events (job_id, event_type, meta)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  (
    SELECT enumlabel::job_event_type
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'job_event_type'
    ORDER BY enumsortorder
    LIMIT 1
  ),
  '{"note":"Test job created for dev"}'::jsonb
);
