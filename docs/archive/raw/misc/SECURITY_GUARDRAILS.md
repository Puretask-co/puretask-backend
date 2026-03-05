# Security Guardrails & Repository Hygiene

**Last Updated**: 2025-01-15  
**Status**: Active

## Overview

This document describes the security guardrails and repository hygiene measures that prevent secrets, build artifacts, and unsafe patterns from entering the repository or production pipeline.

## Core Principles

1. **Secrets never enter git** - Even accidentally
2. **Legacy auth cannot sneak back in** - Enforced by lint/CI
3. **No bloated artifacts** - Keep tooling fast
4. **CI enforces rules** - Before code merges or deploys
5. **Single source of truth** - Railway for secrets, canonical auth for routes

## Repository Hygiene

### .gitignore (Canonical)

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

The `.env.example` file serves as a contract for all required environment variables:

- Contains all required env vars
- Safe placeholder values (e.g., `YOUR_JWT_SECRET`)
- Short inline comments
- Always kept up-to-date
- New env vars must be added here in the same PR

**Rule**: No real values, always up-to-date.

## Secret Prevention

### Pre-Commit Scanning (Local Enforcement)

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

Enforced at multiple levels:

1. **ESLint Rule**: `no-restricted-imports` blocks imports from `src/middleware/auth`
2. **CI Check**: GitHub Actions verifies no legacy auth imports
3. **Runtime Warning**: Deprecation warnings logged if legacy auth is used

**Rule**: Only `requireAuth` from `src/middleware/authCanonical.ts` is allowed.

### Route Safety Assertions

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

### Doc Classification

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
