-- DROP_OLD_SCHEDULED_START.sql
-- Fix: Drop the old scheduled_start column since we have scheduled_start_at
-- The code uses scheduled_start_at, but the old column is causing NOT NULL constraint violations

-- Drop the old scheduled_start column
ALTER TABLE jobs DROP COLUMN scheduled_start;

