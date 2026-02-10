# Admin Dashboard Frontend Integration Guide

## Overview

This guide explains how to integrate the comprehensive Admin Dashboard into your React frontend application. The backend APIs are now fully functional and ready to be consumed by the frontend.

## Backend API Endpoints

All admin endpoints are prefixed with `/admin` and require authentication with an `admin` or `super_admin` role.

### Available API Routes

1. **Analytics**: `/admin/analytics/*`
   - `GET /admin/analytics/overview` - Comprehensive analytics overview
   - `GET /admin/analytics/revenue` - Detailed revenue analytics
   - `GET /admin/analytics/platform-metrics` - Platform health metrics

2. **Bookings**: `/admin/bookings/*`
   - `GET /admin/bookings` - Paginated list with filters
   - `GET /admin/bookings/:id` - Detailed booking info
   - `PATCH /admin/bookings/:id/status` - Update booking status
   - `POST /admin/bookings/bulk-update` - Bulk operations
   - `GET /admin/bookings/stats/summary` - Booking statistics

3. **Cleaners**: `/admin/cleaners/*`
   - `GET /admin/cleaners` - Paginated list with filters
   - `GET /admin/cleaners/:id` - Detailed cleaner info
   - `PATCH /admin/cleaners/:id/verified-badge` - Toggle verified badge
   - `PATCH /admin/cleaners/:id/tier` - Update cleaner tier
   - `POST /admin/cleaners/:id/suspend` - Suspend cleaner account
   - `GET /admin/cleaners/stats/summary` - Cleaner statistics

4. **Clients**: `/admin/clients/*`
   - `GET /admin/clients` - Paginated list with filters
   - `GET /admin/clients/:id` - Detailed client info
   - `GET /admin/clients/:id/bookings` - Client's booking history
   - `POST /admin/clients/:id/credit` - Grant/deduct credits
   - `GET /admin/clients/stats/summary` - Client statistics

5. **Finance**: `/admin/finance/*`
   - `GET /admin/finance/overview` - Finance center overview
   - `GET /admin/finance/payouts` - All payouts with filters
   - `POST /admin/finance/payouts/process` - Process pending payouts
   - `GET /admin/finance/revenue` - Revenue reports
   - `GET /admin/finance/transactions` - Transaction history
   - `GET /admin/finance/stats` - Financial statistics

6. **Risk Management**: `/admin/risk/*`
   - `GET /admin/risk/overview` - Risk management overview
   - `GET /admin/risk/flags` - All risk flags
   - `POST /admin/risk/flags` - Create new risk flag
   - `PATCH /admin/risk/flags/:id/resolve` - Resolve risk flag
   - `GET /admin/risk/disputes` - All disputes
   - `PATCH /admin/risk/disputes/:id/status` - Update dispute status
   - `GET /admin/risk/safety-incidents` - Safety incidents
   - `GET /admin/risk/stats` - Risk statistics

7. **Messages**: `/admin/messages/*`
   - `GET /admin/messages/log` - Message delivery log
   - `GET /admin/messages/stats` - Message delivery statistics
   - `GET /admin/messages/templates` - Message templates

8. **System**: `/admin/system/*`
   - `GET /admin/system/config` - System configuration
   - `PATCH /admin/system/config` - Update system config (super admin only)
   - `GET /admin/system/health` - System health status
   - `GET /admin/system/audit-log` - Admin audit log
   - `GET /admin/system/stats` - Overall system statistics
   - `GET /admin/system/dashboard` - Dashboard overview data

## Authentication

All admin API requests must include a valid JWT token in the `Authorization` header:

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

The token must belong to a user with `role: 'admin'` or `role: 'super_admin'`.

## Frontend Implementation

### 1. API Client Setup

Create an API client for admin endpoints:

```typescript
// src/api/adminClient.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const adminClient = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add error handling interceptor
adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      // Redirect to access denied page
      window.location.href = '/access-denied';
    }
    return Promise.reject(error);
  }
);

export default adminClient;
```

### 2. React Query Setup (Recommended)

Use React Query for efficient data fetching and caching:

```typescript
// src/hooks/useAdminData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import adminClient from '@/api/adminClient';

// Analytics
export function useAdminAnalytics(period = '30d') {
  return useQuery({
    queryKey: ['admin', 'analytics', period],
    queryFn: async () => {
      const { data } = await adminClient.get('/analytics/overview', {
        params: { period }
      });
      return data;
    }
  });
}

// Bookings
export function useAdminBookings(filters: any) {
  return useQuery({
    queryKey: ['admin', 'bookings', filters],
    queryFn: async () => {
      const { data } = await adminClient.get('/bookings', {
        params: filters
      });
      return data;
    }
  });
}

// Update booking status
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: any) => {
      const { data } = await adminClient.patch(`/bookings/${id}/status`, {
        status,
        reason
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    }
  });
}

// Cleaners
export function useAdminCleaners(filters: any) {
  return useQuery({
    queryKey: ['admin', 'cleaners', filters],
    queryFn: async () => {
      const { data } = await adminClient.get('/cleaners', {
        params: filters
      });
      return data;
    }
  });
}

// Toggle verified badge
export function useToggleVerifiedBadge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { data } = await adminClient.patch(`/cleaners/${id}/verified-badge`, {
        verified
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cleaners'] });
    }
  });
}

// System dashboard
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await adminClient.get('/system/dashboard');
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}
```

