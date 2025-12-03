-- scripts/verifySchema.sql
-- Schema Verification Script for PureTask Backend
-- 
-- INSTRUCTIONS:
-- 1. Open Neon Database Console → SQL Editor
-- 2. Paste this entire script
-- 3. Run it
-- 4. Verify all tables show their structure (no "relation does not exist" errors)
-- 5. If any table is missing, run the corresponding migration

-- ============================================
-- CORE TABLES (001_init.sql)
-- ============================================

SELECT 'Checking users table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' ORDER BY ordinal_position;

SELECT 'Checking client_profiles table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'client_profiles' ORDER BY ordinal_position;

SELECT 'Checking cleaner_profiles table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_profiles' ORDER BY ordinal_position;

SELECT 'Checking jobs table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'jobs' ORDER BY ordinal_position;

SELECT 'Checking job_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'job_events' ORDER BY ordinal_position;

-- ============================================
-- CREDITS & PAYMENTS
-- ============================================

SELECT 'Checking credit_ledger table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'credit_ledger' ORDER BY ordinal_position;

SELECT 'Checking credit_accounts table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'credit_accounts' ORDER BY ordinal_position;

SELECT 'Checking credit_transactions table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'credit_transactions' ORDER BY ordinal_position;

SELECT 'Checking payment_intents table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payment_intents' ORDER BY ordinal_position;

SELECT 'Checking payouts table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payouts' ORDER BY ordinal_position;

-- ============================================
-- STRIPE INTEGRATION
-- ============================================

SELECT 'Checking stripe_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'stripe_events' ORDER BY ordinal_position;

SELECT 'Checking stripe_customers table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'stripe_customers' ORDER BY ordinal_position;

SELECT 'Checking stripe_connect_accounts table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'stripe_connect_accounts' ORDER BY ordinal_position;

-- ============================================
-- JOBS RELATED
-- ============================================

SELECT 'Checking job_photos table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'job_photos' ORDER BY ordinal_position;

SELECT 'Checking job_checkins table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'job_checkins' ORDER BY ordinal_position;

SELECT 'Checking job_status_history table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'job_status_history' ORDER BY ordinal_position;

SELECT 'Checking addresses table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'addresses' ORDER BY ordinal_position;

-- ============================================
-- DISPUTES
-- ============================================

SELECT 'Checking disputes table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'disputes' ORDER BY ordinal_position;

SELECT 'Checking dispute_actions table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'dispute_actions' ORDER BY ordinal_position;

-- ============================================
-- RELIABILITY ENGINE (CLEANERS)
-- ============================================

SELECT 'Checking cleaner_metrics table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_metrics' ORDER BY ordinal_position;

SELECT 'Checking cleaner_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_events' ORDER BY ordinal_position;

SELECT 'Checking cleaner_weekly_streaks table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_weekly_streaks' ORDER BY ordinal_position;

SELECT 'Checking reliability_snapshots table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'reliability_snapshots' ORDER BY ordinal_position;

SELECT 'Checking cleaner_tier_history table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_tier_history' ORDER BY ordinal_position;

-- ============================================
-- CLIENT RISK ENGINE
-- ============================================

SELECT 'Checking client_risk_scores table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'client_risk_scores' ORDER BY ordinal_position;

SELECT 'Checking client_risk_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'client_risk_events' ORDER BY ordinal_position;

-- ============================================
-- RESCHEDULING ENGINE
-- ============================================

SELECT 'Checking reschedule_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'reschedule_events' ORDER BY ordinal_position;

SELECT 'Checking reschedule_reason_codes table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'reschedule_reason_codes' ORDER BY ordinal_position;

-- ============================================
-- CANCELLATION ENGINE
-- ============================================

SELECT 'Checking cancellation_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cancellation_events' ORDER BY ordinal_position;

SELECT 'Checking grace_cancellations table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'grace_cancellations' ORDER BY ordinal_position;

-- ============================================
-- INCONVENIENCE / FLEXIBILITY
-- ============================================

SELECT 'Checking inconvenience_logs table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'inconvenience_logs' ORDER BY ordinal_position;

SELECT 'Checking cleaner_flex_profiles table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_flex_profiles' ORDER BY ordinal_position;

SELECT 'Checking client_flex_profiles table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'client_flex_profiles' ORDER BY ordinal_position;

SELECT 'Checking flexibility_decline_events table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'flexibility_decline_events' ORDER BY ordinal_position;

-- ============================================
-- AVAILABILITY ENGINE
-- ============================================

SELECT 'Checking cleaner_availability table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_availability' ORDER BY ordinal_position;

SELECT 'Checking availability_blocks table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'availability_blocks' ORDER BY ordinal_position;

SELECT 'Checking blackout_periods table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'blackout_periods' ORDER BY ordinal_position;

SELECT 'Checking cleaner_time_off table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_time_off' ORDER BY ordinal_position;

-- ============================================
-- MATCHING ENGINE
-- ============================================

SELECT 'Checking match_recommendations table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'match_recommendations' ORDER BY ordinal_position;

-- ============================================
-- NOTIFICATIONS
-- ============================================

SELECT 'Checking notification_templates table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'notification_templates' ORDER BY ordinal_position;

SELECT 'Checking notification_logs table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'notification_logs' ORDER BY ordinal_position;

-- ============================================
-- ADMIN / AUDIT
-- ============================================

SELECT 'Checking admin_audit_log table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'admin_audit_log' ORDER BY ordinal_position;

-- ============================================
-- ADDITIONAL TABLES
-- ============================================

SELECT 'Checking reviews table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'reviews' ORDER BY ordinal_position;

SELECT 'Checking messages table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'messages' ORDER BY ordinal_position;

SELECT 'Checking cleaner_earnings table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'cleaner_earnings' ORDER BY ordinal_position;

SELECT 'Checking payout_requests table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payout_requests' ORDER BY ordinal_position;

SELECT 'Checking user_preferences table...' as check_status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'user_preferences' ORDER BY ordinal_position;

-- ============================================
-- SUMMARY: Count all tables
-- ============================================

SELECT 'SUMMARY: Total tables in public schema' as check_status;
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Listing all tables:' as check_status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

