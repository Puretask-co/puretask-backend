-- ============================================
-- SECTION 4: WEBHOOK & EXTERNAL INTEGRATIONS HARDENING
-- ============================================
-- This migration implements comprehensive hardening for:
-- - Stripe webhooks (idempotency, replay protection, audit trail)
-- - External integrations (n8n, SendGrid, Twilio, OneSignal)
-- - Financial ledger integrity
-- - Delivery tracking for messaging providers

-- ============================================
-- 1. WEBHOOK EVENTS TABLE (Canonical Intake)
-- ============================================
-- Stores ALL webhook events from ALL providers before processing
-- This is the source of truth for webhook audit and replay

CREATE TABLE IF NOT EXISTS webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL,  -- 'stripe', 'n8n', 'sendgrid', 'twilio', 'onesignal'
  event_id            TEXT,           -- Provider's unique event ID (Stripe event.id, etc.)
  event_type          TEXT NOT NULL, -- 'payment_intent.succeeded', 'email.delivered', etc.
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  payload_json        JSONB NOT NULL,
  processing_status   TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,
  processed_at        TIMESTAMPTZ,
  correlation_id      TEXT,           -- For tracing across systems
  metadata            JSONB DEFAULT '{}'::jsonb,
  
  -- Unique constraint: same provider + event_id = duplicate
  CONSTRAINT webhook_events_provider_event_id_unique UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events (provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_status ON webhook_events (processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_correlation_id ON webhook_events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events (processing_status, received_at) 
  WHERE processing_status = 'pending';

COMMENT ON TABLE webhook_events IS 'Canonical storage for all webhook events before processing. Enables replay, audit, and idempotency.';
COMMENT ON COLUMN webhook_events.processing_status IS 'pending=not started, processing=in progress, done=success, failed=permanent failure';
COMMENT ON COLUMN webhook_events.correlation_id IS 'Tracing ID passed through all downstream systems';

-- ============================================
-- 2. LEDGER ENTRIES TABLE (Financial Audit Trail)
-- ============================================
-- Append-only ledger for all financial transactions
-- This is the source of truth for financial correctness

CREATE TABLE IF NOT EXISTS ledger_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  type                TEXT NOT NULL, -- 'charge', 'escrow_hold', 'escrow_release', 'payout', 'refund', 'adjustment', 'fee'
  amount              INTEGER NOT NULL, -- Amount in cents
  currency            TEXT NOT NULL DEFAULT 'usd',
  source              TEXT,           -- 'stripe_event_id', 'admin_action_id', 'system'
  source_id           TEXT,           -- Stripe event ID, admin user ID, etc.
  description         TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure type is valid
  CONSTRAINT ledger_entries_type_check CHECK (
    type IN ('charge', 'escrow_hold', 'escrow_release', 'payout', 'refund', 'adjustment', 'fee', 'credit_purchase', 'credit_refund')
  )
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id ON ledger_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_job_id ON ledger_entries (job_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type ON ledger_entries (type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_source ON ledger_entries (source, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries (created_at DESC);

COMMENT ON TABLE ledger_entries IS 'Append-only financial ledger. All balances derived from this table.';
COMMENT ON COLUMN ledger_entries.source IS 'Origin of the transaction: stripe_event_id, admin_action_id, system';
COMMENT ON COLUMN ledger_entries.amount IS 'Amount in cents. Positive = credit to user, Negative = debit from user';

-- ============================================
-- 3. DELIVERY LOG TABLE (Messaging Providers)
-- ============================================
-- Tracks all outbound messages (email, SMS, push) for audit and retry

CREATE TABLE IF NOT EXISTS delivery_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel             TEXT NOT NULL, -- 'email', 'sms', 'push'
  provider            TEXT NOT NULL, -- 'sendgrid', 'twilio', 'onesignal'
  template_key        TEXT,         -- Email template ID, SMS template, etc.
  provider_message_id TEXT,         -- Provider's message ID (for callbacks)
  to_address          TEXT NOT NULL, -- Email, phone, push token
  status              TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, failed, bounced
  error_code          TEXT,
  error_message       TEXT,
  attempt             INTEGER NOT NULL DEFAULT 1,
  max_attempts        INTEGER NOT NULL DEFAULT 3,
  metadata            JSONB DEFAULT '{}'::jsonb, -- jobId, userId, etc.
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  
  CONSTRAINT delivery_log_channel_check CHECK (channel IN ('email', 'sms', 'push')),
  CONSTRAINT delivery_log_status_check CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_channel ON delivery_log (channel);
CREATE INDEX IF NOT EXISTS idx_delivery_log_provider ON delivery_log (provider);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON delivery_log (status);
CREATE INDEX IF NOT EXISTS idx_delivery_log_provider_message_id ON delivery_log (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_log_to_address ON delivery_log (to_address);
CREATE INDEX IF NOT EXISTS idx_delivery_log_queued_at ON delivery_log (queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_log_metadata_job_id ON delivery_log USING GIN (metadata jsonb_path_ops) WHERE metadata ? 'jobId';
CREATE INDEX IF NOT EXISTS idx_delivery_log_metadata_user_id ON delivery_log USING GIN (metadata jsonb_path_ops) WHERE metadata ? 'userId';

COMMENT ON TABLE delivery_log IS 'Audit trail for all outbound messaging. Enables retry, support queries, and provider reliability tracking.';
COMMENT ON COLUMN delivery_log.provider_message_id IS 'Provider-assigned ID (SendGrid msg_id, Twilio SID, OneSignal notification_id)';

-- ============================================
-- 4. PAYMENT STATE MACHINE TABLE
-- ============================================
-- Tracks payment state transitions for audit and state machine enforcement

CREATE TABLE IF NOT EXISTS payment_state_transitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id   TEXT NOT NULL, -- Stripe payment intent ID or internal ID
  from_state          TEXT,
  to_state            TEXT NOT NULL,
  reason              TEXT,           -- 'webhook_received', 'admin_action', 'timeout', etc.
  source              TEXT,          -- 'stripe_webhook', 'admin', 'system', 'api'
  source_id           TEXT,          -- Event ID, admin user ID, etc.
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_state_transitions_payment_intent_id ON payment_state_transitions (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_state_transitions_to_state ON payment_state_transitions (to_state);
CREATE INDEX IF NOT EXISTS idx_payment_state_transitions_created_at ON payment_state_transitions (created_at DESC);

COMMENT ON TABLE payment_state_transitions IS 'Audit log of all payment state changes. Enables state machine enforcement and debugging.';

-- ============================================
-- 5. N8N EVENT NONCES (Replay Protection)
-- ============================================
-- Short-term cache of processed n8n event nonces to prevent replay attacks

CREATE TABLE IF NOT EXISTS n8n_event_nonces (
  nonce               TEXT PRIMARY KEY,
  event_id            TEXT NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_n8n_event_nonces_expires_at ON n8n_event_nonces (expires_at);

-- Cleanup expired nonces (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_n8n_nonces()
RETURNS void AS $$
BEGIN
  DELETE FROM n8n_event_nonces WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE n8n_event_nonces IS 'Short-term cache of n8n event nonces to prevent replay attacks. Nonces expire after 1 hour.';

-- ============================================
-- 6. BUSINESS IDEMPOTENCY KEYS
-- ============================================
-- Tracks idempotency keys for business operations (not just Stripe events)

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key       TEXT NOT NULL UNIQUE, -- e.g., 'payout_release:job-123', 'job_complete:job-456'
  operation_type      TEXT NOT NULL,
  result              JSONB,                -- Cached result if operation already executed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_operation_type ON idempotency_keys (operation_type);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

-- Cleanup expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE idempotency_keys IS 'Idempotency keys for business operations. Prevents duplicate execution of mutating operations.';

-- ============================================
-- 7. VIEWS FOR OBSERVABILITY
-- ============================================

-- Webhook processing stats
CREATE OR REPLACE VIEW webhook_processing_stats AS
SELECT
  provider,
  event_type,
  processing_status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_processing_seconds,
  MAX(received_at) as last_received_at
FROM webhook_events
GROUP BY provider, event_type, processing_status;

-- Ledger balance summary
CREATE OR REPLACE VIEW ledger_balance_summary AS
SELECT
  user_id,
  type,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM ledger_entries
GROUP BY user_id, type;

-- Delivery log stats
CREATE OR REPLACE VIEW delivery_log_stats AS
SELECT
  channel,
  provider,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (delivered_at - queued_at))) as avg_delivery_seconds,
  MAX(queued_at) as last_queued_at
FROM delivery_log
GROUP BY channel, provider, status;

COMMENT ON VIEW webhook_processing_stats IS 'Statistics for webhook processing performance and failures';
COMMENT ON VIEW ledger_balance_summary IS 'Summary of ledger entries by user and type';
COMMENT ON VIEW delivery_log_stats IS 'Statistics for message delivery performance';
