# Security Guardrails & Repository Hygiene

**Last Updated**: 2025-01-15  
**Status**: Active

## Overview

**What it is:** The set of rules and tools that keep secrets out of git and enforce safe auth and repo hygiene.  
**What it does:** Prevents accidental secret commits, blocks legacy auth, and keeps CI as the gate.  
**How we use it:** Read this doc when setting up a new machine or onboarding; follow .gitignore, pre-commit, and CI rules.

This document describes the security guardrails and repository hygiene measures that prevent secrets, build artifacts, and unsafe patterns from entering the repository or production pipeline.

**What this doc is for:** Use it when you need to understand or set up: (1) what must never be committed (.gitignore, .env.example), (2) how secrets are blocked (pre-commit and CI), (3) auth rules (legacy auth ban, requireAuth), and (4) Railway and GitHub settings. Each section below explains **what it is**, **why it matters**, and **how to verify**.

**Why guardrails matter:** One committed API key or `.env` file can expose production. Pre-commit and CI catch secrets before they merge. Auth guardrails prevent accidental use of deprecated or unsafe middleware.

**In plain English:** *Secrets* = API keys, passwords, tokens—things that must never be in the code or in git. *Pre-commit* = a check that runs right before you commit; if it finds a secret, the commit is blocked. *CI* = the automated checks that run when you push; they also block secrets so nothing slips through.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Core Principles

**What it is:** Five high-level rules that guide all guardrails (secrets, auth, artifacts, CI, single source of truth).  
**What it does:** Ensures we don't commit secrets, don't use legacy auth, keep tooling lean, and let CI enforce.  
**How we use it:** When in doubt, follow these; any new process should align with them.

1. **Secrets never enter git** - Even accidentally
2. **Legacy auth cannot sneak back in** - Enforced by lint/CI
3. **No bloated artifacts** - Keep tooling fast
4. **CI enforces rules** - Before code merges or deploys
5. **Single source of truth** - Railway for secrets, canonical auth for routes

## Repository Hygiene

### .gitignore (Canonical)

**What it is:** The list of files and directories Git must never track. If a path is in `.gitignore`, `git add` won't stage it and it won't be committed.

**Why it matters:** Prevents accidental commit of `.env`, `node_modules`, `dist`, logs, and secrets. If something should never ship, it should never be tracked.

The `.gitignore` file is the single source of truth for ignored files. It includes:

- **Environment files**: `.env`, `.env.*` (except `.env.example`)
- **Dependencies**: `node_modules/`
- **Build artifacts**: `dist/`, `build/`, `.cache/`, `.turbo/`
- **Logs**: `*.log`
- **IDE files**: `.vscode/`, `.idea/`
- **OS files**: `.DS_Store`, `Thumbs.db`
- **Secrets**: `*.pem`, `*.key`, `*.cert`, `secrets/`, `credentials/`

**Rule**: If a file should never ship, it should never be tracked.

### .env.example (Required Contract)

**What it is:** A template file that lists every environment variable the app needs, with placeholder values (e.g. `YOUR_JWT_SECRET`) and optional comments. Never contains real secrets.  
**What it does:** Tells developers and CI what vars to set; keeps the contract in one place.  
**How we use it:** Copy to .env and fill in real values locally; add new required vars to .env.example in the same PR as code.

**Why it matters:** New developers and CI know what vars to set. If a new feature needs a new var, it must be added to `.env.example` in the same PR so the contract stays accurate.

The `.env.example` file serves as a contract for all required environment variables:

- Contains all required env vars
- Safe placeholder values (e.g., `YOUR_JWT_SECRET`)
- Short inline comments
- Always kept up-to-date
- New env vars must be added here in the same PR

**Rule**: No real values, always up-to-date.

## Secret Prevention

**What it is:** Pre-commit and CI checks that block commits and PRs if secrets or forbidden files are detected.  
**What it does:** Stops secrets from entering the repo at commit time and at merge time.  
**How we use it:** Install pre-commit via the setup script; rely on CI as the authoritative gate; don't bypass without good reason.

### Pre-Commit Scanning (Local Enforcement)

