# Apply Components to All Pages - Quick Reference

**Status**: 5/32 pages complete (16%)

---

## ✅ **COMPLETED PAGES**

1. ✅ `/client/bookings` - Loading, error, empty states
2. ✅ `/client/dashboard` - Loading states, empty states
3. ✅ `/search` - Loading, error states
4. ✅ `/cleaner/dashboard` - Loading states
5. ✅ `/cleaner/jobs/requests` - Loading, error states

---

## 📋 **REMAINING PAGES TO UPDATE**

### **Client Pages** (8 remaining)
- [ ] `/client/bookings/[id]` - Loading, error states
- [ ] `/client/settings` - Form validation, loading states
- [ ] `/client/recurring` - Loading, error, empty states
- [ ] `/favorites` - Already has some, enhance with new components
- [ ] `/booking` - Form validation, loading states
- [ ] `/booking/confirm/[id]` - Loading states
- [ ] `/cleaner/[id]` - Loading, error states
- [ ] `/reviews` - Loading, error, empty states

### **Cleaner Pages** (10 remaining)
- [ ] `/cleaner/calendar` - Loading, error states
- [ ] `/cleaner/earnings` - Loading, error states
- [ ] `/cleaner/jobs/[id]` - Loading, error states
- [ ] `/cleaner/profile` - Form validation, loading states
- [ ] `/cleaner/availability` - Form validation, loading states
- [ ] `/cleaner/certifications` - Loading, error, empty states
- [ ] `/cleaner/leaderboard` - Loading, error states
- [ ] `/cleaner/progress` - Loading, error states
- [ ] `/cleaner/team` - Loading, error, empty states
- [ ] `/cleaner/ai-assistant/*` - Loading, error states

### **Admin Pages** (8 remaining)
- [ ] `/admin/dashboard` - Loading, error states
- [ ] `/admin/bookings` - Loading, error states
- [ ] `/admin/users` - Loading, error states
- [ ] `/admin/disputes` - Loading, error states
- [ ] `/admin/analytics` - Loading, error states
- [ ] `/admin/finance` - Loading, error states
- [ ] `/admin/communication` - Loading, error states
- [ ] `/admin/settings` - Form validation, loading states

### **Other Pages** (1 remaining)
- [ ] `/messages` - Already has some, enhance with new components

---

## 🔧 **QUICK UPDATE PATTERN**

For each page, add:

```tsx
// Imports
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ErrorDisplay } from '@/components/error/ErrorDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useErrorHandler } from '@/hooks/useErrorHandler';

// In component
const { handleError } = useErrorHandler();

// Loading state
if (isLoading) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-8 px-6">
        <SkeletonList items={6} />
      </main>
    </div>
  );
}

// Error state
if (error) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 py-8 px-6">
        <ErrorDisplay error={error} onRetry={() => refetch()} variant="card" />
      </main>
    </div>
  );
}

// Empty state
{items.length === 0 ? <EmptyState ... /> : <ItemsList />}
```

---

**Next**: Systematically apply to all remaining pages.
