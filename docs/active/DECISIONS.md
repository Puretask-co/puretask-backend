# Decisions

> Canonical record of architectural/product decisions extracted from historical logs.
> If a decision changes, add a new entry and mark the old one as superseded.

## Current active decisions (curated)

Hand-curated list (~10â€“30). Each entry: **Decision** â€” **Why** â€” **Tradeoff**.

- **Neon Postgres for DB** â€” Why: serverless scaling, branching, managed backups â€” Tradeoff: vendor dependency
- **Railway for deploy** â€” Why: speed, simplicity, GitHub integration â€” Tradeoff: platform coupling
- **n8n as event router** â€” Why: async workflows, retries, visibility â€” Tradeoff: extra service to run
- **/health and /health/ready endpoints** â€” Why: monitoring, deploy checks, load balancer health â€” Tradeoff: none
- **Canonical docs only (README, SETUP, ARCHITECTURE, RUNBOOK, DEPLOYMENT, TROUBLESHOOTING, DECISIONS)** â€” Why: single source of truth, no doc sprawl â€” Tradeoff: must append, not create new files
- **Pre-commit guard for new .md** â€” Why: block new markdown outside docs/active or docs/archive â€” Tradeoff: must move new docs into approved paths
- **Idempotency keys on money-adjacent endpoints** â€” Why: safe retries, no double charge â€” Tradeoff: client must send key, store responses
- **Stripe for payments + Connect for payouts** â€” Why: global payments, compliance â€” Tradeoff: fees, Stripe dependency
- **Sentry init once (instrument.js)** â€” Why: correct tracing, no double-capture â€” Tradeoff: must preload before app
- **Layering: routes thin, services own logic** â€” Why: testability, clear boundaries â€” Tradeoff: more files, no DB in routes
- **Cleaner Level System: goals over XP, levels as gates** — Why: behavior control, tangible rewards (cash, visibility, fee reduction), no abstract points — Tradeoff: goal evaluation on each completion/login adds minor latency (async)
- **Gamification docs: bundle content as canonical for rules and constants** — Why: bundle docs (PURETASK_GAMIFICATION_CURSOR_CONTEXT, event_contract_v1, metrics_contract_v1, spec_enforcement_matrix_v1) are more complete than backend’s original gamification sections: they define canonical rules (meaningful login 15 min, message 25 chars/template/reply 24h, photo/on-time/good-faith), key constants table, and full event/metric contracts. Backend ARCHITECTURE keeps code/schema paths; we merged the bundle’s rules and constants into ARCHITECTURE and RUNBOOK so one source of truth exists. Bundle SQL migrations are not run (043–056 already apply). — Tradeoff: two doc locations (canonical docs + gamification_bundle/docs) with canonical docs holding the distilled rules; full contracts stay in gamification_bundle/docs.
- **Documents switch: uploaded bundle as canonical gamification spec** — Why: the uploaded bundle is the source of truth for gamification. We made the switch by: (1) declaring gamification_bundle/README.md the index and PURETASK_GAMIFICATION_CURSOR_CONTEXT.md the lead doc; (2) pointing ARCHITECTURE §3, RUNBOOK §4, SETUP, and docs/active/README.md to the bundle; (3) keeping implementation (code, DB) unchanged. — Tradeoff: single canonical spec location; implementation docs reference it.
- **ESLint: zero errors, warnings allowed** — Why: CI and local `npm run lint` must pass (exit 0). We ignore test/spec/docs and gamification-bundle for type-aware lint; allow `db/client` in core/workers/lib/middleware/routes; SQL template literal rule and no-misused-promises are "warn"; no-console is "warn" in workers, "off" in logger. Remaining errors were fixed (void promises, logger instead of console, eslint-disable for optional require). — Tradeoff: many no-explicit-any and no-unused-vars remain as warnings; can tighten later.
- **Real-site frontend stack: Next.js + Tailwind + shadcn/ui + Framer Motion** — Why: aligns with existing frontend docs and DATA_MODEL_REFERENCE (timeline, presence map); Next.js for SSR and deploy; Tailwind + shadcn for consistency; Framer for job timeline and trust UI. — Tradeoff: none for this repo (frontend lives in its own repo).
- **Maps: Mapbox** — Why: better for custom "cleaner on route" and presence UX (vector tiles, mobile SDKs, predictable pricing at scale). Use Google Directions API only if you already rely on it for turn-by-turn. — Tradeoff: another vendor; Google may be simpler if you only need basic directions.
- **Uploads: S3 or Cloudflare R2 with signed URLs** — Why: backend already assumes S3/Cloudinary and signed URLs (fileUploadService, MASTER_CHECKLIST). S3 default (ecosystem, BACKUP_S3 in n8n); R2 if zero egress matters (S3-compatible API). — Tradeoff: R2 slightly smaller ecosystem; S3 egress cost unless behind CloudFront.
- **Single S3-compatible storage implementation for S3 and R2** — Why: one codepath in `src/lib/storage.ts` using AWS SDK; R2 is "S3 API + custom endpoint". Env only: set `STORAGE_ENDPOINT` for R2, leave empty for S3. Endpoints: `POST /uploads/sign` (signed PUT URL), `POST /jobs/:jobId/photos/commit` (record photo + optional timeline events when MIN_BEFORE_PHOTOS / MIN_AFTER_PHOTOS met), `GET /jobs/:jobId/timeline` (events ASC for stepper). — Tradeoff: none.
- **Canonical job status in one place** — Why: backend, frontend, and n8n must use the same status enum and transition rules. Source: `src/state/jobStateMachine.ts` and `src/constants/jobStatus.ts` (JSON-safe constants for frontend/n8n). See ARCHITECTURE §3.4a. — Tradeoff: frontend/n8n must consume from this repo or a shared package.
- **Admin audit log for sensitive actions** — Why: ops trail for resolve dispute, override job status, and (already) credit adjust. `logAdminAction` in `src/lib/adminAuditLog.ts` writes to `admin_audit_log` (019 schema). Used by: job status override, dispute resolve (by id and by jobId). Credit adjust already logged via `createAuditLog` → `audit_logs`. — Tradeoff: none.

