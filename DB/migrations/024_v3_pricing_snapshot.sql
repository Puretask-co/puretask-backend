-- Migration 024: Add pricing_snapshot column to jobs table for V3 tier-aware pricing
-- V3 FEATURE: Lock pricing at booking time to prevent pricing drift

-- Add pricing_snapshot JSONB column to jobs table
-- This stores the pricing breakdown at booking time, preventing disputes from pricing changes
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

-- Add index for querying by pricing snapshot data (if needed)
-- CREATE INDEX idx_jobs_pricing_snapshot ON jobs USING GIN (pricing_snapshot);

-- Comment explaining the column
COMMENT ON COLUMN jobs.pricing_snapshot IS 'V3 FEATURE: Stores tier-aware pricing breakdown at booking time. Includes basePrice, tierAdjustment, platformFee, totalPrice, cleanerTier, etc. Locked at booking to prevent pricing drift.';

