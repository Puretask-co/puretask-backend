# Documentation Index - Organized by Topic & Importance

**Last Updated:** 2026-01-29  
**Purpose:** Quick reference guide to all documentation, organized by topic and importance level

**Complete beginner?** If terms like "Sentry," "CI/CD," "migration," or "circuit breaker" are new to you, open **[README.md](./README.md)** first and read the **"New here? Key terms (plain English)"** section. It defines the most common terms in one sentence each. Then come back here and use **Quick Reference by Use Case** (below) to find the doc for your task.

---

## 📚 How to Use This Index

**What it is:** A single place to find all active docs. Each doc is listed under a topic (e.g. Production Readiness, Security, API) and an importance level.  
**What it does:** Lets you jump to the right doc for your task (e.g. deploy, security, API, gaps).  
**How we use it:** Use **Quick Reference by Use Case** below to find the doc for your task (e.g. "I want to deploy" → PRODUCTION_READINESS_ROADMAP; "I want to address remaining gaps" → ADDRESS_REMAINING_GAPS). Each doc's sections use **What it is / What it does / How we use it** (see README).

**Importance levels:**
- **🔴 CRITICAL**: Must-read for production deployment and security (e.g. production readiness, security audit, monitoring).
- **🟠 HIGH**: Important for development, operations, and maintenance (e.g. database recovery, CI/CD, backups).
- **🟡 MEDIUM**: Useful for understanding specific features or systems (e.g. API docs, architecture, gap analysis, notifications).
- **🟢 LOW**: Reference material, historical context, or optional reading (e.g. contributing, cleanup).

---

## 🔴 CRITICAL - Production Readiness & Security

### Production Readiness
1. **`00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md`** ⭐ **START HERE** (production readiness)
   - Detailed implementation guide
   - Step-by-step instructions for production features
   - Verification steps
   - **Read First**: Production deployment and status

2. **`00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md`**
   - **Read When**: Implementing production features (same doc as above)

### Security
3. **`SECURITY_AUDIT_SUMMARY.md`** ⭐ **SECURITY OVERVIEW**
   - Complete security audit results
   - 0 vulnerabilities found
   - Security measures implemented
   - **Read First**: Security posture

4. **`SECURITY_GUARDRAILS.md`**
   - Repository hygiene
   - Secret prevention
   - Pre-commit hooks
   - **Read When**: Setting up development environment

5. **`SECURITY_INCIDENT_RESPONSE.md`**
   - Incident response procedures
   - Secret exposure handling
   - **Read When**: Security incident occurs

### Monitoring & Observability
6. **`MONITORING_SETUP.md`**
   - Sentry configuration
   - Metrics system
   - UptimeRobot setup
   - **Read When**: Setting up monitoring

### Error Recovery
7. **`ERROR_RECOVERY_CIRCUIT_BREAKERS.md`**
   - Circuit breaker implementation
   - Retry logic
   - External API resilience
   - **Read When**: Understanding error handling

---

## 🟠 HIGH - Operations & Infrastructure

### Database
8. **`DATABASE_RECOVERY.md`**
   - Recovery procedures
   - Point-in-time recovery
   - RTO/RPO information
   - **Read When**: Database issues or recovery needed

9. **`BACKUP_SETUP.md`**
   - Neon backup configuration
   - Backup verification
   - **Read When**: Setting up backups

10. **`BACKUP_RESTORE_PROCEDURE.md`**
    - Detailed restore steps
    - **Read When**: Need to restore from backup

### CI/CD & Deployment
11. **`CI_CD_SETUP.md`**
    - GitHub Actions workflow
    - Automated testing
    - Deployment pipeline
    - **Read When**: Setting up CI/CD

### Rate Limiting
12. **`RATE_LIMITING.md`**
    - Rate limiting strategy
    - Redis implementation
    - Configuration
    - **Read When**: Configuring rate limits

### GDPR Compliance
13. **`GDPR_COMPLIANCE.md`**
    - GDPR implementation
    - Data export/deletion
    - Consent management
    - **Read When**: Handling GDPR requests

---

## 🟡 MEDIUM - Development & Features

