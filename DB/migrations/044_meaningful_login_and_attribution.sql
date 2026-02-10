-- Migration 044: Meaningful login tracking + reward attribution placeholder
-- Enables "meaningful login" for streak goals (anti-gaming)
-- Prepares for reward attribution ("Your rewards helped you get +X bookings")

-- ============================================
-- MEANINGFUL ACTIONS (for login streak anti-gaming)
-- ============================================
-- A login counts as "meaningful" when the cleaner does one of:
--   accept/confirm job, send message, view job list + open details, upload photos
-- This table records such actions; login_streak goals can optionally require them.

CREATE TABLE IF NOT EXISTS cleaner_meaningful_actions (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleaner_id, action_date, action_type)
);

CREATE INDEX IF NOT EXISTS idx_meaningful_actions_cleaner ON cleaner_meaningful_actions(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_meaningful_actions_date ON cleaner_meaningful_actions(action_date);

COMMENT ON TABLE cleaner_meaningful_actions IS 'Tracks meaningful actions for login streak anti-gaming';

-- ============================================
-- REWARD ATTRIBUTION (placeholder)
-- ============================================
-- Future: track when cleaners with active boosts get bookings, to show
-- "Your rewards helped you get +X extra bookings this week"
-- For now we add a view that can be extended later.

CREATE OR REPLACE VIEW cleaner_boost_attribution_placeholder AS
SELECT
  c.cleaner_id,
  DATE_TRUNC('week', NOW())::date AS week_start,
  0::int AS extra_bookings_attributed
FROM cleaner_active_boosts c
WHERE c.is_active = true AND c.expires_at > NOW()
GROUP BY c.cleaner_id;

COMMENT ON VIEW cleaner_boost_attribution_placeholder IS 'Placeholder for reward attribution; returns 0 until implemented';

SELECT 'Migration 044 Completed' AS status;
