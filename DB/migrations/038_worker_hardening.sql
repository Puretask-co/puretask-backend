-- ============================================
-- Worker & Job Queue Hardening
-- ============================================
-- Adds idempotency keys, dead-letter handling, and expired lock recovery

-- ============================================
-- 1. Add Idempotency Key to job_queue
-- ============================================

ALTER TABLE job_queue 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index for idempotency (only for non-null keys)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency 
  ON job_queue (queue_name, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN job_queue.idempotency_key IS 'Idempotency key to prevent duplicate job enqueueing. Format: {job_type}:{unique_identifier}';

-- ============================================
-- 2. Add Dead-Letter Status
-- ============================================

-- Update job_queue status constraint to include 'dead'
-- First, check if constraint exists and what values it allows
DO $$
BEGIN
  -- If status column has a check constraint, we need to drop and recreate it
  -- For now, we'll just ensure 'dead' is a valid status
  -- PostgreSQL will allow any text value unless there's a constraint
  NULL; -- Placeholder - actual constraint modification handled by application logic
END $$;

-- Add dead-letter tracking columns
ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
  ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_queue_dead_letter 
  ON job_queue (status, dead_letter_at) 
  WHERE status = 'dead';

COMMENT ON COLUMN job_queue.dead_letter_reason IS 'Reason why job was moved to dead-letter queue';
COMMENT ON COLUMN job_queue.dead_letter_at IS 'When job was moved to dead-letter queue';

-- ============================================
-- 3. Add Expired Lock Recovery
-- ============================================

-- Add locked_by and locked_at columns for better lock tracking
ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_queue_locked 
  ON job_queue (status, locked_at) 
  WHERE status = 'processing';

COMMENT ON COLUMN job_queue.locked_by IS 'Identifier of worker/process that locked this job';
COMMENT ON COLUMN job_queue.locked_at IS 'When job was locked for processing';

-- ============================================
-- 4. Worker Run Expired Lock Recovery
-- ============================================

-- Add expired lock detection to worker_runs
ALTER TABLE worker_runs
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_worker_runs_expired_locks
  ON worker_runs (status, started_at)
  WHERE status = 'running';

COMMENT ON COLUMN worker_runs.lock_expires_at IS 'When the advisory lock should be considered expired (for crash recovery)';

-- ============================================
-- 5. Helper Functions
-- ============================================

-- Function to recover expired locks in job_queue
CREATE OR REPLACE FUNCTION recover_expired_job_locks(
  lock_timeout_minutes INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  recovered_count INTEGER;
BEGIN
  UPDATE job_queue
  SET 
    status = 'pending',
    locked_by = NULL,
    locked_at = NULL,
    attempts = attempts + 1,
    error_message = COALESCE(error_message || '; ', '') || 'Lock expired - recovered'
  WHERE status = 'processing'
    AND locked_at < NOW() - (lock_timeout_minutes || ' minutes')::INTERVAL
    AND attempts < max_attempts;
  
  GET DIAGNOSTICS recovered_count = ROW_COUNT;
  
  RETURN recovered_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recover_expired_job_locks IS 'Recovers jobs stuck in processing status due to worker crashes';

-- Function to recover expired worker runs
CREATE OR REPLACE FUNCTION recover_expired_worker_runs(
  lock_timeout_minutes INTEGER DEFAULT 60
)
RETURNS INTEGER AS $$
DECLARE
  recovered_count INTEGER;
BEGIN
  UPDATE worker_runs
  SET 
    status = 'failed',
    finished_at = NOW(),
    error_message = 'Worker run expired - likely crashed'
  WHERE status = 'running'
    AND started_at < NOW() - (lock_timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS recovered_count = ROW_COUNT;
  
  RETURN recovered_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recover_expired_worker_runs IS 'Marks worker runs as failed if they have been running too long (likely crashed)';

-- ============================================
-- 6. Views for Observability
-- ============================================

-- Job queue stats view
CREATE OR REPLACE VIEW job_queue_stats AS
SELECT
  queue_name,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(created_at) as last_created_at,
  MAX(completed_at) as last_completed_at
FROM job_queue
GROUP BY queue_name, status;

-- Dead-letter queue view
CREATE OR REPLACE VIEW dead_letter_queue AS
SELECT
  id,
  queue_name,
  payload,
  attempts,
  max_attempts,
  dead_letter_reason,
  dead_letter_at,
  error_message,
  created_at
FROM job_queue
WHERE status = 'dead'
ORDER BY dead_letter_at DESC;

-- Stuck jobs view (processing too long)
CREATE OR REPLACE VIEW stuck_jobs AS
SELECT
  id,
  queue_name,
  payload,
  attempts,
  locked_by,
  locked_at,
  EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60 as minutes_stuck,
  error_message
FROM job_queue
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '30 minutes'
ORDER BY locked_at ASC;

COMMENT ON VIEW job_queue_stats IS 'Statistics for job queue by status';
COMMENT ON VIEW dead_letter_queue IS 'Jobs that have permanently failed';
COMMENT ON VIEW stuck_jobs IS 'Jobs stuck in processing status (likely crashed worker)';
