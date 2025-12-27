# 📚 PureTask Documentation

**Last Updated**: 2025-12-26  
**Status**: ✅ Organized and current

Welcome to the PureTask backend documentation! This guide will help you find exactly what you need.

---

## 🎯 Quick Navigation

### **For New Developers:**
1. Start here: [`_active/development/SETUP_INSTRUCTIONS.md`](_active/development/SETUP_INSTRUCTIONS.md)
2. Then read: [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md) ⭐
3. Dev workflow: [`_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md`](_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md)

### **For Deploying:**
1. Railway guide: [`../DEPLOY_TO_RAILWAY.md`](../DEPLOY_TO_RAILWAY.md) ⭐
2. Setup checklist: [`../RAILWAY_SETUP_CHECKLIST.md`](../RAILWAY_SETUP_CHECKLIST.md)
3. Environment setup: [`_active/deployment/ENV_TEMPLATE.md`](_active/deployment/ENV_TEMPLATE.md)

### **For Understanding the System:**
1. Master guide: [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md) ⭐
2. Architecture: [`_active/architecture/ARCHITECTURE_SUMMARY.md`](_active/architecture/ARCHITECTURE_SUMMARY.md)
3. Current status: [`../LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md) ⭐

---

## 📁 Documentation Structure

```
docs/
├── 📂 _active/              # Current, accurate docs (USE THESE!)
│   ├── deployment/          # Railway, environment, database setup
│   ├── development/         # Developer workflow, testing, debugging
│   ├── architecture/        # System design, blueprints, API reference
│   └── operations/          # Workers, n8n, monitoring, notifications
│
├── 📂 _archive/             # Old/outdated docs (reference only)
│   ├── old-analyses/        # Historical analysis reports
│   ├── old-tests/           # Outdated test reports
│   ├── old-plans/           # Superseded implementation plans
│   ├── old-railway/         # Old Railway docs (superseded)
│   └── old-misc/            # Miscellaneous archived docs
│
├── 📂 _future/              # Not yet implemented
│   └── v5-planning/         # V5 auto-matching plans
│
├── 📂 blueprint/            # Core system blueprints
├── 📂 specs/                # Feature specifications
├── 📂 versions/             # Version roadmaps (V1-V5)
│
├── 📄 V1-V4 Status Docs     # Version-specific status (see below)
├── 📄 ALL_VERSIONS_STATUS.md
└── 📄 README.md (this file)
```

---

## 🗂️ Active Documentation

### 🚀 Deployment (`_active/deployment/`)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `ENV_TEMPLATE.md` | Environment variables reference | Setting up `.env` files |
| `DATABASE_SETUP.md` | Database configuration | Postgres setup |
| `NEON_SETUP_GUIDE.md` | Neon.tech database setup | Using Neon (alternative to Railway Postgres) |
| `STAGING_ENVIRONMENT.md` | Staging environment guide | Setting up staging |

**⭐ PRIMARY GUIDE**: [`../DEPLOY_TO_RAILWAY.md`](../DEPLOY_TO_RAILWAY.md) (at repo root)

---

### 💻 Development (`_active/development/`)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `SETUP_INSTRUCTIONS.md` | Initial project setup | First time setting up the project |
| `DEVELOPMENT_WORKFLOW_GUIDE.md` | Day-to-day dev workflow | Daily development |
| `TESTING_GUIDE.md` | Testing strategies & commands | Writing/running tests |
| `QUICK_REFERENCE_COMMANDS.md` | Common CLI commands | Quick command lookup |
| `WINDOWS_SETUP.md` | Windows-specific setup | Windows development |
| `DATABASE_CONNECTION_TROUBLESHOOTING.md` | DB connection fixes | Database issues |
| `MIGRATION_GUIDE.md` | Database migrations | Creating/running migrations |
| `MIGRATION_BEST_PRACTICES.md` | Migration dos/don'ts | Writing good migrations |
| `POSTMAN_API_KEY_SETUP.md` | API testing setup | Testing with Postman |

---

### 🏗️ Architecture (`_active/architecture/`)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **`PURETASK_MASTER_GUIDE.md`** ⭐ | **Complete system reference** | **Understanding the entire system** |
| `ARCHITECTURE_SUMMARY.md` | High-level architecture | Quick system overview |
| `ARCHITECTURE.md` | Detailed architecture | Deep dive into system design |
| `ROUTES_CATALOG.md` | All API endpoints | Finding/documenting endpoints |
| `SERVICES_CATALOG.md` | All services | Understanding service layer |
| `EVENT_SYSTEM_SPEC.md` | Event system design | Working with events |
| `CAPABILITIES.md` | Feature capabilities | What the system can do |
| `API_REFERENCE.md` | API documentation | API integration |
| `architecture-what-lives-where.md` | Code organization | Finding code locations |

---

### ⚙️ Operations (`_active/operations/`)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **`WORKER_SCHEDULE.md`** ⭐ | **Worker scheduling reference** | **Setting up cron jobs** |
| `N8N_SETUP_COMPLETE_CHECKLIST.md` | n8n workflow setup | Configuring n8n |
| `N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md` | n8n workflow details | Building n8n workflows |
| `email-registry.md` | Email/SMS template registry | Managing notification templates |
| `NOTIFICATION_SERVICE_MIGRATION.md` | Notification architecture | Understanding notifications |
| `n8n-universal-sender-workflow-spec.md` | Universal sender spec | n8n sender workflow |
| `SECURITY_AUDIT_WORKFLOW_GUIDE.md` | Security audit process | Running security audits |
| `DEPLOYMENT_CHECKLIST.md` | Deployment checklist | Pre-deployment verification |

---

## 📊 Version Status Documents

### Current Status
- **[`../LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md)** ⭐ - **THE TRUTH** - Current state of all features
- `ALL_VERSIONS_STATUS.md` - Version overview
- `VERSION_FEATURE_BREAKDOWN.md` - Feature by version