### 3. Component Structure

Organize your admin components like this:

```
src/
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminBookingsConsole.tsx
│   │   ├── AdminCleanerManagement.tsx
│   │   ├── AdminClientManagement.tsx
│   │   ├── AdminAnalytics.tsx
│   │   ├── AdminFinanceCenter.tsx
│   │   ├── AdminRiskManagement.tsx
│   │   ├── AdminMessages.tsx
│   │   └── AdminSystemConfig.tsx
│   └── ...
├── components/
│   ├── admin/
│   │   ├── BookingStatusBadge.tsx
│   │   ├── CleanerCard.tsx
│   │   ├── StatCard.tsx
│   │   ├── DataTable.tsx
│   │   └── ...
│   └── ...
├── hooks/
│   └── useAdminData.ts
├── api/
│   └── adminClient.ts
└── ...
```

### 4. Routing Setup

Use React Router to set up admin routes:

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookingsConsole from './pages/admin/AdminBookingsConsole';
// ... other imports

function AdminRoutes() {
  const { user } = useAuth();
  
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/access-denied" />;
  }
  
  return (
    <Routes>
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/bookings" element={<AdminBookingsConsole />} />
      <Route path="/cleaners" element={<AdminCleanerManagement />} />
      <Route path="/clients" element={<AdminClientManagement />} />
      <Route path="/analytics" element={<AdminAnalytics />} />
      <Route path="/finance" element={<AdminFinanceCenter />} />
      <Route path="/risk" element={<AdminRiskManagement />} />
      <Route path="/messages" element={<AdminMessages />} />
      <Route path="/system" element={<AdminSystemConfig />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... other routes */}
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 5. Sample Component: AdminDashboard

See the provided React components in the `admin-components` folder for complete implementations.

## UI Library Recommendations

The provided components are built for shadcn/ui, but can be adapted for:

- **Material-UI (MUI)**: Replace with `DataGrid`, `Card`, `Button`, etc.
- **Ant Design**: Replace with `Table`, `Card`, `Button`, etc.
- **Chakra UI**: Replace with `Table`, `Box`, `Button`, etc.
- **Tailwind CSS**: Components are already Tailwind-compatible

## Security Considerations

1. **Role-Based Access Control**: Always verify user role on the frontend AND backend
2. **API Key Protection**: Never expose API keys in frontend code
3. **XSS Prevention**: Sanitize all user inputs
4. **CSRF Protection**: Use CSRF tokens for state-changing operations
5. **Rate Limiting**: Backend already has rate limiting enabled
6. **Audit Logging**: All admin actions are logged automatically

## Testing Admin APIs

### Using cURL

```bash
# Get admin dashboard data
curl -X GET http://localhost:4000/admin/system/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get bookings with filters
curl -X GET "http://localhost:4000/admin/bookings?status=scheduled&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update booking status
curl -X PATCH http://localhost:4000/admin/bookings/BOOKING_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "reason": "Admin override"}'
```

### Using Postman

1. Create a new collection "PureTask Admin API"
2. Set collection-level authorization: Bearer Token
3. Add environment variables: `API_URL`, `AUTH_TOKEN`
4. Import the API endpoints from this documentation

## Next Steps

1. ✅ Backend APIs are fully functional and ready to use
2. 📝 Review the sample React components in `admin-components/`
3. 🎨 Customize the UI to match your brand
4. 🧪 Test all endpoints with your authentication system
5. 🚀 Deploy and monitor

## Support & Documentation

- **API Documentation**: See individual route files in `src/routes/admin/`
- **TypeScript Types**: See `src/types/admin.ts` for all response types
- **Authentication**: See `src/middleware/adminAuth.ts` for auth logic
- **Sample Data**: Use the existing admin routes for testing

## Performance Optimization

1. **Pagination**: All list endpoints support pagination
2. **Caching**: Use React Query's built-in caching
3. **Lazy Loading**: Load admin components only when needed
4. **Debouncing**: Debounce search inputs (300ms recommended)
5. **Virtual Scrolling**: Use for large tables (1000+ rows)

---

**Status**: Backend 100% Complete ✅ | Frontend Components Ready for Integration 🎨

