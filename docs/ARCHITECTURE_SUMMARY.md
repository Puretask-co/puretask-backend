# Architecture Governance Summary

**Quick Reference Guide**  
**Last Updated:** January 2025

---

## 🎯 The Golden Rule

**Backend decides WHAT is true.**  
**n8n decides WHAT happens next.**  
**Frontend decides HOW it looks.**

---

## 📚 Documentation Index

1. **[architecture-what-lives-where.md](./architecture-what-lives-where.md)** ⭐ START HERE
   - Source of truth for what lives where
   - Ownership boundaries
   - Communication patterns

2. **[ARCHITECTURE_ENFORCEMENT_GUIDE.md](./ARCHITECTURE_ENFORCEMENT_GUIDE.md)**
   - How to enforce boundaries
   - CI checks
   - ESLint rules
   - Naming standards

3. **[ARCHITECTURE_MIGRATION_GUIDE.md](./ARCHITECTURE_MIGRATION_GUIDE.md)**
   - Migrating existing violations
   - Step-by-step process
   - Testing strategy

4. **[EVENT_SYSTEM_SPEC.md](./EVENT_SYSTEM_SPEC.md)**
   - Event naming conventions
   - Payload structure
   - Template ID mapping

---

## ⚡ Quick Reference

### ✅ What Backend Owns

- Database & migrations
- Auth & permissions
- Job lifecycle rules
- Credits & pricing
- Stripe payments
- Payout calculations
- Business logic validation
- **Event emission** (not delivery)

### ✅ What Frontend Owns

- UI pages & components
- Forms & basic validation
- API calls (to backend only)
- Display logic
- SEO & branding

### ✅ What n8n Owns

- Email/SMS delivery
- Retry logic
- Slack alerts
- Communication orchestration

### ❌ What Frontend CANNOT Do

- Calculate prices/credits
- Access database directly
- Use Stripe server SDK
- Make business decisions

### ❌ What Backend CANNOT Do (Production)

- Send emails directly (SendGrid)
- Send SMS directly (Twilio)
- Handle retry logic for comms

---

## 🚨 Current Violations

**Status:** 🟡 Migration in progress

**Files to migrate:**
- `src/services/notifications/notificationService.ts`
- `src/services/notifications/providers/sendgrid.ts`
- `src/services/notifications/providers/twilio.ts`

**Target:** Replace direct calls with event emissions

**See:** [ARCHITECTURE_MIGRATION_GUIDE.md](./ARCHITECTURE_MIGRATION_GUIDE.md)

---

## 🔍 Enforcement

### CI Checks

**File:** `.github/workflows/backend-architecture-checks.yml`

**Checks:**
- ✅ Blocks direct SendGrid calls (production paths)
- ✅ Blocks direct Twilio calls (production paths)
- ✅ Warns on large route files
- ✅ Verifies service layer usage

### ESLint Rules

**File:** `.eslintrc.js` (to be added)

**Rules:**
- Block `@sendgrid/mail` imports
- Block `twilio` imports
- Warn on complex route handlers

---

## 📋 Quick Checklist

Before merging PR:

- [ ] No business logic in frontend
- [ ] No direct SendGrid/Twilio in backend (production)
- [ ] Routes are thin (< 20 lines of logic)
- [ ] All calculations in service layer
- [ ] Events use correct naming (`domain.action`)
- [ ] Template IDs from env vars only

---

## 🎯 Event Pattern

```typescript
// Backend emits event
await publishEvent({
  eventName: "job.booked",
  jobId: job.id,
  payload: {
    communication: {
      templateId: env.EMAIL_TEMPLATE_JOB_BOOKED,
      to_email: user.email,
      channel: "email",
      dynamic_data: { ... },
    },
  },
});

// n8n receives event and handles delivery
```

---

## 🔗 Related Resources

- **Main Doc:** [architecture-what-lives-where.md](./architecture-what-lives-where.md)
- **Enforcement:** [ARCHITECTURE_ENFORCEMENT_GUIDE.md](./ARCHITECTURE_ENFORCEMENT_GUIDE.md)
- **Migration:** [ARCHITECTURE_MIGRATION_GUIDE.md](./ARCHITECTURE_MIGRATION_GUIDE.md)
- **Events:** [EVENT_SYSTEM_SPEC.md](./EVENT_SYSTEM_SPEC.md)
- **CI Checks:** `.github/workflows/backend-architecture-checks.yml`

---

**When in doubt, refer to `architecture-what-lives-where.md` - it's the source of truth.**

---

*Last Updated: January 2025*
