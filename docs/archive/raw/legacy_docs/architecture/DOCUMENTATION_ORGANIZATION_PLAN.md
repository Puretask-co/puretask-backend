# Documentation Organization Plan

**Date**: 2025-12-26  
**Purpose**: Reorganize chaotic docs into clean, logical structure

---

## 📁 New Folder Structure

```
docs/
├── _active/                    # Current, accurate, actively used docs
│   ├── deployment/             # Railway, environment setup
│   ├── development/            # Dev workflow, testing, debugging
│   ├── architecture/           # System design, blueprints, master guide
│   └── operations/             # Workers, monitoring, n8n, notifications
│
├── _archive/                   # Old/outdated docs (keep for reference)
│   ├── old-analyses/           # Historical analysis reports
│   ├── old-tests/              # Outdated test reports
│   └── old-plans/              # Superseded implementation plans
│
├── _future/                    # Not yet implemented (V5, future features)
│   └── v5-planning/            # V5 auto-matching plans
│
├── blueprint/                  # Core system design (keep at root)
├── specs/                      # Feature specifications (keep at root)
└── versions/                   # Version-specific docs (keep at root)
```

---

## 🗂️ File Organization Map

### ✅ ACTIVE DOCS (Keep These!)

#### `_active/deployment/` - Railway & Environment Setup
- DEPLOY_TO_RAILWAY.md (NEW - your comprehensive guide)
- RAILWAY_SETUP_CHECKLIST.md (NEW)
- RAILWAY_DEPLOYMENT_ANALYSIS.md (NEW)
- test-railway-deployment.ps1 (script, keep at root)
- ENV_TEMPLATE.md
- DATABASE_SETUP.md
- NEON_SETUP_GUIDE.md
- STAGING_ENVIRONMENT.md

#### `_active/development/` - Developer Workflow
- DEVELOPMENT_WORKFLOW_GUIDE.md
- TESTING_GUIDE.md
- QUICK_REFERENCE_COMMANDS.md
- SETUP_INSTRUCTIONS.md
- WINDOWS_SETUP.md
- DATABASE_CONNECTION_TROUBLESHOOTING.md
- MIGRATION_GUIDE.md
- MIGRATION_BEST_PRACTICES.md
- POSTMAN_API_KEY_SETUP.md

#### `_active/architecture/` - System Design
- PURETASK_MASTER_GUIDE.md ⭐ (MOST IMPORTANT)
- ARCHITECTURE_SUMMARY.md
- ARCHITECTURE.md
- ROUTES_CATALOG.md
- SERVICES_CATALOG.md
- EVENT_SYSTEM_SPEC.md
- CAPABILITIES.md
- API_REFERENCE.md
- architecture-what-lives-where.md

#### `_active/operations/` - Workers, n8n, Monitoring
- WORKER_SCHEDULE.md ⭐
- N8N_SETUP_COMPLETE_CHECKLIST.md
- N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md
- email-registry.md
- NOTIFICATION_SERVICE_MIGRATION.md
- n8n-universal-sender-workflow-spec.md
- SECURITY_AUDIT_WORKFLOW_GUIDE.md
- DEPLOYMENT_CHECKLIST.md

---

### 📦 ARCHIVE (Old/Superseded)

#### `_archive/old-analyses/`
- ANALYSIS_DOCUMENTS_COMPARISON.md
- ANALYSIS_REPORT_REVIEW.md
- ANALYSIS_REPORT.md
- BACKEND_REVIEW_ANALYSIS.md
- COMPLETE_ANALYSIS.md
- CURRENT_SYSTEM_INVENTORY.md
- PROJECT_ANALYSIS_2025.md
- PROJECT_COMPREHENSIVE_REVIEW.md
- BEST_PRACTICES_AUDIT.md
- BEST_PRACTICES_REVIEW.md
- INTEGRATION_TESTS_REVIEW.md
- LINTING_REPORT.md
- STATE_MACHINE_REVIEW.md
- TEST_BEST_PRACTICES_REVIEW.md
- V1_READINESS_ASSESSMENT.md
- V1_REQUIREMENTS_AUDIT.md
- V1_REVIEW_ANALYSIS.md

