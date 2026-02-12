# CI/CD Pipeline Setup Guide

## Overview

**What it is:** The high-level summary of our CI/CD setup (GitHub Actions workflows, env vars, deploy).  
**What it does:** Describes what runs on push/PR and how we run migrations and deploy.  
**How we use it:** Read this first; then use Workflows and the sections below when changing or debugging CI.

This document describes the CI/CD pipeline setup for PureTask Backend using GitHub Actions.

**What this doc is for:** Use it when you need to understand or change: (1) which workflows run on push/PR, (2) what env vars CI needs, (3) how to run migrations in CI or on deploy, and (4) how to add staging/production deploy. Each workflow and section below explains **what it does**, **why it matters**, and **how to verify**.

**Why CI/CD matters:** Every push runs lint, typecheck, and tests so broken code doesn't merge. Security scan blocks secrets. Migrations in CI or on deploy keep schema and code in sync so production doesn't hit "column does not exist."

**In plain English:** *CI* (Continuous Integration) = every time you push code, a robot runs lint, tests, and build. If something fails, the push/PR is marked red and we don't merge. *CD* (Continuous Deployment) = optionally, a robot also deploys the app to staging or production so we don't deploy by hand. *Migration* = a script that updates the database (e.g. add a column); we run them in order so the DB matches the code.

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

## Workflows

### 1. Main CI Pipeline (`.github/workflows/ci.yml`)
**Triggers**: Push/PR to `main` or `develop` branches

**What it does:** Runs lint, typecheck, tests, build, and security scan on every push and PR. If any job fails, the PR cannot merge (when branch protection is enabled).

**Why it matters:** Prevents broken or insecure code from reaching main. Green CI = confidence that the codebase is in a known-good state.

**Jobs**:
- **lint**: Runs ESLint and TypeScript type checking
- **test**: Runs all tests with PostgreSQL service
- **build**: Builds the application (runs after lint/test pass)
- **security-scan**: Runs npm audit and secret scanning

**How to Know It's Working**:
- ✅ Green checkmarks appear on PRs
- ✅ Tests run automatically on push
- ✅ Build succeeds
- ✅ Failed tests block merge

**How to Know It's NOT Working**:
- ❌ Red X marks on PRs
- ❌ Tests don't run automatically
- ❌ Build fails
- ❌ Can merge code that breaks tests

### 2. Test Workflow (`.github/workflows/test.yml`)
**What it is:** A workflow that runs backend (and optionally frontend/E2E) tests with a Postgres service container.  
**What it does:** Catches regressions in a clean environment that matches production.  
**How we use it:** Ensure tests pass before merge; use for coverage and optional Codecov; add frontend/E2E jobs if needed.

**Triggers**: Push/PR to `main` or `develop` branches

**What it does:** Runs backend (and optionally frontend and E2E) tests, often with a PostgreSQL service container so tests hit a real DB.

**Why it matters:** Catches regressions before deploy. Ensures tests run in a clean environment that matches production (same Node version, DB type).

**Jobs**:
- **backend-tests**: Backend unit/integration tests
- **frontend-tests**: Frontend tests (if frontend repo is included)
- **e2e-tests**: End-to-end tests with Playwright

**Features**:
- PostgreSQL service container
- Coverage reporting
- Codecov integration (optional)

### 3. Security Scan (`.github/workflows/security-scan.yml`)
**Triggers**: Push/PR or manual dispatch

**What it does:** Scans the repo for secrets (e.g. Gitleaks), checks for forbidden files (`.env`, `node_modules`), and optionally verifies the build doesn't leak secrets.

**Why it matters:** Last line of defense against committed secrets. Even if pre-commit is skipped, CI blocks the PR.

**Jobs**:
- **secret-scan**: Scans for secrets and forbidden files
- **auth-enforcement**: Checks for legacy auth middleware
- **build-check**: Verifies build doesn't contain secrets

**Features**:
- Gitleaks integration
- Pattern-based secret detection
- Forbidden file checks (.env, node_modules, etc.)

### 4. Architecture Checks (`.github/workflows/backend-architecture-checks.yml`)
**Triggers**: PRs that modify `src/**`

**What it does:** Enforces architectural rules (e.g. no direct SendGrid/Twilio in routes, service layer usage, event naming). Fails the PR if violations are found.

**Why it matters:** Keeps the codebase consistent and prevents shortcuts that bypass the service layer or notification abstractions.

**Checks**:
- Blocks direct SendGrid/Twilio calls
- Warns about large route files
- Verifies service layer usage
- Checks event naming conventions

