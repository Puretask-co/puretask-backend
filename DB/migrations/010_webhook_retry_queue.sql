-- 010_webhook_retry_queue.sql
-- Webhook retry queue for failed Stripe and other webhooks

-- Webhook failures table for retry queue
CREATE TABLE IF NOT EXISTS webhook_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,  -- 'stripe', 'n8n', etc.
  event_id        TEXT,           -- Original event ID (for idempotency)
  event_type      TEXT NOT NULL,  -- Event type (e.g., 'payment_intent.succeeded')
  payload         JSONB NOT NULL, -- Full webhook payload
  error_message   TEXT,           -- Last error message
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 5,
  next_retry_at   TIMESTAMPTZ,    -- When to retry next
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed, dead
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_failures_status ON webhook_failures (status);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_next_retry ON webhook_failures (next_retry_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_failures_source ON webhook_failures (source);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_event_id ON webhook_failures (event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_failures_created_at ON webhook_failures (created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER trg_webhook_failures_set_updated_at
BEFORE UPDATE ON webhook_failures
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

-- View: pending webhooks ready to retry
CREATE OR REPLACE VIEW pending_webhook_retries AS
SELECT *
FROM webhook_failures
WHERE status = 'pending'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  AND retry_count < max_retries
ORDER BY created_at ASC;

-- View: webhook stats by source
CREATE OR REPLACE VIEW webhook_stats AS
SELECT
  source,
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries,
  MAX(created_at) as last_failure_at
FROM webhook_failures
GROUP BY source, status;

-- Comments
COMMENT ON TABLE webhook_failures IS 'Queue for retrying failed webhook deliveries';
COMMENT ON COLUMN webhook_failures.next_retry_at IS 'Exponential backoff: 1m, 5m, 15m, 1h, 4h';
COMMENT ON COLUMN webhook_failures.status IS 'pending=queued, processing=being retried, succeeded=done, failed=gave up, dead=manual intervention needed';

