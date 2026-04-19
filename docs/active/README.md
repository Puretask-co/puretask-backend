# PureTask Documentation

**What it is:** Canonical entry point for backend documentation.  
**What it does:** Separates source-of-truth docs from supporting references.  
**How we use it:** Start with canonical docs first; consult references second.

---

## Documentation model (canonical vs reference)

PureTask uses a two-tier docs model:

- **Tier 1 (canonical):** Source of truth for onboarding, architecture, ops, deploy, troubleshooting, and decisions.
- **Tier 2 (reference):** Supporting detail under `docs/active/**`; useful, but canonical docs win on conflicts.

For governance rules, see `.cursor/rules/documentation.mdc`.

---

## Document priority (most → least important)

Use this table to know which doc to open first for a given need. **1 = most important / frequently needed.**

| Rank | Doc | Purpose / when to use |
|------|-----|------------------------|
| 1 | [README.md](./README.md) | Entry point; find the right doc (this file). |
| 2 | [SETUP.md](./SETUP.md) | Run locally: clone, env, DB, run app, tests. Read first when onboarding or setting up a new machine. |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | How the system fits together (layers, auth, flows, DB, workers). Read to understand the codebase. |
| 4 | [RUNBOOK.md](./RUNBOOK.md) | Ops: health checks, deploy, rollback, incidents. Use when operating or debugging production. |
| 5 | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Known issues and fixes. Check when something is broken. |
| 6 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway / production deploy and rollback. Use when shipping or reverting. |
| 7 | [PROJECT_ISSUES_AND_REMEDIATION.md](./PROJECT_ISSUES_AND_REMEDIATION.md) | All known problems (routes→DB, auth, migrations, lint, tests) and how to fix them. Use when improving quality or planning work. |
| 8 | [DOCUMENT_INVENTORY_FULL_REVIEW.md](./DOCUMENT_INVENTORY_FULL_REVIEW.md) | **Full doc inventory** — every document in one table with a review-status column. Use to systematically review each doc and ensure everything each says is done. |
| 9 | [AUDIT_TICKETS.md](./AUDIT_TICKETS.md) | Bug and risk tickets from the PR rubric (many done). Use for PR/audit follow-up. |
| 10 | [PR_AUDIT_RUBRIC.md](./PR_AUDIT_RUBRIC.md) | PR audit checklist (15 sections). Use when reviewing a PR or doing a system audit. |
| 11 | [DECISIONS.md](./DECISIONS.md) | Architectural and product decisions (why we did X). Use to avoid reverting or contradicting past choices. |
| 12 | [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) | Canonical list of API endpoints. Use when building or integrating with the API. |
| 13 | [API_REFERENCE.md](./API_REFERENCE.md) | Swagger/OpenAPI and spec comparison. Use for exact request/response shapes. |
| 14 | [DATA_MODEL_REFERENCE.md](./DATA_MODEL_REFERENCE.md) | Schema and data model. Use when writing queries or understanding tables. |
| 15 | [BACKEND_UI_SPEC.md](./BACKEND_UI_SPEC.md) | Backend → frontend UI contract (screens, data, actions, states). Use when aligning frontend and backend. |
| 16 | [MASTER_MIGRATIONS.md](./MASTER_MIGRATIONS.md) | Canonical migration order; which SQL to run. Use with DB/migrations/README.md when touching the DB. |
| 17 | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) | Backup strategy and restore procedures. Use for disaster recovery or data safety. |
| 18 | [CI_CD_SETUP.md](./CI_CD_SETUP.md) | CI/CD pipelines, env vars, migrations in CI. Use when setting up or changing automation. |
| 19 | [GAMIFICATION_BACKEND_SPEC.md](./GAMIFICATION_BACKEND_SPEC.md) | Gamification backend spec. Use when working on levels, goals, rewards, or governor. |
| 20 | [GAMIFICATION_FRONTEND_BACKEND_SPEC.md](./GAMIFICATION_FRONTEND_BACKEND_SPEC.md) | Gamification frontend–backend contract. Use when building gamification UI. |
| 21 | [gamification_bundle/](./gamification_bundle/README.md) | Gamification bundle (canonical spec, events, metrics). Use with implementation guides when integrating bundle. |
| 22 | [GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md](./GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md) | Step-by-step implementation (paths, code, verification). Use when adding or changing gamification code. |
| 23 | [GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md](./GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md) | How to add the bundle into the current system. Use before implementation guide. |
| 24 | [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Notification system (sender flow, dedupe, templates). Use when working on notifications. |
| 25 | [BACKEND_QA.md](./BACKEND_QA.md) | Backend Q&A and build checklist (n8n, Stripe, alignment). Use for “what’s set up?” and build status. |
| 26 | [FOUNDER_BACKEND_REFERENCE.md](./FOUNDER_BACKEND_REFERENCE.md) | Index to founder-level deep dives (founder/*). Use when you need deep detail on one system. |
| 27 | [FRONTEND_JOB_STATUS_CONFIG.md](./FRONTEND_JOB_STATUS_CONFIG.md) | Job status config for frontend. Use when wiring job lifecycle in the UI. |
| 28 | [SYSTEM_AUDIT_CHECKLIST.md](./SYSTEM_AUDIT_CHECKLIST.md) | System audit checklist. Use during full system review. |
| 29 | [SYSTEM_INVENTORY_EVIDENCE.md](./SYSTEM_INVENTORY_EVIDENCE.md) | Pre-audit inventory (routes, services, schema). Use with PR rubric. |
| 30 | [EVIDENCE_MAP_AUDIT.md](./EVIDENCE_MAP_AUDIT.md) | Evidence map (where to check, fix). Use during detailed audit. |
| 31 | [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) | V1–V5 master checklist. Use for high-level task tracking. |
| 32 | [MASTER_CHECKLIST_EXECUTION.md](./MASTER_CHECKLIST_EXECUTION.md) | How to complete each master checklist task. Use with MASTER_CHECKLIST.md. |
| 33 | [BACKEND_ALIGNMENT_CHECKLIST.md](./BACKEND_ALIGNMENT_CHECKLIST.md) | Backend alignment checklist. Use when aligning with frontend or spec. |
| 34 | [BACKEND_ALIGNMENT_SOURCES.md](./BACKEND_ALIGNMENT_SOURCES.md) | Sources for alignment. Use with alignment checklist. |
| 35 | [PROD_TEST_SCHEMA_REFERENCE.md](./PROD_TEST_SCHEMA_REFERENCE.md) | Prod vs test schema reference. Use when comparing environments. |
| 36 | [MIGRATIONS_ANALYSIS_VS_MASTER.md](./MIGRATIONS_ANALYSIS_VS_MASTER.md) | Migration analysis vs master file. Use when debugging migration order. |
| 37 | [CONSOLIDATION_GUIDE.md](./CONSOLIDATION_GUIDE.md) | Which docs were combined and how. Use for doc history. |
| 38 | [FOUNDER_REFERENCE_CANDIDATES.md](./FOUNDER_REFERENCE_CANDIDATES.md) | List of systems to document in founder style. Use when planning founder docs. |
| 39 | [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines. Use when contributing or onboarding. |
| 40 | [AI_ONBOARDING_BUNDLE.md](./AI_ONBOARDING_BUNDLE.md) | AI onboarding bundle. Use when working on AI onboarding. |
| 41 | **founder/** (e.g. FOUNDER_AUTH.md, FOUNDER_PAYMENT_FLOW.md) | Deep dives per topic (auth, payments, webhooks, etc.). Use when you need detail on that topic; see FOUNDER_BACKEND_REFERENCE.md for index. |
| 42 | **gamification_bundle/docs/** (event_contract_v1, metrics_contract_v1, etc.) | Bundle contracts and specs. Use when implementing or verifying gamification events/metrics. |
| 43 | **legal/** (README.md, TOS_CONSOLIDATED.md, PRIVACY_POLICY.md, etc.) | Legal and compliance. Use when you need terms, privacy, or in-app copy. |
| 44 | **01-HIGH/, 02-MEDIUM/, 03-LOW/** | Priority-tiered issues and roadmaps. Use when planning work by priority. |
| 45 | **docs/versions/** (e.g. PRIORITIZED_BACKLOG.md, MASTER_CHECKLIST.md) | Versioned backlog and checklist. Use for consolidated TODO and prioritization. |

---

## Tier 1: Canonical docs

| Doc | Purpose |
|-----|---------|
| [SETUP.md](./SETUP.md) | Local setup, environment, database bootstrap, and first-run flow |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, layering, major flows, and architectural constraints |
| [RUNBOOK.md](./RUNBOOK.md) | Operations runbook: deploy/rollback/incident response procedures |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment and process layout (Railway + workers) |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Known failures and fixes |
| [DECISIONS.md](./DECISIONS.md) | Architectural/product decisions and supersession history |

---

## Tier 2: Reference docs (selected)

These are supporting docs for deep dives and implementation detail.

| Doc | Purpose |
|-----|---------|
| [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) | Master implementation checklist |
| [MASTER_CHECKLIST_EXECUTION.md](./MASTER_CHECKLIST_EXECUTION.md) | Task-by-task execution guide for checklist items |
| [BACKEND_QA.md](./BACKEND_QA.md) | Backend Q&A and build status walkthrough |
| [API_REFERENCE.md](./API_REFERENCE.md) | API reference and endpoint coverage notes |
| [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) | Endpoint-focused backend reference |
| [BACKEND_UI_SPEC.md](./BACKEND_UI_SPEC.md) | Backend-to-frontend UI contract notes |
| [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) | Backup and restore reference procedures |
| [CI_CD_SETUP.md](./CI_CD_SETUP.md) | CI/CD workflow reference |
| [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Notification design and behavior reference |
| [PR_AUDIT_RUBRIC.md](./PR_AUDIT_RUBRIC.md) | PR audit rubric/checklist |
| [AUDIT_TICKETS.md](./AUDIT_TICKETS.md) | Audit-derived remediation tickets |
| [PROD_TEST_SCHEMA_REFERENCE.md](./PROD_TEST_SCHEMA_REFERENCE.md) | Production vs test schema comparison reference |
| [FORWARD_EXECUTION_GUIDE.md](./FORWARD_EXECUTION_GUIDE.md) | Cross-repo forward plan (backend + frontend) with P0/P1/P2 execution gates |
| [gamification_bundle/README.md](./gamification_bundle/README.md) | Gamification spec index and detailed bundle docs |

---

## Archive and history

- Historical notes and older plans belong in `docs/archive/raw/`.
- Do not delete raw history; move superseded material to archive with clear naming.

---

## Docs hygiene cadence (monthly)

Run this checklist once per month (or after major docs refactors):

1. Re-run full inventory and ledger classification.
2. Re-run `docs/active` internal link validation and confirm zero missing.
3. Confirm Tier 1 canonical docs still reflect current implementation and decisions.
4. Move newly superseded non-canonical material to `docs/archive/raw/` (never delete history).
5. Record the pass in `docs/archive/raw/docs_governance/docs_hygiene_log_YYYY-MM.md`.

Current monthly log:

- [docs_hygiene_log_2026-04.md](../archive/raw/docs_governance/docs_hygiene_log_2026-04.md)
