-- Migration 045: Gamification expansion
-- Adds: good-faith declines, message templates, job add-ons, config support

-- ============================================
-- JOB ADD-ONS (for add-on completion goals)
-- ============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_addons BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS addons_count INTEGER DEFAULT 0;
COMMENT ON COLUMN jobs.has_addons IS 'Client selected add-ons at booking';
COMMENT ON COLUMN jobs.addons_count IS 'Number of add-ons selected at booking';

-- ============================================
-- MESSAGES: template_id for meaningful message rules
-- ============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_id TEXT;
COMMENT ON COLUMN messages.template_id IS 'Quick template key if message sent via template (tmpl_thank_you, etc)';

-- ============================================
-- JOB OFFERS: decline reason for good-faith logic
-- ============================================
-- job_offers may have status declined; we need decline_reason
DO $$ BEGIN
  ALTER TABLE job_offers ADD COLUMN decline_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
COMMENT ON COLUMN job_offers.decline_reason IS 'Good-faith reason: distance_too_far, time_conflict, job_mismatch, safety_concern, access_logistics, too_short_notice';

-- ============================================
-- CLEANER: max travel for good-faith distance
-- ============================================
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS max_travel_miles NUMERIC(5,2) DEFAULT 10;
COMMENT ON COLUMN cleaner_profiles.max_travel_miles IS 'Max miles from home; job >= max+1 is good-faith decline';

-- ============================================
-- QUICK MESSAGE TEMPLATES (reference table)
-- ============================================
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  copy TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO message_templates (id, label, copy, category) VALUES
  ('tmpl_on_my_way', 'On my way', 'On my way', 'professional'),
  ('tmpl_arrived', 'I''ve arrived', 'I''ve arrived', 'professional'),
  ('tmpl_starting_now', 'Starting now', 'Starting now', 'professional'),
  ('tmpl_finished_photos_attached', 'Finished — photos attached', 'Finished — here are your photos.', 'professional'),
  ('tmpl_any_focus_areas', 'Any focus areas?', 'Any areas you want me to focus on?', 'professional'),
  ('tmpl_thank_you', 'Thank you', 'Thanks for choosing PureTask! I just finished up — let me know if there''s anything you''d like adjusted.', 'courtesy'),
  ('tmpl_reschedule_offer', 'Would you like to reschedule?', 'Hi! Would you like to reschedule this cleaning? If so, tell me a better day/time and I''ll confirm right away.', 'courtesy'),
  ('tmpl_review_request', 'Request a review', 'If you were happy with the cleaning, would you mind leaving a quick review? It really helps me get booked more often. Thank you!', 'courtesy'),
  ('tmpl_tip_request', 'Request a tip', 'If you feel I did a great job, tips are always appreciated — but never expected. Thank you for your support!', 'courtesy')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, copy = EXCLUDED.copy, category = EXCLUDED.category;

-- ============================================
-- ADD-ON CORE GOALS (Levels 4, 5, 6)
-- ============================================
INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
(4, 'addons_30', 'core', 'Complete 30 add-ons', 'Complete 30 jobs where the client selected add-ons at booking.', '{"type":"addons_completed","min":30}'::jsonb, 'visibility_boost', '{"multiplier":1.15,"duration_days":14,"job_filter":"has_addons"}'::jsonb, 5),
(5, 'addons_45', 'core', 'Complete 45 add-ons', 'Complete 45 jobs where the client selected add-ons at booking.', '{"type":"addons_completed","min":45}'::jsonb, 'exposure_window', '{"minutes":10,"duration_days":30,"job_filter":"has_addons"}'::jsonb, 6),
(6, 'addons_60', 'core', 'Complete 60 add-ons', 'Complete 60 jobs where the client selected add-ons at booking.', '{"type":"addons_completed","min":60}'::jsonb, 'permission', '{"enabled":true,"pool":"premium_addon_carousel"}'::jsonb, 5)
ON CONFLICT (level, goal_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, criteria = EXCLUDED.criteria, reward_type = EXCLUDED.reward_type, reward_config = EXCLUDED.reward_config;

-- Update L1 photo goal to use simplified validation (1 before + 1 after)
UPDATE cleaner_level_goals SET criteria = '{"type":"photos_valid","min":1}'::jsonb WHERE level = 1 AND goal_key = 'upload_photos';

SELECT 'Migration 045 Completed' AS status;