---

## Data and copy: backend vs frontend (2026-02)

**Review question:** Is there data or copy we built in the backend that should live on the frontend instead?

**Summary:** Most backend-owned data is correct (source of truth for DB/admin-editable content). A few items are **pure UI copy** or **display-only derivations** that could move to the frontend to simplify the API and centralize i18n/UX.

### Keep in backend (correct as-is)

- **Level names (`level_label`)** — Sourced from `cleaner_level_definitions` (DB); can be admin-editable. API returning `level_label` with `current_level` is fine.
- **Badge name/icon** — From `badge_definitions` (DB) and config; admin can change. API returns `id`, `name`, `icon` for profile/trust signals. Correct.
- **Reason codes (label, description)** — Stored in DB, admin-editable; used in cancellation/decline flows. Backend is source of truth.
- **Invoice/line item labels** — From DB (`description`); backend correct.
- **Support explanation paragraph** — Generated server-side from gamification state so support “Copy explanation” stays in sync with data. Keep in backend.
- **Next Best Action / reward_preview label** — Derived from reward definitions (DB); backend is fine. If we ever want frontend i18n for reward names, we could return only `reward_id` and have frontend map; not required now.
- **Gamification config (goals, levels, level copy, quick templates)** — Used by backend for evaluation, emails, and API responses. Level copy and quick templates used **only** for in-app UI could theoretically move to frontend; if they’re also used in notifications or system messages, keep in backend.

### Good candidates to move to frontend

1. **Trust live-appointment checklist labels**  
   **Where:** `src/routes/trustAdapter.ts` — hardcoded `[{ id: "c1", label: "Kitchen" }, { id: "c2", label: "Bathrooms" }, { id: "c3", label: "Floors" }]`.  
   **Recommendation:** Backend returns only checklist state, e.g. `[{ id, completed, completedAtISO }]` (or equivalent). Frontend owns the list of room labels and merges for display. Reduces coupling and allows frontend/i18n to change copy without backend deploy.

2. **Admin settings category labels**  
   **Where:** `src/routes/admin/settings.ts` — `formatCategoryLabel()` maps `setting_type` to strings like "Platform Configuration", "Booking Rules".  
   **Recommendation:** API returns raw `setting_type`; frontend holds the map (or i18n) for display. Keeps admin UI copy and possible i18n on the frontend.

3. **Matching explanation strings**  
   **Where:** `src/routes/matching.ts` — builds `explanation: string[]` (e.g. "High reliability score (85/100)", "Elite tier cleaner - top performer"). API also returns `breakdown` with numeric scores and keys.  
   **Recommendation:** Optional. Frontend could format explanations from `breakdown` alone; backend would return only `breakdown`. Keeps all “why we recommended this cleaner” copy and i18n on the frontend. If the same strings are used in emails or other backend contexts, keep current behavior.

### Optional / context-dependent

- **Level label only:** If level names become **fixed** (never admin-edited), frontend could hold a static map `level 1–10 → display name` and API could return only `current_level`. Today level names are in DB and may be edited; current design is correct unless we explicitly make levels non-editable.
- **Level copy / quick message templates** (`getLevelCopy()`, `getQuickTemplates()` in `src/config/cleanerLevels/index.ts`): If used only for cleaner-facing in-app UI, could move to frontend; if used in notifications or backend-generated messages, keep in backend.

**Decision:** No change required immediately. When touching Trust adapter or admin settings, consider moving checklist labels and admin category labels to the frontend. Matching explanations can stay as-is unless we want full i18n for match reasons.

### Copy-paste: what to put in the frontend

Use the blocks below in the **frontend** (constants, i18n, or config). After that, change the **backend** as noted so it only returns data, not labels.

---

**1. Trust live-appointment checklist (room labels)**

Backend today: `src/routes/trustAdapter.ts` builds `checklist` with `id`, `label`, `completed`, `completedAtISO`.  
Move the **labels** to the frontend. Backend should return only e.g. `{ id, completed, completedAtISO }` (no `label`).  
Frontend merges this list with labels:

```ts
// Frontend: e.g. constants/trustChecklist.ts or i18n
export const TRUST_CHECKLIST_ROOM_LABELS: Record<string, string> = {
  c1: "Kitchen",
  c2: "Bathrooms",
  c3: "Floors",
};

// Usage: map API checklist items and add label from TRUST_CHECKLIST_ROOM_LABELS[id]
```

---

**2. Admin settings category labels**

Backend today: `src/routes/admin/settings.ts` → `formatCategoryLabel(type)`.  
Backend should return raw `setting_type`; frontend does the display mapping:

```ts
// Frontend: e.g. constants/adminSettingsCategories.ts or i18n
export const ADMIN_SETTINGS_CATEGORY_LABELS: Record<string, string> = {
  platform: "Platform Configuration",
  booking: "Booking Rules",
  pricing: "Pricing & Fees",
  credits: "Credit System",
  payment: "Payment Settings",
  payout: "Payout Settings",
  notifications: "Notifications",
  email: "Email Configuration",
  sms: "SMS Configuration",
  features: "Feature Flags",
  ai: "AI Assistant",
  security: "Security Settings",
  rate_limit: "Rate Limiting",
  tiers: "Cleaner Tiers",
  reviews: "Review System",
  disputes: "Disputes",
  referral: "Referral Program",
  analytics: "Analytics & Tracking",
  api: "API Configuration",
  webhooks: "Webhooks",
  backup: "Backup & Maintenance",
  maintenance: "Maintenance",
};

// Fallback if type not in map: type.charAt(0).toUpperCase() + type.slice(1)
```

---

**3. Matching explanation strings (optional)**

