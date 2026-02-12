-- 000_fix_job_events_columns.sql
-- Fix missing columns in job_events table
-- Run this in Neon SQL Editor

-- Step 1: Add actor_type column (required, NOT NULL)
-- This column tracks who performed the action: 'client', 'cleaner', 'admin', or 'system'
ALTER TABLE job_events ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'system';
-- Remove the default after adding (so future inserts must provide a value)
ALTER TABLE job_events ALTER COLUMN actor_type DROP DEFAULT;

-- Step 2: Add actor_id column (nullable)
-- This column stores the user ID of who performed the action (null for 'system' events)
ALTER TABLE job_events ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- Step 3: Add payload column (the code expects 'payload', not 'meta')
-- If 'meta' column exists, we'll keep both for now, but the code uses 'payload'
ALTER TABLE job_events ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Step 4: (Optional) If you want to migrate data from 'meta' to 'payload' for existing rows:
-- UPDATE job_events SET payload = meta WHERE payload = '{}'::jsonb AND meta IS NOT NULL;

-- Step 5: Verify the columns were added
-- Run this to check:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'job_events'
-- AND column_name IN ('actor_type', 'actor_id', 'payload')
-- ORDER BY column_name;

