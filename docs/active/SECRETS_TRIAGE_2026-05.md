# Secrets Triage — 2026-05-13

**Scanned by:** Manual `Grep`-based working-tree sweep (gitleaks not installed locally; gitleaks-action is already wired in `.github/workflows/security-scan.yml`).
**Status:** Working-tree leak files removed. **Production rotation (0.1) still required.**

---

## What was scanned

- Full working tree, all branches' checked-out files
- Patterns: known leaked JWT hex, `sk_live_`/`sk_test_`, `AKIA`, `ghp_`, `xox[bpars]`, common env-var assignments (`JWT_SECRET=`, `DATABASE_URL=`, `STRIPE_SECRET_KEY=`, etc.)
- NOT scanned: full git history. gitleaks-action runs that on every push.

## Findings

### 1. Leaked JWT_SECRET — confirmed in 5 files (working tree)

The compromised secret (the `c2f5bd0a…68c8` hex string from playbook 0.1) appears in:

| File | Reason | Action |
|---|---|---|
| `docs/_archive/cleanup-2026-01-29/JWT_AUTHENTICATION_GUIDE.md` | Original leak, called out in playbook 0.1 | **DELETED** |
| `docs/archive/raw/legacy_docs/JWT_AUTHENTICATION_GUIDE.md` | Duplicate of above in different archive folder | **DELETED** |
| `docs/archive/raw/legacy_docs/JWT_QUICK_REFERENCE.md` | Different doc, same secret pasted | **DELETED** |
| `docs/archive/raw/uncategorized/JWT_QUICK_REFERENCE.md` | Duplicate of the QUICK_REFERENCE | **DELETED** |
| `docs/active/AUDIT_CORRECTION_PLAYBOOK.md` | The playbook itself quotes the leaked value to identify it | **KEPT** (intentional reference) |

**Important:** deleting the working-tree copies does not undo the leak — every cloned copy and every git revision still contains the secret. **Playbook 0.1 rotation is still required.** This step only stops new clones from seeing the secret in plain view.

### 2. Stripe keys — none real

All `sk_test_` / `sk_live_` occurrences are placeholders (`sk_test_xxxxx`, `sk_test_YOUR_…`). No real Stripe keys in the working tree.

### 3. AWS / GitHub / Slack tokens — none found

No matches for `AKIA…`, `ghp_…`, `xox[bpars]-…` patterns.

### 4. Other env-var assignments — all placeholders

`JWT_SECRET=`, `DATABASE_URL=`, `SENDGRID_API_KEY=`, `TWILIO_AUTH_TOKEN=`, `REDIS_URL=` matches are all either placeholders (`your-key`, `YOUR_…`, `<...>`) or generator commands (`openssl rand -hex 32`).

## Recommendations

1. **Rotate `JWT_SECRET` in Railway** (playbook 0.1). This is the only action that actually protects you — the leaked hex is permanent in git history.
2. Confirm the CI gitleaks step on `security-scan.yml:68` is required-status on PRs to `main`.
3. The `.gitleaks.toml` allowlist should be reviewed quarterly so it doesn't accumulate stale exemptions.

## What is not done

- Full git-history scan locally (gitleaks-action already does this in CI; running it locally would require installing gitleaks).
- `git filter-repo` / BFG history rewrite — out of scope for this triage; the rotation in 0.1 is the actual mitigation.
