# PureTask – What Lives Where (Source of Truth)

**Last Updated:** January 2025  
**Status:** 🟡 **Partially Implemented** - Migration to n8n in progress

---

## 📋 Golden Rule

**Backend decides WHAT is true.**  
**n8n decides WHAT happens next.**  
**Frontend decides HOW it looks.**

---

## 🏗️ Repo: puretask-backend (Core API)

### ✅ Owns (Source of Truth)

- **PostgreSQL data + schema + migrations**
  - All database tables
  - All migrations in `DB/migrations/`
  - Data integrity rules
  - Foreign key constraints

- **Auth + permissions**
  - JWT token generation/validation
  - User authentication
  - Role-based access control (RBAC)
  - Password hashing/verification
  - Session management

- **Job lifecycle rules**
  - State machine transitions (`src/state/jobStateMachine.ts`)
  - Valid state transitions
  - Who can trigger which events
  - Job status enforcement

- **Credits & pricing rules**
  - Credit balance calculations
  - Escrow logic
  - Refund calculations
  - Pricing tier rules
  - Payout percentages

- **Stripe payments + webhooks**
  - Payment intent creation
  - Webhook signature verification
  - Payment processing
  - Chargeback handling
  - Stripe Connect payouts

- **Payout calculations**
  - Cleaner earnings computation
  - Platform fee calculations
  - Tier-based payout percentages
  - Payout scheduling

- **Business logic validation**
  - "Can this job be cancelled?"
  - "Can this user do this action?"
  - "Is this refund allowed?"
  - "What tier is this user?"

- **Event emission to n8n**
  - Event creation (`src/lib/events.ts`)
  - Event payload structure
  - Which events to emit
  - Template ID references

### ❌ Does NOT Own

- **Email templates or copy**
  - Template content (HTML/text)
  - Email subject lines
  - Email branding/styling

- **Retry logic for communications**
  - Email retry on failure
  - SMS retry logic
  - Notification retry strategies

- **Marketing automation**
  - Email campaigns
  - Drip sequences
  - Abandoned cart emails

- **Direct SendGrid/Twilio calls** (⚠️ **Currently violating - see migration guide**)
  - Should only emit events
  - n8n handles actual sending

---

## 🎨 Repo: puretask-clean-with-confidence (Frontend / Website)

### ✅ Owns

- **UI pages & components**
  - React components
  - Page layouts
  - Navigation
  - Routing

- **Forms + basic validation**
  - Required field checks
  - Email format validation
  - Phone number format
  - Input sanitization (XSS prevention)

- **API calls to backend only**
  - All HTTP requests go to backend
  - Single API client module (`src/lib/api.ts`)
  - No direct database access
  - No direct Stripe calls

- **Display logic**
  - Loading states
  - Error states
  - Success messages
  - Data formatting (currency, dates)

- **SEO, branding, landing pages**
  - Meta tags
  - Landing page content
  - Marketing copy
  - Analytics pixels

### ❌ Does NOT Own

- **Any money logic**
  - No price calculations
  - No credit computations
  - No payout math
  - No refund calculations

- **Any credits logic**
  - No credit balance calculations
  - No credit deduction logic
  - No credit addition logic
  - Backend is source of truth

- **Any job state logic**
  - No "can cancel" checks
  - No state transition logic
  - Backend decides state changes

- **Any business rules**
  - No permission checks
  - No tier calculations
  - No reliability scoring

- **Database access**
  - No SQL queries
  - No direct DB connections
  - Everything via API

- **Stripe secret logic**
  - No secret keys
  - No server-side Stripe calls
  - Backend handles all payments

---

## ⚙️ System: n8n (Automation Brain)

### ✅ Owns

- **Event → Email routing**
  - Receives events from backend
  - Maps events to email templates
  - Selects template IDs
  - Routes to SendGrid

- **SendGrid sending**
  - Actual email delivery
  - SendGrid API calls
  - Template rendering
  - Personalization

- **Retries + error handling**
  - Retry failed emails
  - Exponential backoff
  - Dead letter queue
  - Retry limits

- **Slack alerts**
  - Error notifications
  - Failure alerts
  - Success confirmations
  - Operational monitoring

- **SMS escalation (Twilio)**
  - SMS sending via Twilio
  - SMS retry logic
  - Fallback to SMS when email fails

- **Communication orchestration**
  - Multi-channel routing
  - Preference-based delivery
  - Rate limiting
  - Bounce handling

### ❌ Does NOT Own

- **Business rule truth**
  - Doesn't decide if refund allowed
  - Doesn't calculate credits
  - Doesn't validate permissions

- **Payment decisions**
  - Doesn't process payments
  - Doesn't create payment intents
  - Backend handles all money

- **DB writes** (except logging if needed)
  - Doesn't modify core tables
  - Doesn't change job status
  - Doesn't update credits

- **Event creation**
  - Doesn't decide what events happen
  - Backend emits events
  - n8n reacts to events

---

## 🔄 How They Communicate

### Backend → n8n

```typescript
// Backend emits event
await publishEvent({
  eventName: "job.booked",
  jobId: "123",
  payload: {
    templateId: "d-xxxx",  // SendGrid template ID
    to_email: "user@example.com",
    dynamic_data: {
      jobAddress: "123 Main St",
      creditAmount: 100,
    }
  }
});

// Event forwarded to n8n webhook
POST https://n8n.your-domain.com/webhook/puretask
{
  "jobId": "123",
  "eventName": "job.booked",
  "payload": { ... }
}
```

### Frontend → Backend

