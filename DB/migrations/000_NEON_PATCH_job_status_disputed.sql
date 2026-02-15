-- Add 'disputed' to job_status enum if missing (for reliabilityService, dispute flows)
-- Run in Neon SQL Editor if computeCleanerStats fails with "invalid input value for enum job_status: 'disputed'"
DO $$
BEGIN
  ALTER TYPE job_status ADD VALUE 'disputed';
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- already exists
  WHEN undefined_object THEN
    NULL; -- job_status type may not exist
END
$$;
