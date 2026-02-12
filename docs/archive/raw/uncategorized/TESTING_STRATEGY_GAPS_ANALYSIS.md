# Testing Strategy - Comprehensive Gap Analysis

## 📋 Scope Clarification

**The testing strategy applies to BOTH backend AND frontend:**
- ✅ **Backend (puretask-backend)**: Node.js/Express API, services, middleware, workers
- ✅ **Frontend (puretask-frontend)**: Next.js/React components, hooks, contexts, pages

---

## 🔍 What's Currently Covered

### ✅ Already Documented:
1. **Phase 1**: Testing Infrastructure Setup (Backend & Frontend)
2. **Phase 2**: Unit Tests (Backend utilities, Frontend hooks/components)
3. **Phase 3**: Integration Tests (Payment, Booking, Auth, Onboarding flows)
4. **Phase 4**: E2E Tests (Client booking, Cleaner onboarding, Job lifecycle)
5. **Phase 5**: API Endpoint Tests (Auth, Booking, Onboarding, Admin)
6. **Phase 6**: Security & Authorization Tests (RBAC, Data isolation)
7. **Phase 7**: Manual Testing Protocol
8. **Phase 8**: Performance Tests

---

## ❌ What's MISSING - Detailed Breakdown

### **1. Backend Middleware Tests** ⚠️ CRITICAL MISSING

**Files to Test:**
- `src/middleware/jwtAuth.ts` - JWT authentication
- `src/middleware/csrf.ts` - CSRF protection
- `src/middleware/security.ts` - Security headers
- `src/middleware/rateLimit.ts` - Rate limiting
- `src/middleware/productionRateLimit.ts` - Production rate limits
- `src/middleware/adminAuth.ts` - Admin authentication

**Test Cases Needed:**

#### JWT Auth Middleware (`jwtAuth.ts`)
| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| Valid token attaches user | Bearer token | `req.user` populated | User object attached |
| Invalid token rejects | Invalid token | `401` error | Request rejected |
| Missing token rejects | No auth header | `401` error | Request rejected |
| Expired token rejects | Expired JWT | `401` error | Request rejected |
| Legacy headers work in dev | `x-user-id` header | User attached (dev only) | Works in non-prod |
| Legacy headers blocked in prod | `x-user-id` header | `401` error | Blocked in production |

#### CSRF Middleware (`csrf.ts`)
| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| GET requests don't need CSRF | GET request | Request passes | No CSRF required |
| POST requests require CSRF | POST without token | `403` error | CSRF required |
| Valid CSRF token passes | POST with valid token | Request passes | Token validated |
| Invalid CSRF token rejects | POST with invalid token | `403` error | Token rejected |
| Expired CSRF token rejects | POST with expired token | `403` error | Token expired |

#### Security Headers (`security.ts`)
| Test | What to Verify | Expected Header | Success Criteria |
|------|----------------|-----------------|------------------|
| X-Frame-Options set | Response headers | `DENY` | Header present |
| X-Content-Type-Options set | Response headers | `nosniff` | Header present |
| Content-Security-Policy set | Response headers | CSP string | Header present |
| HSTS header set (HTTPS) | Response headers | `max-age=31536000` | Header present |

#### Rate Limiting (`rateLimit.ts`)
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Allows requests under limit | 10 requests in 1 min | All succeed | Requests pass |
| Blocks requests over limit | 101 requests in 1 min | `429` error | Rate limited |
| Resets after window | Wait 1 min, retry | Request succeeds | Limit reset |

---

### **2. Backend Service Tests** ⚠️ CRITICAL MISSING

**Services That Need Tests:**

#### `src/services/phoneVerificationService.ts`
| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| `sendOTP` generates OTP | Phone number | OTP stored, SMS sent | OTP in database |
| `sendOTP` validates phone format | Invalid phone | Error thrown | Invalid format rejected |
| `verifyOTP` validates correct OTP | Correct OTP | Phone verified | `phone_verified = true` |
| `verifyOTP` rejects wrong OTP | Wrong OTP | Error thrown | Verification fails |
| `verifyOTP` rejects expired OTP | Expired OTP | Error thrown | Expired OTP rejected |

#### `src/services/fileUploadService.ts`
| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| `uploadFile` validates file type | Invalid type | Error thrown | Invalid type rejected |
| `uploadFile` validates file size | File > 10MB | Error thrown | Size limit enforced |
| `uploadFile` saves file | Valid file | File saved, URL returned | File stored correctly |
| `validateFile` checks MIME type | Wrong MIME | Error thrown | MIME validated |

