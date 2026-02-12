# Phase 1 — User Runbook (Your Actions)

**Purpose:** Execute every Phase 1 implement and verify step. All code and docs for Phase 1 are done; this runbook is the **only** remaining work: rotate secrets, purge history, verify.

**Outcome:** No secrets in repo; all exposed credentials rotated; git history purged; secrets only in Railway; startup validates env.

---

## Prerequisites (already done in repo)

- [x] Startup env validation (`src/config/env.ts`: `requireEnv()` + `validateEnvironment()`)
- [x] `.gitignore` includes `.env*`, `node_modules/`, `dist/`, `*.log`
- [x] Incident response doc: [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md)
- [x] CI secret scan: `.github/workflows/security-scan.yml` (Gitleaks + forbidden files)
- [x] Rotation order and purge method documented in [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md)

---

## Step 1 — Secret inventory (off-repo)

- [ ] Copy [SECRET_INVENTORY_TEMPLATE.md](./SECRET_INVENTORY_TEMPLATE.md) into a **private** doc (Notion, Google Doc, or password-protected spreadsheet).
- [ ] Do **not** commit the filled-in inventory. Use it to track **Status** (pending / rotated) as you rotate.

---

## Step 2 — Rotate secrets (in order)

Use [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) § 1.4 for each provider. Update **Railway** (or your deployment target) only; do **not** commit secrets.

| Order | Secret | Action | Done |
|-------|--------|--------|------|
| 1 | Stripe Secret Key | Dashboard → new key → Railway `STRIPE_SECRET_KEY` → deploy → delete old key | [ ] |
| 2 | Stripe Webhook Signing Secret | New endpoint or rotate signing secret → Railway `STRIPE_WEBHOOK_SECRET` → deploy → remove old | [ ] |
| 3 | Database (Neon/Postgres) | Rotate password or new role → Railway `DATABASE_URL` → deploy → revoke old | [ ] |
| 4 | JWT Secret | `openssl rand -hex 32` → Railway `JWT_SECRET` → deploy (all users re-login) | [ ] |
| 5 | SendGrid | New API key → Railway `SENDGRID_API_KEY` → deploy → revoke old | [ ] |
| 6 | Twilio | New Auth Token (and SID if needed) → Railway → deploy → revoke old | [ ] |
| 7 | OneSignal | New API key if needed → Railway → deploy | [ ] |
| 8 | n8n webhook | New HMAC secret → Railway `N8N_WEBHOOK_SECRET` + n8n env → deploy both | [ ] |
| 9 | Optional (if exposed) | Sentry DSN, Redis URL, Slack webhook, Google/Facebook/OpenAI/n8n API | [ ] |

---

## Step 3 — Invalidate old tokens / webhooks

- [ ] Stripe: Old secret key **deleted** (not disabled). Old webhook signing secret removed.
- [ ] JWT: Old tokens invalid after deploy with new `JWT_SECRET` (expected).
- [ ] DB: Old credentials revoked in Neon/Postgres.
- [ ] SendGrid/Twilio/OneSignal/n8n: Old keys revoked per provider.

---

## Step 4 — Remove secrets from git history

- [ ] **Working tree:** Ensure no `.env`, `.env.production`, `.env.staging` in repo. Only `.env.example` is allowed.
- [ ] **History:** Run BFG or git-filter-repo to remove `.env*` from history. Force-push. See [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) § 1.5.
- [ ] **Team:** Instruct all contributors to **fresh clone** (no pull after history rewrite).

Example (BFG):

```bash
# Install BFG, then (from repo root):
# java -jar bfg.jar --delete-files .env
# git reflog expire --expire=now --all && git gc --prune=now --aggressive
# git push --force
```

---

## Step 5 — Verify

- [ ] No `.env` in working tree; `git status` and `git log --all -- .env` show nothing (or history rewritten).
- [ ] Railway (or target) has all runtime secrets; repo has **zero** secrets.
- [ ] App starts with all vars set: `npm start` (or deploy) succeeds.
- [ ] Startup with one required var missing exits non-zero with clear message (already enforced by `requireEnv()`).
- [ ] Manual: Stripe test webhook returns 200 with new signing secret; test PaymentIntent works with new key.

---

## Step 6 — Mark Phase 1 complete

- [ ] Secret inventory (off-repo) updated: all items **rotated**.
- [ ] Git history purged; team has fresh clones.
- [ ] Secrets only in Railway; incident response doc and this runbook are the single source of truth for "what to do if it happens again."

---

## Links

| Doc | Purpose |
|-----|---------|
| [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) | Full runbook, provider steps, purge plan |
| [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md) | Incident steps, rotation list, verification |
| [SECRET_INVENTORY_TEMPLATE.md](./SECRET_INVENTORY_TEMPLATE.md) | Template to copy off-repo for inventory |
| [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) | Section 1 checklist |
| [PHASE_0_1_STATUS.md](./PHASE_0_1_STATUS.md) | Phase 0 & 1 status |

---

**Last updated:** 2026-01-31
