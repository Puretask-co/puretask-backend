# LAUNCH_READINESS_CHECKLIST.md

- [ ] Environment: `.env` created from `.env.example`, secrets populated (DATABASE_URL = Neon, JWT_SECRET, STRIPE_*)
- [x] Database: consolidated schema applied to Neon (`000_COMPLETE_CONSOLIDATED_SCHEMA.sql`); feature_flags INSERT fix applied
- [ ] Smoke tests: `npm run test:smoke` pass (run after `npm install` if needed)
- [ ] Integration (critical paths): jobs + payments + payouts verified
- [ ] Stripe webhook secret set and tested
- [ ] Logging/alerting enabled (Slack/email endpoints configured)
- [ ] MCP servers configured (Postman API key, Railway CLI if used)
- [ ] Backup/restore validated for production database

## Code alignment (done)

- **Feature flags:** `feature_flags` has no `value` column; config values live in `metadata->>'value'`. `src/services/invoiceService.ts` updated to use `metadata->>'value'` for `INVOICE_APPROVAL_THRESHOLD_CENTS`, `INVOICE_EXPIRY_DAYS`, `INVOICE_TAX_RATE_BPS`.

## Next steps (in order)

1. Ensure `.env` has `DATABASE_URL` pointing at your Neon DB (with `?sslmode=require`).
2. Run `npm install` (if dependencies are missing), then `npm run dev` and hit `GET http://localhost:4000/health`.
3. Run `npm run test:smoke` and fix any failures.
4. Manually or via tests verify: create job → payment → payout flow.
5. Set `STRIPE_WEBHOOK_SECRET` and send a test event from Stripe Dashboard.
6. Configure alerting (e.g. `ALERT_SLACK_WEBHOOK_URL`) and backup/restore for Neon.

## If `npm install` fails (broken Node/npm)

If you see `MODULE_NOT_FOUND` for `common-ancestor-path` or corepack, your Node.js install is likely corrupted. Fix it then rerun the steps above:

- **Option A:** Reinstall Node.js from [nodejs.org](https://nodejs.org/) (LTS). Use the installer and ensure "Automatically install necessary tools" is checked if offered.
- **Option B:** Use [nvm-windows](https://github.com/coreybutler/nvm-windows) and install a fresh Node version: `nvm install 20` then `nvm use 20`.

After a clean Node install, run: `npm install` → `npm run dev` → `npm run test:smoke`.
