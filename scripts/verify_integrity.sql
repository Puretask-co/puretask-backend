-- Integrity checks for wallet, escrow, earnings, payouts.
-- Replace placeholders with actual ids/emails.

-- Wallet vs ledger for a user
SELECT u.id, u.email,
       u.wallet_credits_balance AS wallet,
       COALESCE(SUM(
         CASE
           WHEN l.type IN ('wallet_purchase','subscription_credit','admin_credit') THEN l.amount
           WHEN l.type = 'escrow_hold' THEN -l.amount
           WHEN l.type = 'escrow_release' THEN l.amount
           WHEN l.type = 'escrow_reversal' THEN l.amount
           WHEN l.type = 'refund' THEN -l.amount
           WHEN l.type = 'admin_debit' THEN -l.amount
           ELSE 0
         END
       ),0) AS ledger_balance
FROM users u
LEFT JOIN credit_ledger l ON l.user_id = u.id
WHERE u.email = 'test-client@example.com'
GROUP BY u.id, u.email, u.wallet_credits_balance;

-- Escrow per job
SELECT j.id, j.status, j.escrow_amount,
  COALESCE(SUM(CASE WHEN l.type='escrow_hold' THEN l.amount ELSE 0 END),0) AS hold,
  COALESCE(SUM(CASE WHEN l.type='escrow_release' THEN l.amount ELSE 0 END),0) AS release_amt,
  COALESCE(SUM(CASE WHEN l.type='escrow_reversal' THEN l.amount ELSE 0 END),0) AS reversal
FROM jobs j
LEFT JOIN credit_ledger l ON l.job_id = j.id
WHERE j.id = '<job_uuid_here>'
GROUP BY j.id, j.status, j.escrow_amount;

-- Earnings vs payouts per cleaner
SELECT c.id AS cleaner_id,
       SUM(e.amount) AS total_earnings,
       SUM(CASE WHEN e.status='paid' THEN e.amount ELSE 0 END) AS paid_earnings,
       SUM(p.total_amount_credits) AS payouts_total
FROM cleaners c
LEFT JOIN earnings e ON e.cleaner_id = c.id
LEFT JOIN payouts p ON p.cleaner_id = c.id AND p.status='paid'
WHERE c.id = '<cleaner_id_here>'
GROUP BY c.id;

-- Terminal/problem jobs sanity
SELECT id, status, escrow_amount
FROM jobs
WHERE status IN ('disputed','no_show','canceled_by_client','canceled_by_cleaner','refunded')
LIMIT 50;

