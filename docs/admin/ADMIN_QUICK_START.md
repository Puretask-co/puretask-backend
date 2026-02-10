# Admin System Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Verify Installation

The admin system has been fully integrated into your PureTask backend. All files are in place:

```
✅ src/middleware/adminAuth.ts
✅ src/types/admin.ts
✅ src/routes/admin/index.ts
✅ src/routes/admin/analytics.ts
✅ src/routes/admin/bookings.ts
✅ src/routes/admin/cleaners.ts
✅ src/routes/admin/clients.ts
✅ src/routes/admin/finance.ts
✅ src/routes/admin/risk.ts
✅ src/routes/admin/messages.ts
✅ src/routes/admin/system.ts
✅ src/index.ts (updated)
```

### Step 2: Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:4000` (or your configured port).

### Step 3: Create an Admin User

You'll need a user account with admin privileges. If you don't have one, create it using your existing user creation method, then update the role:

```sql
-- Connect to your database and run:
UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com';
```

### Step 4: Get Admin Token

Login to get your JWT token:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin@email.com",
    "password": "your-password"
  }'
```

Save the returned token - you'll need it for all admin requests.

### Step 5: Test Admin Endpoints

#### Test 1: Admin Dashboard

```bash
curl http://localhost:4000/admin/system/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response**: JSON with overview stats, recent bookings, system health

#### Test 2: Analytics Overview

```bash
curl http://localhost:4000/admin/analytics/overview?period=30d \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response**: Revenue, bookings, cleaners, and clients analytics

#### Test 3: Bookings List

```bash
curl "http://localhost:4000/admin/bookings?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response**: Paginated list of bookings

#### Test 4: Cleaners List

```bash
curl "http://localhost:4000/admin/cleaners?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response**: Paginated list of cleaners with stats

#### Test 5: System Health

```bash
curl http://localhost:4000/admin/system/health \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response**: System health status, uptime, checks

---

## 📊 Available Admin Routes

### Quick Reference

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Dashboard | `/admin/system/dashboard` | Overview, stats, alerts |
| Analytics | `/admin/analytics` | `/overview`, `/revenue`, `/platform-metrics` |
| Bookings | `/admin/bookings` | `/`, `/:id`, `/stats/summary` |
| Cleaners | `/admin/cleaners` | `/`, `/:id`, `/:id/verified-badge` |
| Clients | `/admin/clients` | `/`, `/:id`, `/:id/bookings` |
| Finance | `/admin/finance` | `/overview`, `/payouts`, `/revenue` |
| Risk | `/admin/risk` | `/overview`, `/flags`, `/disputes` |
| Messages | `/admin/messages` | `/log`, `/stats`, `/templates` |
| System | `/admin/system` | `/config`, `/health`, `/audit-log` |

---

## 🔐 Authentication

All admin endpoints require:
1. Valid JWT token in Authorization header
2. User role: `admin` or `super_admin`

### Authorization Header Format

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Testing with Different Roles

- **Admin**: Can access all admin endpoints except system config updates
- **Super Admin**: Can access everything, including sensitive system config updates

---

## 🧪 Testing with Postman

### Import Collection

1. Open Postman
2. Create new collection: "PureTask Admin API"
3. Add these environment variables:
   - `BASE_URL`: `http://localhost:4000`
   - `AUTH_TOKEN`: (your JWT token)

### Sample Requests

#### 1. Get Dashboard Data
```
GET {{BASE_URL}}/admin/system/dashboard
Authorization: Bearer {{AUTH_TOKEN}}
```

#### 2. Get Bookings with Filters
```
GET {{BASE_URL}}/admin/bookings?status=scheduled&page=1&limit=20
Authorization: Bearer {{AUTH_TOKEN}}
```

#### 3. Update Booking Status
```
PATCH {{BASE_URL}}/admin/bookings/:bookingId/status
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "status": "completed",
  "reason": "Admin override for testing"
}
```

#### 4. Toggle Cleaner Verified Badge
```
PATCH {{BASE_URL}}/admin/cleaners/:cleanerId/verified-badge
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "verified": true
}
```

---

## 🐛 Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Missing or invalid token

**Solution**: 
1. Verify token is valid
2. Check token hasn't expired
3. Ensure Authorization header is set correctly

### Issue: 403 Forbidden

**Cause**: User doesn't have admin role

**Solution**: 
```sql
-- Update user role in database
UPDATE users SET role = 'admin' WHERE id = 'USER_ID';
```

### Issue: 404 Not Found

**Cause**: Admin routes not registered

**Solution**: 
- Verify `src/index.ts` imports from `./routes/admin/index`
- Restart server: `npm run dev`

### Issue: 500 Internal Server Error

**Cause**: Database query error or missing data

**Solution**: 
1. Check server logs for details
2. Verify database schema is up to date
3. Check `DB/migrations/026_ai_assistant_schema.sql` was run
4. Ensure all required tables exist

---

## 📈 Monitoring & Logs

### View Server Logs

```bash
# In your terminal where the server is running
# Look for log entries like:
# info: Admin analytics retrieved { adminId: '...', period: '30d' }
# info: Admin bookings list retrieved { adminId: '...', count: 10 }
```

### Check Audit Log

```bash
curl http://localhost:4000/admin/system/audit-log \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

All admin actions are automatically logged with:
- Admin user ID
- Action performed
- Resource affected
- Timestamp
- IP address

---

## 🎯 Next Steps

### 1. Test All Endpoints

Go through each module and test the key endpoints:
- ✅ Dashboard
- ✅ Analytics
- ✅ Bookings
- ✅ Cleaners
- ✅ Clients
- ✅ Finance
- ✅ Risk Management
- ✅ Messages
- ✅ System Config

### 2. Build Frontend

Use the documentation in `docs/ADMIN_DASHBOARD_FRONTEND.md` to:
- Set up React app
- Install dependencies (React Query, Axios, shadcn/ui)
- Create admin pages
- Implement authentication flow

### 3. Customize

Adjust the admin system to your needs:
- Add custom filters
- Modify data returned
- Add new analytics
- Customize permissions

### 4. Deploy

When ready:
- Update environment variables
- Deploy backend to production
- Deploy frontend admin dashboard
- Set up monitoring

---

## 📚 Additional Resources

- **Complete Documentation**: `ADMIN_SYSTEM_COMPLETE.md`
- **Frontend Guide**: `docs/ADMIN_DASHBOARD_FRONTEND.md`
- **Type Definitions**: `src/types/admin.ts`
- **Authentication**: `src/middleware/adminAuth.ts`

---

## ✅ Checklist

Before going to production:

- [ ] Test all admin endpoints
- [ ] Verify authentication works
- [ ] Check authorization (admin vs super_admin)
- [ ] Review audit logging
- [ ] Test error handling
- [ ] Set up monitoring
- [ ] Create admin user accounts
- [ ] Document admin workflows
- [ ] Train admin team
- [ ] Deploy frontend dashboard

---

**Status**: Backend 100% Complete ✅

**Ready to use immediately!**

For questions or issues, refer to the complete documentation in `ADMIN_SYSTEM_COMPLETE.md`.

