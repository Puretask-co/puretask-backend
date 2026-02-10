# CI/CD Pipeline Setup Guide

## Overview
This document describes the CI/CD pipeline setup for PureTask Backend using GitHub Actions.

## Workflows

### 1. Main CI Pipeline (`.github/workflows/ci.yml`)
**Triggers**: Push/PR to `main` or `develop` branches

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
**Triggers**: Push/PR to `main` or `develop` branches

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
