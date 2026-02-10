# Database Backup Setup Guide

See `DATABASE_RECOVERY.md` for recovery procedures.

**What this doc is for:** Short guide to enabling and verifying Neon backups (automated backups, retention, PITR, backup:verify). For restore steps, use [DATABASE_RECOVERY.md](DATABASE_RECOVERY.md) and [BACKUP_RESTORE_PROCEDURE.md](BACKUP_RESTORE_PROCEDURE.md).

**Why it matters:** Ensures backups are on and verified so you can restore when needed.

**In plain English:** Neon (our database host) can automatically save a copy of the database every day. This doc tells you how to turn that on and how to check that the copies are usable. If something goes wrong later, we use those copies to restore—see DATABASE_RECOVERY and BACKUP_RESTORE_PROCEDURE.

**What it is:** A short guide to enabling and verifying Neon backups (automated backups, retention, PITR).  
**What it does:** Ensures backups are on and verified so we can restore when needed.  
**How we use it:** Enable backups in Neon Console; set retention; run `npm run backup:verify`; use BACKUP_RESTORE_PROCEDURE and DATABASE_RECOVERY for restore steps.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Neon Backup Configuration

**What it is:** The Neon Console settings for automated backups, retention, and PITR.  
**What it does:** Turns on daily snapshots and point-in-time recovery so we have restorable data.  
**How we use it:** In Neon Console enable backups, set retention (7–30 days), enable PITR if on Pro; run `npm run backup:verify`.

1. Enable automated backups in Neon Console
2. Set retention period (7-30 days)
3. Enable point-in-time recovery (Pro tier)
4. Run verification: `npm run backup:verify`

For detailed instructions, see Neon documentation: https://neon.tech/docs
