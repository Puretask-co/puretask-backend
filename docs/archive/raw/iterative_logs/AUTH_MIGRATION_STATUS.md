# Auth Migration Status

**Date**: 2025-01-15  
**Status**: In Progress

## Summary

Migrating all routes from legacy `authMiddleware` (header-based, dev-only) to canonical `requireAuth` (JWT-based, production-safe).

## Migration Progress

### ✅ Completed Migrations

1. **src/routes/ai.ts** - ✅ Migrated to `requireAuth`
2. **src/routes/admin.ts** - ✅ Migrated to `requireAuth` + `requireAdmin`
3. **src/routes/search.ts** - ✅ Migrated to `requireAuth` (fixed wrong import)
4. **src/routes/stripe.ts** - ✅ Migrated to `requireAuth` + `requireClient` (webhook remains signature-based)
5. **src/routes/v2.ts** - ✅ Migrated to `requireAuth`
6. **src/routes/tracking.ts** - ✅ Migrated to `requireAuth`
7. **src/routes/analytics.ts** - ✅ Migrated to `requireAuth` + `requireAdmin`
8. **src/routes/matching.ts** - ✅ Migrated to `requireAuth`
9. **src/routes/cancellation.ts** - ✅ Migrated to `requireAuth`
10. **src/routes/assignment.ts** - ✅ Migrated to `requireAuth`
11. **src/routes/alerts.ts** - ✅ Migrated to `requireAuth`
12. **src/routes/reschedule.ts** - ✅ Migrated to `requireAuth`
13. **src/routes/scoring.ts** - ✅ Migrated to `requireAuth`
14. **src/routes/premium.ts** - ✅ Migrated to `requireAuth`
15. **src/routes/manager.ts** - ✅ Migrated to `requireAuth` + `requireAdmin`
16. **src/routes/payments.ts** - ✅ Migrated to `requireAuth`

### 🔄 Remaining Work

1. **Remove legacy auth from jwtAuth.ts** - Remove dev fallback for x-user-id/x-user-role headers
2. **Deprecate src/middleware/auth.ts** - Mark as deprecated, add warnings
3. **Update analytics.ts route handlers** - Fix any remaining `requireAdmin` array usage
4. **Add ESLint rule** - Prevent imports from `src/middleware/auth.ts`
5. **Update route protection table** - Mark all routes as migrated

### ✅ Already Using Canonical Auth

These routes were already using JWT-based auth:
- `/jobs` - uses `jwtAuthMiddleware`
- `/credits` - uses `jwtAuthMiddleware` + `requireRole`
- `/cleaner` - uses `jwtAuthMiddleware` + `requireRole`
- `/client` - uses `jwtAuthMiddleware` + `requireRole`
- `/admin/*` sub-routes - use `jwtAuthMiddleware`
- `/cleaner-ai-*` - use `jwtAuthMiddleware`
- `/message-history` - uses `jwtAuthMiddleware`
- `/gamification` - uses `jwtAuthMiddleware`
- `/photos` - uses `jwtAuthMiddleware`
- `/messages` - uses `jwtAuthMiddleware`
- `/pricing` - uses `jwtAuthMiddleware`

### ✅ Webhooks (Correctly Isolated)

- `/stripe/webhook` - Uses Stripe signature verification (no JWT) ✅
- `/n8n/events` - Uses n8n HMAC verification (no JWT) ✅

## Next Steps

1. Fix analytics.ts route handlers to use `requireAdmin` correctly
2. Remove legacy auth fallback from jwtAuth.ts
3. Add deprecation warnings to src/middleware/auth.ts
4. Create ESLint rule to prevent legacy auth imports
5. Update all route handlers to use `AuthedRequest` from `authCanonical.ts`
6. Test all routes to ensure auth works correctly
7. Update documentation

## Notes

- All mutating routes now use `requireAuth`
- All role-sensitive routes use `requireRole` or convenience wrappers (`requireAdmin`, `requireClient`, `requireCleaner`)
- Webhooks are properly isolated and use signature verification
- Dev and prod behavior will be identical after removing legacy fallback
