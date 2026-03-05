# Security Incident Response - Secret Exposure

## Date
[Current Date]

## Issue
Secrets were found in git history and local .env file.

## What Was Found
1. **Stripe LIVE keys** in git commit history
2. **Real Stripe LIVE key** in local `.env` file
3. Multiple commits containing `sk_live_` pattern

## Immediate Actions Taken
1. ✅ Pre-commit hook installed to prevent future commits
2. ✅ `.env` files added to `.gitignore`
3. ⚠️ **REQUIRED**: Rotate all exposed secrets

## Secrets That Need Rotation

### Critical (Rotate Immediately)
- [ ] **Stripe Live API Key** (`sk_live_*`)
  - Revoke at: https://dashboard.stripe.com/apikeys
  - Generate new key
  - Update Railway environment variable
  
- [ ] **Stripe Webhook Secret** (`whsec_*`)
  - Generate new webhook secret in Stripe dashboard
  - Update Railway environment variable
  - Update webhook endpoint in Stripe

- [ ] **JWT_SECRET**
  - Generate new secret: `openssl rand -hex 32`
  - Update Railway environment variable
  - **Note**: All users will need to re-login

### High Priority
- [ ] **Database Password** (if DATABASE_URL was exposed)
  - Change password in Neon/PostgreSQL
  - Update Railway DATABASE_URL

- [ ] **N8N_WEBHOOK_SECRET**
  - Generate new secret
  - Update Railway and n8n configuration

### Medium Priority (if exposed)
- [ ] SendGrid API Key
- [ ] Twilio Account SID and Auth Token
- [ ] OpenAI API Key
- [ ] Google OAuth Client Secret
- [ ] Facebook App Secret

## Git History Cleanup

### If Repository is Private
Consider using `git filter-branch` or BFG Repo-Cleaner to remove secrets from history:
```bash
# WARNING: This rewrites history - coordinate with team
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### If Repository is Public or Shared
- Assume secrets are compromised
- Do NOT attempt to remove from history (it's too late)
- Focus on rotating all secrets immediately
- Document the incident

## Prevention Measures Implemented
1. ✅ Pre-commit hook for secret scanning
2. ✅ `.gitignore` updated to exclude all `.env` files
3. ✅ CI/CD secret scanning workflow
4. ✅ ESLint rule to prevent legacy auth usage

## Verification Checklist
- [ ] All Stripe keys rotated
- [ ] All webhook secrets updated
- [ ] JWT_SECRET rotated
- [ ] Database password changed (if needed)
- [ ] All API keys rotated
- [ ] Railway environment variables updated
- [ ] Application tested with new secrets
- [ ] Team notified of secret rotation

## Notes
- Pre-commit hook will prevent future accidental commits
- All secrets should live ONLY in Railway environment variables
- Never commit `.env` files, even test ones
- Use `.env.example` for documentation only