#### `src/services/onboardingReminderService.ts`
| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| `getAbandonedOnboardingCleaners` finds abandoned | 24+ hours old | Array of cleaners | Correct cleaners found |
| `sendOnboardingReminder` sends email | Cleaner object | Email sent | SendGrid called |
| `sendOnboardingReminder` marks as sent | Cleaner object | `reminder_sent_at` set | Database updated |
| `sendOnboardingReminders` batch sends | Multiple cleaners | All emails sent | Batch processed |

#### `src/services/cleanerOnboardingService.ts`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `saveAgreements` saves agreements | Agreements object | Agreements saved | Database updated |
| `saveBasicInfo` updates profile | Basic info | Profile updated | Fields saved |
| `uploadFacePhoto` uploads photo | File object | Photo URL returned | File uploaded |
| `uploadIDVerification` creates verification | File + type | Verification record | Record created |
| `saveServiceAreas` saves zip codes | Zip codes array | Areas saved | Database updated |
| `saveAvailability` saves schedule | Availability blocks | Blocks saved | Schedule saved |
| `completeOnboarding` marks complete | Cleaner ID | `onboarding_completed_at` set | Onboarding complete |
| `getOnboardingProgress` returns progress | Cleaner ID | Progress object | Correct progress |

---

### **3. Backend Worker Tests** ⚠️ MISSING

**Workers That Need Tests:**

#### `src/workers/onboardingReminderWorker.ts`
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Worker finds abandoned cleaners | 24+ hours old | Cleaners found | Query works |
| Worker sends reminders | Abandoned cleaners | Emails sent | Reminders sent |
| Worker handles errors gracefully | SendGrid failure | Error logged | No crash |
| Worker marks reminders as sent | After sending | `reminder_sent_at` set | Database updated |

#### `src/workers/v1-core/autoCancelJobs.ts`
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Cancels jobs past deadline | Job past deadline | Job cancelled | Status updated |
| Refunds credits on cancel | Cancelled job | Credits refunded | Balance restored |
| Sends cancellation notification | Job cancelled | Notification sent | User notified |

#### `src/workers/v1-core/payoutWeekly.ts`
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Processes weekly payouts | Eligible cleaners | Payouts created | Payout records created |
| Calculates payout amounts | Earnings data | Correct amounts | Math correct |
| Creates Stripe transfers | Payout records | Transfers created | Stripe API called |

---

### **4. Backend Library/Utility Tests** ⚠️ PARTIALLY MISSING

**Files That Need Tests:**

#### `src/lib/tiers.ts`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| Tier constants defined | - | bronze, silver, gold, platinum | All tiers exist | Constants correct |
| Tier validation | Valid tier | `true` | Tier accepted |
| Tier validation | Invalid tier | `false` | Tier rejected |

#### `src/lib/security.ts` (Rate Limiting Functions)
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `createRateLimiter` creates limiter | Options | Rate limiter | Limiter created |
| `endpointRateLimiter` limits endpoint | Request | Rate limited | Limit enforced |
| `userRateLimiter` limits per user | User ID | Rate limited | User limit enforced |
| `combinedRateLimiter` combines limits | Multiple limits | Combined limit | All limits enforced |

#### `src/lib/errorRecovery.ts` (Additional Functions)
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `getUserFriendlyError` formats errors | Error object | User-friendly message | Message readable |
| `isOffline` detects offline | Network error | `true` | Offline detected |

---

### **5. Frontend Context Tests** ⚠️ MISSING

**Contexts That Need Tests:**

#### `src/contexts/AuthContext.tsx`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `login` authenticates user | Credentials | User object | User logged in |
| `login` stores token | Credentials | Token in localStorage | Token saved |
| `register` creates account | Registration data | User object | Account created |
| `logout` clears session | - | User null, token removed | Session cleared |
| `refreshUser` updates user | - | User data refreshed | User updated |
| Loads user from localStorage | On mount | User loaded | Persistence works |

#### `src/contexts/NotificationContext.tsx`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `addNotification` adds notification | Notification object | Notification added | State updated |
| `markAsRead` marks read | Notification ID | `read = true` | Status updated |
| `clearAll` clears all | - | Empty array | All cleared |

#### `src/contexts/WebSocketContext.tsx`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| Connects on mount | - | Socket connected | Connection established |
| Receives messages | Message event | Message added | Message received |
| Sends messages | Message object | Message sent | Socket emits |
| Handles disconnect | Disconnect event | Reconnection attempted | Auto-reconnect |

