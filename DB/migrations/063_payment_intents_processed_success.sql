-- Add processed_success to payment_intents for webhook idempotency (prevent double-credit on payment_intent.succeeded)
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS processed_success BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payment_intents_processed_success
  ON payment_intents (stripe_payment_intent_id)
  WHERE processed_success = true;

COMMENT ON COLUMN payment_intents.processed_success IS 'Set true after webhook side-effects (ledger, etc.) to prevent duplicate processing';
