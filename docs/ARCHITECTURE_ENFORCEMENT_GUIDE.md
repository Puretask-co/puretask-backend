# Architecture Enforcement Guide

**Purpose:** Make it hard to break architectural boundaries (not "best intentions")  
**Status:** Enforcement mechanisms to implement

---

## 🎯 Enforcement Layers

### Layer A: Code Structure + Ownership

**Backend Services Folder = Only Place Logic Goes**

```
src/
├── routes/          ← Thin controllers only
├── services/        ← ALL business logic here ✅
├── core/            ← Core domain logic ✅
└── lib/             ← Utilities only (no business rules)
```

**Rule:** Routes should be < 20 lines. If longer, move logic to services.

**Example:**

```typescript
// ✅ CORRECT - Thin route
router.post("/jobs", auth, async (req, res) => {
  const job = await JobsService.bookJob(req.user.id, req.body);
  return res.json({ job });
});

// ❌ WRONG - Fat route with logic
router.post("/jobs", auth, async (req, res) => {
  // ❌ Validation should be in service
  if (!req.body.address) {
    return res.status(400).json({ error: "Address required" });
  }
  
  // ❌ Calculation should be in service
  const price = calculatePrice(req.body);  // ❌
  
  // ❌ Business logic should be in service
  const balance = await getBalance(req.user.id);  // ❌
  if (balance < price) {
    return res.status(400).json({ error: "Insufficient credits" });
  }
  
  // ❌ DB operations should be in service
  const job = await query("INSERT INTO jobs ...");  // ❌
  
  return res.json({ job });
});
```

**Frontend Has No "Domain" Folder**

```
frontend/
├── pages/           ← UI pages ✅
├── components/      ← UI components ✅
├── lib/
│   └── api.ts      ← API client only ✅
├── services/        ← ❌ NO! No business logic services
└── domain/          ← ❌ NO! No domain logic
```

**Rule:** Frontend can have:
- API client utilities
- Display/formatters
- UI state management
- **NOT business logic**

---

### Layer B: CI Checks (Simple but Powerful)

#### Check 1: Frontend - Block Stripe Server SDK

**File:** `.github/workflows/frontend-ci.yml` (create this)

```yaml
name: Frontend CI Checks

on: [pull_request]

jobs:
  check-architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Block Stripe server SDK
        run: |
          if grep -r "stripe/server" src/; then
            echo "❌ ERROR: Frontend cannot import Stripe server SDK"
            echo "Use Stripe client SDK only (for frontend checkout)"
            exit 1
          fi
      
      - name: Block business logic services
        run: |
          if [ -d "src/services" ] && [ "$(ls -A src/services/*.ts 2>/dev/null | grep -v api)" ]; then
            echo "❌ ERROR: Frontend has business logic services"
            echo "Move business logic to backend"
            exit 1
          fi
      
      - name: Block database access
        run: |
          if grep -r "pg\|postgres\|sql\|database" src/ --include="*.ts" --include="*.tsx" | grep -v "api"; then
            echo "❌ ERROR: Frontend cannot access database directly"
            echo "All data access must go through backend API"
            exit 1
          fi
      
      - name: Block SendGrid/Twilio
        run: |
          if grep -r "sendgrid\|twilio\|@sendgrid\|twilio" src/ --include="*.ts" --include="*.tsx"; then
            echo "❌ ERROR: Frontend cannot use SendGrid/Twilio"
            echo "All communications go through backend → n8n"
            exit 1
          fi
```

#### Check 2: Backend - Block Direct SendGrid/Twilio (Production Paths)

**File:** `.github/workflows/backend-ci.yml` (add to existing)