#### `src/contexts/ToastContext.tsx`
| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| `showToast` displays toast | Message | Toast visible | Toast shown |
| Toast auto-dismisses | After timeout | Toast removed | Auto-dismiss works |

---

### **6. Frontend API Client Tests** ⚠️ MISSING

**File: `src/lib/api.ts`**

| Test | Function | Input | Expected | Success Criteria |
|------|----------|-------|----------|------------------|
| Request interceptor adds token | Request | Authorization header | Token added | Header present |
| Response interceptor handles 401 | 401 response | Redirect to login | Redirect triggered | Auth flow works |
| Response interceptor handles errors | Error response | Error logged | Error handled | No crash |
| Timeout handling | Slow request | Timeout error | Error thrown | Timeout works |

---

### **7. Frontend Component Tests - Additional** ⚠️ PARTIALLY MISSING

**Components That Need Tests:**

#### `src/components/layout/Header.tsx`
| Test | User Action | Expected Result | Success Criteria |
|------|-------------|-----------------|------------------|
| Displays user name | Authenticated | Name visible | User info shown |
| Shows logout button | Authenticated | Button visible | Logout available |
| Shows login link | Not authenticated | Link visible | Login link shown |
| Mobile menu toggles | Click menu | Menu opens | Mobile nav works |

#### `src/components/layout/MobileNav.tsx`
| Test | User Action | Expected Result | Success Criteria |
|------|-------------|-----------------|------------------|
| Shows role-specific links | Client role | Client links | Correct links |
| Shows role-specific links | Cleaner role | Cleaner links | Correct links |
| Closes on link click | Click link | Menu closes | Navigation works |

#### `src/components/forms/FormField.tsx`
| Test | User Action | Expected Result | Success Criteria |
|------|-------------|-----------------|------------------|
| Displays label | Render | Label visible | Label shown |
| Shows error message | Error prop | Error visible | Error displayed |
| Validates input | Invalid input | Error shown | Validation works |

#### `src/components/error/ErrorBoundary.tsx`
| Test | Scenario | Expected Result | Success Criteria |
|------|----------|------------------|------------------|
| Catches render errors | Component error | Error UI shown | Error caught |
| Logs error | Component error | Error logged | Logging works |
| Shows retry button | Error state | Button visible | Retry available |

---

### **8. Database Migration Tests** ⚠️ MISSING

**What to Test:**
- Migrations run successfully
- Migrations are idempotent (can run twice)
- Migrations rollback correctly
- Foreign key constraints work
- Indexes are created
- Triggers are created

**Test Cases:**
| Test | Migration | Expected | Success Criteria |
|------|-----------|----------|------------------|
| Migration runs | `035_onboarding_enhancements.sql` | Tables created | Schema updated |
| Migration idempotent | Run twice | No errors | Can re-run safely |
| Foreign keys work | Insert invalid FK | Error thrown | Constraint enforced |
| Indexes created | Query with index | Fast query | Index used |

---

### **9. Integration Tests - Additional** ⚠️ PARTIALLY MISSING

#### Email Integration (SendGrid)
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Sends onboarding reminder | Abandoned cleaner | Email sent | SendGrid API called |
| Handles SendGrid errors | API failure | Error logged | Graceful failure |
| Email template renders | Email data | HTML generated | Template works |

#### SMS Integration (Twilio)
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Sends OTP SMS | Phone number | SMS sent | Twilio API called |
| Handles Twilio errors | API failure | Error logged | Graceful failure |
| Validates phone format | Invalid phone | Error thrown | Format validated |

#### Webhook Integration (n8n)
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Sends webhook to n8n | Event triggered | Webhook sent | n8n called |
| Validates webhook signature | Invalid signature | Request rejected | Security works |
| Handles webhook failures | n8n down | Error logged | Graceful failure |

#### Stripe Integration
| Test | Scenario | Expected | Success Criteria |
|------|----------|----------|------------------|
| Creates checkout session | Credit purchase | Session created | Stripe API called |
| Processes webhook | Payment event | Credits added | Webhook processed |
| Validates webhook signature | Invalid signature | Request rejected | Security works |
| Idempotent webhook processing | Duplicate event | No double-credit | Idempotency works |

---

### **10. E2E Tests - Additional Scenarios** ⚠️ PARTIALLY MISSING

#### Admin Workflows E2E
| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Admin logs in | Dashboard loads | Admin dashboard visible |
| 2 | Navigate to ID verifications | Page loads | Verifications list visible |
| 3 | Click "Review" on verification | Modal opens | Document preview shown |
| 4 | Click "Approve" | Status updated | Verification approved |
| 5 | Verify database updated | Query database | Status = "verified" |

