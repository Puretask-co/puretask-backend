-- 064: Payout idempotency — one payout per job (audit R1)
-- Prevents double-payout when both approval paths (tracking + state machine) could run.
-- If duplicate payouts exist, resolve before applying (e.g. keep one per job_id).

-- Ensure one payout per job (idempotent completion)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payouts_job_id ON payouts (job_id);