```yaml
name: Backend CI Checks

on: [pull_request]

jobs:
  check-architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Block direct SendGrid in production paths
        run: |
          # Allow in test files, block in production code
          if grep -r "sgMail\|@sendgrid/mail\|sendgrid" src/ \
            --include="*.ts" \
            --exclude="*.test.ts" \
            --exclude="*.spec.ts" \
            --exclude-dir=tests \
            | grep -v "test\|spec"; then
            echo "❌ ERROR: Direct SendGrid calls in production code"
            echo "Use publishEvent() instead. n8n handles email sending."
            echo "Exception: src/lib/alerting.ts allowed for critical alerts only"
            exit 1
          fi
      
      - name: Block direct Twilio in production paths
        run: |
          if grep -r "twilio\|Twilio" src/ \
            --include="*.ts" \
            --exclude="*.test.ts" \
            --exclude="*.spec.ts" \
            --exclude-dir=tests \
            | grep -v "test\|spec\|types"; then
            echo "❌ ERROR: Direct Twilio calls in production code"
            echo "Use publishEvent() instead. n8n handles SMS sending."
            exit 1
          fi
      
      - name: Ensure routes are thin
        run: |
          # Check that route files don't have too much logic
          # (Simple heuristic: count lines in route handlers)
          # This is a soft check - won't fail, just warns
          echo "⚠️  Checking route file sizes..."
          for file in src/routes/*.ts; do
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 300 ]; then
              echo "⚠️  WARNING: $file is large ($lines lines). Consider moving logic to services."
            fi
          done
```

#### Check 3: ESLint Rules (Code-Level Enforcement)

**File:** `.eslintrc.js` (add to backend)

```javascript
module.exports = {
  rules: {
    // Block direct SendGrid imports (except in specific files)
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@sendgrid/mail', 'sendgrid'],
            message: 'Use publishEvent() instead. n8n handles email sending.',
            allowTypeImports: false,
          },
          {
            group: ['twilio'],
            message: 'Use publishEvent() instead. n8n handles SMS sending.',
            allowTypeImports: false,
          },
        ],
        paths: [
          {
            name: '@sendgrid/mail',
            importNames: ['default'],
            message: 'Use publishEvent() instead.',
            allowTypeImports: false,
          },
        ],
      },
    ],
    
    // Warn if route handlers are too complex
    'complexity': ['warn', { max: 10 }],
    
    // Enforce that services are used (not direct DB in routes)
    'no-restricted-modules': [
      'error',
      {
        patterns: ['../db/client'],
        paths: [
          {
            name: '../db/client',
            message: 'Use service layer functions instead of direct DB access in routes.',
          },
        ],
      },
    ],
  },
};
```

**Note:** The `no-restricted-modules` rule above is conceptual. You may need to use a custom ESLint plugin or TypeScript compiler checks instead.

---

### Layer C: Naming Standards

#### Event Naming Convention

**Format:** `{domain}.{action}`

```typescript
// ✅ CORRECT
"job.booked"
"job.cancelled"
"job.completed"
"payment.succeeded"
"payout.sent"
"user.registered"

// ❌ WRONG
"booked"              // Missing domain
"job_booked"          // Use dot, not underscore
"JOB_BOOKED"          // Use lowercase
```

#### n8n Workflow Naming

**Format:** `PT-{domain}-{action}`

```
PT-Email-JobBooked
PT-Email-JobCancelled
PT-SMS-EmergencyAlert
PT-Slack-ErrorAlert
```

#### Template ID References

**Format:** Environment variables only

```typescript
// ✅ CORRECT - Env var reference
templateId: env.EMAIL_TEMPLATE_JOB_BOOKED

// ❌ WRONG - Hardcoded
templateId: "d-123abc456def"  // ❌ NO!
```

**Env vars:**
```env
EMAIL_TEMPLATE_JOB_BOOKED=d-xxxx
EMAIL_TEMPLATE_JOB_CANCELLED=d-yyyy
SMS_TEMPLATE_EMERGENCY=d-zzzz
```

---

### Layer D: "Change Process" Checklist

**Before any PR is merged, answer these questions:**