### API Documentation
14. **`API_DOCUMENTATION.md`**
    - Swagger UI access
    - OpenAPI specification
    - API structure
    - **Read When**: Using the API

15. **`API_SPEC_COMPARISON.md`**
    - Compares external spec (endpoints, DB, n8n, idempotency) with our codebase
    - Whether to adopt it or a version
    - **Read When**: Evaluating specs or onboarding

16. **`API_EXACT_ENDPOINTS.md`**
    - Exact REST paths + request/response (our API)
    - **Read When**: Frontend, SDKs, or n8n integration

17. **`N8N_EVENT_ROUTER.md`**
    - n8n Switch-by-eventType reference
    - Event body shape and suggested actions
    - **Read When**: Building n8n workflows

### Architecture
18. **`ARCHITECTURE.md`**
    - System architecture
    - Design patterns
    - Project structure
    - **Read When**: Understanding codebase structure

### Gap Analysis & Planning
19. **`COMPREHENSIVE_GAP_ANALYSIS.md`**
    - Gap identification
    - Missing features
    - Production readiness concerns
    - **Read When**: Planning improvements

20. **`GAP_COMPLETION_ROADMAP.md`**
    - Completion guide
    - Prioritized tasks
    - Implementation steps
    - **Read When**: Completing gaps

21. **`ADDRESS_REMAINING_GAPS.md`**
    - Step-by-step guide for remaining issues (migration runner, tests, runbooks, alerting, etc.)
    - **Read When**: Addressing remaining production-readiness items

22. **`REMAINING_ISSUES_STEPS.md`**
    - How to complete the remaining issues (tests, typecheck, lint, alerting, migrations, k6)
    - **Read When**: Finishing remaining items one by one

### Notifications System
23. **`NOTIFICATION_SENDER_ANALYSIS.md`**
    - Notification system overview
    - Architecture
    - **Read When**: Understanding notifications

24. **`NOTIFICATION_MATURITY_UPGRADES.md`**
    - Recent improvements
    - Template registry
    - URL builders
    - **Read When**: Working with notifications

23. **`NOTIFICATION_DEDUPE_STRATEGY.md`**
    - Deduplication logic
    - Type-aware dedupe
    - **Read When**: Debugging duplicate notifications

26. **`NOTIFICATION_TEMPLATES_OUTLINE.md`**
    - Template structure
    - New notification types
    - **Read When**: Adding new notifications

### Workers & Cron Jobs
27. **`CRON_JOBS_AND_NOTIFICATIONS.md`**
    - Scheduled workers
    - Cron job inventory
    - **Read When**: Understanding background jobs

28. **`WORKER_HARDENING.md`**
    - Worker reliability
    - Idempotency
    - Lock recovery
    - **Read When**: Working with workers

### Performance
29. **`PERFORMANCE_TESTING.md`**
    - Load testing setup
    - k6 configuration
    - Benchmarking
    - **Read When**: Performance testing

---

## 🟢 LOW - Reference & Historical

### Contributing
30. **`CONTRIBUTING.md`**
    - Development setup
    - Contribution guidelines
    - **Read When**: Contributing to project

### Server Issues
31. **`SERVER_STARTUP_ANALYSIS.md`**
    - Startup issues analysis
    - Solutions
    - **Read When**: Server startup problems

### Frontend Integration
32. **`FRONTEND_AUTH_FIX.md`**
    - Frontend auth fixes
    - **Read When**: Frontend auth issues

### Cleanup
31. **`CLEANUP_SUMMARY.md`**
    - Workspace cleanup log
    - **Read When**: Understanding file organization

### README
34. **`README.md`**
    - Quick links
    - Documentation overview
    - **Read When**: First time exploring docs

---

## 📊 Quick Reference by Use Case

### "I want to deploy to production"
1. `PRODUCTION_READINESS_STATUS.md`
2. `PRODUCTION_READINESS_ROADMAP.md`
3. `SECURITY_AUDIT_SUMMARY.md`
4. `MONITORING_SETUP.md`
5. `CI_CD_SETUP.md`
6. `DATABASE_RECOVERY.md`

