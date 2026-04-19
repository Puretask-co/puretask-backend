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
