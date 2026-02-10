-- 040_token_invalidation.sql
-- Adds token versioning and invalidation support

-- Add token_version to users table for bulk token invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(token_version);

-- Create table to track invalidated tokens (optional, for explicit revocation)
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_user ON invalidated_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_created ON invalidated_tokens(invalidated_at);

-- Cleanup old invalidated tokens (older than token expiration time)
-- This prevents unbounded growth
COMMENT ON TABLE invalidated_tokens IS 'Tracks explicitly invalidated tokens. Cleaned up after token expiration period.';

-- Function to invalidate all tokens for a user (increment token_version)
CREATE OR REPLACE FUNCTION invalidate_user_tokens(user_id_param TEXT, reason_param TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET token_version = token_version + 1
  WHERE id = user_id_param;
  
  -- Optionally log the invalidation
  IF reason_param IS NOT NULL THEN
    INSERT INTO security_events (event_type, user_id, details)
    VALUES ('token_invalidated', user_id_param, jsonb_build_object('reason', reason_param))
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION invalidate_user_tokens IS 'Invalidates all tokens for a user by incrementing token_version';
