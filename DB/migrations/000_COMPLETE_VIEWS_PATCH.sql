-- ============================================================
-- 000_COMPLETE_VIEWS_PATCH.sql
-- Views (and one table) that exist in individual migrations 003-055
-- but were not inlined in 000_COMPLETE_CONSOLIDATED_SCHEMA.sql.
-- Add this to the master sequence so the combined file is complete.
-- ============================================================

-- From 003_credit_views.sql (adapted for delta_credits schema per 045_credit_views_delta_fix.sql)
CREATE OR REPLACE VIEW credit_summary_by_reason AS
SELECT
  reason,
  COUNT(*) AS transaction_count,
  SUM(CASE WHEN delta_credits > 0 THEN delta_credits ELSE 0 END)::INTEGER AS total_added,
  SUM(CASE WHEN delta_credits < 0 THEN -delta_credits ELSE 0 END)::INTEGER AS total_removed,
  SUM(delta_credits)::INTEGER AS net_change
FROM credit_ledger
GROUP BY reason;

CREATE OR REPLACE VIEW cleaner_unpaid_earnings AS
SELECT
  j.cleaner_id,
  COUNT(*) as unpaid_jobs,
  SUM(j.credit_amount)::INTEGER as total_credits_unpaid
FROM jobs j
LEFT JOIN payouts p ON p.job_id = j.id
WHERE j.status = 'completed'
  AND j.cleaner_id IS NOT NULL
  AND (p.id IS NULL OR p.status = 'failed')
GROUP BY j.cleaner_id;

-- From 010_webhook_retry_queue.sql (views only; webhook_failures table is in COMPLETE)
CREATE OR REPLACE VIEW pending_webhook_retries AS
SELECT *
FROM webhook_failures
WHERE status = 'pending'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  AND retry_count < max_retries
ORDER BY created_at ASC;

CREATE OR REPLACE VIEW webhook_stats AS
SELECT
  source,
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries,
  MAX(created_at) as last_failure_at
FROM webhook_failures
GROUP BY source, status;

-- From 013_credit_economy_controls.sql
CREATE OR REPLACE VIEW user_weekly_bonuses AS
SELECT
  user_id,
  year,
  week_of_year,
  SUM(amount) as total_bonuses,
  COUNT(*) as bonus_count
FROM credit_bonuses
GROUP BY user_id, year, week_of_year;

-- From 014_payout_improvements.sql
CREATE OR REPLACE VIEW cleaners_eligible_for_payout AS
SELECT
  cp.user_id as cleaner_id,
  u.email,
  cp.stripe_account_id,
  cp.minimum_payout_cents,
  COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0) as pending_payout_cents
FROM cleaner_profiles cp
JOIN users u ON u.id = cp.user_id
LEFT JOIN payouts p ON p.cleaner_id = cp.user_id
WHERE cp.stripe_account_id IS NOT NULL
GROUP BY cp.user_id, u.email, cp.stripe_account_id, cp.minimum_payout_cents
HAVING COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0) >= cp.minimum_payout_cents;

-- From 015_referrals_and_boosts.sql
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT
  r.referrer_id,
  u.email,
  COUNT(*) as total_referrals,
  COUNT(*) FILTER (WHERE r.status = 'rewarded') as successful_referrals,
  SUM(r.referrer_reward) FILTER (WHERE r.status = 'rewarded') as total_credits_earned
FROM referrals r
JOIN users u ON u.id = r.referrer_id
GROUP BY r.referrer_id, u.email
ORDER BY successful_referrals DESC;

-- From 019_comprehensive_schema_additions.sql
CREATE OR REPLACE VIEW v_cleaner_dashboard AS
SELECT
  u.id as cleaner_id,
  u.email,
  COALESCE(cp.first_name, '') || ' ' || COALESCE(cp.last_name, '') as full_name,
  cp.tier,
  cp.reliability_score,
  cp.avg_rating,
  cp.jobs_completed,
  cp.low_flexibility_badge,
  cp.payout_percent,
  COALESCE(ce.pending_earnings, 0) as pending_earnings_cents,
  COALESCE(ce.available_earnings, 0) as available_earnings_cents
FROM users u
JOIN cleaner_profiles cp ON cp.user_id = u.id
LEFT JOIN (
  SELECT cleaner_id,
         SUM(CASE WHEN status = 'pending' THEN net_amount_cents ELSE 0 END) as pending_earnings,
         SUM(CASE WHEN status = 'available' THEN net_amount_cents ELSE 0 END) as available_earnings
  FROM cleaner_earnings
  GROUP BY cleaner_id
) ce ON ce.cleaner_id = u.id
WHERE u.role = 'cleaner';

CREATE OR REPLACE VIEW v_client_dashboard AS
SELECT
  u.id as client_id,
  u.email,
  COALESCE(clp.first_name, '') || ' ' || COALESCE(clp.last_name, '') as full_name,
  COALESCE(ca.current_balance, 0) as credit_balance,
  COALESCE(ca.held_balance, 0) as held_credits,
  COALESCE(crs.risk_score, 0) as risk_score,
  COALESCE(crs.risk_band, 'normal') as risk_band,
  COALESCE(clp.grace_cancellations_total, 2) - COALESCE(clp.grace_cancellations_used, 0) as grace_cancellations_remaining
FROM users u
LEFT JOIN client_profiles clp ON clp.user_id = u.id
LEFT JOIN credit_accounts ca ON ca.user_id = u.id
LEFT JOIN client_risk_scores crs ON crs.client_id = u.id
WHERE u.role = 'client';

-- From 038_worker_hardening.sql (view)
CREATE OR REPLACE VIEW stuck_jobs AS
SELECT
  id,
  queue_name,
  payload,
  attempts,
  locked_by,
  locked_at,
  EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60 as minutes_stuck,
  error_message
FROM job_queue
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '30 minutes'
ORDER BY locked_at ASC;

-- From 050_gamification_reward_idempotency_and_effects.sql
CREATE OR REPLACE VIEW gamification_active_reward_grants AS
SELECT *
FROM gamification_reward_grants
WHERE status = 'active'
  AND (ends_at IS NULL OR ends_at > now());

CREATE OR REPLACE VIEW gamification_cleaner_active_rewards AS
SELECT cleaner_id,
       reward_id,
       granted_at,
       ends_at,
       uses_remaining,
       meta
FROM gamification_active_reward_grants;

-- From 055_gamification_ops_views.sql
CREATE OR REPLACE VIEW ops_cleaner_active_rewards_summary AS
SELECT
  car.cleaner_id,
  array_agg(car.reward_id ORDER BY car.reward_id) AS active_reward_ids,
  COUNT(*) AS active_reward_count
FROM gamification_cleaner_active_rewards car
GROUP BY car.cleaner_id;

-- From 030: table missing in COMPLETE (COMPLETE has onboarding_tooltips; this table tracks per-cleaner tooltip interactions)
CREATE TABLE IF NOT EXISTS cleaner_tooltip_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tooltip_id UUID NOT NULL REFERENCES onboarding_tooltips(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  marked_helpful BOOLEAN,
  UNIQUE(cleaner_id, tooltip_id)
);
CREATE INDEX IF NOT EXISTS idx_tooltip_interactions_cleaner ON cleaner_tooltip_interactions(cleaner_id);
