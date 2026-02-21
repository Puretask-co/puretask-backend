-- Optional: event-style safety reports for gamification/event pipeline (bundle contract).
-- Only run if you need pt_safety_reports for metrics or event ingestion.
-- User IDs are TEXT to match users(id). See docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 9.

CREATE TABLE IF NOT EXISTS pt_safety_reports (
  report_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id    TEXT NOT NULL REFERENCES users(id),
  job_request_id UUID,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT,
  photo_id      UUID,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_safety_reports_cleaner_occurred
  ON pt_safety_reports (cleaner_id, occurred_at DESC);

COMMENT ON TABLE pt_safety_reports IS 'Event-style safety reports for gamification metrics/contract; optional.';
