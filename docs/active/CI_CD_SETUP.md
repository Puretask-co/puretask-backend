# CI/CD Pipeline Setup

**What it is:** GitHub Actions workflows for PureTask Backend: lint, typecheck, test, build, security scan, and optional deploy.  
**What it does:** Describes what runs on push/PR, required env vars, how to run migrations in CI or on deploy, and how to add staging/production deploy.  
**How we use it:** Read when changing or debugging CI; run the same commands locally to reproduce CI.

**Why it matters:** Every push runs lint, typecheck, and tests so broken code doesn’t merge. Security scan blocks secrets. Migrations in CI or on deploy keep schema and code in sync.

---

## Key terms (plain English)

| Term | Meaning |
|------|--------|
| **CI/CD** | On every push, scripts run lint, test, build. They block bad code from being merged. Optional: deploy to staging/production. |
| **Migration** | A script that updates the database (e.g. add a column). We run them in order so the DB matches the code. |
| **Production / Staging** | Production = live app; staging = copy for testing before production. |
| **Env vars / .env** | Configuration (API keys, DB URL) in environment variables or `.env`—never committed. |

---

## 1. Workflows

### 1.1 Main CI (`.github/workflows/ci.yml`)

**Triggers:** Push/PR to `main` or `develop`.

**Jobs:** lint (ESLint, format check, TypeScript) → test (with PostgreSQL) → build → security-scan (npm audit + secret scanning).

**What it does:** Prevents broken or insecure code from reaching main. Green CI = known-good state.

**Signs it’s working:** Green checkmarks on PRs; tests run on push; failed tests block merge.  
**Signs it’s not:** Red X on PRs; tests don’t run; build fails; you can merge failing code.

### 1.2 Test workflow (`.github/workflows/test.yml`)

**Triggers:** Push/PR to `main` or `develop`.

**Jobs:** backend-tests, optionally frontend-tests, e2e-tests (Playwright). PostgreSQL service container; optional coverage/Codecov.

**What it does:** Catches regressions in a clean environment that matches production.

### 1.3 Security scan (`.github/workflows/security-scan.yml`)

**Triggers:** Push/PR or manual.

**Jobs:** secret-scan (Gitleaks, forbidden files), auth-enforcement (legacy auth checks), build-check (no secrets in build).

**What it does:** Last line of defense against committed secrets.

### 1.4 Architecture checks (`.github/workflows/backend-architecture-checks.yml`)

**Triggers:** PRs that change `src/**`.

**Checks:** No direct SendGrid/Twilio in routes; service layer usage; event naming. Fails PR on violations.

---

## 2. Environment variables

**Required for CI:**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/puretask_test
JWT_SECRET=test-secret-key-for-ci-minimum-32-chars-long
STRIPE_SECRET_KEY=sk_test_fake_key_for_ci_testing_only
STRIPE_WEBHOOK_SECRET=whsec_test_secret_for_ci
N8N_WEBHOOK_SECRET=test-n8n-secret-for-ci
```

**Optional:** `REDIS_URL=""`, `USE_REDIS_RATE_LIMITING=false`, `ENABLE_METRICS=false`.

---

## 3. Database migrations in CI or on deploy

- **Commands:** `npm run db:migrate` (or project’s migrate script). See [DB/migrations/README.md](../DB/migrations/README.md).
- **Option A (CI):** Add a job that sets `DATABASE_URL` to staging, runs migrate, then deploy. Run only on push to deploy branch.
- **Option B (on server):** In deploy script, run migrate before `npm start`. Order: migrate then start.

---

## 4. Deployment (future)

**Staging:** Uncomment/configure deploy job in `ci.yml` for `develop` push; use `environment: staging`.  
**Production:** Deploy on `main` push; use `environment: production`.

**Options:** SSH (appleboy/ssh-action), Docker (build-push then pull on server), or cloud (AWS/GCP/Azure actions). See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway/production layout.

---

## 5. Testing the pipeline

**Locally (same as CI):**

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

**In CI:** Push a branch, open GitHub Actions, confirm all jobs pass.

**Failure scenarios:** Lint errors → fail lint; type errors → fail typecheck; broken tests → fail test; secrets → fail security-scan.

---

## 6. Troubleshooting

- **Tests pass locally, fail in CI:** Env vars, PostgreSQL/Node version, test isolation.
- **Build fails in CI:** TypeScript errors, missing deps in package.json, missing env.
- **Security scan fails:** Remove real secrets; add false positives to allowlist (e.g. `.gitleaks.toml`).

---

## 7. Best practices

1. Run tests before pushing: `npm test`
2. Fix lint locally: `npm run lint -- --fix`
3. Typecheck before commit: `npm run typecheck`
4. Never commit secrets; use env vars and `.env.example` (no values).
5. Keep workflows fast: cache deps, parallel jobs, skip when possible.

---

**Sources consolidated (2026-02):** Content merged from `docs/active/CI_CD_SETUP.md` and `docs/active/01-HIGH/CI_CD_SETUP.md`. Original 01-HIGH file archived to `docs/archive/raw/consolidated-sources/01-HIGH/`.