### "I need to understand security"
1. `SECURITY_AUDIT_SUMMARY.md`
2. `SECURITY_GUARDRAILS.md`
3. `SECURITY_INCIDENT_RESPONSE.md`
4. `RATE_LIMITING.md`

### "I'm working on notifications"
1. `NOTIFICATION_SENDER_ANALYSIS.md`
2. `NOTIFICATION_MATURITY_UPGRADES.md`
3. `NOTIFICATION_DEDUPE_STRATEGY.md`
4. `NOTIFICATION_TEMPLATES_OUTLINE.md`
5. `CRON_JOBS_AND_NOTIFICATIONS.md`

### "I need to fix an error"
1. `ERROR_RECOVERY_CIRCUIT_BREAKERS.md`
2. `SERVER_STARTUP_ANALYSIS.md`
3. `DATABASE_RECOVERY.md`

### "I'm setting up the development environment"
1. `ARCHITECTURE.md`
2. `CONTRIBUTING.md`
3. `SECURITY_GUARDRAILS.md`
4. `API_DOCUMENTATION.md`

### "I need to understand the system"
1. `ARCHITECTURE.md`
2. `PRODUCTION_READINESS_STATUS.md`
3. `COMPREHENSIVE_GAP_ANALYSIS.md`
4. `CRON_JOBS_AND_NOTIFICATIONS.md`

### "I want to address remaining gaps"
1. `ADDRESS_REMAINING_GAPS.md`
2. `REMAINING_ISSUES_STEPS.md` — **How to complete** each remaining issue (tests, typecheck, lint, alerting, migrations, k6)
3. `COMPREHENSIVE_GAP_ANALYSIS.md`
4. `PRODUCTION_READINESS_ROADMAP.md`

### Runbooks (operations)
1. `docs/runbooks/restore-from-backup.md` — Restore from backup (Neon PITR)
2. `docs/runbooks/handle-incident.md` — Handle a production incident
3. `docs/runbooks/rollback-deploy.md` — Rollback a deploy (e.g. Railway)

---

## 📁 Documentation Organization

### Current Structure
```
docs/active/          # Current, actively-used documentation (30 files)
docs/_archive/        # Archived/historical docs (excluded from indexing)
docs/_future/         # Future planning docs
docs/architecture/    # Architecture-specific docs
docs/deployment/      # Deployment guides
docs/testing/         # Testing documentation
docs/specs/           # API specifications
```

### Recommended Reading Order for New Developers

**Day 1: Overview**
1. `README.md`
2. `ARCHITECTURE.md`
3. `PRODUCTION_READINESS_STATUS.md`

**Day 2: Development Setup**
1. `CONTRIBUTING.md`
2. `SECURITY_GUARDRAILS.md`
3. `API_DOCUMENTATION.md`

**Day 3: Deep Dive**
1. `COMPREHENSIVE_GAP_ANALYSIS.md`
2. `GAP_COMPLETION_ROADMAP.md`
3. Feature-specific docs as needed

---

## 🔍 Finding Documentation

### By Topic
- **Security**: `SECURITY_*.md`
- **Production**: `PRODUCTION_*.md`
- **Notifications**: `NOTIFICATION_*.md`
- **Database**: `DATABASE_*.md`, `BACKUP_*.md`
- **Monitoring**: `MONITORING_*.md`
- **API**: `API_*.md`
- **Architecture**: `ARCHITECTURE.md`
- **Gap Analysis**: `GAP_*.md`, `COMPREHENSIVE_*.md`

### By Importance
- **🔴 Critical**: Production readiness, security, monitoring
- **🟠 High**: Operations, infrastructure, compliance
- **🟡 Medium**: Development, features, testing
- **🟢 Low**: Reference, historical, contributing

---

## 📝 Maintenance Notes

- **Last Cleanup**: 2026-01-29 (43 files archived)
- **Active Docs**: 30 files
- **Total Docs**: ~472 files (including archived)
- **Index Updated**: 2026-01-29

---

**Quick Links:**
- [Production Readiness Status](./PRODUCTION_READINESS_STATUS.md)
- [Security Audit Summary](./SECURITY_AUDIT_SUMMARY.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
