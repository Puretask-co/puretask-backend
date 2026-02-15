-- Create invalidated_tokens without FK (avoids type mismatch with users.id on branched DBs)
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_user ON invalidated_tokens(user_id);
