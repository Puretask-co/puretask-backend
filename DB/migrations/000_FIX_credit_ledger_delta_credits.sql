-- One-time fix: ensure tables have columns and drop views so consolidated schema can recreate them.
-- Run this before 000_COMPLETE_CONSOLIDATED_SCHEMA.sql if your DB has an older schema.

-- Drop credit views so CREATE OR REPLACE VIEW can run (Postgres cannot rename view columns on replace)
DROP VIEW IF EXISTS credit_ledger_with_balance CASCADE;
DROP VIEW IF EXISTS user_credit_balances CASCADE;

-- Ensure credit_ledger has delta_credits
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_ledger')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'delta_credits') THEN
    ALTER TABLE credit_ledger ADD COLUMN delta_credits INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column credit_ledger.delta_credits';
  END IF;
END $$;

-- Ensure cleaner_profiles has columns required by views (e.g. cleaner_stripe_info)
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Placeholder user for seed data (cleaner_ai_templates/cleaner_quick_responses use cleaner_id = 'DEFAULT')
INSERT INTO users (id, email, password_hash, role)
SELECT 'DEFAULT', 'default@system.local', 'no-login', 'cleaner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 'DEFAULT');