### V1 (Baseline - COMPLETE)
- `V1_COMPLETE_SUMMARY.md` - V1 completion report
- `V1_COMPLETION_SUMMARY.md` - V1 features summary
- `V1_ENABLED_FEATURES.md` - What's enabled in V1

### V2 (Trust & Operations - COMPLETE)
- `V2_EXECUTION_COMPLETE.md` - V2 completion status
- `V2_EXECUTION_PLAN.md` - V2 implementation plan
- `V2_FEATURES_DETAILED_BREAKDOWN.md` - V2 features detail

### V3 (Automation & Growth - DEPLOYED) ⭐
- **`V3_DEPLOYMENT_COMPLETE.md`** ⭐ - **V3 deployment status**
- `V3_COMPLETE_OVERVIEW.md` - V3 feature overview
- `V3_COMPLETE_SUMMARY.md` - V3 completion summary
- `V3_DEPLOYMENT_VERIFICATION.md` - V3 verification steps
- `V3_EXECUTION_PLAN.md` - V3 implementation plan
- `V3_FEATURES_DETAILED_BREAKDOWN.md` - V3 features detail
- `V3_FINAL_STATUS.md` - V3 final status
- `V3_IMPLEMENTATION_COMPLETE.md` - V3 code completion
- `V3_NEXT_STEPS_COMPLETE.md` - V3 next steps

### V4 (Risk & Monetization - ENABLED) ⭐
- **`V4_DEPLOYMENT_COMPLETE.md`** ⭐ - **V4 deployment status**
- **`V4_CAPABILITIES_COMPLETE.md`** ⭐ - **V4 features detail**
- `V4_DEPLOYMENT_VERIFICATION.md` - V4 verification steps
- `V4_IMPLEMENTATION_COMPLETE.md` - V4 code completion
- `V4_IMPLEMENTATION_PLAN.md` - V4 plan

