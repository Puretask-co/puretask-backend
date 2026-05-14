# SQL Injection Audit Tracker

**Source rule:** `.eslintrc.json` → `no-restricted-syntax` (narrowed 2026-05-13 from "all interpolated templates" to "interpolated templates passed to `query()` / `.query()`"). See [AUDIT_REANALYSIS_2026-05-13.md § A.2](./AUDIT_REANALYSIS_2026-05-13.md#a2--sql-injection-audit-on-804-template-literal-queries).

**Goal:** drive the warning count to zero. Each cleared file → lower the `--max-warnings` ratchet in `package.json`'s `lint` script.

## How to fix a violation

Three patterns, in order of preference:

1. **Parameterized values.** `query(\`SELECT * FROM jobs WHERE id = ${id}\`)` → `query("SELECT * FROM jobs WHERE id = $1", [id])`.
2. **Whitelist non-parameterizable fragments.** Some SQL fragments can't be parameterized (column names, sort directions, identifier paths). Pin them to a constant whitelist:
   ```ts
   const SAFE_DATE_FILTERS = { last_30: "AND created_at > NOW() - INTERVAL '30 days'", ... } as const;
   const dateFilter = SAFE_DATE_FILTERS[req.query.range] ?? "";
   query(`SELECT ... WHERE 1=1 ${dateFilter}`); // dateFilter is now provably safe
   ```
   Then add an inline `// eslint-disable-next-line no-restricted-syntax -- whitelisted fragment` comment with a one-line justification.
3. **Refactor to a query builder.** For routes that build complex WHERE/ORDER clauses dynamically (admin analytics, search), introduce a small helper that returns `{ sql, params }` rather than stringly-joining SQL.

**Never silence the warning with `// eslint-disable` without writing the justification.** The whole point of this tracker is auditability.

## Current state (2026-05-13)

**Total violations: 112 across 50 files**

Sorted by per-file count (tackle biggest clusters first; each cluster is usually a uniform pattern):

### High-density (≥4 violations per file)

- [ ] `src/services/adminService.ts` (17 violations: lines 38, 45, 52, 59, 66, 73, 80, 87, 94, 101, 108, 136, 299, 393, 401, 694, 700)
- [ ] `src/services/analyticsService.ts` (12 violations: 135, 146, 158, 178, 197, 302, 335, 379, 405, 437, 472, 510)
- [ ] `src/services/invoiceService.ts` (6 violations: 800, 810, 840, 850, 885, 895)
- [ ] `src/routes/cleaner-ai-settings.ts` (4 violations: 199, 433, 631, 818)
- [ ] `src/routes/cleanerEnhanced.ts` (4 violations: 816, 884, 902, 978)
- [ ] `src/services/cleanerDashboardService.ts` (4 violations: 28, 43, 57, 71)
- [ ] `src/services/userManagementService.ts` (4 violations: 108, 126, 344, 375)

### Medium-density (2–3 violations per file)

- [ ] `src/routes/admin/risk.ts` (3: 221, 369, 467)
- [ ] `src/routes/client.ts` (3: 532, 1157, 1478)
- [ ] `src/services/supportService.ts` (3: 206, 212, 248)
- [ ] `src/lib/queue.ts` (2: 305, 364)
- [ ] `src/routes/adminEnhanced.ts` (2: 1163, 1202)
- [ ] `src/routes/admin/bookings.ts` (2: 155, 167)
- [ ] `src/routes/admin/cleaners.ts` (2: 139, 150)
- [ ] `src/routes/admin/clients.ts` (2: 156, 178)
- [ ] `src/services/adminGamificationAbuseService.ts` (2: 44, 51)
- [ ] `src/services/adminGamificationGoalsService.ts` (2: 68, 163)
- [ ] `src/services/cleanerClientsService.ts` (2: 115, 123)
- [ ] `src/services/jobsService.ts` (2: 723, 730)
- [ ] `src/services/propertiesService.ts` (2: 207, 317)
- [ ] `src/services/riskService.ts` (2: 109, 197)
- [ ] `src/workers/gamification/computeGovernorMetrics.ts` (2: 37, 184)

### Single (1 violation per file)

- [ ] `src/core/db/rescheduleDb.ts` (line 116)
- [ ] `src/routes/admin/finance.ts` (189)
- [ ] `src/routes/admin/messages.ts` (119)
- [ ] `src/routes/admin/system.ts` (255)
- [ ] `src/routes/ai.ts` (117)
- [ ] `src/routes/gamification.ts` (741)
- [ ] `src/routes/reschedule.ts` (464)
- [ ] `src/services/adminGamificationChoicesService.ts` (96)
- [ ] `src/services/adminGamificationRewardsService.ts` (98)
- [ ] `src/services/aiScheduling.ts` (78)
- [ ] `src/services/cashBudgetService.ts` (205)
- [ ] `src/services/creditEconomyService.ts` (924)
- [ ] `src/services/creditsService.ts` (321)
- [ ] `src/services/feePolicyService.ts` (50)
- [ ] `src/services/holidayService.ts` (105)
- [ ] `src/services/kpiService.ts` (223)
- [ ] `src/services/notifications/preferencesService.ts` (98)
- [ ] `src/services/photosService.ts` (143)
- [ ] `src/services/referralService.ts` (257)
- [ ] `src/services/rewardEffectsService.ts` (239)
- [ ] `src/services/searchService.ts` (58)
- [ ] `src/services/teamsService.ts` (221)
- [ ] `src/workers/_deprecated/kpiSnapshot.ts` (31) — **archive candidate** (in `_deprecated/`)
- [ ] `src/workers/_deprecated/retryFailedEvents.ts` (27) — **archive candidate**
- [ ] `src/workers/_deprecated/stuckJobDetection.ts` (205) — **archive candidate**
- [ ] `src/workers/disabled/stuckJobDetection.ts` (205) — **archive candidate** (`disabled/`)
- [ ] `src/workers/v1-core/autoCancelJobs.ts` (30)
- [ ] `src/workers/v1-core/noShowDetection.ts` (32)

## Ratchet protocol

After clearing a cluster:
1. Run `npm run lint` and note the new total.
2. Edit `package.json` → `lint` script → lower `--max-warnings <N>` by the amount cleared.
3. Cross off the file in this tracker.
4. Commit with `refactor(sql): parameterize <file> (-N warnings)`.

When the count hits zero:
- Change the rule from `"warn"` to `"error"` in `.eslintrc.json`.
- Delete `--max-warnings` from the `lint` script.
- Archive this tracker doc.

## Notes on false-positives prevention

The rule selector is now:
```
CallExpression[callee.name='query'] > TemplateLiteral[expressions.length>0]
CallExpression[callee.property.name='query'] > TemplateLiteral[expressions.length>0]
```

This matches:
- `query(\`...\`)` — bare function
- `pool.query(\`...\`)`, `client.query(\`...\`)`, `db.query(\`...\`)` — method form

It does **not** match notification templates, error messages, URL builders, or anything else that happens to use interpolation. If a real SQL injection site uses a different call shape (e.g. `execute()`, custom wrapper), add another selector to the rule rather than relying on grep.
