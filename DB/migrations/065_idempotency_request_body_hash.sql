-- 065: Idempotency request body hash (audit B4)
-- Reject same idempotency key with different body to prevent misuse.

ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS request_body_hash TEXT NULL;

COMMENT ON COLUMN idempotency_keys.request_body_hash IS 'SHA-256 hex hash of request body when provided; used to reject same key with different body';