```typescript
// Frontend calls backend API
POST /api/jobs
{
  "scheduled_start_at": "2025-01-15T10:00:00Z",
  "address": "123 Main St",
  "credit_amount": 100
}

// Backend:
// 1. Validates request
// 2. Checks permissions
// 3. Calculates pricing
// 4. Escrows credits
// 5. Creates job
// 6. Emits event to n8n
// 7. Returns response
```

### n8n → SendGrid/Twilio

```javascript
// n8n workflow receives event
// 1. Validates secret
// 2. Looks up template
// 3. Renders template with data
// 4. Sends via SendGrid
// 5. Retries on failure
// 6. Alerts Slack on errors
```

---

## 🚨 Current Violations (Migration Required)

### ⚠️ Backend Currently Has Direct SendGrid/Twilio Calls

**Files that need migration:**
- `src/services/notifications/notificationService.ts` - Direct SendGrid/Twilio calls
- `src/services/notifications/providers/sendgrid.ts` - SendGrid provider
- `src/services/notifications/providers/twilio.ts` - Twilio provider
- `src/lib/alerting.ts` - Direct SendGrid for alerts

**Migration Status:** 🟡 In Progress  
**Target:** Replace all direct calls with event emissions  
**Timeline:** See `docs/ARCHITECTURE_MIGRATION_GUIDE.md`

---

## ✅ Enforcement Rules

### Rule 1: Business Logic Lock
- ✅ Frontend can only call backend endpoints
- ✅ Frontend never calculates money/credits/tier outcomes
- ✅ Backend validates everything, even if frontend "already validated"

### Rule 2: Communication Routing
- ✅ Backend emits events only (no direct SendGrid/Twilio in production)
- ✅ n8n handles all email/SMS delivery
- ✅ All communication templates live in n8n/SendGrid

### Rule 3: Single Source of Truth
- ✅ Database = Backend's source of truth
- ✅ Backend = Frontend's source of truth
- ✅ Events = n8n's source of truth

---

## 📝 Examples

### ✅ CORRECT: Business Logic in Backend

```typescript
// ✅ CORRECT - Backend route
router.post("/jobs", auth, async (req, res) => {
  // All validation and business logic here
  const job = await JobsService.bookJob(req.user.id, req.body);
  return res.json(job);
});

// ✅ CORRECT - Service layer
export async function bookJob(userId: string, payload: BookJobPayload) {
  // Validate permissions
  if (!canUserCreateJob(userId)) {
    throw new Error("Forbidden");
  }
  
  // Calculate pricing (backend decides)
  const price = calculateJobPrice(payload);
  
  // Check credits (backend decides)
  const balance = await getCreditBalance(userId);
  if (balance < price) {
    throw new Error("Insufficient credits");
  }
  
  // Escrow credits (backend executes)
  await escrowCredits(userId, price);
  
  // Create job
  const job = await createJobInDB({ ...payload, price });
  
  // Emit event (backend emits, n8n handles)
  await publishEvent({
    eventName: "job.booked",
    jobId: job.id,
    payload: { templateId: "d-xxxx", ... }
  });
  
  return job;
}
```

### ❌ WRONG: Business Logic in Frontend

```typescript
// ❌ WRONG - Frontend calculating price
function createJob(data) {
  const price = calculatePrice(data);  // ❌ NO! Backend should calculate
  const balance = getUserCredits();     // ❌ NO! Backend should check
  if (balance < price) {                // ❌ NO! Backend should validate
    return { error: "Insufficient" };
  }
  // ...
}

// ❌ WRONG - Frontend deciding permissions
function canCancelJob(job) {
  if (job.status === "completed") {     // ❌ NO! Backend should decide
    return false;
  }
  // ...
}
```

### ✅ CORRECT: Event Emission Pattern

```typescript
// ✅ CORRECT - Backend emits event
await publishEvent({
  eventName: "job.booked",
  jobId: job.id,
  payload: {
    templateId: "d-xxxx",  // SendGrid template ID (env var)
    to_email: user.email,
    dynamic_data: {
      jobAddress: job.address,
      creditAmount: job.credit_amount,
    }
  }
});

// Event automatically forwarded to n8n
// n8n handles SendGrid sending, retries, alerts
```

### ❌ WRONG: Direct SendGrid Call

```typescript
// ❌ WRONG - Backend sending email directly
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(env.SENDGRID_API_KEY);
await sgMail.send({
  to: user.email,
  from: "noreply@puretask.com",
  subject: "Job Booked",
  html: template,
});  // ❌ NO! n8n should handle this
```

---

## 🔍 Validation Checklist

Before merging any PR, verify:

### Backend PRs
- [ ] No business logic in routes (only in services)
- [ ] All calculations happen in service layer
- [ ] Events emitted instead of direct SendGrid/Twilio calls
- [ ] No direct email/SMS sending (except test mode)

### Frontend PRs
- [ ] No price/credit calculations
- [ ] No database access
- [ ] All API calls go through `src/lib/api.ts`
- [ ] No Stripe secret keys
- [ ] No business rule logic

### n8n Workflows
- [ ] Workflows start with `PT-` prefix
- [ ] Workflows only react to events (don't create them)
- [ ] No database writes to core tables
- [ ] Retry logic implemented

---

## 📚 Related Documents

- `docs/ARCHITECTURE_ENFORCEMENT_GUIDE.md` - How to enforce these rules
- `docs/ARCHITECTURE_MIGRATION_GUIDE.md` - How to migrate existing violations
- `docs/EVENT_SYSTEM_SPEC.md` - Event naming and payload standards

---

**This document is the source of truth for architectural boundaries. When in doubt, refer here.**

---

*Last Updated: January 2025*  
*Next Review: After n8n migration completion*