#### Cleaner AI Assistant E2E
| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Cleaner navigates to AI assistant | Page loads | AI interface visible |
| 2 | Creates message template | Template saved | Template in list |
| 3 | Uses quick response | Response sent | Message sent |
| 4 | Views message history | History loads | Messages visible |

#### Client Recurring Booking E2E
| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Client creates recurring booking | Booking created | Recurring schedule set |
| 2 | System creates first job | Job created | Job in dashboard |
| 3 | System creates subsequent jobs | Jobs created | Jobs appear weekly |
| 4 | Client cancels recurring | Schedule cancelled | No more jobs created |

---

### **11. Coverage Reporting** ⚠️ MISSING SETUP

**What's Needed:**
- Verify coverage reports generate
- Set coverage thresholds
- Add coverage to CI/CD
- Generate coverage badges
- Track coverage over time

**Action Items:**
1. Run `npm run test:coverage` and verify reports
2. Set minimum coverage thresholds (e.g., 80%)
3. Add coverage reporting to CI/CD pipeline
4. Generate coverage HTML reports
5. Track coverage trends

---

### **12. Test Data Management** ⚠️ MISSING

**What's Needed:**
- Test database setup/teardown
- Seed data for tests
- Test user creation helpers
- Cleanup utilities
- Fixtures for common scenarios

**Files to Create:**
- `src/tests/fixtures/users.ts` - User fixtures
- `src/tests/fixtures/bookings.ts` - Booking fixtures
- `src/tests/fixtures/cleaners.ts` - Cleaner fixtures
- `src/tests/helpers/db.ts` - Database helpers
- `src/tests/helpers/seed.ts` - Seed data

---

### **13. Mock/Stub Setup** ⚠️ PARTIALLY MISSING

**What's Needed:**
- Mock Stripe API
- Mock SendGrid API
- Mock Twilio API
- Mock n8n webhooks
- Mock file uploads
- Mock WebSocket connections

**Files to Create:**
- `src/tests/mocks/stripe.ts` - Stripe mocks
- `src/tests/mocks/sendgrid.ts` - SendGrid mocks
- `src/tests/mocks/twilio.ts` - Twilio mocks
- `src/tests/mocks/n8n.ts` - n8n mocks
- `../puretask-frontend/src/test-helpers/mocks/api.ts` - API mocks

---

## 📊 Summary: Missing Test Coverage

| Category | Backend | Frontend | Status |
|----------|---------|----------|--------|
| **Middleware Tests** | ❌ 0% | N/A | **CRITICAL** |
| **Service Tests** | ⚠️ 20% | N/A | **HIGH PRIORITY** |
| **Worker Tests** | ❌ 0% | N/A | **HIGH PRIORITY** |
| **Utility Tests** | ⚠️ 40% | ⚠️ 30% | **MEDIUM PRIORITY** |
| **Context Tests** | N/A | ❌ 0% | **HIGH PRIORITY** |
| **Component Tests** | N/A | ⚠️ 20% | **MEDIUM PRIORITY** |
| **Integration Tests** | ⚠️ 60% | ⚠️ 40% | **ONGOING** |
| **E2E Tests** | N/A | ⚠️ 30% | **MEDIUM PRIORITY** |
| **Migration Tests** | ❌ 0% | N/A | **LOW PRIORITY** |
| **Coverage Reporting** | ⚠️ Needs setup | ⚠️ Needs setup | **HIGH PRIORITY** |

---

## 🎯 Priority Action Items

### **Immediate (Week 1):**
1. ✅ Verify existing tests run correctly
2. ⚠️ Create middleware tests (JWT, CSRF, Security)
3. ⚠️ Create service tests (onboarding, phone verification, file upload)
4. ⚠️ Set up coverage reporting

### **Short-term (Week 2-3):**
5. ⚠️ Create context tests (Auth, Notification, WebSocket)
6. ⚠️ Create worker tests (onboarding reminders, auto-cancel)
7. ⚠️ Expand integration tests (email, SMS, webhooks)
8. ⚠️ Create E2E tests for admin workflows

### **Medium-term (Week 4+):**
9. ⚠️ Create component tests (Header, MobileNav, FormField)
10. ⚠️ Create migration tests
11. ⚠️ Set up test data management
12. ⚠️ Create comprehensive mocks

---

**Status**: 📋 **Gap Analysis Complete** - Ready for Implementation
**Next Step**: Begin implementing missing tests starting with highest priority items
