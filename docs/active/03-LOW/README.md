# PureTask Backend - Active Documentation

This directory contains current, actively-used documentation for the PureTask backend.

**What this folder is for:** Low-priority or reference docs (contributing, cleanup summary, server startup analysis). For the full index of all active docs by topic and importance, see [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) in the parent `active` folder.

**Why it matters:** Keeps 03-LOW docs in one place so you know these are "nice to have" or reference, not critical path.

**What it is:** The 03-LOW folder intro: low-priority or reference docs (contributing, cleanup, server startup).  
**What it does:** Points to DOCUMENTATION_INDEX and explains that these docs are not critical path.  
**How we use it:** Use Quick Links and DOCUMENTATION_INDEX to find the doc you need; each section in every doc uses What it is / What it does / How we use it (see parent README).

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

## Quick Links

- **Setup**: See `SETUP.md` for local development setup
- **Deployment**: See `DEPLOYMENT.md` for deployment procedures
- **Architecture**: See `ARCHITECTURE.md` for system design
- **Troubleshooting**: See `TROUBLESHOOTING.md` for common issues

## Archived Documentation

Historical documentation, fix logs, progress notes, and completed implementation guides are stored in `../archive/` and excluded from Cursor/VS Code indexing for performance.

## Current Status

- ✅ TypeScript compilation fixes in progress
- ✅ Test infrastructure verified
- ✅ Railway deployment configured
- 🔄 Fixing remaining route handler type mismatches