#### `_archive/old-tests/`
- DATABASE_TEST_REPORT.md
- DATABASE_TEST_SUMMARY.md
- TEST_RESULTS_SUMMARY.md
- TEST_STATUS_SUMMARY.md
- TESTING_STATUS.md
- TEST_FIXES_IMPLEMENTED.md
- TEST_FIXES_SUMMARY.md
- TEST_PASSWORD_HASH_FIX_DIFFS.md
- TEST_PASSWORD_HASH_FIX_SUMMARY.md
- V1_HARDENING_TEST_FIXES.md
- V1_TEST_CHECKLIST.md
- V1_TESTING_SUMMARY.md
- V2_TESTING_SUMMARY.md
- V4_TESTING_SUMMARY.md
- FINAL_WORKER_TEST_STATUS.md
- WORKER_DRY_RUN_FINAL_STATUS.md
- WORKER_DRY_RUN_ISSUES.md
- WORKER_TEST_PROGRESS.md

#### `_archive/old-plans/`
- CURSOR_BUILD_PLAN.md
- CURSOR_COMMAND.md
- CURSOR_FIRST_COMMAND.txt
- IMPLEMENTATION_ACTION_PLAN.md
- IMPLEMENTATION_PLAN.md
- NEXT_STEPS_ACTION_PLAN.md
- NEXT_STEPS_CURRENT.md
- NEXT_STEPS.md
- PHASE1_COMPLETE.md
- PHASE2_COMPLETE.md
- PHASE3_COMPLETE.md
- PHASE4_COMPLETE.md
- PHASE5_COMPLETE.md
- RUNBOOK_EXECUTION_SUMMARY.md
- FIXES_SUMMARY.md
- FINAL_STATUS.md
- SUMMARY.md

#### `_archive/old-railway/`
- RAILWAY_BEGINNERS_GUIDE.md (superseded by DEPLOY_TO_RAILWAY.md)
- RAILWAY_DEPLOYMENT_FIX.md (outdated)
- RAILWAY_ENVIRONMENTS_GUIDE.md (superseded)
- RAILWAY_HEALTHCHECK_FIX.md (fixed already)
- RAILWAY_QUICK_START.md (superseded)
- RAILWAY_SETUP.md (superseded)
- DEPLOYMENT_QUICK_START.md (superseded)

#### `_archive/old-misc/`
- MCP_SERVERS_FIX_GUIDE.md (fixed already)
- MCP_SERVERS_REVIEW.md (old)
- WORKFLOW_FIX_AUDIT_AUTOFIX.md (done)
- FIX_STRIPE_EVENTS_COLUMN.sql (one-time fix)
- N8N_WORKFLOW_VALIDATION.md (superseded by SETUP_COMPLETE)
- TESTING_DATA_SETUP.md (old)

---

### 🔮 FUTURE (Not Implemented Yet)

#### `_future/v5-planning/`
- V5_CAPABILITIES_ANALYSIS.md
- FUTURE_FEATURES.md
- ROADMAP.md (if not current)

---

### 📌 KEEP AT ROOT LEVEL

These stay in `docs/` root for easy access:

#### Core References (Don't Move)
- README.md ⭐
- LIVE_STATUS_AND_GATES_ACCURATE.md ⭐ (NEW - THE TRUTH)
- ALL_VERSIONS_STATUS.md

#### Version-Specific (Keep Organized)
- V1_COMPLETE_SUMMARY.md
- V1_COMPLETION_SUMMARY.md
- V1_ENABLED_FEATURES.md
- V2_EXECUTION_COMPLETE.md
- V2_EXECUTION_PLAN.md
- V2_FEATURES_DETAILED_BREAKDOWN.md
- V3_COMPLETE_OVERVIEW.md
- V3_COMPLETE_SUMMARY.md
- V3_DEPLOYMENT_COMPLETE.md ⭐
- V3_DEPLOYMENT_VERIFICATION.md
- V3_EXECUTION_PLAN.md
- V3_FEATURES_DETAILED_BREAKDOWN.md
- V3_FINAL_STATUS.md
- V3_IMPLEMENTATION_COMPLETE.md
- V3_NEXT_STEPS_COMPLETE.md
- V3_NEXT_STEPS.md (archive - superseded by COMPLETE)
- V4_CAPABILITIES_COMPLETE.md ⭐
- V4_DEPLOYMENT_COMPLETE.md ⭐
- V4_DEPLOYMENT_VERIFICATION.md
- V4_IMPLEMENTATION_COMPLETE.md
- V4_IMPLEMENTATION_PLAN.md
- VERSION_FEATURE_BREAKDOWN.md

