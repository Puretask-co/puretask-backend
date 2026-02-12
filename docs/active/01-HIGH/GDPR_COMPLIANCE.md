# GDPR Compliance Guide

## Overview

**What it is:** The high-level summary of our GDPR-related features (data export, deletion, consent).  
**What it does:** Describes what we support for EU/user data rights and how to use it.  
**How we use it:** Read this first; then use GDPR Rights Implemented and the sections below when implementing or verifying compliance.

This guide covers GDPR (General Data Protection Regulation) compliance features for PureTask Backend.

**What this doc is for:** Use it when you need to (1) implement or verify GDPR-style endpoints (data export, deletion, consent), (2) understand what data we export or delete, or (3) document retention or consent for compliance. Each right below explains **what the endpoint does**, **how to call it**, and **what the response contains**.

**Why it matters:** EU users and many B2B contracts require data export and deletion. This doc ensures the backend supports those flows and that the team knows how to use them.

**In plain English:** GDPR is a law that gives users the right to get a copy of their data and the right to have their data deleted. This doc describes the API endpoints we use for that: "export my data" and "delete my account" and "what did I consent to." Use it when a user or a partner asks how we handle those requests.

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

## GDPR Rights Implemented

**What it is:** The list of GDPR-style endpoints we implement (access, deletion, consent).  
**What it does:** Shows what a user or partner can request and how we respond.  
**How we use it:** Use these endpoints when a user asks for their data or deletion; document in privacy policy.

### 1. Right to Access (Data Export)
**What it is:** The endpoint that returns all personal data we hold for the authenticated user.  
**What it does:** Satisfies "right to access" / data portability.  
**How we use it:** Call `GET /user/data/export` with a valid Bearer token; return the JSON to the user or use for migration.

**Endpoint**: `GET /user/data/export`

**Description**: Users can export all their personal data in JSON format.

**Usage**:
```bash
curl -X GET http://localhost:4000/user/data/export \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "...",
      "email": "...",
      "role": "...",
      ...
    },
    "jobs": [...],
    "payments": [...],
    "creditTransactions": [...],
    "messages": [...],
    "consentHistory": [...]
  }
}
```

### 2. Right to be Forgotten (Data Deletion)
**Endpoint**: `DELETE /user/data`

**Description**: Users can request deletion of their personal data. Data is anonymized rather than deleted to preserve business/legal records.

**Usage**:
```bash
curl -X DELETE http://localhost:4000/user/data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What Gets Anonymized**:
- Email address → `deleted_{userId}_{timestamp}@deleted.puretask.com`
- Password hash → cleared
- Phone number → NULL
- First name → NULL
- Last name → NULL
- Default address → NULL
- Message content → `[Message deleted]`

**What's Preserved** (for business/legal records):
- Jobs (with anonymized user references)
- Payments (with anonymized user references)
- Credit transactions (with anonymized user references)

### 3. Consent Management
**Endpoints**:
- `POST /user/consent` - Record consent
- `GET /user/consent/:type` - Get consent status

**Consent Types**:
- `privacy_policy` - Privacy policy acceptance
- `terms_of_service` - Terms of service acceptance
- `marketing` - Marketing communications consent

**Usage**:
```bash
# Record consent
curl -X POST http://localhost:4000/user/consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "privacy_policy",
    "accepted": true,
    "version": "2024-01-01"
  }'

# Get consent status
curl -X GET http://localhost:4000/user/consent/privacy_policy \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database Schema

### User Consents Table
Created automatically on first use:

```sql
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type, version)
);
```

## Implementation Checklist

### ✅ Completed
- [x] Data export endpoint (`GET /user/data/export`)
- [x] Data deletion endpoint (`DELETE /user/data`)
- [x] Consent recording (`POST /user/consent`)
- [x] Consent retrieval (`GET /user/consent/:type`)
- [x] Data anonymization (preserves business records)
- [x] Consent history tracking

### ⚠️ Recommended Additions

1. **Privacy Policy Display**
   - Show privacy policy on signup
   - Track acceptance via consent endpoint
   - Store acceptance timestamp

2. **Terms of Service Display**
   - Show terms on signup
   - Track acceptance via consent endpoint
   - Store acceptance timestamp

3. **Data Processing Logs**
   - Log all data access
   - Log data exports
   - Log data deletions
   - Maintain audit trail

4. **Data Retention Policy**
   - Define retention periods
   - Automate data cleanup
   - Document retention periods

5. **Third-Party Data Sharing**
   - Document third-party integrations
   - List data shared with third parties
   - Include in data export

## Privacy Policy Requirements

### What to Include

1. **Data Collection**
   - What data is collected
   - Why data is collected
   - Legal basis for processing

2. **Data Usage**
   - How data is used
   - Who has access to data
   - Data sharing with third parties

3. **User Rights**
   - Right to access
   - Right to deletion
   - Right to rectification
   - Right to portability
   - Right to object

4. **Data Security**
   - Security measures
   - Data encryption
   - Access controls

5. **Contact Information**
   - Data protection officer (if applicable)
   - Contact for privacy inquiries
   - Supervisory authority

## Terms of Service Requirements

### What to Include

1. **Service Description**
   - What the service provides
   - User responsibilities
   - Service limitations

2. **User Obligations**
   - Acceptable use policy
   - Prohibited activities
   - Account security

3. **Payment Terms**
   - Payment processing
   - Refund policy
   - Cancellation policy

4. **Liability**
   - Service availability
   - Limitation of liability
   - Indemnification

5. **Dispute Resolution**
   - Governing law
   - Dispute process
   - Arbitration (if applicable)

## Compliance Verification

### How to Verify Compliance

1. **Test Data Export**
   ```bash
   npm run test:integration -- userData.test.ts
   ```

2. **Test Data Deletion**
   - Create test user
   - Request data deletion
   - Verify data is anonymized
   - Verify business records preserved

3. **Test Consent Management**
   - Record consent
   - Retrieve consent
   - Verify consent history

4. **Review Privacy Policy**
   - Ensure all required sections present
   - Verify accuracy
   - Check for updates

5. **Review Terms of Service**
   - Ensure all required sections present
   - Verify accuracy
   - Check for updates

## Legal Considerations

### Important Notes

1. **Data Anonymization vs Deletion**
   - We anonymize rather than delete to preserve business/legal records
   - Anonymized data cannot be traced back to user
   - Complies with GDPR while maintaining business needs

2. **Consent Requirements**
   - Consent must be freely given
   - Consent must be specific
   - Consent must be informed
   - Consent can be withdrawn

3. **Data Breach Notification**
   - Must notify users within 72 hours
   - Must notify supervisory authority
   - Document breach response procedure

4. **Data Protection Impact Assessment**
   - Required for high-risk processing
   - Document processing activities
   - Assess risks and mitigations

## Next Steps

1. **Create Privacy Policy**
   - Write comprehensive privacy policy
   - Include all required sections
   - Make accessible on frontend

2. **Create Terms of Service**
   - Write comprehensive terms
   - Include all required sections
   - Make accessible on frontend

3. **Implement Frontend Integration**
   - Add privacy policy acceptance on signup
   - Add terms acceptance on signup
   - Add data export UI
   - Add data deletion UI

4. **Set Up Data Retention**
   - Define retention periods
   - Create cleanup jobs
   - Document retention policy

5. **Regular Audits**
   - Review compliance quarterly
   - Update policies as needed
   - Test GDPR features regularly
