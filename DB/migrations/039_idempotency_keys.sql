-- ============================================
-- Idempotency Keys Table
-- ============================================
-- Stores idempotency results for API endpoints

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_endpoint 
  ON idempotency_keys (endpoint, created_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created 
  ON idempotency_keys (created_at);

-- Cleanup old idempotency keys (older than 24 hours)
-- This prevents unbounded growth
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency results for API endpoints. Keys are valid for 24 hours.';

-- Optional: Add a cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_idempotency_keys IS 'Removes idempotency keys older than 24 hours';
