# Documentation Review Report

**Date:** 2026-01-31  
**Scope:** All docs (canonical, governance, scripts, runbooks, index) **and archived files**.  
**Purpose:** One-time full review to ensure everything is in order and correct.

---

## 1. Canonical docs (docs/active/)

| Doc | Status | Notes |
|-----|--------|--------|
| **README.md** | OK | Entry point; "What it is / What it does / How we use it"; links to SETUP, ARCHITECTURE, RUNBOOK, TROUBLESHOOTING, DEPLOYMENT, DECISIONS; runbooks (../runbooks/); archive note. |
| **SETUP.md** | OK | Three-line block; prerequisites; env (links to docs/architecture/ENV_EXAMPLE.md); install; run; common problems; link to DEPLOYMENT. |
| **ARCHITECTURE.md** | FIXED | Added "What it is / What it does / How we use it" at top. Full layering, data flow, auth, DB, integrations, state machines, testing, security, deployment. |
| **DEPLOYMENT.md** | OK | Three-line block; environments; Railway setup; DB; CI/CD; rollback; link to docs/runbooks/rollback-deploy.md. |
| **TROUBLESHOOTING.md** | FIXED | Added "What it is / What it does / How we use it" at top. Detailed sections: server, DB, auth, rate limiting, performance, Sentry, Redis, deployment, getting help. |
| **RUNBOOK.md** | EXISTS | Created via script (path in .cursorignore). Links to runbooks (rollback, handle-incident). Ops commands, health checks, restart, incident playbooks. |
| **DECISIONS.md** | OK | Curated section (10 bullets) + "Extracted from archive (auto)". generate-decisions.ps1 preserves curated when re-run. |

---

## 2. Governance

| Item | Status | Notes |
|------|--------|--------|
| **.githooks/pre-commit** | OK | Blocks new .md outside docs/active/, docs/archive/, .githooks/. Message and paths correct. |
| **.cursor/rules/documentation.mdc** | OK | Canonical list matches README; append-only; archive policy; alwaysApply. |
| **.cursorignore** | ACTION | **Remove `**/*RUNBOOK*.md`** so docs/active/RUNBOOK.md is indexed by Cursor. Pattern currently ignores the canonical RUNBOOK. Other patterns (archive, bloat) OK. |

---

## 3. Paths and links

| Link | Target | Status |
|------|--------|--------|
| README → SETUP, ARCHITECTURE, etc. | ./SETUP.md, ./ARCHITECTURE.md, … | OK |
| README → runbooks | ../runbooks/rollback-deploy.md, handle-incident.md | OK (docs/runbooks/ exists) |
| SETUP → ENV_EXAMPLE | docs/architecture/ENV_EXAMPLE.md | OK (file exists) |
| SETUP → DEPLOYMENT | ./DEPLOYMENT.md | OK |
| DEPLOYMENT → rollback | ../runbooks/rollback-deploy.md | OK |

---

## 4. DOCUMENTATION_INDEX.md

- **Updated:** Production Readiness "START HERE" now points to **00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md** (PRODUCTION_READINESS_STATUS was archived).
- **Rest:** Importance levels, "What it is / What it does / How we use it" reference, and use-case index are correct.

---

## 5. Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| **scripts/classify-md.ps1** | Classify .md → iterative_logs, reference_docs, experiments, uncategorized; optional -Move; -IncludeArchive for full inventory | OK |
| **scripts/generate-decisions.ps1** | Extract decision-like lines from docs/archive/raw → DECISIONS.md; **preserves** "Current active decisions (curated)" when re-run | OK |

---

## 6. Runbooks (docs/runbooks/)

- **rollback-deploy.md** — Railway rollback steps; linked from DEPLOYMENT and README. OK.
- **handle-incident.md** — Triage, mitigate, communicate; links to rollback, MONITORING_SETUP, DATABASE_RECOVERY. OK.
- **restore-from-backup.md** — Present; not linked from canonical docs (optional add to RUNBOOK if desired).

---

## 7. Duplication and structure

