# PureTask Documentation

**What it is:** The main entry point for PureTask backend documentation.  
**What it does:** Points you to setup, architecture, ops, deployment, and troubleshooting.  
**How we use it:** Start here when onboarding or looking for the right doc.

---

## Start here

| Doc | Purpose |
|-----|---------|
| [SETUP.md](./SETUP.md) | Run locally: clone, env, migrate, run. **What to do next:** see SETUP.md § “What to do next — detailed guide” (build, DB, env, run app, tests, deploy, optional 057 and follow-ups). |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the system fits together (layers, flow, DB, integrations) |
| [gamification_bundle/](./gamification_bundle/README.md) | **Gamification canonical spec** (uploaded bundle): rules, events, metrics, enforcement. Lead doc in `docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md`. |
| [GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md](./GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md) | **How to add the bundle into the current system:** step-by-step (you cannot "just add all the code on"; this guide explains why and the exact steps). |
| [GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md](./GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md) | **Detailed implementation guide:** file paths, code snippets, and verification for every step (withClient, config bridge, RBAC, admin services, progression/reward, worker, tests). |

## Operations

| Doc | Purpose |
|-----|---------|
| [RUNBOOK.md](./RUNBOOK.md) | Ops commands, health checks, incident playbooks |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Known issues and fixes |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway / production deploy and rollback |
| [DECISIONS.md](./DECISIONS.md) | Architectural and product decisions (from logs) |
| [FOUNDER_BACKEND_REFERENCE.md](./FOUNDER_BACKEND_REFERENCE.md) | Index to founder-level deep dives (founder/*.md): what each piece is, where/when/how/why we use it. |
| [FOUNDER_REFERENCE_CANDIDATES.md](./FOUNDER_REFERENCE_CANDIDATES.md) | List of systems, features, and functions to document in the same style (events, notifications, auth, payments, etc.). |
| [PROJECT_REVIEW_FULL.md (archived)](../archive/raw/misc/PROJECT_REVIEW_FULL.md) | Complete project review: systems, workers, features, tests — what's done, what remains (archived). |

## Runbooks (detailed)

See [RUNBOOK.md](./RUNBOOK.md) for deploy, rollback, and incident response. Detailed runbooks (archived): [rollback-deploy](../archive/raw/runbooks/rollback-deploy.md), [handle-incident](../archive/raw/runbooks/handle-incident.md), [restore-from-backup](../archive/raw/runbooks/restore-from-backup.md).

## Save points (checkpoints)

| Tag / branch | When | Purpose |
|--------------|------|---------|
| `docs-governance-checkpoint-2026-01-31` | 2026-01-31 | Pre–Cursor restart; canonical docs, governance, archive moves, .cursorignore fix. |
| `production-ready-backup` | — | Branch containing the above checkpoint. |

History was rewritten (2026-01-31) to remove an exposed secret from SECURITY_GUARDRAILS.md; all branches and tags were force-pushed. Scripts: `scripts/rewrite-history-remove-secret.sh`, `scripts/fix-guardrails-secret.ps1`.

To restore this exact state: `git checkout docs-governance-checkpoint-2026-01-31` or `git checkout production-ready-backup`.

## Reference (consolidated)

| Doc | Purpose |
|-----|---------|
| [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) | Backup strategy, setup, restore procedures, integrity checks |
| [CI_CD_SETUP.md](./CI_CD_SETUP.md) | CI/CD pipelines, env vars, migrations in CI, deploy options |
| [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Notification system: sender flow, dedupe, templates, maturity |
| [API_REFERENCE.md](./API_REFERENCE.md) | Swagger/OpenAPI access, spec comparison, exact endpoint list |
| [CONSOLIDATION_GUIDE.md](./CONSOLIDATION_GUIDE.md) | Which docs were combined and how (synthesize, not concatenate) |
| [MASTER_CHECKLIST_EXECUTION.md](./MASTER_CHECKLIST_EXECUTION.md) | **How to complete every task** in the V1–V5 Master Checklist: what each task does, why it matters, and how to do it (use with [MASTER_CHECKLIST.md](../versions/MASTER_CHECKLIST.md)). |
| [PRIORITIZED_BACKLOG.md](../versions/PRIORITIZED_BACKLOG.md) | **Full consolidated TODO list** by priority: Critical (6), High (8), Medium (12), Low (10) — 36 items from repo + docs. |

## Archived history

Raw historical notes live in `docs/archive/raw/` and are not edited. Consolidated source files from the 2026-02 merge live in `docs/archive/raw/consolidated-sources/`.  
MD inventory reports: run `powershell -ExecutionPolicy Bypass -File scripts\classify-md.ps1` → `docs/_md_inventory/md_report.md`.