#### Question 1: Does it change truth?
- ✅ **Yes** → Must be in backend
- ❌ **No** → Can be in frontend (UI only)

**Examples:**
- "Can user cancel this job?" → Backend ✅
- "Show cancel button" → Frontend ✅
- "Calculate job price" → Backend ✅
- "Format price as $10.00" → Frontend ✅

#### Question 2: Does it execute actions?
- ✅ **Yes** → Must be in n8n (for communications)
- ✅ **Yes** → Must be in backend (for data changes)

**Examples:**
- "Send email" → n8n ✅
- "Create job in DB" → Backend ✅
- "Retry failed email" → n8n ✅
- "Update credit balance" → Backend ✅

#### Question 3: Is it UI?
- ✅ **Yes** → Must be in frontend

**Examples:**
- "Button click handler" → Frontend ✅
- "Form validation (required fields)" → Frontend ✅
- "Loading spinner" → Frontend ✅
- "Price calculation" → Frontend ❌ (Backend!)

---

## 🛠️ Implementation Steps

### Step 1: Add CI Checks (High Priority)

1. Create `.github/workflows/frontend-ci.yml` (for frontend repo)
2. Add checks to `.github/workflows/backend-ci.yml` (for backend repo)
3. Test that checks fail on violations
4. Document in PR template

### Step 2: Add ESLint Rules (Medium Priority)

1. Update `.eslintrc.js` with restricted imports
2. Add complexity warnings
3. Test with existing codebase
4. Fix violations or add exceptions

### Step 3: Code Review Checklist (Immediate)

Add to PR template:

```markdown
## Architecture Checklist

- [ ] No business logic in frontend
- [ ] No direct SendGrid/Twilio calls in backend (production paths)
- [ ] Routes are thin (< 20 lines of logic)
- [ ] All calculations in service layer
- [ ] Events use correct naming convention
- [ ] Template IDs from env vars only
```

### Step 4: Documentation (Ongoing)

1. Link to `architecture-what-lives-where.md` in README
2. Add examples to each repo's contributing guide
3. Create onboarding doc for new developers

---

## 🚨 Current Violations to Fix

### Violation 1: Direct SendGrid Calls

**Files:**
- `src/services/notifications/notificationService.ts`
- `src/services/notifications/providers/sendgrid.ts`
- `src/lib/alerting.ts` (allowed exception for critical alerts)

**Fix:** See `docs/ARCHITECTURE_MIGRATION_GUIDE.md`

### Violation 2: Direct Twilio Calls

**Files:**
- `src/services/notifications/notificationService.ts`
- `src/services/notifications/providers/twilio.ts`

**Fix:** See `docs/ARCHITECTURE_MIGRATION_GUIDE.md`

---

## 📊 Enforcement Status

| Enforcement Layer | Status | Priority |
|-------------------|--------|----------|
| Code Structure | ✅ Partially enforced | High |
| CI Checks | ❌ Not implemented | High |
| ESLint Rules | ❌ Not implemented | Medium |
| Naming Standards | ✅ Documented | Low |
| Change Process | ✅ Documented | Medium |

---

## ✅ Success Criteria

Enforcement is working when:

1. ✅ PR fails if frontend imports Stripe server SDK
2. ✅ PR fails if backend has direct SendGrid/Twilio in production code
3. ✅ PR fails if route file > 300 lines (warning)
4. ✅ ESLint warns on complex route handlers
5. ✅ All events follow naming convention
6. ✅ All template IDs from env vars

---

## 🔄 Continuous Improvement

### Quarterly Review

Every quarter, review:
- Are CI checks catching violations?
- Are developers following the patterns?
- Do we need additional checks?
- Are there new patterns to enforce?

### Metrics to Track

- Number of PRs that fail architecture checks
- Time to fix architecture violations
- Developer feedback on enforcement

---

**This guide makes architecture boundaries enforceable, not optional.**

---

*Last Updated: January 2025*  
*Next Review: After CI checks implementation*
