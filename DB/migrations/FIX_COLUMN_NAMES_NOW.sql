-- FIX_COLUMN_NAMES_NOW.sql
-- COPY AND PASTE THIS ENTIRE FILE INTO NEON SQL EDITOR
-- This will rename scheduled_start/scheduled_end to scheduled_start_at/scheduled_end_at

-- IMPORTANT: DO NOT DROP THE COLUMNS - WE NEED TO RENAME THEM!

-- Step 1: Check what columns exist (run this first to verify)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name LIKE 'scheduled%'
ORDER BY column_name;

-- Step 2: Rename scheduled_start to scheduled_start_at
-- (Only run if scheduled_start exists)
ALTER TABLE jobs RENAME COLUMN scheduled_start TO scheduled_start_at;

-- Step 3: Rename scheduled_end to scheduled_end_at
-- (Only run if scheduled_end exists)
ALTER TABLE jobs RENAME COLUMN scheduled_end TO scheduled_end_at;

