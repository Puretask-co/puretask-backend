# Phase 0 & Phase 1 — Status & Next Steps

**Purpose:** Track where we are in the hardening plan so we can "begin" and move forward. Updated as Phase 0 and Phase 1 progress.

**Plan reference:** [HARDENING_EXECUTION_PLAN.md](../HARDENING_EXECUTION_PLAN.md). Section 1 runbook: [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md).

---

## Phase 0: Prerequisites

| Task | Status | Notes |
|------|--------|-------|
| MASTER_CHECKLIST and runbooks are authority | ✅ | Use MASTER_CHECKLIST + sections/ |
| Phase 1 runbook read | ✅ | SECTION_01_SECRETS.md |
| .env.example exists, no secrets | ✅ | `.env.example` has placeholders only |
| Required env vars for startup | ✅ | `src/config/env.ts` has requireEnv() for DATABASE_URL, JWT_SECRET, STRIPE_*, N8N_WEBHOOK_SECRET |
| .gitignore includes .env*, node_modules/, dist/, *.log | ✅ | `.gitignore` is complete |
| Clone repo; npm ci | — | You have repo; run `npm ci` if deps change |
| npm run build succeeds | ✅ | Build and `tsc --noEmit` pass. |
| npm test passes | ⚠️ | Run locally with `.env` set; sandbox may hit EPERM. After build fix, run tests. |
| Railway (or target) has backend project | — | Confirm deployment target; no secrets in repo |

**Phase 0 next:** Run `npm test` locally with a valid `.env` (or test env) to confirm tests pass. Then proceed with Phase 1 manual actions.

---

## Phase 1: Secrets & Incident Response

| Task | Status | Notes |
|------|--------|-------|
| **Design** | | |
| Secret inventory (off-repo) | ✅ Template | [SECRET_INVENTORY_TEMPLATE.md](./SECRET_INVENTORY_TEMPLATE.md) — copy off-repo; fill Status as you rotate. |
| Rotation order decided | ✅ | Runbook § 1.3: Stripe key → Stripe webhook → DB → JWT → SendGrid → Twilio → OneSignal → n8n |
| Git purge method decided | ✅ | BFG or git-filter-repo; force-push; fresh clone. See runbook § 1.5. |
| **Build / Create** | | |
| Startup env validation | ✅ | `src/config/env.ts`: requireEnv() + validateEnvironment(); throws on missing required vars. |
| .gitignore | ✅ | .env*, node_modules/, dist/, *.log already in place. |
| Incident response doc | ✅ | [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md) — rotation order, immediate actions, links. |
| **Implement (your actions)** | | **Runbook:** [PHASE_1_USER_RUNBOOK.md](./PHASE_1_USER_RUNBOOK.md) |
| Rotate all exposed secrets | ⏳ YOUR ACTION | Follow PHASE_1_USER_RUNBOOK + SECTION_01 § 1.4. Update Railway only; do not commit secrets. |
| Invalidate old tokens / webhooks | ⏳ YOUR ACTION | After rotation: delete old Stripe keys, revoke old webhooks. |
| Remove secrets from git history | ⏳ YOUR ACTION | BFG or git-filter-repo; force-push; instruct contributors to fresh clone. |
| Store secrets only in Railway | ⏳ YOUR ACTION | Confirm no secrets in repo; all runtime secrets in Railway. |
| **Test** | | |
| Startup with missing var → exit non-zero | ✅ | requireEnv() throws; process exits. |
| Startup with all vars → app starts | — | Run with .env or Railway; app starts. |
| CI secret scan | ✅ | `.github/workflows/security-scan.yml` — Gitleaks + forbidden files. |
| Manual: Stripe test webhook 200 with new secret | — | After rotation. |

**Phase 1 code/docs:** Complete. **Phase 1 next:** Execute [PHASE_1_USER_RUNBOOK.md](./PHASE_1_USER_RUNBOOK.md) (inventory off-repo → rotate → invalidate → purge → verify).

---

## Blockers (fix first)

1. ~~**TypeScript build fails**~~ — **Resolved.** Build and `tsc --noEmit` pass.
2. **Tests** — Run `npm test` locally with a valid `.env` (or test env). Fix any failing tests. (Sandbox may hit EPERM; run with full permissions if needed.)

---

## Order of operations (begin here)

1. ~~**Fix TypeScript errors**~~ — Done; build passes.
2. **Run tests** with `.env` or test env; fix failures (optional before Phase 1 actions).
3. **Phase 1 — Your actions (no code):**
   - Create **secret inventory** off-repo (list every key that was or could be exposed).
   - **Rotate secrets** in order: Stripe key → Stripe webhook secret → DB → JWT → SendGrid → Twilio → OneSignal → n8n. Use [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) and [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md).
   - **Purge git history** (BFG or git-filter-repo); force-push; fresh clone for all contributors.
4. **Phase 3 (after Phase 2):** Add CI secret scan and pre-commit hook — see HARDENING_EXECUTION_PLAN Phase 3.

---

## Links

- [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Full checklist.
- [HARDENING_EXECUTION_PLAN.md](../HARDENING_EXECUTION_PLAN.md) — Phases 0–14 detail.
- [PHASE_1_USER_RUNBOOK.md](./PHASE_1_USER_RUNBOOK.md) — Phase 1 manual steps (rotate, purge, verify).
- [SECRET_INVENTORY_TEMPLATE.md](./SECRET_INVENTORY_TEMPLATE.md) — Template for off-repo secret inventory.
- [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) — Section 1 runbook.
- [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md) — Incident response and rotation.

**Last updated:** 2026-01-31
