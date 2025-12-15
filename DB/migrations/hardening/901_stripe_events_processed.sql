-- 901_stripe_events_processed.sql
-- Stripe webhook idempotency: record processed Stripe events/objects so replays do nothing.

CREATE TABLE IF NOT EXISTS stripe_events_processed (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT NOT NULL UNIQUE,
  stripe_object_id TEXT, -- optional: pi_ / ch_ / re_ / po_ etc.
  event_type       TEXT,
  status           TEXT NOT NULL DEFAULT 'processed',
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload      JSONB
);

-- Optional extra guard: prevent processing same Stripe object twice
CREATE UNIQUE INDEX IF NOT EXISTS uniq_stripe_object_processed
  ON stripe_events_processed (stripe_object_id)
  WHERE stripe_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_event_id ON stripe_events_processed (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_processed_at ON stripe_events_processed (processed_at);

