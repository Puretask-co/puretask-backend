-- 012_job_offers.sql
-- Job offers for broadcast matching system
-- NOTE: Uses TEXT for cleaner_id to match existing users.id column type

CREATE TABLE IF NOT EXISTS job_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, declined, declined_by_system, expired
  expires_at      TIMESTAMPTZ NOT NULL,
  decline_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One offer per cleaner per job
  CONSTRAINT unique_job_cleaner_offer UNIQUE (job_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_job_offers_job ON job_offers (job_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_cleaner ON job_offers (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers (status);
CREATE INDEX IF NOT EXISTS idx_job_offers_expires ON job_offers (expires_at) WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER trg_job_offers_updated_at
BEFORE UPDATE ON job_offers
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- Auto-expire old offers (can be run by worker)
CREATE OR REPLACE FUNCTION expire_old_job_offers() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE job_offers
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE job_offers IS 'Tracks job offers sent to cleaners for broadcast matching';
COMMENT ON FUNCTION expire_old_job_offers IS 'Mark expired offers - call periodically';