**What it is:** A Git hook that runs before every commit. It scans only staged files for secret patterns (API keys, JWT secrets, etc.). If it finds a match, the commit is blocked.  
**What it does:** Catches secrets before they are pushed; fast because it only scans staged files.  
**How we use it:** Run `scripts/setup-pre-commit.sh` (or .ps1 on Windows); fix or allowlist any false positives.

**Why it matters:** Catches secrets before they're pushed. Can be bypassed with `--no-verify`, but CI will still catch secrets, so bypass only skips the local check.

A pre-commit hook scans staged files for:

- API key patterns (Stripe, SendGrid, Twilio, OpenAI, Google)
- JWT secrets
- Webhook secrets
- Common secret variable names with actual values

**Behavior**:
- Blocks commit if secrets detected
- Can be bypassed with `--no-verify` (logged and discouraged)
- Scans only staged files for speed

**Setup**:
```bash
# Linux/Mac
bash scripts/setup-pre-commit.sh

# Windows
powershell scripts/setup-pre-commit.ps1
```

### CI-Level Secret Scanning (Authoritative Gate)

**What it is:** A GitHub Actions job that runs on every push/PR. It checks for forbidden files (e.g. `.env`) and runs a secret scanner (e.g. Gitleaks) on the whole repo. If it finds secrets or forbidden files, the workflow fails and the PR cannot merge.  
**What it does:** Ensures no secret or forbidden file reaches main even if pre-commit was bypassed.  
**How we use it:** Require this job in branch protection; fix any failure before merging.

**Why it matters:** Pre-commit can be bypassed; CI cannot. CI is the authoritative gate—no secret reaches the main branch if this job is required and passing.

GitHub Actions workflow (`.github/workflows/security-scan.yml`) performs:

1. **Forbidden file check**:
   - Fails if `.env`, `.env.production`, `.env.staging` found
   - Fails if `node_modules` or `dist` tracked in git

2. **Secret pattern scanning**:
   - Uses Gitleaks for comprehensive secret detection
   - Scans entire repo (not just diffs)
   - Checks for common secret patterns

3. **Build output verification**:
   - Ensures no secrets leaked into compiled code

**Rule**: If CI fails, the PR does not merge. No exceptions.

## Auth Guardrails

### Legacy Auth Import Ban

**What it is:** ESLint and CI block imports from the old auth middleware path. Only `requireAuth` from `src/middleware/authCanonical.ts` is allowed for protecting routes.

**Why it matters:** Prevents accidental use of deprecated or inconsistent auth logic. One canonical auth middleware reduces bugs and makes security review easier.

Enforced at multiple levels:

1. **ESLint Rule**: `no-restricted-imports` blocks imports from `src/middleware/auth`
2. **CI Check**: GitHub Actions verifies no legacy auth imports
3. **Runtime Warning**: Deprecation warnings logged if legacy auth is used

**Rule**: Only `requireAuth` from `src/middleware/authCanonical.ts` is allowed.

### Route Safety Assertions
**What it is:** The rule that all mutating routes must use `requireAuth`.  
**What it does:** Ensures no protected action is reachable without auth.  
**How we use it:** Apply requireAuth to any route that changes data; verify via ESLint and code review.

All mutating routes must use `requireAuth`. This is verified by:

- ESLint rules
- CI checks
- Code review

## Railway Environment Discipline

### Single Source of Truth

**Secrets live only in Railway**:

- No `.env` files in repo
- No copying env values into docs, comments, or examples
- Railway dashboard is the only place for production secrets

### Deployment Safety Rules
**What it is:** Checks to run before and after deploy (CI, secret scan, healthcheck).  
**What it does:** Reduces risk of deploying broken or insecure code.  
**How we use it:** Ensure CI and secret scan pass before deploy; run healthcheck and smoke tests after.

**Before deploy**:
- ✅ CI passes
- ✅ Secret scan passes
- ✅ Auth rules pass

**After deploy**:
- ✅ Healthcheck runs
- ✅ Critical routes smoke-tested

## GitHub Branch Protection

### Recommended Settings

Configure in GitHub repository settings:

1. **Require PR reviews** (optional, recommended for security changes)
2. **Require status checks to pass**:
   - `secret-scan`
   - `auth-enforcement`
   - `build-check`
3. **Require branches to be up to date**
4. **Block force pushes to main**
5. **Block deletion of main branch**

**Note**: These must be configured manually in GitHub UI.