#### Existing Folders (Keep)
- `blueprint/` - Core system blueprints
- `specs/` - Feature specifications
- `versions/` - Version roadmaps and plans

---

## 🔧 Worker Files Organization

### Current Structure
```
src/workers/
├── [26 active workers]
└── disabled/
    ├── cleaningScores.ts
    ├── goalChecker.ts
    └── stuckJobDetection.ts
```

### Proposed Structure
```
src/workers/
├── _STATUS.md                  # NEW - Which workers are active/scheduled
├── v1-core/                    # V1 baseline workers
│   ├── autoCancelJobs.ts
│   ├── autoExpireAwaitingApproval.ts
│   ├── payoutWeekly.ts
│   ├── retryFailedNotifications.ts
│   └── webhookRetry.ts
│
├── v2-operations/              # V2 operational workers
│   ├── creditEconomyMaintenance.ts
│   ├── payoutRetry.ts
│   ├── payoutReconciliation.ts
│   ├── backupDaily.ts
│   ├── photoRetentionCleanup.ts
│   └── queueProcessor.ts
│
├── v3-automation/              # V3 workers
│   └── subscriptionJobs.ts
│
├── v4-analytics/               # V4 workers
│   ├── expireBoosts.ts
│   ├── kpiDailySnapshot.ts
│   └── weeklySummary.ts
│
├── reliability/                # Reliability system workers
│   ├── reliabilityRecalc.ts
│   ├── nightlyScoreRecompute.ts
│   └── cleaningScores.ts
│
├── _deprecated/                # Old/unused workers
│   ├── autoPausePayouts.ts (unused?)
│   ├── goalChecker.ts (duplicate in disabled/)
│   ├── kpiSnapshot.ts (superseded by kpiDailySnapshot?)
│   ├── metricsSnapshot.ts (superseded?)
│   ├── processPayouts.ts (superseded by payoutWeekly?)
│   ├── retryFailedEvents.ts (unused?)
│   └── stuckJobDetection.ts (duplicate in disabled/)
│
├── disabled/                   # Intentionally disabled (keep)
│   ├── cleaningScores.ts
│   ├── goalChecker.ts
│   └── stuckJobDetection.ts
│
└── index.ts                    # Worker registry (keep at root)
```

---

## 📋 Migration Steps

### Step 1: Create Folders ✅ DONE
```powershell
# Already created above
```

### Step 2: Move Active Docs (Do This Next)
```powershell
# Move deployment docs
Move-Item docs/DEPLOY_TO_RAILWAY.md docs/_active/deployment/
Move-Item docs/RAILWAY_*.md docs/_active/deployment/
Move-Item docs/ENV_TEMPLATE.md docs/_active/deployment/
# ... etc
```

### Step 3: Move Archive Docs
```powershell
# Move old analyses
Move-Item docs/ANALYSIS_*.md docs/_archive/old-analyses/
Move-Item docs/*_REVIEW*.md docs/_archive/old-analyses/
# ... etc
```

### Step 4: Update README with New Structure
Create `docs/README.md` with navigation guide

### Step 5: Organize Workers (Optional - More Complex)
Can do this separately if you want

---

## ⚠️ Important Notes

1. **Don't Delete Anything** - Move to archive, don't delete
2. **Keep Git History** - Use `git mv` not `Move-Item` (I'll do this)
3. **Update References** - Some docs may reference old paths
4. **Test After Move** - Verify nothing breaks
5. **Keep Scripts at Root** - PowerShell scripts stay in `scripts/`

---

## 🎯 Priority Actions

### Do First (High Value):
1. ✅ Create folder structure (DONE)
2. ⏳ Move active docs to `_active/`
3. ⏳ Move archive docs to `_archive/`
4. ⏳ Create `docs/README.md` navigation guide

### Do Later (Optional):
5. ⏳ Organize workers by version
6. ⏳ Update internal doc references
7. ⏳ Create worker status doc

---

**Ready to proceed with moving files?** Say "yes" and I'll execute the migration using `git mv` to preserve history!