Backend today: `src/routes/matching.ts` returns `explanation: string[]` and `breakdown` with `description` per factor.  
If you want i18n, backend can return only `breakdown` (scores + keys); frontend builds the bullet list from these templates (use `breakdown.reliability.score`, `breakdown.distance.description`, etc.):

```ts
// Frontend: templates to build explanation bullets from GET match explain response
// Backend returns: breakdown.reliability.score, .distance, .repeatClient, .flexibility, .riskAlignment
// Each has .score and .description. Backend can stop sending top-level "explanation" array.

// Template ideas (frontend builds string from breakdown + these):
// - reliability: `Based on ${score}/100 reliability score` or use breakdown.reliability.description
// - distance: `${km}km from job location` or use breakdown.distance.description
// - repeatClient: "Bonus for previous successful jobs with you" | "No prior history with this client"
// - flexibility: "Low flexibility badge (prefers fixed schedules)" | "Flexible with schedule changes"
// - riskAlignment: "Adjustment based on client risk profile" | "Good risk alignment"
// Plus summary bullets: "High reliability score (X/100)", "Close proximity (Xkm away)",
// "Has successfully completed jobs with you before", "Elite tier cleaner - top performer",
// "Pro tier cleaner - highly rated"
```

So: copy **1** and **2** into the frontend as-is; use **3** only if you want to stop sending `explanation[]` from the backend and build it from `breakdown` on the frontend.

---

## Documentation consolidation (done 2026-02)

**Approach:** We **synthesized** (gathered all ideas and important information into one coherent doc per topic), not concatenated. See **CONSOLIDATION_GUIDE.md** for the plan and which docs were combined.

**Completed:** Backup & restore → `BACKUP_RESTORE.md`; CI/CD → `CI_CD_SETUP.md`; Notifications (4 files) → `NOTIFICATIONS.md`; API (3 files) → `API_REFERENCE.md`; Founder reference → `FOUNDER_BACKEND_REFERENCE.md` is now an index linking to `founder/*.md` (full single-doc version archived). Source files archived to `docs/archive/raw/consolidated-sources/` (01-HIGH/, 02-MEDIUM/, FOUNDER_BACKEND_REFERENCE_FULL.md).

**Not combined (kept as-is):** RUNBOOK + DEPLOYMENT; Legal; Gamification bundle docs; 01-HIGH/02-MEDIUM/03-LOW folder structure for remaining files. Table below kept as historical reference.

| Candidate | Files to combine | Target / note |
|-----------|------------------|---------------|
| **Backup & restore** | `docs/active/BACKUP_RESTORE.md`, `01-HIGH/BACKUP_SETUP.md`, `01-HIGH/BACKUP_RESTORE_PROCEDURE.md` | Merge into single `BACKUP_RESTORE.md`: strategy + setup + restore steps. 01-HIGH versions are longer and have "plain English" sections; fold the best into active and archive the 01-HIGH pair. |
| **CI/CD** | `docs/active/CI_CD_SETUP.md`, `01-HIGH/CI_CD_SETUP.md` | One file only. 01-HIGH version is longer and has glossary; merge any missing workflow detail into active `CI_CD_SETUP.md` and remove or archive the duplicate. |
| **RUNBOOK + DEPLOYMENT** | `RUNBOOK.md`, `DEPLOYMENT.md` | Optional. Both cover deploy, rollback, production. Could become one "Ops & deployment" doc; current split (RUNBOOK = ops/incident, DEPLOYMENT = Railway/process layout) is also fine. |
| **Notifications (02-MEDIUM)** | `NOTIFICATION_DEDUPE_STRATEGY.md`, `NOTIFICATION_MATURITY_UPGRADES.md`, `NOTIFICATION_SENDER_ANALYSIS.md`, `NOTIFICATION_TEMPLATES_OUTLINE.md` | One `NOTIFICATIONS.md` with sections: dedupe, maturity/sender, templates. Reduces four files to one reference. |
| **API (02-MEDIUM)** | `API_DOCUMENTATION.md`, `API_SPEC_COMPARISON.md`, `API_EXACT_ENDPOINTS.md` | One `API_REFERENCE.md`: how we document the API + spec comparison + exact endpoints. Complements canonical `BACKEND_ENDPOINTS.md`. |
| **Founder reference** | `FOUNDER_BACKEND_REFERENCE.md` (single long doc) + `founder/*.md` (36 topic files) | Either: (A) merge all `founder/*.md` into `FOUNDER_BACKEND_REFERENCE.md` as sections (one very long doc), or (B) keep `founder/` as chapters and make `FOUNDER_BACKEND_REFERENCE.md` a short index that links to them. Avoid duplicating the same content in both. |
| **Legal** | `legal/README.md` + `legal/*.md` (TOS, PRIVACY_POLICY, CLEANER_AGREEMENT, etc.) | Usually kept separate for counsel and liability clarity. Optional: one `LEGAL.md` with an index and sections for each artifact; current structure is already an index + files. |
| **Gamification bundle docs** | `gamification_bundle/docs/*.md` (README, event_contract, metrics_contract, enforcement, etc.) | Optional: one `GAMIFICATION_SPEC.md` with sections. Current split is good for modular updates; combine only if you want a single long spec. |
| **01-HIGH / 02-MEDIUM / 03-LOW** | All files under these priority folders | Either merge each folder’s content into the relevant canonical doc (e.g. 01-HIGH backup → BACKUP_RESTORE; 01-HIGH CI_CD → CI_CD_SETUP), or turn each folder into one "HIGH/MEDIUM/LOW backlog" doc that links to or embeds the current files. Reduces many small files to a few. |

---
## Extracted from archive (auto)

Raw lines matched from `docs/archive/raw`. For quick reference use the curated list above. Re-run `scripts\generate-decisions.ps1` to refresh.

### undated

