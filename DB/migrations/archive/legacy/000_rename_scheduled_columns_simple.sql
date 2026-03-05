-- 000_rename_scheduled_columns_simple.sql
-- Simple version: Direct ALTER TABLE commands
-- Run these commands one at a time in Neon SQL Editor

-- Step 1: Check if scheduled_start exists (run this first to verify)
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' 
-- AND column_name IN ('scheduled_start', 'scheduled_start_at');

-- Step 2: Rename scheduled_start to scheduled_start_at
-- (Only run if scheduled_start exists and scheduled_start_at does NOT exist)
ALTER TABLE jobs RENAME COLUMN scheduled_start TO scheduled_start_at;

-- Step 3: Rename scheduled_end to scheduled_end_at  
-- (Only run if scheduled_end exists and scheduled_end_at does NOT exist)
ALTER TABLE jobs RENAME COLUMN scheduled_end TO scheduled_end_at;
