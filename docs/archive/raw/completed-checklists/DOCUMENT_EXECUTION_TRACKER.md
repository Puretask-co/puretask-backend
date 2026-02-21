# Document Execution Tracker

**Purpose:** Consolidated view of all 9 canonical documents—status, dependencies, and implementation progress.  
**Last updated:** 2026-02-02

---

## Document Map

| Document | Purpose | Status |
|----------|---------|--------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, layers, key flows | ✅ Reference—no checklists |
| [SETUP.md](./SETUP.md) | Local dev setup | ✅ Complete |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev standards, PR process | ✅ Complete |
| [COMPREHENSIVE_GAP_ANALYSIS.md](./COMPREHENSIVE_GAP_ANALYSIS.md) | Gaps, priorities | 🔄 Phase 1–3 items |
| [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) | 14-section hardening | 🔄 Sections 5–14 unchecked |
| [HARDENING_EXECUTION_PLAN.md](./HARDENING_EXECUTION_PLAN.md) | Phased build/implement/test | 🔄 Phases 5–14 |
| [CI_CD_SETUP.md](./CI_CD_SETUP.md) | CI/CD guide | ✅ CI exists; deploy future |
| [PRODUCTION_READINESS_ROADMAP.md](./PRODUCTION_READINESS_ROADMAP.md) | Quick wins, critical | 🔄 Many items |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Known issues, fixes | ✅ Current |

---

## Cross-Document Checklist (Code-Implementable)

### Already Done ✅
- Swagger/OpenAPI at `/api-docs`
- Canonical auth (authCanonical)
- CI: lint, typecheck, test, build, security-scan
- Pre-commit hooks, .gitignore, .env.example
- Stripe webhook idempotency, raw body
- Migrations structure, run-migration script
- Durable jobs table, locking
- Error format (sendError, asyncHandler)
- PR template
- Sentry integration, metrics
- backup:verify, monitoring:verify scripts
- k6 load tests
- adminService credit_ledger fix (delta_credits)
- pricing_snapshot in NEON patch

### High Priority (Implement in Code)

| # | Item | Source | Status |
|---|------|--------|--------|
| 1 | Add `npm run format` (Prettier) | CONTRIBUTING | ✅ |
| 2 | Add `npm run format:check` | CONTRIBUTING | ✅ |
| 3 | Fix SETUP reference (.env.example) | SETUP | ✅ |
| 4 | README: migrations, format, CONTRIBUTING link | ROADMAP | ✅ |
| 5 | Messages route: surface actual error in dev | TROUBLESHOOTING | ✅ |
| 6 | Section 5: NOT NULL/FK, idempotency, BACKUP_RESTORE | MASTER §5 | ✅ |
| 7 | Section 6: Dead-letter, worker observability | MASTER §6 | ✅ |
| 8 | Section 7: /api/v1, /api/webhooks, idempotency, contract tests | MASTER §7 | ✅ |
| 9 | Section 8: Sanitization, SSRF, file upload MIME, PII redaction | MASTER §8 | ✅ |

### Medium Priority (Design/Build)

| # | Item | Source |
|---|------|--------|
| 10 | Ownership checks on all resource routes | MASTER §8 |
| 11 | Crons enqueue-only (full migration) | MASTER §6 |
| 12 | Admin RBAC roles (support_agent, etc.) | MASTER §11 |
| 13 | DTOs for all endpoints | MASTER §7 |

### Requires Manual / External

| # | Item | Notes |
|---|------|-------|
| 11 | Secret rotation | User runbook; not automatable |
| 12 | Git history purge | User action |
| 13 | Sentry DSN, UptimeRobot | External signup |
| 14 | Neon backups enable | Dashboard |
| 15 | Legal (TOS, Privacy, IC) | Policy/docs |
| 16 | Admin RBAC, dispute UI | Significant build |

---

## Execution Order

1. **Quick fixes** (this session): format script, SETUP fix, README link
2. **Next PRs**: Schema constraints, dead-letter, idempotency headers
3. **Ongoing**: Section-by-section from MASTER_CHECKLIST

---

## References

- Full 14-section checklist: [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- Phased plan: [HARDENING_EXECUTION_PLAN.md](./HARDENING_EXECUTION_PLAN.md)
- Section runbooks: [sections/SECTION_*.md](./sections/)