## Environment Variables

### Required for CI
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/puretask_test
JWT_SECRET=test-secret-key-for-ci-minimum-32-chars-long
STRIPE_SECRET_KEY=sk_test_fake_key_for_ci_testing_only
STRIPE_WEBHOOK_SECRET=whsec_test_secret_for_ci
N8N_WEBHOOK_SECRET=test-n8n-secret-for-ci
```

### Optional
```bash
REDIS_URL=""  # Empty for CI (Redis not needed for tests)
USE_REDIS_RATE_LIMITING=false
ENABLE_METRICS=false  # Disable metrics in CI
```

## Database Migrations

### Runner (local and CI)
- **Status:** Migration runner added. See [ADDRESS_REMAINING_GAPS.md](../active/02-MEDIUM/ADDRESS_REMAINING_GAPS.md).
- **Commands:** `npm run migrate:status`, `npm run migrate:up` (requires `DATABASE_URL`).
- **Script:** `scripts/migrate-runner.js` — tracks applied migrations in `schema_migrations`; runs pending `DB/migrations/*.sql` and `DB/migrations/hardening/*.sql`.

### Running migrations in CI or on deploy
- **Option A (CI job):** Add a job that sets `DATABASE_URL` to staging DB (secret), runs `npm run migrate:up`, then triggers deploy. Run only on push to `staging` or `main` if you deploy from main.
- **Option B (on server):** In deploy script, run `npm run migrate:up` before `npm start` (or before starting the process). Document the order: migrate then start.

---

## Deployment (Future)

### Staging Deployment
Uncomment and configure the `deploy` job in `ci.yml`:
```yaml
deploy:
  name: Deploy to Staging
  runs-on: ubuntu-latest
  needs: [build, test, security-scan]
  if: github.ref == 'refs/heads/develop' && github.event_name == 'push'
  environment:
    name: staging
    url: https://staging-api.puretask.com
```

### Production Deployment
```yaml
deploy:
  name: Deploy to Production
  runs-on: ubuntu-latest
  needs: [build, test, security-scan]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  environment:
    name: production
    url: https://api.puretask.com
```

## Deployment Options

### Option 1: SSH Deployment
```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_KEY }}
    script: |
      cd /var/www/puretask-backend
      git pull
      npm ci --production
      npm run build
      pm2 restart puretask-backend
```

### Option 2: Docker Deployment
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: puretask/backend:${{ github.sha }}
    
- name: Deploy to server
  run: |
    ssh ${{ secrets.SSH_HOST }} "docker pull puretask/backend:${{ github.sha }} && docker-compose up -d"
```

### Option 3: Cloud Provider (AWS/GCP/Azure)
- Use provider-specific actions (e.g., `aws-actions/configure-aws-credentials`)
- Deploy to ECS, Cloud Run, or App Service

## Testing the Pipeline

### Test Locally
```bash
# Run the same commands CI runs
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

### Test in CI
1. Create a test branch
2. Push to trigger workflow
3. Check GitHub Actions tab
4. Verify all jobs pass

### Test Failure Scenarios
- Push code with lint errors → Should fail lint job
- Push code with type errors → Should fail typecheck job
- Push code that breaks tests → Should fail test job
- Push code with secrets → Should fail security-scan job

## Troubleshooting

### Tests Fail in CI but Pass Locally
- Check environment variables match
- Verify PostgreSQL version matches
- Check Node.js version matches
- Review test isolation issues

### Build Fails in CI
- Check TypeScript errors
- Verify all dependencies are in package.json
- Check for missing environment variables

### Security Scan Fails
- Review detected secrets
- Add false positives to `.gitleaks.toml` allowlist
- Remove actual secrets from code

## Best Practices

1. **Always run tests before pushing**
   ```bash
   npm test
   ```

2. **Fix lint errors locally**
   ```bash
   npm run lint -- --fix
   ```

3. **Check types before committing**
   ```bash
   npm run typecheck
   ```

4. **Don't commit secrets**
   - Use environment variables
   - Add to `.env.example` (without values)
   - Never commit `.env` files

5. **Keep workflows fast**
   - Cache dependencies
   - Run tests in parallel
   - Skip unnecessary jobs when possible

## Next Steps

1. **Set up deployment**: Configure production deployment
2. **Add notifications**: Slack/email on failures
3. **Add performance tests**: Include in CI
4. **Add database migrations**: Run in deployment
5. **Add rollback**: Automatic rollback on failure
