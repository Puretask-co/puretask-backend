# PureTask Privacy Policy — Draft for Counsel Review

**Status:** Draft. GDPR/CPRA framing.  
**See also:** [FOUNDER_GDPR.md](../founder/FOUNDER_GDPR.md), [SECTION_13_LEGAL.md](../sections/SECTION_13_LEGAL.md).  
**Last updated:** 2026-02-02

---

## Purpose

Disclose what data we collect, how we use it, retention, sharing, and user rights. Required for transparency and GDPR/CPRA compliance.

---

## Sections (for counsel to draft)

1. **Data We Collect** — Account (email, phone, name); profile (address, preferences); job data; payments; messages; photos; usage/analytics.
2. **How We Use It** — Platform operations; payments; dispute resolution; communications; service improvement; legal/compliance.
3. **Legal Basis (GDPR)** — Contract performance; legitimate interest; consent (where required).
4. **Retention** — How long we keep data; job photos, audit logs, dispute evidence per retention policy.
5. **Sharing** — Stripe (payments), SendGrid (email), Twilio (SMS), OneSignal (push), n8n (automation), OpenAI (AI features if used); subprocessor list.
6. **International Transfers** — If applicable; safeguards (e.g. standard contractual clauses).
7. **Your Rights** — Access (data export); erasure (deletion); portability; rectification; restrict processing; object; withdraw consent; complain to supervisory authority.
8. **CPRA / California** — Sale/sharing disclosures; opt-out; non-discrimination.
9. **Cookies & Tracking** — If applicable (web/app).
10. **Contact** — Data protection contact; how to exercise rights.

---

## Technical Implementation

- **Export:** `POST /user/data/export` — returns UserDataExport JSON (see gdprService).
- **Deletion:** `POST /user/data/delete` — anonymizes or deletes per policy.
- **Consent:** `user_consents` table; types: `privacy_policy`, `terms_of_service`, `marketing`, etc.