### V5 (Platform Maturity - FUTURE)
See: [`_future/v5-planning/`](_future/v5-planning/)

---

## 📦 Archived Documentation

**Location**: `_archive/`

These docs are kept for historical reference but are **outdated**:

- **`old-analyses/`** - Historical analysis reports (60+ docs)
- **`old-tests/`** - Old test reports and summaries (18 docs)
- **`old-plans/`** - Superseded implementation plans (17 docs)
- **`old-railway/`** - Old Railway docs (superseded by new guides)
- **`old-misc/`** - Various archived documentation

**⚠️ Don't use these for current work!** They're historical reference only.

---

## 🔮 Future Planning

**Location**: `_future/v5-planning/`

Documents for features not yet implemented:

- `V5_CAPABILITIES_ANALYSIS.md` - V5 feature planning
- `FUTURE_FEATURES.md` - Future feature ideas
- `ROADMAP.md` - Long-term roadmap

---

## 🎯 Common Tasks

### "I need to deploy to Railway"
1. Read: [`../DEPLOY_TO_RAILWAY.md`](../DEPLOY_TO_RAILWAY.md)
2. Follow: [`../RAILWAY_SETUP_CHECKLIST.md`](../RAILWAY_SETUP_CHECKLIST.md)
3. Test with: [`../test-railway-deployment.ps1`](../test-railway-deployment.ps1)

### "I need to understand the system"
1. Start: [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md)
2. Then: [`../LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md)
3. Deep dive: [`_active/architecture/ARCHITECTURE_SUMMARY.md`](_active/architecture/ARCHITECTURE_SUMMARY.md)

### "I need to set up dev environment"
1. Follow: [`_active/development/SETUP_INSTRUCTIONS.md`](_active/development/SETUP_INSTRUCTIONS.md)
2. If Windows: [`_active/development/WINDOWS_SETUP.md`](_active/development/WINDOWS_SETUP.md)
3. Daily workflow: [`_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md`](_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md)

### "I need to run/schedule workers"
1. Check: [`_active/operations/WORKER_SCHEDULE.md`](_active/operations/WORKER_SCHEDULE.md)
2. Location: `../src/workers/` (see worker organization below)

### "I need to configure n8n"
1. Setup: [`_active/operations/N8N_SETUP_COMPLETE_CHECKLIST.md`](_active/operations/N8N_SETUP_COMPLETE_CHECKLIST.md)
2. Implementation: [`_active/operations/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md`](_active/operations/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md)
3. Templates: [`_active/operations/email-registry.md`](_active/operations/email-registry.md)

### "I need to create/run migrations"
1. Guide: [`_active/development/MIGRATION_GUIDE.md`](_active/development/MIGRATION_GUIDE.md)
2. Best practices: [`_active/development/MIGRATION_BEST_PRACTICES.md`](_active/development/MIGRATION_BEST_PRACTICES.md)

### "I need to write tests"
1. Testing guide: [`_active/development/TESTING_GUIDE.md`](_active/development/TESTING_GUIDE.md)
2. Stripe testing: `STRIPE_TESTING.md` (root level)

---

## 🔧 Worker Organization

**Location**: `../src/workers/`

Workers are organized by version/category:

- **V1 Core**: `autoCancelJobs`, `autoExpireAwaitingApproval`, `payoutWeekly`, etc.
- **V2 Operations**: `creditEconomyMaintenance`, `payoutRetry`, `backupDaily`, etc.
- **V3 Automation**: `subscriptionJobs`
- **V4 Analytics**: `expireBoosts`, `kpiDailySnapshot`, `weeklySummary`
- **Reliability**: `reliabilityRecalc`, `cleaningScores`
- **Disabled**: `disabled/` folder (intentionally disabled workers)

**See**: [`_active/operations/WORKER_SCHEDULE.md`](_active/operations/WORKER_SCHEDULE.md) for scheduling details.

---

## 📖 Additional Resources

### At Repository Root:
- `README.md` - Project overview
- `DEPLOY_TO_RAILWAY.md` ⭐ - Primary deployment guide
- `RAILWAY_SETUP_CHECKLIST.md` - Setup checklist
- `RAILWAY_DEPLOYMENT_ANALYSIS.md` - Deployment analysis
- `LIVE_STATUS_AND_GATES_ACCURATE.md` ⭐ - Current system status
- `DOCUMENTATION_ORGANIZATION_PLAN.md` - This reorganization plan

### Workflow Scripts:
- `scripts/set-railway-env-secure.ps1` - Secure env var setup
- `test-railway-deployment.ps1` - Deployment testing
- `scripts/run-audit-workflow.ps1` - Security audit

---

## ❓ FAQ

**Q: Which docs should I trust?**
A: Use docs in `_active/` and version status docs (V1-V4). Ignore `_archive/`.

**Q: Where's the single source of truth?**
A: [`LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md) + [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md)

