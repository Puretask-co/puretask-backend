# Admin Portal - Complete Setup Guide

## Overview

This guide will help you set up a dedicated admin portal for PureTask with a separate login page and centralized dashboard for all admin capabilities.

## Admin User Credentials

```
Email: nathan@puretask.co
Password: BaileeJane7!
Role: admin
```

## Quick Setup

### 1. Create the Admin User

Run the setup script:

```bash
node scripts/create-admin-user.js
```

This will:
- ✅ Create the admin user `nathan@puretask.co`
- ✅ Set the password to `BaileeJane7!`
- ✅ Assign admin role
- ✅ Create necessary profiles

### 2. Test Admin Login

```bash
# Start the server
npm run dev

# Test login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nathan@puretask.co",
    "password": "BaileeJane7!"
  }'
```

You should receive a JWT token in the response.

## Admin Portal Structure

The admin portal is organized into a single, centralized interface with all capabilities accessible from one place.

### Portal URL Structure

```
/admin              → Admin Dashboard (Overview)
/admin/login        → Admin Login Page
/admin/bookings     → Bookings Management
/admin/cleaners     → Cleaner Management
/admin/clients      → Client Management
/admin/analytics    → Analytics & Reports
/admin/finance      → Finance Center
/admin/risk         → Risk Management
/admin/messages     → Message Log & Templates
/admin/system       → System Configuration
```

## Admin Portal Features

### 🏠 **Dashboard** (`/admin`)
- Overview statistics
- Recent bookings
- System health
- Quick alerts
- Platform metrics

### 📋 **Bookings Console** (`/admin/bookings`)
- View all bookings
- Filter by status, date, client, cleaner
- Update booking status
- Bulk operations
- Export data

### 👥 **Cleaner Management** (`/admin/cleaners`)
- List all cleaners
- View detailed profiles
- Manage tiers (Rookie → Platinum)
- Toggle verified badges
- Suspend accounts
- View performance metrics

### 🏢 **Client Management** (`/admin/clients`)
- List all clients
- View booking history
- Manage credits
- View risk flags
- Export client data

### 📊 **Analytics** (`/admin/analytics`)
- Revenue reports
- Booking trends
- Cleaner performance
- Client retention
- Platform growth

### 💰 **Finance Center** (`/admin/finance`)
- Pending payouts
- Revenue breakdown
- Transaction history
- Process payouts
- Financial reports

### ⚠️ **Risk Management** (`/admin/risk`)
- Flagged users
- Active disputes
- Safety incidents
- Risk statistics

### 📧 **Messages** (`/admin/messages`)
- Message delivery log
- Delivery statistics
- Template management
- AI message tracking

### ⚙️ **System Config** (`/admin/system`)
- Feature flags
- Platform settings
- Pricing configuration
- System health
- Audit log

## Frontend Implementation

### Option 1: Standalone Admin Portal (Recommended)

Create a separate React app for the admin portal:

```bash
# Create new React app
npx create-react-app puretask-admin --template typescript

cd puretask-admin

# Install dependencies
npm install react-router-dom @tanstack/react-query axios
npm install -D @types/react-router-dom

# Install UI library (choose one)
npm install @shadcn/ui tailwindcss  # shadcn/ui
# OR
npm install @mui/material @emotion/react @emotion/styled  # Material-UI
# OR
npm install antd  # Ant Design
```

### Option 2: Integrated Admin Section

