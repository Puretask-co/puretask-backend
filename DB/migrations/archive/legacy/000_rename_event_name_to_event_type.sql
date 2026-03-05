-- 000_rename_event_name_to_event_type.sql
-- Simple script to rename type to event_type in job_events table
-- Run this in Neon SQL Editor

-- Step 1: Check what columns exist (run this first to verify)
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'job_events'
-- AND column_name IN ('type', 'event_name', 'event_type')
-- ORDER BY column_name;

-- Step 2: Rename type to event_type
-- The database has a column named 'type' but the code expects 'event_type'
ALTER TABLE job_events RENAME COLUMN type TO event_type;
