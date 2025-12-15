# LAUNCH_READINESS_CHECKLIST.md

- [ ] Environment: `.env` created from `.env.example`, secrets populated
- [ ] Database: consolidated schema applied (see `MIGRATIONS.md`)
- [ ] Smoke tests: `npm run test:smoke` pass
- [ ] Integration (critical paths): jobs + payments + payouts verified
- [ ] Stripe webhook secret set and tested
- [ ] Logging/alerting enabled (Slack/email endpoints configured)
- [ ] MCP servers configured (Postman API key, Railway CLI if used)
- [ ] Backup/restore validated for production database

