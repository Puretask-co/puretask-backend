-- 005_backups.sql
-- Logical backup snapshots table for storing point-in-time summaries

-- Backups table stores aggregated business data snapshots
-- This is NOT a replacement for pg_dump - it's for business intelligence
CREATE TABLE IF NOT EXISTS backups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL,       -- e.g. 'daily-summary', 'pre-deploy', 'monthly-report'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- version info, tags, etc.
  data         JSONB NOT NULL       -- summary payload (counts, aggregates, etc.)
);

-- Index for querying by time
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups (created_at DESC);

-- Index for querying by label
CREATE INDEX IF NOT EXISTS idx_backups_label ON backups (label);

-- Composite index for label + time queries
CREATE INDEX IF NOT EXISTS idx_backups_label_created ON backups (label, created_at DESC);

-- Add comment
COMMENT ON TABLE backups IS 'Logical backup snapshots storing aggregated business metrics over time';
COMMENT ON COLUMN backups.label IS 'Categorizes the backup type: daily-summary, pre-deploy, monthly-report, etc.';
COMMENT ON COLUMN backups.metadata IS 'Version info, tags, and other backup metadata as JSON';
COMMENT ON COLUMN backups.data IS 'The actual snapshot data: user counts, job counts, credit totals, etc.';

