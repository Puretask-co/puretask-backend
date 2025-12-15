# PATH_TO_LAUNCH.md

1) Configure env: copy `.env.example` → `.env`, add secrets.
2) Apply DB schema per `MIGRATIONS.md` (dev → staging → prod).
3) Run smoke tests: `npm run test:smoke`.
4) Run critical integration tests (jobs, payments, payouts).
5) Set Stripe webhook + secrets; test with live webhook events.
6) Verify logging/alerting; wire Slack/email.
7) Enable background workers needed for V1 only.
8) Deploy to staging; run verification checklist.
9) Deploy to prod; monitor errors and webhook logs.