- **| **Old Railway** | 10+ | `_archive/old-railway/` |** _(source: `docs\archive\raw\iterative_logs\COMPLETE_ORGANIZATION_SUMMARY.md`)_
- **â”‚   â”œâ”€â”€ deployment/    â† Railway, environment, setup** _(source: `docs\archive\raw\iterative_logs\COMPLETE_ORGANIZATION_SUMMARY.md`)_
- **â”‚   â”œâ”€â”€ old-railway/** _(source: `docs\archive\raw\iterative_logs\COMPLETE_ORGANIZATION_SUMMARY.md`)_
- **- **Fix:** Deploy to Railway and test** _(source: `docs\archive\raw\iterative_logs\COMPLETE_PLATFORM_ANALYSIS.md`)_
- **- [ ] Deploy to Railway staging** _(source: `docs\archive\raw\iterative_logs\COMPLETE_PLATFORM_ANALYSIS.md`)_
- **- âš ï¸ Railway configuration exists but not deployed** _(source: `docs\archive\raw\iterative_logs\COMPLETE_PLATFORM_ANALYSIS.md`)_
- **- Railway/Render (backend hosting)** _(source: `docs\archive\raw\iterative_logs\COMPLETE_ROLLOUT_PLAN_V3_V4_FULL.md`)_
- **- Railway: $5/mo (hobby)** _(source: `docs\archive\raw\iterative_logs\FINAL_PRE_LAUNCH_SUMMARY.md`)_
- **- Sign up for Railway + Vercel** _(source: `docs\archive\raw\iterative_logs\FINAL_PRE_LAUNCH_SUMMARY.md`)_
- **3. Deploy to Railway + Vercel (2 hours)** _(source: `docs\archive\raw\iterative_logs\FINAL_PRE_LAUNCH_SUMMARY.md`)_
- **- Idempotency guards in place** _(source: `docs\archive\raw\iterative_logs\FINAL_STATUS.md`)_
- **- Ledger idempotency guards âœ…** _(source: `docs\archive\raw\iterative_logs\FINAL_STATUS.md`)_
- **- Stripe webhook idempotency âœ…** _(source: `docs\archive\raw\iterative_logs\FINAL_STATUS.md`)_
- **- Worker idempotency verified âœ…** _(source: `docs\archive\raw\iterative_logs\FINAL_STATUS.md`)_
- **## 5. Concurrency & Idempotency** _(source: `docs\archive\raw\iterative_logs\JOB_STATUS_MACHINE.md`)_
- **- [ ] `DATABASE_URL=<railway-postgres-url>`** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- âœ… Reference V3_DEPLOYMENT_COMPLETE.md and V4_DEPLOYMENT_COMPLETE.md as source of truth** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- Command: `railway run npm run migrate:run`** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- Run: `.\scripts\set-railway-env-secure.ps1`** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- Status: Available in Railway project** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- URL: `https://puretask-production.up.railway.app/stripe/webhook`** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **## 3. Railway Deployment Status** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- ****Next Review**: After Railway deployment complete** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **| **Internal URL** | âœ… ACTIVE | `puretask-backend.railway.internal` |** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **| **Production** | Railway deployment (`puretask-production.up.railway.app`) | Currently deploying, variables being set |** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **| **Public Domain** | âœ… GENERATED | https://puretask-production.up.railway.app |** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **| **Service** | âœ… DEPLOYED | `puretask-production.up.railway.app` |** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **1. [ ] Run database migrations on Railway Postgres** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **1. âœ… Complete Railway environment variable setup** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **3. [ ] Schedule V3 subscription worker (Railway cron)** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **3. â³ Wait for Railway deployment to complete** _(source: `docs\archive\raw\iterative_logs\LIVE_STATUS_AND_GATES_ACCURATE.md`)_
- **- Deploy backend (Railway)** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- Deploy backend to Railway** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- Multiple Railway instances** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- Railway (backend) - $5-20/mo** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- Railway (Backend): $20/mo with scaling** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- Railway (Backend): $5/mo hobby plan** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **1. Sign up for Railway & Vercel** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **4. Deploy backend to Railway** _(source: `docs\archive\raw\iterative_logs\MASTER_STATUS.md`)_
- **- **Standardized Format**: `{ error: { code, message }, requestId, timestamp }`** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- **- [x] Error handling standardized** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- **- Create Sentry account and add `SENTRY_DSN` to Railway** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- ****Action**: Configure Railway/load balancer to redirect HTTP â†’ HTTPS** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- **1. **Set Environment Variables** in Railway:** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- **3. **Configure HTTPS** at Railway/load balancer level** _(source: `docs\archive\raw\iterative_logs\PRODUCTION_READINESS_STATUS.md`)_
- **- Analytics for decision-making** _(source: `docs\archive\raw\iterative_logs\PROJECT_COMPLETION_CERTIFICATE_FINAL.md`)_
- **### 3.3 Credits as the Source of Truth** _(source: `docs\archive\raw\iterative_logs\PURETASK_FINAL_BLUEPRINT_OVERVIEW.md`)_
- **Canonical - Single Source of Truth** _(source: `docs\archive\raw\iterative_logs\PURETASK_FINAL_BLUEPRINT_OVERVIEW.md`)_
- **PureTask relies heavily on background processing for time-based enforcement, lifecycle transitions, reconciliation, notifications, analytics, and safety checks. Workers are first-class system components; failure handling, retries, and idempotency are core design concerns.** _(source: `docs\archive\raw\iterative_logs\PURETASK_FINAL_BLUEPRINT_OVERVIEW.md`)_
- **- âœ… `railway.json` - Railway deployment config** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **- âœ… `railway.toml` - Alternative Railway config** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **- Go to Railway â†’ `puretask-backend` â†’ "Build Logs" tab** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **# ðŸš‚ Railway Build Fix - Current Status** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **2. **Railway will auto-deploy** when you push to `main`** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **git add nixpacks.toml railway.json railway.toml** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **git commit -m "fix: add explicit Railway build configuration"** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **I've created an explicit build configuration file that tells Railway exactly how to build your app:** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **Railway still can't determine how to build the app, even though Root Directory is correct.** _(source: `docs\archive\raw\iterative_logs\RAILWAY_BUILD_FIX.md`)_
- **- **Health Check**: http://localhost:4000/health** _(source: `docs\archive\raw\iterative_logs\SERVER_STATUS.md`)_
- **- [ ] Payment idempotency tests (needs review)** _(source: `docs\archive\raw\iterative_logs\TEST_STATUS_SUMMARY.md`)_
- **- Idempotency guards work** _(source: `docs\archive\raw\iterative_logs\TEST_STATUS_SUMMARY.md`)_
- **- Ledger idempotency** _(source: `docs\archive\raw\iterative_logs\TEST_STATUS_SUMMARY.md`)_
- **- Stripe webhook idempotency** _(source: `docs\archive\raw\iterative_logs\TEST_STATUS_SUMMARY.md`)_
- ****`PURETASK_COMPLETE_TESTING_MASTER_GUIDE.md`** is your single source of truth, containing:** _(source: `docs\archive\raw\iterative_logs\TESTING_FINAL_STATUS.md`)_
- **### Schedule in Railway** _(source: `docs\archive\raw\iterative_logs\WORKER_STATUS.md`)_
- **See: `DEPLOY_TO_RAILWAY.md` for Railway cron configuration** _(source: `docs\archive\raw\iterative_logs\WORKER_STATUS.md`)_
- **- Idempotency on mutating endpoints that can be retried (e.g., approve, complete, refund).** _(source: `docs\archive\raw\uncategorized\API_ENDPOINTS.md`)_
- **- Idempotency-Key header for idempotent operations (approve, refunds).** _(source: `docs\archive\raw\uncategorized\API_ENDPOINTS.md`)_
- **- Refunds: one refund per event; Stripe event idempotency enforced.** _(source: `docs\archive\raw\uncategorized\API_ENDPOINTS.md`)_
- **## Idempotency Rules (key ones)** _(source: `docs\archive\raw\uncategorized\API_ENDPOINTS.md`)_
- **Defines the API surface for core operations (auth, booking, jobs, credits, payouts, disputes, admin). Maps endpoints to responsible services and states. Ensures idempotency and validation rules.** _(source: `docs\archive\raw\uncategorized\API_ENDPOINTS.md`)_
- **- Health check: `http://localhost:4000/health` â†’ Timeout** _(source: `docs\archive\raw\uncategorized\BACKEND_TIMEOUT_ISSUE.md`)_
- **- âœ… Error format standardized** _(source: `docs\archive\raw\uncategorized\BEST_PRACTICES_AUDIT.md`)_
- **- âœ… `payouts` correctly references `users` (the source of truth)** _(source: `docs\archive\raw\uncategorized\BEST_PRACTICES_REVIEW.md`)_
- **- Idempotency violation â†’ return existing job reference without new ledger entries.** _(source: `docs\archive\raw\uncategorized\BOOKING_SYSTEM.md`)_
- **- Idempotency: duplicate booking submissions with same idempotency key should not double-charge or double-create.** _(source: `docs\archive\raw\uncategorized\BOOKING_SYSTEM.md`)_
- **- **Hardening Migrations**: 901-905 for idempotency and safety** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- **Idempotency**: Workers designed to be safely re-run** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- **V1 Hardening**: Payout locks and idempotency (prevents double-payouts)** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- **V1 Hardening**: Webhook idempotency (handles duplicate webhook deliveries)** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- Escrow idempotency** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- Idempotency verified** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- Partial unique indexes for idempotency** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **- Webhook idempotency** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **1. **Stripe Webhook Idempotency**** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **2. **Escrow Idempotency**** _(source: `docs\archive\raw\uncategorized\CAPABILITIES.md`)_
- **| Check health | `curl http://localhost:4000/health` |** _(source: `docs\archive\raw\uncategorized\COMMANDS.md`)_
- **2. Check health: `Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing`** _(source: `docs\archive\raw\uncategorized\CONNECTION_TEST_RESULTS.md`)_
- **- **Health Check**: http://localhost:4000/health** _(source: `docs\archive\raw\uncategorized\docs_archive__SERVER_STARTUP_GUIDE.md`)_
- ****Purpose:** Single source of truth for all email templates** _(source: `docs\archive\raw\uncategorized\email-registry.md`)_
- ***This registry is the single source of truth for all email/SMS templates in PureTask.*** _(source: `docs\archive\raw\uncategorized\email-registry.md`)_
- **| `GET /admin/system/health` | âœ… `/admin/system/health` | âœ… EXISTS | adminEnhanced.ts:140 |** _(source: `docs\archive\raw\uncategorized\ENDPOINT_VERIFICATION_REPORT.md`)_
- **- **Internal Scheduler**: Optional (see `scripts/setup-railway-cron.md`)** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **- **Railway Cron**: Recommended for production** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **- âœ… **Scheduled Execution**: Workers are designed to run via cron (Railway, etc.)** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **- See `scripts/setup-railway-cron.md` for guidance** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **- Set up Railway cron jobs for all active workers** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- ****âš ï¸ ACTION REQUIRED**: Workers need to be scheduled in Railway or another cron service.** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **2. Schedule workers in Railway or external cron service** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **Cron Trigger (Railway/External)** _(source: `docs\archive\raw\uncategorized\ENGINES_WORKERS_AUTOMATION_REPORT.md`)_
- **1. **Decision:** MVP or full build?** _(source: `docs\archive\raw\uncategorized\FRONTEND_REALITY_CHECK.md`)_
- **- [ ] Enforce idempotency on handlers (event_id + object_id) per `micro/STRIPE_IDEMPOTENCY.md`.** _(source: `docs\archive\raw\uncategorized\IMPLEMENTATION_PLAN.md`)_
- **- [ ] Preserve idempotency keys on approve/refund-sensitive endpoints.** _(source: `docs\archive\raw\uncategorized\IMPLEMENTATION_PLAN.md`)_
- **- API smoke/integration tests (existing `src/tests`); add cases for disputes/refunds/payouts/idempotency.** _(source: `docs\archive\raw\uncategorized\IMPLEMENTATION_PLAN.md`)_
- **- Do not rewrite what already works; tighten correctness and idempotency against specs.** _(source: `docs\archive\raw\uncategorized\IMPLEMENTATION_PLAN.md`)_
- **## Sprint 1 â€“ Stripe/n8n Wiring & Idempotency** _(source: `docs\archive\raw\uncategorized\IMPLEMENTATION_PLAN.md`)_
- **- Prevent duplicate ledger rows for same source operation (use idempotency keys).** _(source: `docs\archive\raw\uncategorized\LEDGER_ENTRY_RULES.md`)_
- **# Or use Neon Console SQL Editor:** _(source: `docs\archive\raw\uncategorized\MAKING_CHANGES_GUIDE.md`)_
- **â˜ Choose hosting (Vercel + Railway/Render)** _(source: `docs\archive\raw\uncategorized\MASTER_ROLLOUT_PLAN.md`)_
- **Hosting (Vercel + Railway): $50-200** _(source: `docs\archive\raw\uncategorized\MASTER_ROLLOUT_PLAN.md`)_
- **- Use Railway variables in production** _(source: `docs\archive\raw\uncategorized\N8N_API_CLIENT.md`)_
- **### Railway Configuration** _(source: `docs\archive\raw\uncategorized\N8N_API_CLIENT.md`)_
- **Add to Railway environment variables:** _(source: `docs\archive\raw\uncategorized\N8N_API_CLIENT.md`)_
- **- [ ] Add variables to Railway** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **- Paste into Railway** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **- Watch Railway logs** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **## ðŸš€ Railway Deployment** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **## ðŸš€ Three Ways to Use n8n** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **### Railway Production (Copy-Paste Ready) ðŸš€** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **1. **Railway Setup** (5 minutes)** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **Add these to Railway Dashboard â†’ Variables:** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **Copy-paste this into Railway â†’ Variables:** _(source: `docs\archive\raw\uncategorized\N8N_COMPLETE_CONFIG.md`)_
- **- Idempotency enforced in workflows (event_id/object_id checks).** _(source: `docs\archive\raw\uncategorized\N8N_ORCHESTRATION.md`)_
- **- Surface alerts for stuck retries or repeated idempotency blocks (potential duplicates).** _(source: `docs\archive\raw\uncategorized\N8N_ORCHESTRATION.md`)_
- **- Environment variable is set in Railway** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **### Railway Production** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **1. **Add to Railway:**** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **Add to Railway Dashboard â†’ Variables:** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **curl -X POST https://your-backend.railway.app/webhooks/n8n \** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **railway logs | grep n8n** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **URL: https://your-backend.railway.app/webhooks/n8n** _(source: `docs\archive\raw\uncategorized\N8N_WEBHOOK_SECRET.md`)_
- **- If client already refunded via other path, ensure idempotency (no double refund).** _(source: `docs\archive\raw\uncategorized\NO_SHOW_DETECTION.md`)_
- **- Once details updated, mark earnings to retry in next payout run (policy).** _(source: `docs\archive\raw\uncategorized\PAYOUT_FAILURE_UX.md`)_
- **- Idempotency: earnings included once; payout.paid retried safely.** _(source: `docs\archive\raw\uncategorized\PAYOUT_PROCESSOR.md`)_
- **- **Infrastructure:** Neon, Vercel, Railway (planned)** _(source: `docs\archive\raw\uncategorized\PRE_LAUNCH_COMPLETE_SUMMARY.md`)_
- **- [ ] Choose hosting platform (Vercel/Railway recommended)** _(source: `docs\archive\raw\uncategorized\PRE_LAUNCH_COMPLETE_SUMMARY.md`)_
- ****Minimum to Start:** $6/month (domain + Railway hobby plan)** _(source: `docs\archive\raw\uncategorized\PRE_LAUNCH_COMPLETE_SUMMARY.md`)_
- **| **Railway (Backend)** | $5-20 | â³ Deploy |** _(source: `docs\archive\raw\uncategorized\PRE_LAUNCH_COMPLETE_SUMMARY.md`)_
- **3. âœ… **Standardized Error Handling**** _(source: `docs\archive\raw\uncategorized\PRODUCTION_READINESS_SUMMARY.md`)_
- **- Backend Health: http://localhost:4000/health** _(source: `docs\archive\raw\uncategorized\PURETASK_ARCHITECTURE_EXPLAINED.md`)_
- **- Idempotency everywhere.** _(source: `docs\archive\raw\uncategorized\PURETASK_AUTOMATION_WORKER_MODEL.md`)_
- **## 6. Idempotency Rules** _(source: `docs\archive\raw\uncategorized\PURETASK_AUTOMATION_WORKER_MODEL.md`)_
- **Defines how PureTask operates without humans: automation philosophy, worker architecture, scheduling, idempotency, failure recovery, and division between code-based workers and orchestration tools like n8n. Automation is a first-class system component.** _(source: `docs\archive\raw\uncategorized\PURETASK_AUTOMATION_WORKER_MODEL.md`)_
- **- Can deploy backend from GitHub to Railway** _(source: `docs\archive\raw\uncategorized\PUSH_FRONTEND_TO_GITHUB_GUIDE.md`)_
- **- Single source of truth** _(source: `docs\archive\raw\uncategorized\QUICK_6_HOUR_OVERVIEW.md`)_
- **2. **Single source of truth** - Email registry, architecture docs** _(source: `docs\archive\raw\uncategorized\QUICK_6_HOUR_OVERVIEW.md`)_
- **- Add object-level idempotency guards for invoice/charge/dispute/payout.** _(source: `docs\archive\raw\uncategorized\REFUND_CHARGEBACK_SOP.md`)_
- **- Re-enable refundProcessor and chargebackProcessor with idempotency.** _(source: `docs\archive\raw\uncategorized\REFUND_CHARGEBACK_SOP.md`)_
- **1) Idempotency check (event_id/object_id or admin request key).** _(source: `docs\archive\raw\uncategorized\REFUND_PROCESSOR.md`)_
- **### 2. Idempotency-Key Header Support** _(source: `docs\archive\raw\uncategorized\SECTION_7_NEEDS_ASSESSMENT.md`)_
- **1. **Idempotency-Key** (prevents financial errors)** _(source: `docs\archive\raw\uncategorized\SECTION_7_NEEDS_ASSESSMENT.md`)_
- **2. Add `Idempotency-Key` header support for risky endpoints** _(source: `docs\archive\raw\uncategorized\SECTION_7_NEEDS_ASSESSMENT.md`)_
- **- **Idempotency checks** via `stripe_events_processed` table** _(source: `docs\archive\raw\uncategorized\SECTION_8_SECURITY_ASSESSMENT.md`)_
- **- **Health Check**: http://localhost:4000/health** _(source: `docs\archive\raw\uncategorized\SERVER_STARTUP_GUIDE.md`)_
- **# State Sync & Idempotency Spec** _(source: `docs\archive\raw\uncategorized\STATE_SYNC.md`)_
- **## Object-Level Idempotency** _(source: `docs\archive\raw\uncategorized\STATE_SYNC.md`)_
- **Defines object-level idempotency and state-sync rules for Stripe-driven flows (PI, invoice, charge, payout, dispute) and internal state (wallet/escrow/earnings/payouts).** _(source: `docs\archive\raw\uncategorized\STATE_SYNC.md`)_
- **- Idempotent by Stripe event ID and object ID (handled further in Idempotency spec).** _(source: `docs\archive\raw\uncategorized\STRIPE_EVENT_HANDLING.md`)_
- **3) Handler: perform business logic (wallet/credits, refunds, payouts, etc.) with idempotency.** _(source: `docs\archive\raw\uncategorized\STRIPE_EVENT_HANDLING.md`)_
- **# Stripe Idempotency Spec** _(source: `docs\archive\raw\uncategorized\STRIPE_IDEMPOTENCY.md`)_
- **## Idempotency** _(source: `docs\archive\raw\uncategorized\STRIPE_WEBHOOK_ROUTER.md`)_
- **1) Ingest: signature verify, store raw event (stripe_events), idempotency check on event_id.** _(source: `docs\archive\raw\uncategorized\STRIPE_WEBHOOK_ROUTER.md`)_
- **3) Handler: perform domain logic with object-level idempotency.** _(source: `docs\archive\raw\uncategorized\STRIPE_WEBHOOK_ROUTER.md`)_
- **Defines routing of Stripe events to domain handlers after ingest/signature verification, leveraging idempotency rules.** _(source: `docs\archive\raw\uncategorized\STRIPE_WEBHOOK_ROUTER.md`)_
- **- Idempotency** _(source: `docs\archive\raw\uncategorized\TESTING_CAMPAIGNS.md`)_
- ****This is your single source of truth for all testing in PureTask.**** _(source: `docs\archive\raw\uncategorized\TESTING_COMPLETE_SUMMARY.md`)_
- **- **Micro/Unit Specs:** Stripe Event Handling; Stripe Idempotency; Ledger Entry Rules; Wallet Math; Earnings Math; Reliability Score; DB Constraints.** _(source: `docs\archive\raw\uncategorized\TESTING_GUIDE.md`)_
- **- Idempotency-key units: same event/operation key â†’ no double side-effect.** _(source: `docs\archive\raw\uncategorized\TESTING_GUIDE.md`)_
- **- Ledger write units: wallet_purchase, escrow_hold/release, refund, earning, negative_adjustment with validation/idempotency.** _(source: `docs\archive\raw\uncategorized\TESTING_GUIDE.md`)_
- **- M: Force n8n failure then retry â†’ no duplicate payouts/refunds; idempotency holds.** _(source: `docs\archive\raw\uncategorized\TESTING_GUIDE.md`)_
- **7) Idempotency: replay Stripe events (PI, refund, payout.*) â†’ no duplicate effects.** _(source: `docs\archive\raw\uncategorized\TESTING_GUIDE.md`)_
- **- Idempotency** _(source: `docs\archive\raw\uncategorized\TESTING_STRATEGY_COMPLETE.md`)_
- **- Stripe webhook idempotency** _(source: `docs\archive\raw\uncategorized\TESTING_STRATEGY_COMPLETE.md`)_
- ****Idempotency Test (Critical):**** _(source: `docs\archive\raw\uncategorized\TESTING_STRATEGY_COMPLETE.md`)_
- **| Idempotent webhook processing | Duplicate event | No double-credit | Idempotency works |** _(source: `docs\archive\raw\uncategorized\TESTING_STRATEGY_GAPS_ANALYSIS.md`)_
- **- Set up Railway deployment (API + Worker services)** _(source: `docs\archive\raw\uncategorized\V1_REQUIREMENTS_AUDIT.md`)_
- **- [ ] Test concurrent payout worker runs (idempotency)** _(source: `docs\archive\raw\uncategorized\V1_REVIEW_ANALYSIS.md`)_
- **- V1 hardening (idempotency, guards, atomic operations)** _(source: `docs\archive\raw\uncategorized\V1_REVIEW_ANALYSIS.md`)_
- **### Idempotency** _(source: `docs\archive\raw\uncategorized\V3_COMPLETE_OVERVIEW.md`)_
- **- Idempotency: prevents duplicate job creation** _(source: `docs\archive\raw\uncategorized\V3_FEATURES_DETAILED_BREAKDOWN.md`)_
- ****Idempotency**:** _(source: `docs\archive\raw\uncategorized\V3_FEATURES_DETAILED_BREAKDOWN.md`)_
- **3. Idempotency: prevent duplicate job creation** _(source: `docs\archive\raw\uncategorized\V3_PLAN.md`)_
- **- âœ… **V1 Hardening**: Payout locks and idempotency** _(source: `docs\archive\raw\uncategorized\VERSION_FEATURE_BREAKDOWN.md`)_
- **- âœ… **V1 Hardening**: Webhook idempotency** _(source: `docs\archive\raw\uncategorized\VERSION_FEATURE_BREAKDOWN.md`)_
- **- âœ… Escrow reservation idempotency** _(source: `docs\archive\raw\uncategorized\VERSION_FEATURE_BREAKDOWN.md`)_
- **- âœ… Payout locks and idempotency** _(source: `docs\archive\raw\uncategorized\VERSION_FEATURE_BREAKDOWN.md`)_
- **- âœ… Stripe webhook idempotency** _(source: `docs\archive\raw\uncategorized\VERSION_FEATURE_BREAKDOWN.md`)_
- **- Railway logs (if deployed on Railway)** _(source: `docs\archive\raw\uncategorized\WORKER_SCHEDULE.md`)_
- **## ðŸš€ Railway Deployment** _(source: `docs\archive\raw\uncategorized\WORKER_SCHEDULE.md`)_
- **### Option 3: Railway Cron Jobs** _(source: `docs\archive\raw\uncategorized\WORKER_SCHEDULE.md`)_
- **For Railway, use the **Cron Jobs** feature or create separate worker services:** _(source: `docs\archive\raw\uncategorized\WORKER_SCHEDULE.md`)_
- **Use Railway's built-in cron job feature to schedule individual workers.** _(source: `docs\archive\raw\uncategorized\WORKER_SCHEDULE.md`)_

---

## Gamification bundle implementation (2026-02)

- **Implemented (implementation guide Steps 1, 2, 4, 9):** `withClient` adapter (`src/db/bundleAdapter.ts`, re-exported from `src/db/client.ts`), config bridge (`src/config/cleanerLevels/bundleConfigBridge.ts` with `getBundleConfig()`), RBAC shim (`src/middleware/rbac.ts` with `requireAdminRole` and `req.adminUser`), and optional migration `057_pt_safety_reports.sql`. Build and gamification unit tests pass. The app continues to use existing `src/lib/gamification/` and services; bundle code in `src/gamification-bundle/` remains reference-only and excluded from build.
- **Also implemented:** Wrapper adapters for bundle-style progression and rewards: `bundleProgressionServiceAdapter.ts`, `bundleRewardGrantServiceAdapter.ts`, and `grantForCompletedGoals` (used where completed goals should grant bundle-defined rewards). Event contract loader (`src/config/cleanerLevels/contracts/eventContractLoader.ts`) loads `event_contract_v1.json` and exposes `getAllowedEventTypes()`, `isAllowedEventType()`, `validateEventForContract()`; optional enforcement via `STRICT_EVENT_CONTRACT=true` in `recordEvent` (returns 400 EVENT_CONTRACT_VIOLATION when validation fails). See docs/active/BUNDLE_SWITCH_GAP_ANALYSIS.md.
- **Option A merge (done):** Bundle logic and comments were merged into current engine: `src/lib/gamification/goal_evaluator.ts` (evaluateGoals comment), `level_evaluator.ts` (rules comment, immutable goalsByLevel, maintenance default comment), `reward_granter.ts` (extend_duration comments), `types.ts` (JSDoc and inline comments). Build and gamification unit tests (11) pass. Bundle folder remains reference-only; no Option B adapted folder.
- **Build and deploy:** `npm run build` copies `src/config/cleanerLevels/contracts/*.json` to `dist/` via `scripts/copy-contracts-to-dist.js` so STRICT_EVENT_CONTRACT works in production. Integration test `onboardingRealAuth.test.ts` uses real auth (createTestCleaner); TROUBLESHOOTING documents known skips. Gamification onboarding progress route fixed to avoid double-send (return + headersSent check in catch).

---

## Type-safe API integration (rule of thumb)

We follow a **practical rule of thumb** for type-safe integration (shared/mirrored types between backend and frontend):

| Kind of endpoint / data | Type-safe? | What we do |
|-------------------------|------------|------------|
| **Job details (full payload)** | Yes | `JobDetailsResponse` in `src/types/jobDetails.ts`; GET `/jobs/:jobId/details` builds and returns it. |
| **Job (single resource)** | Worth it | `Job` from `src/types/db.ts`; GET `/jobs/:jobId` returns `{ job }` from `getJob()` (typed). |
| **Cleaner profile (with reliability, etc.)** | Worth it | `CleanerProfileResponse` (= `JobDetailsCleaner`) in `src/types/jobDetails.ts`; GET `/cleaners/:id` returns `{ cleaner: CleanerProfileResponse }`. |
| **Ledger / payment by job** | Yes if frontend renders in detail | Covered inside `JobDetailsResponse`: `CreditLedgerEntry[]`, `JobDetailsPaymentIntent`, `JobDetailsPayout`. |
| **List responses (jobs, cleaners, notifications)** | Nice to have | No formal `{ items: T[], total }` shared type yet; responses are ad-hoc (e.g. `{ jobs }`, `{ cleaners }`). Frontend can type locally if desired. |
| **Simple success/error** | Optional | `sendSuccess` / `sendError`; frontend can type wrapper if wanted. |
| **One-off or rarely used** | Optional | Add types when we touch them. |

So: we **do** follow the rule. We prioritize shared types for job details, single job, cleaner profile, and ledger/payment (via job details). We do not force a shared type for every endpoint; list and simple responses remain optionally typed (often frontend-only).

