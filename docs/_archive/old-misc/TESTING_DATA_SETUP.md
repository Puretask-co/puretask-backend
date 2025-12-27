# Testing Data Setup (PureTask)

Practical steps to make the testing guide executable: load schema/seed data, wire Stripe test mode, and run integrity checks.

---

## 1) Prerequisites
- Postgres (Neon or local) reachable via `DATABASE_URL`.
- Node 20+, repo dependencies installed.
- `.env` populated from `docs/ENV_TEMPLATE.md` (Stripe keys, N8N secrets, DB URL).
- Stripe CLI installed and logged in (`stripe --version`, `stripe login`).
- n8n webhook URL and secret available (`N8N_WEBHOOK_SECRET`).

---

## 2) Load Schema & Seed
Recommended baseline (fresh DB):
```bash
# Full schema
psql "$DATABASE_URL" -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql

# Dev/test seed data
psql "$DATABASE_URL" -f DB/migrations/000_SEED_TEST_DATA.sql
```

If you need a clean reset in a local Postgres:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```
Then rerun the two files above.

---

## 3) Stripe Test Wiring
Start a dedicated listener terminal:
```bash
stripe listen --forward-to https://puretask.app.n8n.cloud/webhook/stripe/webhook
```
Use a separate terminal for triggers, e.g.:
```bash
stripe trigger payment_intent.succeeded
stripe trigger invoice.paid
stripe trigger payment_intent.payment_failed
```
Keep the listener window open; don’t type into it beyond startup.

---

## 4) Quick Data Sampling (SQL)
List users by role:
```sql
SELECT id, email, role FROM users ORDER BY role, email LIMIT 20;
```

List cleaners (for payouts/tests):
```sql
SELECT u.id AS user_id, u.email, cp.id AS cleaner_profile_id
FROM users u
JOIN cleaner_profiles cp ON cp.user_id = u.id
ORDER BY u.email
LIMIT 20;
```

Check wallet balances:
```sql
SELECT id, email, wallet_credits_balance
FROM users
ORDER BY wallet_credits_balance DESC
LIMIT 20;
```

Top-up a test client wallet (example: +200 credits):
```sql
UPDATE users SET wallet_credits_balance = wallet_credits_balance + 200
WHERE email = 'test-client@example.com';
INSERT INTO credit_ledger (user_id, type, amount, source)
VALUES ((SELECT id FROM users WHERE email='test-client@example.com'),
        'wallet_purchase', 200, 'admin_seed');
```
Adjust the email and amount to your test identities.

---

## 5) Scenario Starters (minimal)
Use the API where possible (preferred), but if you need quick DB prep:

- Happy path (Scenario A): ensure client wallet has enough credits (see top-up), create a job via API, proceed through execution → approval → payout.
- Auto-refill (Scenario D): set client wallet just below required escrow, enable auto-refill, then book via API; use `payment_intent.succeeded` trigger if needed.
- Subscription (Scenario E): trigger `invoice.paid` after seed load to add credits, then book normally.
- Cancellations / No-show (Scenarios F/G): create a job, then exercise cancellation/no-show flows via API.
- Payment failure (Scenario H): `stripe trigger payment_intent.payment_failed` and attempt a booking that needs credits.
- Chargeback (Scenario I): simulate via Stripe Dashboard or `charge.dispute.*` events after a successful payment.
- High volume (Scenario O): seed multiple users/jobs (duplicate seed data or create via API) and run integrity queries below.

---

## 6) Integrity Checks (SQL)
Run these after key flows to validate state:

Wallet vs Ledger (per user):
```sql
SELECT u.id, u.email,
       u.wallet_credits_balance AS wallet,
       COALESCE(SUM(
         CASE
           WHEN l.type IN ('wallet_purchase','subscription_credit','admin_credit') THEN l.amount
           WHEN l.type = 'escrow_hold' THEN -l.amount
           WHEN l.type = 'escrow_release' THEN l.amount
           WHEN l.type = 'refund' THEN -l.amount
           WHEN l.type = 'escrow_reversal' THEN l.amount
           WHEN l.type = 'admin_debit' THEN -l.amount
           ELSE 0
         END
       ),0) AS ledger_balance
FROM users u
LEFT JOIN credit_ledger l ON l.user_id = u.id
WHERE u.email = 'test-client@example.com'
GROUP BY u.id, u.email, u.wallet_credits_balance;
```

Escrow per job:
```sql
SELECT j.id, j.status, j.escrow_amount,
  COALESCE(SUM(CASE WHEN l.type='escrow_hold' THEN l.amount ELSE 0 END),0) AS hold,
  COALESCE(SUM(CASE WHEN l.type='escrow_release' THEN l.amount ELSE 0 END),0) AS release_amt,
  COALESCE(SUM(CASE WHEN l.type='escrow_reversal' THEN l.amount ELSE 0 END),0) AS reversal
FROM jobs j
LEFT JOIN credit_ledger l ON l.job_id = j.id
WHERE j.id = '<job_uuid_here>'
GROUP BY j.id, j.status, j.escrow_amount;
```

Earnings vs Payouts:
```sql
SELECT c.id AS cleaner_id,
       SUM(e.amount) AS total_earnings,
       SUM(CASE WHEN e.status='paid' THEN e.amount ELSE 0 END) AS paid_earnings,
       SUM(p.total_amount_credits) AS payouts_total
FROM cleaners c
LEFT JOIN earnings e ON e.cleaner_id = c.id
LEFT JOIN payouts p ON p.cleaner_id = c.id AND p.status='paid'
WHERE c.id = '<cleaner_id_here>'
GROUP BY c.id;
```

Active disputes/no-shows sanity:
```sql
SELECT id, status, escrow_amount
FROM jobs
WHERE status IN ('disputed','no_show','canceled_by_client','canceled_by_cleaner')
LIMIT 50;
```

You can also run `scripts/verify_integrity.sql` and replace placeholders with test emails/ids for convenience.

---

## 7) Stripe Listener & Triggers (quick reference)
- Listener: `stripe listen --forward-to https://puretask.app.n8n.cloud/webhook/stripe/webhook`
- Success purchase: `stripe trigger payment_intent.succeeded`
- Subscription renewal: `stripe trigger invoice.paid`
- Payment failure: `stripe trigger payment_intent.payment_failed`
- Chargeback (from dashboard) or simulate dispute: handle `charge.dispute.created/closed`

---

## 8) Tips for Repeatable Runs
- Keep a dedicated test client and cleaner; reuse their IDs to avoid clutter.
- After destructive tests, rerun the seed files to reset state.
- Always validate with the integrity queries after running a scenario (A–O).
- Prefer API flows over direct SQL for creating jobs and triggering state changes; use SQL mainly for verification and controlled top-ups.

