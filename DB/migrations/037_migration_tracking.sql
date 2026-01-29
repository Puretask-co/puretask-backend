-- ============================================
-- Migration Tracking Table
-- ============================================
-- Tracks which migrations have been applied to the database
-- This enables safe migration execution and prevents duplicate application

CREATE TABLE IF NOT EXISTS schema_migrations (
  id              SERIAL PRIMARY KEY,
  migration_name  TEXT NOT NULL UNIQUE,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum        TEXT,  -- Optional: SHA256 of migration file for verification
  applied_by      TEXT,  -- Optional: user/system that applied the migration
  notes           TEXT   -- Optional: notes about the migration
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations (migration_name);

COMMENT ON TABLE schema_migrations IS 'Tracks which migrations have been applied to prevent duplicate execution';
COMMENT ON COLUMN schema_migrations.migration_name IS 'Name of the migration file (e.g., 001_init.sql)';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA256 hash of migration file for integrity verification';

-- ============================================
-- Helper Function: Check if migration is applied
-- ============================================

CREATE OR REPLACE FUNCTION migration_applied(migration_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_migrations WHERE schema_migrations.migration_name = migration_applied.migration_name
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Helper Function: Record migration as applied
-- ============================================

CREATE OR REPLACE FUNCTION record_migration_applied(
  p_migration_name TEXT,
  p_checksum TEXT DEFAULT NULL,
  p_applied_by TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO schema_migrations (migration_name, checksum, applied_by, notes)
  VALUES (p_migration_name, p_checksum, p_applied_by, p_notes)
  ON CONFLICT (migration_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migration_applied IS 'Check if a migration has been applied';
COMMENT ON FUNCTION record_migration_applied IS 'Record that a migration has been applied';
