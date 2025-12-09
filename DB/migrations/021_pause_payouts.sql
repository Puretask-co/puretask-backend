-- 021_pause_payouts.sql
-- Add payout_paused flag to cleaner_profiles to allow pausing payouts per cleaner

ALTER TABLE cleaner_profiles
  ADD COLUMN IF NOT EXISTS payout_paused BOOLEAN NOT NULL DEFAULT false;

