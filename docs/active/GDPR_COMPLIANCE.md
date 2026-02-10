# GDPR Compliance Guide

## Overview
This guide covers GDPR (General Data Protection Regulation) compliance features for PureTask Backend.

## GDPR Rights Implemented

### 1. Right to Access (Data Export)
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