**Q: Is V3 ready for production?**
A: Yes, code is deployed. Needs 4-6 week monitoring period. See `V3_DEPLOYMENT_COMPLETE.md`.

**Q: Is V4 ready for production?**
A: Code is enabled but keep internal-only until V3 gates pass. See `V4_DEPLOYMENT_COMPLETE.md`.

**Q: Why are there so many archived docs?**
A: Historical record of system evolution. Kept for reference, not current use.

**Q: How do I update documentation?**
A: Update docs in `_active/` only. Move outdated docs to `_archive/`. Update this README if structure changes.

---

## 🚀 Getting Started Paths

### Path 1: New Developer
1. [`_active/development/SETUP_INSTRUCTIONS.md`](_active/development/SETUP_INSTRUCTIONS.md)
2. [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md)
3. [`_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md`](_active/development/DEVELOPMENT_WORKFLOW_GUIDE.md)
4. [`_active/development/TESTING_GUIDE.md`](_active/development/TESTING_GUIDE.md)

### Path 2: DevOps/Deployment
1. [`../DEPLOY_TO_RAILWAY.md`](../DEPLOY_TO_RAILWAY.md)
2. [`../RAILWAY_SETUP_CHECKLIST.md`](../RAILWAY_SETUP_CHECKLIST.md)
3. [`_active/deployment/ENV_TEMPLATE.md`](_active/deployment/ENV_TEMPLATE.md)
4. [`_active/operations/WORKER_SCHEDULE.md`](_active/operations/WORKER_SCHEDULE.md)

### Path 3: System Architecture
1. [`_active/architecture/PURETASK_MASTER_GUIDE.md`](_active/architecture/PURETASK_MASTER_GUIDE.md)
2. [`../LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md)
3. [`_active/architecture/ARCHITECTURE_SUMMARY.md`](_active/architecture/ARCHITECTURE_SUMMARY.md)
4. `V3_DEPLOYMENT_COMPLETE.md` & `V4_DEPLOYMENT_COMPLETE.md`

### Path 4: Operations/n8n
1. [`_active/operations/N8N_SETUP_COMPLETE_CHECKLIST.md`](_active/operations/N8N_SETUP_COMPLETE_CHECKLIST.md)
2. [`_active/operations/email-registry.md`](_active/operations/email-registry.md)
3. [`_active/operations/WORKER_SCHEDULE.md`](_active/operations/WORKER_SCHEDULE.md)
4. [`_active/operations/NOTIFICATION_SERVICE_MIGRATION.md`](_active/operations/NOTIFICATION_SERVICE_MIGRATION.md)

---

**Last Updated**: 2025-12-26  
**Maintained By**: PureTask Team  
**Questions?** Check [`LIVE_STATUS_AND_GATES_ACCURATE.md`](../LIVE_STATUS_AND_GATES_ACCURATE.md) or ask in team chat.

