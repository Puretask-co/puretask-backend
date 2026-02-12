-- Migration 046: Safety reports for good-faith "Safety concern" declines
-- When a cleaner selects "Safety concern", they may optionally upload 1 photo.
-- If no photo: short note (min 20 chars) required.
-- Stores evidence for moderation; photo is optional per spec.

CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES job_offers(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'safety_concern',
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_cleaner ON safety_reports(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_created ON safety_reports(created_at DESC);

COMMENT ON TABLE safety_reports IS 'Optional evidence when cleaner declines with safety_concern; photo optional, note required if no photo';
COMMENT ON COLUMN safety_reports.photo_url IS 'Optional: 1 photo of unsafe condition';
COMMENT ON COLUMN safety_reports.note IS 'Required if no photo; min 20 chars';

SELECT 'Migration 046 Completed' AS status;