## Documentation Hygiene

**What it is:** How we organize docs (active vs archived vs vaulted) and keep them free of secrets.  
**What it does:** Keeps Cursor/indexing fast and avoids accidental secret copy-paste from old docs.  
**How we use it:** Put current docs in docs/active; archive obsolete ones to docs/archive; never put real secrets in any doc.

### Doc Classification
**What it is:** Categories for docs (active, archived, vaulted).  
**What it does:** Tells us where to find current vs historical material.  
**How we use it:** Active = in use; archived = old but kept; vaulted = sensitive, stored elsewhere.

Docs are classified as:

- **Active**: Kept in repo (`docs/active/`)
- **Archived**: Moved to `docs/archive/` (excluded from Cursor indexing)
- **Vaulted**: External storage (for sensitive historical docs)

This keeps Cursor fast and prevents accidental secret copy-paste.

## Setup Instructions

### 1. Install Pre-Commit Hook

```bash
# Linux/Mac
bash scripts/setup-pre-commit.sh

# Windows
powershell scripts/setup-pre-commit.ps1
```

### 2. Verify .env.example is Up-to-Date
**What it is:** Checking that every required env var in code is documented in .env.example.  
**What it does:** Keeps the env contract accurate for developers and CI.  
**How we use it:** Compare env.ts (or config) with .env.example; add any missing vars.

```bash
# Compare env.ts with .env.example
# All required vars should be in .env.example
```

### 3. Configure GitHub Branch Protection

1. Go to repository Settings → Branches
2. Add rule for `main` branch
3. Enable required status checks
4. Enable "Require pull request reviews" (optional)

### 4. Test Secret Scanning
**What it is:** A quick test that committing a file with a test secret is blocked.  
**What it does:** Confirms pre-commit (and CI) are working.  
**How we use it:** Run the commands below; commit should fail; remove test file after.

```bash
# Try committing a file with a test secret (should fail)
echo "STRIPE_SECRET_KEY=<redacted>" > test.env
git add test.env
git commit -m "test"  # Should be blocked
rm test.env
```

## Monitoring

### What Gets Logged

- Pre-commit hook bypasses (via `--no-verify`)
- CI secret scan failures
- Legacy auth usage (runtime warnings)
- Forbidden file detections

### Alerting
**What it is:** Notifications when security checks fail (CI, pre-commit bypass, secret matches).  
**What it does:** Ensures we notice and fix guardrail failures quickly.  
**How we use it:** Configure Slack/email/PagerDuty for security workflow failures; optionally alert on bypass patterns.

Set up alerts for:
- CI failures on security checks
- Pre-commit hook bypasses (if possible)
- Secret pattern matches in code reviews

## Troubleshooting

### Pre-Commit Hook Not Running

```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit
```

### False Positives
**What it is:** A non-secret string (e.g. example key) that the scanner flags as a secret.  
**What it does:** Tells how to allowlist safely so we don't block legitimate content.  
**How we use it:** Add the pattern to .gitleaks.toml allowlist with a short comment; avoid allowing real secret shapes.

If a pattern is incorrectly flagged as a secret:

1. Add to `.gitleaks.toml` allowlist
2. Document why it's safe
3. Update this guide if needed

### Bypassing Pre-Commit (Emergency Only)

```bash
# NOT RECOMMENDED - Only in emergencies
git commit --no-verify
```

**Note**: CI will still catch secrets, so this only bypasses local check.

## Success Criteria ✅

**What it is:** A checklist that guardrails are in place (gitignore, pre-commit, CI, auth, Railway, docs).  
**What it does:** Confirms we're done with initial setup and nothing was skipped.  
**How we use it:** Tick each item when verified; enable branch protection manually in GitHub.

- [x] .gitignore finalized and committed
- [x] .env.example exists and is accurate
- [x] Pre-commit secret scanning enabled
- [x] CI secret scanning enabled
- [x] CI fails on forbidden files
- [x] Legacy auth imports blocked by lint/CI
- [x] Railway is sole secret store (documented)
- [x] Docs cleaned and classified
- [ ] GitHub branch protections enabled (manual step)

---

**Security guardrails are active!** 🛡️

Secret leaks are structurally prevented, security regressions fail automatically, and new contributors cannot break core rules.