Add admin routes to your existing React app:

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
// ... import other admin pages

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/admin/login" />;
  }
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return <Navigate to="/access-denied" />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Protected admin routes */}
        <Route path="/admin" element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="bookings" element={<AdminBookingsConsole />} />
          <Route path="cleaners" element={<AdminCleanerManagement />} />
          <Route path="clients" element={<AdminClientManagement />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="finance" element={<AdminFinanceCenter />} />
          <Route path="risk" element={<AdminRiskManagement />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="system" element={<AdminSystemConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

## Complete Admin Portal Components

See the provided React components in the `admin-portal/` directory for complete implementations:

```
admin-portal/
├── pages/
│   ├── AdminLogin.tsx           → Dedicated login page
│   ├── AdminDashboard.tsx       → Main dashboard
│   ├── AdminBookingsConsole.tsx → Bookings management
│   ├── AdminCleanerManagement.tsx
│   ├── AdminClientManagement.tsx
│   ├── AdminAnalytics.tsx
│   ├── AdminFinanceCenter.tsx
│   ├── AdminRiskManagement.tsx
│   ├── AdminMessages.tsx
│   └── AdminSystemConfig.tsx
├── layouts/
│   └── AdminLayout.tsx          → Shared layout with sidebar
├── components/
│   ├── AdminSidebar.tsx         → Navigation sidebar
│   ├── AdminHeader.tsx          → Top header with user menu
│   └── ...
└── hooks/
    └── useAdminAuth.ts          → Admin authentication hook
```

## Security Best Practices

### 1. Separate Admin Domain (Recommended)

Host admin portal on a separate subdomain:

```
Main App: https://app.puretask.com
Admin Portal: https://admin.puretask.com
```

Benefits:
- Better security isolation
- Separate deployment pipeline
- Can add IP whitelist
- Clearer separation of concerns

### 2. IP Whitelisting (Optional)

Restrict admin access to specific IPs:

```typescript
// src/middleware/adminAuth.ts
const ALLOWED_ADMIN_IPS = [
  '203.0.113.0',  // Office IP
  '198.51.100.0'  // VPN IP
];

export function ipWhitelist(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip;
  
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ADMIN_IPS.includes(clientIp)) {
    return res.status(403).json({
      error: 'Access denied from this IP address'
    });
  }
  
  next();
}

// Use it:
adminRouter.use(ipWhitelist);
```

### 3. Two-Factor Authentication

Add 2FA for admin users (recommended for production):

```typescript
// Already implemented in auth system (migration 025)
// Enable 2FA for admin user:
UPDATE users 
SET two_factor_enabled = true 
WHERE email = 'nathan@puretask.co';
```

## Quick Start Checklist

- [ ] Run `node scripts/create-admin-user.js`
- [ ] Verify admin user created successfully
- [ ] Test login with credentials
- [ ] Set up frontend admin portal
- [ ] Configure admin routes
- [ ] Test all admin endpoints
- [ ] Set up proper CORS for admin domain
- [ ] Enable audit logging
- [ ] Set up IP whitelist (if needed)
- [ ] Enable 2FA for admin accounts
- [ ] Deploy admin portal

## Environment Variables

Add to your `.env`:

```bash
# Admin Configuration
ADMIN_PORTAL_URL=http://localhost:3000  # or https://admin.puretask.com
ADMIN_SESSION_TIMEOUT=3600  # 1 hour in seconds
ENABLE_ADMIN_IP_WHITELIST=false
ADMIN_2FA_REQUIRED=true
```

## Testing Admin Portal

### 1. Test Login

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nathan@puretask.co",
    "password": "BaileeJane7!"
  }'
```

### 2. Test Dashboard Access

```bash
TOKEN="your_jwt_token_here"

curl http://localhost:4000/admin/system/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test All Admin Endpoints

Run the comprehensive test:

```bash
# Create test script
node scripts/test-admin-endpoints.js
```

## Admin Portal Deployment

### Frontend Deployment

```bash
# Build admin portal
cd admin-portal
npm run build

# Deploy to hosting (examples)
# Vercel:
vercel deploy

# Netlify:
netlify deploy

# AWS S3:
aws s3 sync build/ s3://admin.puretask.com
```

### Backend Configuration

Update CORS for admin domain:

```typescript
// src/index.ts
app.use(cors({
  origin: [
    'https://app.puretask.com',
    'https://admin.puretask.com',  // Add this
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));
```

## Monitoring & Maintenance

### View Admin Activity

```bash
# Check audit log
curl http://localhost:4000/admin/system/audit-log \
  -H "Authorization: Bearer $TOKEN"
```

### Monitor System Health

```bash
# Check system health
curl http://localhost:4000/admin/system/health \
  -H "Authorization: Bearer $TOKEN"
```

## Support

For issues or questions:
1. Check logs: `npm run dev` (view console output)
2. Verify admin user exists: Check database users table
3. Test authentication: Use curl commands above
4. Review documentation: `ADMIN_SYSTEM_COMPLETE.md`

---

**Admin Portal Status**: ✅ Backend Complete | Frontend Ready for Integration

**Admin User**: nathan@puretask.co (Ready to use)

