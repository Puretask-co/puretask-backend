# Section 1 — Secrets & Incident Response (Full Runbook)

**Objective:** Neutralize leaked credentials, restore trust, ensure secrets never re-enter source control.

**Exit condition:** It is cryptographically and operationally impossible for any leaked secret to be reused.

---

## 1.1 Incident Classification

**Confirmed facts:**
- .env with real secrets existed in repo
- Repo was pushed to GitHub
- ZIP was shared
- Railway is the deployment target

**Posture:** Assume full compromise; assume all secrets are invalid; treat git history as hostile.

---

## 1.2 Secret Inventory (Single Source of Truth)

Before touching providers, create a **private, off-repo** inventory.

| Field | Description |
|-------|-------------|
| Provider | Stripe / Railway / Neon / etc. |
| Env Var Name | STRIPE_SECRET_KEY |
| Scope | prod / staging |
| Used In | file(s) / service(s) |
| Rotation Method | dashboard / regenerate |
| Revocation Method | delete / disable |
| Blast Radius | payments / auth / db |
| Status | pending / rotated / revoked |

**Rule:** If a secret is not in this inventory, it does not exist.

**Inventory categories (typical):**
- **Payments:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, Stripe Connect keys
- **Auth:** JWT_SECRET, refresh/cookie signing secrets
- **Database:** DATABASE_URL / NEON_DATABASE_URL
- **Messaging:** SENDGRID_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID, ONESIGNAL_REST_API_KEY
- **Automation:** N8N_WEBHOOK_SECRET, HMAC signing secret
- **Infra:** REDIS_URL, SENTRY_DSN (treat as sensitive)

---

## 1.3 Rotation Order (Non-Negotiable)

1. Stripe Secret Key  
2. Stripe Webhook Signing Secret  
3. Database (Neon / Postgres)  
4. JWT / Auth Secrets  
5. SendGrid  
6. Twilio  
7. OneSignal  
8. n8n / internal webhook signing  
9. Infra / misc (Redis, admin tokens)

---

## 1.4 Provider Runbooks

### 1.4.1 Stripe Secret Key

1. In Stripe Dashboard: create new **LIVE** secret key; name it (e.g. puretask-backend-live-2026-01-24).  
2. Update Railway env: replace `STRIPE_SECRET_KEY`.  
3. Deploy backend.  
4. Verify: create test PaymentIntent; no auth errors in logs.  
5. Delete old key in Stripe (not disable — delete).

### 1.4.2 Stripe Webhook Signing Secret

1. In Stripe webhooks: create new endpoint or rotate signing secret.  
2. Update Railway `STRIPE_WEBHOOK_SECRET`.  
3. Deploy backend.  
4. Trigger Stripe test webhook; confirm 200 and signature validation passes.  
5. Delete old webhook secret.

### 1.4.3 Database (Neon)

1. Rotate DB password or create new app-specific role.  
2. Update Railway `DATABASE_URL`.  
3. Deploy backend.  
4. Verify: `/health` passes; basic DB query succeeds.  
5. Revoke old credentials.

### 1.4.4 JWT Secret

1. Generate new high-entropy secret (32+ bytes).  
2. Update Railway `JWT_SECRET`.  
3. Deploy backend.  
4. Confirm: new logins work; old tokens rejected. (Forced logout is acceptable.)

### 1.4.5 SendGrid / Twilio / OneSignal

For each: generate new key/token → update Railway → deploy → send test message → revoke old key.

### 1.4.6 n8n / Internal Webhook Signing

1. Generate new HMAC signing secret.  
2. Update Railway and n8n env.  
3. Deploy both.  
4. Verify: valid signature passes; invalid signature fails.

---

## 1.5 Secret Purge Plan

- **Working tree:** Delete .env, .env.production, .env.staging; keep only .env.example.  
- **Git history:** Rewrite history to remove .env* (BFG or git filter-repo); force-push; require fresh clone.  
- **Artifacts:** Delete old build logs; remove ZIPs from shared storage.

---

## 1.6 Guardrails (Before Leaving Section 1)

- .gitignore includes: .env*, node_modules/, dist/  
- .env.example exists with safe placeholders  
- Rule: secrets never enter git, even temporarily  
- (Automated enforcement in Section 3)

---

## 1.7 Done Checklist

- [ ] Secret inventory completed (use [SECRET_INVENTORY_TEMPLATE.md](../00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md) off-repo)
- [ ] Stripe keys rotated & old deleted  
- [ ] Stripe webhook secrets rotated  
- [ ] Database credentials rotated  
- [ ] JWT secret rotated  
- [ ] Messaging provider keys rotated  
- [ ] Internal webhook secrets rotated  
- [ ] Secrets removed from working tree  
- [ ] Git history purge planned or executed  
- [ ] Railway is the only secret store  

**Execute:** [PHASE_1_USER_RUNBOOK.md](../00-CRITICAL/PHASE_1_USER_RUNBOOK.md) for step-by-step rotate, purge, verify.

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 1 checklist. Incident response: [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md).
