# Security Incident Response - Secret Exposure

**What this doc is for:** Follow it when a secret has been exposed (e.g. committed to git, leaked in logs, or suspected compromise). It lists (1) what was found, (2) immediate actions (pre-commit, .gitignore), and (3) which secrets to rotate and in what order (Stripe, JWT, DB, etc.). Use it together with SECURITY_GUARDRAILS for prevention.

**Why it matters:** Rotating exposed secrets quickly limits blast radius. This doc ensures you don't forget a key (e.g. webhook secret) and that rotation order is clear (e.g. JWT rotation invalidates all sessions).

**In plain English:** If a password or API key got out (e.g. committed to git or leaked), follow this doc. It says what to do right away (block future leaks) and which keys to replace and in what order (Stripe, login secret, database, etc.) so the old key stops working and the new one is in place.

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

## Date
[Current Date]

## Issue
**What it is:** A short description of what happened (e.g. secrets in git, leaked in logs).  
**What it does:** Sets context so everyone knows what we're responding to.  
**How we use it:** Replace with the actual issue summary when you use this runbook.

Secrets were found in git history and local .env file.

## What Was Found
**What it is:** The list of exposed items (keys, files, commits).  
**What it does:** Documents what was compromised so we don't miss a key.  
**How we use it:** List every exposed secret or location; use this list to drive rotation.
1. **Stripe LIVE keys** in git commit history
2. **Real Stripe LIVE key** in local `.env` file
3. Multiple commits containing `sk_live_` pattern

## Immediate Actions Taken
**What it is:** Steps we took right away (pre-commit, .gitignore, block future commits).  
**What it does:** Stops further exposure while we rotate.  
**How we use it:** Do these first; tick when done so we don't forget.

1. ✅ Pre-commit hook installed to prevent future commits
2. ✅ `.env` files added to `.gitignore`
3. ⚠️ **REQUIRED**: Rotate all exposed secrets

## Secrets That Need Rotation

### Critical (Rotate Immediately)
- [ ] **Stripe Live API Key** (`sk_live_*`)
  - Revoke at: https://dashboard.stripe.com/apikeys
  - Generate new key
  - Update Railway environment variable
  
- [ ] **Stripe Webhook Secret** (`whsec_*`)
  - Generate new webhook secret in Stripe dashboard
  - Update Railway environment variable
  - Update webhook endpoint in Stripe

- [ ] **JWT_SECRET**
  - Generate new secret: `openssl rand -hex 32`
  - Update Railway environment variable
  - **Note**: All users will need to re-login

### High Priority
**What it is:** Secrets to rotate next if exposed (DB, N8N webhook).  
**What it does:** Covers DB and integration secrets that could have been leaked.  
**How we use it:** If DATABASE_URL or N8N webhook was exposed, rotate and update Railway and n8n.

- [ ] **Database Password** (if DATABASE_URL was exposed)
  - Change password in Neon/PostgreSQL
  - Update Railway DATABASE_URL

- [ ] **N8N_WEBHOOK_SECRET**
  - Generate new secret
  - Update Railway and n8n configuration

### Medium Priority (if exposed)
- [ ] SendGrid API Key
- [ ] Twilio Account SID and Auth Token
- [ ] OpenAI API Key
- [ ] Google OAuth Client Secret
- [ ] Facebook App Secret

## Git History Cleanup

**What it is:** Optional steps to remove secrets from git history (filter-branch, BFG).  
**What it does:** Reduces risk of someone cloning old history and finding secrets.  
**How we use it:** Only if repo is private and team agrees; coordinate before rewriting history.

### If Repository is Private
**What it is:** Using filter-branch or BFG to remove secrets from past commits.  
**What it does:** Rewrites history so the secret no longer appears in clone.  
**How we use it:** Run only after coordinating with team; everyone must re-clone or rebase.

Consider using `git filter-branch` or BFG Repo-Cleaner to remove secrets from history:
```bash
# WARNING: This rewrites history - coordinate with team
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### If Repository is Public or Shared
- Assume secrets are compromised
- Do NOT attempt to remove from history (it's too late)
- Focus on rotating all secrets immediately
- Document the incident

## Prevention Measures Implemented
**What it is:** The guardrails we put in place after the incident (pre-commit, .gitignore, CI).  
**What it does:** Reduces chance of a repeat exposure.  
**How we use it:** Ensure all items are in place; reference SECURITY_GUARDRAILS for setup.

1. ✅ Pre-commit hook for secret scanning
2. ✅ `.gitignore` updated to exclude all `.env` files
3. ✅ CI/CD secret scanning workflow
4. ✅ ESLint rule to prevent legacy auth usage

## Verification Checklist
- [ ] All Stripe keys rotated
- [ ] All webhook secrets updated
- [ ] JWT_SECRET rotated
- [ ] Database password changed (if needed)
- [ ] All API keys rotated
- [ ] Railway environment variables updated
- [ ] Application tested with new secrets
- [ ] Team notified of secret rotation

## Notes
**What it is:** Reminders and rules to prevent future exposure.  
**What it does:** Reinforces that secrets live only in Railway and never in repo.  
**How we use it:** Share with team after incident; use as reference for onboarding.

- Pre-commit hook will prevent future accidental commits
- All secrets should live ONLY in Railway environment variables
- Never commit `.env` files, even test ones
- Use `.env.example` for documentation only
