# API Documentation Status - 100% Completion Goal

**Last Updated:** 2026-01-28  
**Current Progress:** ~120+ endpoints documented (~70-80% complete)

---

## ✅ Fully Documented Routes

### Core Routes (40 endpoints)
- ✅ `/auth` - 2 endpoints
- ✅ `/health` - 2 endpoints  
- ✅ `/status` - 3 endpoints
- ✅ `/jobs` - 10 endpoints
- ✅ `/credits` - 5 endpoints
- ✅ `/payments` - 6 endpoints
- ✅ `/cleaner` - 8 endpoints
- ✅ `/user/data` - 4 endpoints (GDPR)

### Client Routes (16 endpoints)
- ✅ `/client/favorites` - 3 endpoints (GET, POST, DELETE)
- ✅ `/client/addresses` - 5 endpoints (GET, POST, PATCH, PATCH default, DELETE)
- ✅ `/client/payment-methods` - 3 endpoints (GET, PATCH default, DELETE)
- ✅ `/client/recurring-bookings` - 3 endpoints (GET, POST, PATCH, DELETE)
- ✅ `/client/reviews` - 2 endpoints (GET given, POST)

### Communication & Tracking (13 endpoints)
- ✅ `/messages` - 5 endpoints (unread, unread by job, conversations, job messages, send, mark read)
- ✅ `/tracking` - 8 endpoints (get state, en-route, arrived, check-in, check-out, location, approve, dispute)

### Job Management (13 endpoints)
- ✅ `/photos` - 4 endpoints (GET, POST, upload-url, DELETE)
- ✅ `/cancellation` - 4 endpoints (client cancel, cleaner cancel, no-show, preview)
- ✅ `/reschedule` - 5 endpoints (create, accept, decline, get, list)

### Payments & Services (5 endpoints)
- ✅ `/stripe` - 2 endpoints (create payment intent, webhook)
- ✅ `/search` - 2 endpoints (global, autocomplete)
- ✅ `/assignment` - 1 endpoint (wave)

### Analytics & Business (10+ endpoints)
- ✅ `/analytics` - 2+ endpoints (dashboard, revenue trend)
- ✅ `/matching` - 2 endpoints (candidates, auto-assign)
- ✅ `/premium` - 3 endpoints (boost options, active boost, purchase boost)
- ✅ `/pricing` - 2 endpoints (estimate, tiers)
- ✅ `/holidays` - 1 endpoint (list/get)
- ✅ `/notifications` - 3 endpoints (feed, preferences GET, preferences PUT)
- ✅ `/alerts` - 1 endpoint (smoke test)
- ✅ `/ai` - 3 endpoints (settings GET, settings PUT, suggest slots)
- ✅ `/events` - 1 endpoint (n8n webhook)

**Total Documented:** ~120+ endpoints

---

## 🚧 Partially Documented Routes

### Analytics
- [ ] `/analytics/revenue/by-period`
- [ ] `/analytics/jobs/*` (trend, status breakdown)
- [ ] `/analytics/users/*` (signup trend)
- [ ] `/analytics/top/*` (clients, cleaners, rated cleaners)
- [ ] `/analytics/credit-economy`
- [ ] `/analytics/report`

### Premium
- [ ] `/premium/rush/*` (calculate fee, create rush job)
- [ ] `/premium/subscriptions/*` (create, get, update, cancel)
- [ ] `/premium/referrals/*` (generate code, get code, stats, validate, leaderboard)

### Notifications
- [ ] `/notifications/unread-count`
- [ ] `/notifications/:id/read`
- [ ] `/notifications/read-all`
- [ ] `/notifications/:id` (DELETE)

---

## 📋 Remaining Routes to Document

### Admin Routes (High Priority)
- [ ] `/admin` - Multiple endpoints (KPIs, disputes, payouts, users, repairs, risk, fraud)
- [ ] `/admin/analytics` - Multiple endpoints
- [ ] `/admin/bookings` - Multiple endpoints
- [ ] `/admin/cleaners` - Multiple endpoints
- [ ] `/admin/clients` - Multiple endpoints
- [ ] `/admin/finance` - Multiple endpoints
- [ ] `/admin/messages` - Multiple endpoints
- [ ] `/admin/risk` - Multiple endpoints
- [ ] `/admin/settings` - Multiple endpoints
- [ ] `/admin/system` - Multiple endpoints

### Enhanced Routes
- [ ] `/authEnhanced` - Multiple endpoints (2FA, OAuth, sessions)
- [ ] `/cleanerEnhanced` - Multiple endpoints (analytics, goals)
- [ ] `/clientEnhanced` - Multiple endpoints (insights, drafts)
- [ ] `/adminEnhanced` - Multiple endpoints (real-time, insights)

### Specialized Routes
- [ ] `/cleaner/onboarding` - Multiple endpoints (10-step onboarding)
- [ ] `/cleaner/ai` - Multiple endpoints (AI assistant settings)
- [ ] `/cleaner/ai/advanced` - Multiple endpoints (export, preview)
- [ ] `/cleaner/portal` - Multiple endpoints (my clients, invoicing)
- [ ] `/client/invoices` - Multiple endpoints
- [ ] `/admin/onboarding-reminders` - Multiple endpoints
- [ ] `/admin/id-verifications` - Multiple endpoints
- [ ] `/message-history` - Multiple endpoints
- [ ] `/gamification` - Multiple endpoints

### Other Routes
- [ ] `/scoring` - Multiple endpoints (reliability, risk, flexibility, inconvenience)
- [ ] `/manager` - Multiple endpoints (manager dashboard)
- [ ] `/v2` - Multiple endpoints (properties, teams, calendar, goals)

---

## 📊 Statistics

- **Documented:** ~120+ endpoints
- **Estimated Total:** ~180-200 endpoints
- **Completion:** ~70-80%
- **Remaining:** ~60-80 endpoints

---

## 🎯 Next Steps

1. Complete analytics routes documentation
2. Complete premium routes documentation (rush, subscriptions, referrals)
3. Complete notifications routes documentation
4. Document all admin routes
5. Document enhanced routes
6. Document specialized routes
7. Document scoring, manager, v2 routes
8. Regenerate Postman collection
9. Verify Swagger UI shows all endpoints
10. Create comprehensive API documentation guide

---

**Status:** In Progress - Continuing with remaining routes