- **docs/active/** has both canonical files (README, SETUP, …) and many other .md files (e.g. API_DOCUMENTATION, BACKUP_SETUP, MONITORING_SETUP). Some duplicate 00-CRITICAL/01-HIGH/02-MEDIUM/03-LOW content. By design: canonical set is the entry point; tier folders hold detailed/importance-sorted docs. No change required.
- **docs/archive/raw/** holds moved iterative_logs, experiments, uncategorized. **docs/archive/** and **docs/_archive/** are separate (archive = raw moves; _archive = other legacy). .cursorignore covers both.

---

## 8. Archived files (review and analysis)

Archived content is excluded from Cursor indexing (`.cursorignore`: `docs/archive/**`, `docs/_archive`). This section confirms structure, purpose, and that nothing critical is missing from active docs.

### 8.1 docs/archive/

| Path | Contents | Purpose | Status |
|------|----------|---------|--------|
| **docs/archive/raw/** | **311 .md** in 3 subfolders | Output of `classify-md.ps1 -Move`: bloat and uncategorized moved here; raw history preserved. | OK |
| **docs/archive/raw/iterative_logs/** | .md (FIX_, COMPLETE_, PROGRESS_, DAY_, etc.) | Iteration logs, status bloat; not edited; source for DECISIONS extraction. | OK |
| **docs/archive/raw/experiments/** | .md (DRAFT, WIP, TEMP, etc.) | One-offs, experiments; kept raw. | OK |
| **docs/archive/raw/uncategorized/** | .md (did not match other categories) | To be merged or left as-is; manual review if needed. | OK |
| **docs/archive/migrations/** | **8 .sql** | Old/superseded SQL migrations; not run by current stack. | OK — do not run without review |

**References from active docs:** README (“Raw historical notes live in `docs/archive/raw/`”); DECISIONS (“Extracted from archive (auto)” from `docs/archive/raw`); generate-decisions.ps1 reads `docs/archive/raw` only. No active doc depends on archive for critical steps; links are for history/context only.

### 8.2 docs/_archive/

| Path | Contents | Purpose | Status |
|------|----------|---------|--------|
| **docs/_archive/cleanup-2026-01-29/** | ~16 .md + misc | Cleanup batch: temp files, outdated version summaries, old status/troubleshooting. Documented in **03-LOW/CLEANUP_SUMMARY.md**. | OK |
| **docs/_archive/old-analyses/** | 17 .md | Old analysis reports (V1 review, best practices, linting, state machine, etc.). | OK — reference only |
| **docs/_archive/old-misc/** | .md + .sql | One-off fixes, MCP review, Neon migrations, testing data setup. | OK — reference only |
| **docs/_archive/old-plans/** | 8+ .md | Old plans (Cursor build, next steps, summaries). | OK — reference only |
| **docs/_archive/old-railway/** | 3 .md | DEPLOYMENT_QUICK_START, RAILWAY_QUICK_START, RAILWAY_SETUP. Superseded by **docs/active/DEPLOYMENT.md** and **docs/deployment/** guides. | OK |
| **docs/_archive/old-tests/** | 12 .md | Old test reports, worker dry-run status, V1/V2/V4 testing summaries. | OK — reference only |

**References from active docs:** DOCUMENTATION_INDEX (“docs/_archive/ — Archived/historical docs (excluded from indexing)”); CLEANUP_SUMMARY (“43 files moved to `docs/_archive/cleanup-2026-01-29/`”, restore with `mv` if needed); SECURITY_GUARDRAILS (“Archived: Moved to `docs/archive/`”). Consistent: archive is read-only; restore only by explicit move.

### 8.3 Archive integrity and policy

- **No critical path through archive:** All deploy, setup, runbook, and troubleshooting steps live in **docs/active/** or **docs/runbooks/**. Archive is for history and optional reference.
- **Naming:** `docs/archive/` = classifier move output (raw/iterative_logs, experiments, uncategorized) + migrations. `docs/_archive/` = manual/legacy batches (cleanup-*, old-*).
- **Policy:** Do not edit archived files. To “restore” a doc, copy or move it back into **docs/active/** (or appropriate tier) and update any links. Pre-commit allows new .md only under **docs/active/** or **docs/archive/**.

### 8.4 Summary (archived)

- **Structure:** docs/archive/raw (311 .md in 3 categories) + docs/archive/migrations (8 .sql); docs/_archive (cleanup + old-analyses, old-misc, old-plans, old-railway, old-tests). All accounted for.
- **References:** Active docs that mention archive do so correctly (README, DECISIONS, DOCUMENTATION_INDEX, CLEANUP_SUMMARY, SECURITY_GUARDRAILS). No broken expectations.
- **Recommendation:** Keep archive as-is; continue excluding from Cursor; use generate-decisions.ps1 to pull decision-like lines from docs/archive/raw into DECISIONS.md when needed.

---

## 9. Actions taken this review

1. **ARCHITECTURE.md** — Added "What it is / What it does / How we use it" at top.
2. **TROUBLESHOOTING.md** — Added same block at top; title kept as "Troubleshooting".
3. **DOCUMENTATION_INDEX.md** — Production Readiness START HERE now points to 00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md.
4. **.cursorignore** — Recommend **manually removing the line `**/*RUNBOOK*.md`** so docs/active/RUNBOOK.md is not ignored.

---

## 10. Summary

- **Canonical docs:** All present, consistent three-line blocks where intended, links and paths correct.
- **Governance:** Pre-commit and Cursor rules are correct; .cursorignore should be updated to stop ignoring the canonical RUNBOOK.
- **Scripts:** Classifier and decisions generator behave as designed; decisions script preserves curated section.
- **Index and runbooks:** Index updated for production readiness; runbooks exist and are linked.
- **Archived files:** docs/archive/ (raw + migrations) and docs/_archive/ (cleanup + old-*) reviewed; structure and references correct; no critical dependency on archive; policy (read-only, restore by move) clear.

**One manual step:** Edit `.cursorignore` and remove the line containing `**/*RUNBOOK*.md` so Cursor indexes `docs/active/RUNBOOK.md`.
