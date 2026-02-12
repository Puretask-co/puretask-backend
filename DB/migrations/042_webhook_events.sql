-- 042_webhook_events.sql
-- Phase 4: Canonical webhook intake table (SECTION_04_STRIPE_WEBHOOKS runbook § 4.5).
-- Store every webhook (Stripe, n8n, etc.) before processing; unique (provider, event_id) for idempotency.

CREATE TABLE IF NOT EXISTS webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL,
  event_id           TEXT NOT NULL,
  event_type         TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  payload_json       JSONB,
  processing_status  TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
  attempt_count      INT NOT NULL DEFAULT 0,
  last_error         TEXT,
  processed_at       TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id ON webhook_events (provider, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_status ON webhook_events (processing_status) WHERE processing_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events (received_at);

COMMENT ON TABLE webhook_events IS 'Canonical intake for all webhooks; insert before processing; idempotent on (provider, event_id).';
