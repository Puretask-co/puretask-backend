# Section 3 — Guardrails, CI & Repo Hygiene (Full Runbook)

**Objective:** Make it technically impossible for secrets, build artifacts, or unsafe patterns to enter the repo or CI again.

**Exit condition:** Even a rushed or careless commit cannot leak secrets or break security posture.

---

## 3.1 Why This Section

Sections 1–2 fix current damage. Section 3 ensures:
- No secrets can enter git (even accidentally)
- No legacy auth can sneak back in
- No bloated artifacts slow tooling or leak data
- CI enforces rules before merge/deploy

---

## 3.2 .gitignore (Canonical)

Must include at minimum:

```
.env
.env.*
node_modules/
dist/
.turbo/
.cache/
.DS_Store
*.log
.railway/
coverage/
```

**Rule:** If a file should never ship, it should never be tracked.

---

## 3.3 .env.example

- Contains all **required** env vars with safe placeholders.  
- Short comments per variable.  
- No real values.  
- New env vars added here in the same PR that uses them.

---

## 3.4 Pre-Commit Secret Scanning

- Hook scans **staged** files for: API key patterns, JWT secrets, Stripe/Twilio/SendGrid key formats.  
- Blocks commit if detected.  
- Bypass only with explicit override (logged, discouraged).

---

## 3.5 CI Secret Enforcement

- **Scan:** Entire repo (not just diffs); fail build if secrets or .env files present.  
- **Forbidden files:** CI explicitly checks for .env, .env.production, .env.staging, node_modules, dist → hard fail.  
- **Rule:** If CI fails, PR does not merge.

---

## 3.6 Auth Guardrails (Ties to Section 2)

- **Legacy auth import ban:** Lint/CI fails if legacy auth middleware is imported.  
- **Optional:** Static scan for mutating routes without requireAuth; runtime warning if protected route hit without req.user.

---

## 3.7 Railway Discipline

- Secrets live **only** in Railway.  
- No .env in repo; no copying env values into docs, comments, or examples.

---

## 3.8 GitHub

- **After history purge:** Force fresh clone; old SHAs invalid.  
- **Branch protection:** PR-only merges; CI passing required; no direct pushes to main; optional required review for infra/security.

---

## 3.9 Documentation Hygiene

- Classify docs: **Active** (in repo), **Archived** (moved out), **Vaulted** (zip/external).  
- Keeps Cursor fast; reduces accidental secret copy-paste.

---

## 3.10 Done Checklist

- [ ] .gitignore finalized and committed  
- [ ] .env.example exists and is accurate  
- [ ] Pre-commit secret scanning enabled  
- [ ] CI secret scanning enabled  
- [ ] CI fails on forbidden files  
- [ ] Legacy auth imports blocked by lint/CI  
- [ ] Railway is sole secret store  
- [ ] GitHub branch protections enabled  
- [ ] Docs cleaned and classified  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 3 checklist.
