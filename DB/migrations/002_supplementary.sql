-- 002_supplementary.sql
-- Additional tables for features not in the core 001_init.sql
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- Credit purchases tracking (for Stripe checkout history)
CREATE TABLE IF NOT EXISTS credit_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  package_id      TEXT NOT NULL,
  credits_amount  INTEGER NOT NULL,
  price_usd       NUMERIC(10,2) NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending/completed/failed/refunded
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_credit_purchases_user_id ON credit_purchases (user_id);
CREATE INDEX idx_credit_purchases_status ON credit_purchases (status);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  sms_enabled     BOOLEAN NOT NULL DEFAULT false,
  push_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification log for history/debugging
CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL, -- email/sms/push
  type            TEXT NOT NULL, -- job_created, job_completed, etc.
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending/sent/failed
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_notification_log_user_id ON notification_log (user_id);
CREATE INDEX idx_notification_log_status ON notification_log (status);

-- Auto-update updated_at
CREATE TRIGGER trg_notification_preferences_set_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();
