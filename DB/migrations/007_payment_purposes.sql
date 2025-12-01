-- 007_payment_purposes.sql
-- Add purpose and credits_amount to payment_intents for dual payment flows

-- Add purpose column to distinguish between:
-- 'wallet_topup' - buying credits into wallet
-- 'job_charge' - paying for a specific job
ALTER TABLE payment_intents
ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'wallet_topup';

-- Add credits_amount to track how many credits this payment represents
ALTER TABLE payment_intents
ADD COLUMN IF NOT EXISTS credits_amount INTEGER;

-- Add client_id for easier lookups
ALTER TABLE payment_intents
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add check constraint for valid purposes
ALTER TABLE payment_intents
ADD CONSTRAINT chk_payment_intent_purpose 
CHECK (purpose IN ('wallet_topup', 'job_charge'));

-- Index for querying by purpose
CREATE INDEX IF NOT EXISTS idx_payment_intents_purpose ON payment_intents (purpose);

-- Index for querying by client
CREATE INDEX IF NOT EXISTS idx_payment_intents_client_id ON payment_intents (client_id);

-- Comments
COMMENT ON COLUMN payment_intents.purpose IS 'Payment purpose: wallet_topup (buy credits) or job_charge (pay for specific job)';
COMMENT ON COLUMN payment_intents.credits_amount IS 'Number of credits this payment represents';
COMMENT ON COLUMN payment_intents.client_id IS 'Client who initiated this payment';

