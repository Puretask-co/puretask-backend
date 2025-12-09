-- ============================================================
-- PURETASK TEST SEED DATA
-- Run AFTER 000_CONSOLIDATED_SCHEMA.sql
-- ============================================================

-- ============================================
-- TEST USERS
-- ============================================

-- Test Admin
INSERT INTO users (id, email, password_hash, role, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'admin@puretask.com',
    '$2b$10$dummyhashforadmin', -- Not a real hash, replace in production
    'admin',
    'Admin',
    'User'
) ON CONFLICT (id) DO NOTHING;

-- Test Client
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'client@test.com',
    '$2b$10$dummyhashforclient',
    'client',
    'Test',
    'Client',
    '+15555550001'
) ON CONFLICT (id) DO NOTHING;

-- Test Cleaner
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'cleaner@test.com',
    '$2b$10$dummyhashforcleaner',
    'cleaner',
    'Test',
    'Cleaner',
    '+15555550002'
) ON CONFLICT (id) DO NOTHING;

-- Second Test Cleaner (Gold tier)
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'cleaner2@test.com',
    '$2b$10$dummyhashforcleaner2',
    'cleaner',
    'Gold',
    'Cleaner',
    '+15555550003'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CLIENT PROFILES
-- ============================================

INSERT INTO client_profiles (id, user_id, first_name, last_name, default_address, grace_cancellations_total, grace_cancellations_used)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Test',
    'Client',
    '123 Main St, Sacramento, CA 95814',
    2,
    0
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CLEANER PROFILES
-- ============================================

-- Bronze tier cleaner
INSERT INTO cleaner_profiles (
    id, user_id, first_name, last_name, bio, tier, reliability_score,
    hourly_rate_credits, base_rate_cph, avg_rating, jobs_completed,
    payout_percent, latitude, longitude, is_available
)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000002',
    'Test',
    'Cleaner',
    'Experienced cleaner for testing. Specializes in residential cleaning.',
    'bronze',
    85.0,
    35,
    35.00,
    4.5,
    12,
    80,
    38.5816,  -- Sacramento lat
    -121.4944, -- Sacramento lng
    true
) ON CONFLICT (id) DO NOTHING;

-- Gold tier cleaner
INSERT INTO cleaner_profiles (
    id, user_id, first_name, last_name, bio, tier, reliability_score,
    hourly_rate_credits, base_rate_cph, avg_rating, jobs_completed,
    payout_percent, latitude, longitude, is_available
)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000003',
    'Gold',
    'Cleaner',
    'Top-rated gold tier cleaner with 5+ years experience.',
    'gold',
    95.0,
    50,
    50.00,
    4.9,
    150,
    84,
    38.5916,
    -121.5044,
    true
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CREDIT ACCOUNTS
-- ============================================

-- Give test client some credits
INSERT INTO credit_accounts (user_id, current_balance, held_balance, lifetime_purchased)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    500,
    0,
    500
) ON CONFLICT (user_id) DO NOTHING;

-- Add to credit ledger
INSERT INTO credit_ledger (user_id, delta_credits, reason)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    500,
    'purchase'
);

-- ============================================
-- TEST JOB
-- ============================================

INSERT INTO jobs (
    id, client_id, cleaner_id, status, scheduled_start_at, scheduled_end_at,
    address, latitude, longitude, credit_amount, cleaning_type, duration_hours
)
VALUES (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'requested',
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days' + INTERVAL '3 hours',
    '123 Main St, Sacramento, CA 95814',
    38.5816,
    -121.4944,
    105,  -- 3 hours * 35 credits
    'basic',
    3.0
) ON CONFLICT (id) DO NOTHING;

-- Job event for test job
INSERT INTO job_events (job_id, actor_type, actor_id, event_type, payload)
VALUES (
    '00000000-0000-0000-0000-000000000100',
    'system',
    NULL,
    'job.created',
    '{"note": "Test job created for development"}'::jsonb
);

-- ============================================
-- CLEANER AVAILABILITY (for test cleaner)
-- ============================================

-- Monday through Friday, 8am-6pm
INSERT INTO cleaner_availability (cleaner_id, day_of_week, start_time, end_time, is_available) VALUES
    ('00000000-0000-0000-0000-000000000002', 1, '08:00', '18:00', true),
    ('00000000-0000-0000-0000-000000000002', 2, '08:00', '18:00', true),
    ('00000000-0000-0000-0000-000000000002', 3, '08:00', '18:00', true),
    ('00000000-0000-0000-0000-000000000002', 4, '08:00', '18:00', true),
    ('00000000-0000-0000-0000-000000000002', 5, '08:00', '18:00', true)
ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;

-- ============================================
-- CLEANER METRICS (initialize)
-- ============================================

INSERT INTO cleaner_metrics (cleaner_id, total_jobs_window, attended_jobs, on_time_checkins, ratings_sum, ratings_count)
VALUES 
    ('00000000-0000-0000-0000-000000000002', 12, 12, 11, 54.0, 12),
    ('00000000-0000-0000-0000-000000000003', 150, 148, 145, 745.0, 150)
ON CONFLICT (cleaner_id) DO NOTHING;

-- ============================================
-- CLIENT RISK SCORE (initialize as normal)
-- ============================================

INSERT INTO client_risk_scores (client_id, risk_score, risk_band)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 'normal')
ON CONFLICT (client_id) DO NOTHING;

-- ============================================
-- CLEANER FLEX PROFILES (initialize)
-- ============================================

INSERT INTO cleaner_flex_profiles (cleaner_id, reasonable_declines_14d, reasonable_declines_30d, low_flexibility_active)
VALUES 
    ('00000000-0000-0000-0000-000000000002', 0, 0, false),
    ('00000000-0000-0000-0000-000000000003', 0, 0, false)
ON CONFLICT (cleaner_id) DO NOTHING;

-- ============================================
-- CLIENT FLEX PROFILES (initialize)
-- ============================================

INSERT INTO client_flex_profiles (client_id, flex_score, reschedules_30d, late_reschedules_30d, cancellations_30d)
VALUES ('00000000-0000-0000-0000-000000000001', 0.5, 0, 0, 0)
ON CONFLICT (client_id) DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
SELECT 'TEST DATA SEEDED SUCCESSFULLY' AS status;

