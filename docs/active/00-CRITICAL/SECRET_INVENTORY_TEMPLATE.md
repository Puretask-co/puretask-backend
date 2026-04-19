# Secret Inventory Template (Off-Repo Use)

**Purpose:** Use this template to create your **private, off-repo** secret inventory. Do **not** commit a filled-in inventory (with Status, rotation dates, or real values) to the repo.

**How to use:** Copy the table below into a private doc (Notion, Google Doc, password-protected spreadsheet) and fill in **Provider**, **Scope**, **Rotation Method**, **Revocation Method**, and **Status** as you rotate. See [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md) § 1.2.

---

## Inventory Table (copy and maintain off-repo)

| Provider | Env Var Name | Scope | Used In | Rotation Method | Revocation Method | Blast Radius | Status |
|---------|--------------|-------|---------|------------------|-------------------|--------------|--------|
| Stripe | STRIPE_SECRET_KEY | prod/staging | src/config/env.ts, Stripe client | Dashboard → API keys → Create | Delete old key | payments | pending / rotated |
| Stripe | STRIPE_WEBHOOK_SECRET | prod/staging | src/config/env.ts, webhook handler | Dashboard → Webhooks → Signing secret | Delete old endpoint/secret | webhooks | pending / rotated |
| Neon/Postgres | DATABASE_URL | prod/staging | src/config/env.ts, db/client | Neon dashboard → Reset password / new role | Revoke old credentials | db | pending / rotated |
| App | JWT_SECRET | prod/staging | src/config/env.ts, lib/auth.ts | Generate: `openssl rand -hex 32` | N/A (rotate = invalidate all tokens) | auth | pending / rotated |
| SendGrid | SENDGRID_API_KEY | prod/staging | src/config/env.ts, email service | SendGrid dashboard | Revoke old key | email | pending / rotated |
| Twilio | TWILIO_ACCOUNT_SID | prod/staging | src/config/env.ts | Twilio console | N/A (rotate auth token) | sms | pending / rotated |
| Twilio | TWILIO_AUTH_TOKEN | prod/staging | src/config/env.ts | Twilio console → Regenerate | Revoke old token | sms | pending / rotated |
| OneSignal | ONESIGNAL_APP_ID | prod/staging | src/config/env.ts | OneSignal dashboard | N/A | push | pending / rotated |
| OneSignal | ONESIGNAL_API_KEY | prod/staging | src/config/env.ts | OneSignal dashboard | Regenerate | push | pending / rotated |
| n8n | N8N_WEBHOOK_SECRET | prod/staging | src/config/env.ts, n8n HMAC verify | Generate new secret; set in Railway + n8n | N/A | automation | pending / rotated |
| Sentry | SENTRY_DSN | prod/staging | src/config/env.ts | Sentry project settings | Revoke/regenerate DSN | monitoring | optional |
| Redis | REDIS_URL | prod/staging | src/config/env.ts | Provider dashboard | Revoke | rate limiting | optional |
| Slack | ALERT_SLACK_WEBHOOK_URL | prod/staging | src/config/env.ts | Slack app → Regenerate | Revoke | alerting | optional |
| Google | GOOGLE_CLIENT_SECRET | prod/staging | src/config/env.ts | Google Cloud Console | Revoke | calendar/OAuth | optional |
| Facebook | FACEBOOK_APP_SECRET | prod/staging | src/config/env.ts | Meta Developer | Regenerate | OAuth | optional |
| OpenAI | OPENAI_API_KEY | prod/staging | src/config/env.ts | OpenAI dashboard | Revoke | AI features | optional |
| n8n | N8N_API_KEY | prod/staging | src/config/env.ts | n8n settings | Regenerate | automation | optional |

---

## Required vs optional

- **Required (app will not start without these):** DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET. See [ENV_VARS_CHECKLIST.md](../../../ENV_VARS_CHECKLIST.md).
- **Optional:** All others; app may start with empty string or default. Rotate if they were exposed.

---

## Rotation order (non-negotiable)

1. Stripe Secret Key  
2. Stripe Webhook Signing Secret  
3. Database (Neon / Postgres)  
4. JWT Secret  
5. SendGrid  
6. Twilio  
7. OneSignal  
8. n8n webhook signing  
9. Infra / misc (Redis, Slack, Sentry, OAuth, OpenAI, n8n API)

---

**See also:** [SECTION_01_SECRETS.md](../sections/SECTION_01_SECRETS.md), [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md), [PHASE_1_IMPLEMENTATION_RUNBOOK.md](../PHASE_1_IMPLEMENTATION_RUNBOOK.md).
