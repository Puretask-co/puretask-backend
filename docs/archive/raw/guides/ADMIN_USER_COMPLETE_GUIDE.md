# 👨‍💼 **ADMIN USER - COMPLETE GUIDE & TEST CHECKLIST**

## 📋 **Quick Reference**

**Admin Credentials:**
- Email: `nathan@puretask.co`
- Password: `BaileeJane7!`
- Role: **Admin** (Full Platform Access)

**Admin Dashboard:** http://localhost:3001/admin

---

## 🎯 **What Can Admins Do?**

As an admin, you have **complete control** over the PureTask platform:
- ✅ View all users, bookings, and transactions
- ✅ Manage user accounts (approve, suspend, delete)
- ✅ Monitor platform analytics and performance
- ✅ Configure system settings
- ✅ Handle disputes and issues
- ✅ Manage financial operations
- ✅ Send platform-wide communications
- ✅ Access API and integration settings
- ✅ Generate reports and exports
- ✅ Monitor security and risk factors

---

## 🚀 **STEP-BY-STEP ADMIN GUIDE**

### **SECTION 1: LOGIN & FIRST ACCESS**

#### **1.1 Login Process**
- [ ] Go to: http://localhost:3001/auth/login
- [ ] Enter email: `nathan@puretask.co`
- [ ] Enter password: `BaileeJane7!`
- [ ] Click "Sign In"

**Expected Result:**
- ✅ You should be automatically redirected to `/admin/dashboard`
- ✅ Header should show your email with a **purple "Admin" badge**
- ✅ Navigation shows "Admin Panel" button

**If Login Fails:**
- Check that backend server is running (port 4000)
- Verify `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000`
- Check browser console for errors

#### **1.2 First Look - Dashboard Overview**
- [ ] Verify you see the main admin dashboard
- [ ] Check that statistics cards are visible (Total Users, Active Bookings, Revenue, Pending Issues)
- [ ] Confirm charts are loading (Revenue Trends, Daily Bookings, User Distribution)
- [ ] Check Recent Activity feed on the right side

**What You Should See:**
- **Stats Cards (Top Row):**
  - Total Users count
  - Active Bookings count
  - Total Revenue ($)
  - Pending Issues count
- **Revenue Trends Chart:**
  - Line chart with toggles for Week/Month/Year
  - Shows revenue over time
- **Daily Bookings Chart:**
  - Bar chart showing last 14 days of bookings
- **Distribution Charts:**
  - Donut chart: Clients vs Cleaners
  - Donut chart: Booking status breakdown
- **Activity Feed:**
  - Recent platform events
  - User registrations, bookings, payments

---

### **SECTION 2: USER MANAGEMENT** `/admin/users`

#### **2.1 Access User Management**
- [ ] Click "Admin Panel" in header (or navigate to `/admin/users`)
- [ ] Verify user list loads
- [ ] Check pagination controls at bottom

**What You Should See:**
- List of all registered users
- Search bar at top
- Filter options (Role, Status)
- User cards/rows with:
  - Avatar/initials
  - Name and email
  - Role badge (Admin/Cleaner/Client)
  - Status badge (Active/Suspended/Pending)
  - Created date
  - Action buttons (View, Edit, More)

#### **2.2 Search for Users**
- [ ] Type in search bar: Try searching by name or email
- [ ] Verify results update in real-time
- [ ] Clear search and verify all users return

**Test Searches:**
- Search for "test" (should find test accounts)
- Search for "cleaner" (should find test cleaners)
- Search for your admin email
- Search for non-existent user (should show "No users found")

#### **2.3 Filter Users by Role**
- [ ] Click "Role" filter dropdown
- [ ] Select "Admin" - should show only admins
- [ ] Select "Cleaner" - should show only cleaners
- [ ] Select "Client" - should show only clients
- [ ] Select "All" - should show everyone

**Expected Counts:**
- Admins: Should see yourself at minimum
- Cleaners: Should see test cleaner accounts
- Clients: Should see test client accounts

#### **2.4 Filter Users by Status**
- [ ] Click "Status" filter dropdown
- [ ] Select "Active" - shows active users
- [ ] Select "Suspended" - shows suspended users
- [ ] Select "Pending" - shows pending approvals
- [ ] Select "All" - shows everyone

#### **2.5 View User Details**
- [ ] Click on any user card/row
- [ ] Verify user detail panel/modal opens

**User Detail Should Show:**
- Full profile information
- Contact details (email, phone)
- Account creation date
- Current status and role
- Activity history
- Bookings (if applicable)
- Reviews/ratings (if applicable)
- Action buttons (Edit, Suspend, Delete)

#### **2.6 Update User Role** (⚠️ Use Carefully)
- [ ] Open a test user's details
- [ ] Find "Change Role" option
- [ ] Try changing client to cleaner (or vice versa)
- [ ] Verify role updates successfully
- [ ] Check that user's badge updates

**Test This With:**
- Create a test account first
- Don't change your own admin role!

#### **2.7 Suspend a User**
- [ ] Select a test user
- [ ] Click "Suspend" or "Change Status" → "Suspended"
- [ ] Confirm the action
- [ ] Verify user status changes to "Suspended"
- [ ] (Optional) Try logging in as that user - should be blocked

#### **2.8 Activate a Suspended User**
- [ ] Find the suspended user
- [ ] Click "Activate" or "Change Status" → "Active"
- [ ] Verify status changes to "Active"

#### **2.9 Delete a User** (⚠️ Destructive Action)
- [ ] Select a test user
- [ ] Click "Delete" or "More" → "Delete User"
- [ ] Confirm deletion in warning modal
- [ ] Verify user is removed from list

**Warning:** This is permanent! Only test with test accounts.

#### **2.10 Pagination**
- [ ] If more than 20 users, check pagination controls
- [ ] Click "Next" page
- [ ] Click "Previous" page
- [ ] Try jumping to specific page number

---

### **SECTION 3: BOOKING MANAGEMENT** `/admin/bookings`

#### **3.1 Access Booking Management**
- [ ] Navigate to `/admin/bookings`
- [ ] Verify booking list loads
- [ ] Check filter options available

**What You Should See:**
- List of all bookings across platform
- Filter options: Status, Date Range, Client, Cleaner
- Search bar
- Booking cards/rows showing:
  - Booking ID
  - Client name
  - Cleaner name
  - Service type
  - Date/time
  - Status (Pending, Confirmed, In Progress, Completed, Cancelled)
  - Price
  - Action buttons

#### **3.2 Filter Bookings by Status**
- [ ] Filter: "Pending" - shows bookings awaiting confirmation
- [ ] Filter: "Confirmed" - shows accepted bookings
- [ ] Filter: "In Progress" - shows active bookings
- [ ] Filter: "Completed" - shows finished bookings
- [ ] Filter: "Cancelled" - shows cancelled bookings
- [ ] Filter: "All" - shows everything

#### **3.3 Search Bookings**
- [ ] Search by booking ID
- [ ] Search by client name
- [ ] Search by cleaner name
- [ ] Search by service type

#### **3.4 View Booking Details**
- [ ] Click on a booking
- [ ] Verify details modal/page opens

**Booking Details Should Show:**
- Client information
- Cleaner information
- Service details (type, date, time, location)
- Pricing breakdown
- Status history/timeline
- Messages between client and cleaner
- Payment status
- Any special instructions/notes
- Option to view/download invoice

#### **3.5 Monitor Booking Issues**
- [ ] Look for bookings marked as "Disputed" or with warnings
- [ ] Check for bookings with unread admin messages
- [ ] Review any flagged bookings

#### **3.6 Intervene in Booking** (If needed)
- [ ] Open a booking with issues
- [ ] Send message to client and/or cleaner
- [ ] Update booking status (if authorized)
- [ ] Process refund (if needed)
- [ ] Cancel booking (if necessary)

#### **3.7 Export Booking Data**
- [ ] Look for "Export" or "Download" button
- [ ] Select date range
- [ ] Choose format (CSV, Excel, PDF)
- [ ] Download and verify file

---

### **SECTION 4: ANALYTICS DASHBOARD** `/admin/analytics`

#### **4.1 Access Analytics**
- [ ] Navigate to `/admin/analytics`
- [ ] Wait for data to load

**What You Should See:**
- Multiple tabs: Platform, Users, Financial, Services
- Timeframe selector (Day, Week, Month, Year)
- Multiple charts and graphs
- Key metrics and KPIs

#### **4.2 Platform Analytics Tab**
- [ ] Click "Platform" tab (if not default)
- [ ] Review metrics:
  - [ ] Total Users
  - [ ] Active Users
  - [ ] Total Bookings
  - [ ] Completed Bookings
  - [ ] Revenue
  - [ ] Growth Rate (%)

#### **4.3 User Analytics Tab**
- [ ] Click "Users" tab
- [ ] Review metrics:
  - [ ] New Clients (this period)
  - [ ] New Cleaners (this period)
  - [ ] User Retention Rate (%)
  - [ ] Churn Rate (%)
  - [ ] User growth chart

#### **4.4 Financial Analytics Tab**
- [ ] Click "Financial" tab
- [ ] Review metrics:
  - [ ] GMV (Gross Merchandise Value)
  - [ ] Commission Revenue
  - [ ] Average Booking Value
  - [ ] Revenue by Service Type
  - [ ] Revenue trends chart

#### **4.5 Service Analytics Tab**
- [ ] Click "Services" tab (if available)
- [ ] Review:
  - [ ] Most popular services
  - [ ] Service revenue breakdown
  - [ ] Average service duration
  - [ ] Service rating averages

#### **4.6 Change Timeframe**
- [ ] Select "Day" - view today's stats
- [ ] Select "Week" - view last 7 days
- [ ] Select "Month" - view last 30 days
- [ ] Select "Year" - view last 12 months
- [ ] Verify charts update accordingly

---

### **SECTION 5: FINANCIAL MANAGEMENT** `/admin/finance`

#### **5.1 Access Finance Dashboard**
- [ ] Navigate to `/admin/finance`
- [ ] Review financial overview

**What You Should See:**
- Revenue summary cards
- Payment processing overview
- Payout management section
- Transaction history
- Financial charts
- Export options

#### **5.2 Revenue Overview**
- [ ] Check total platform revenue
- [ ] Review revenue by time period
- [ ] Check commission earned
- [ ] Verify revenue breakdown by service type

#### **5.3 Payment Processing**
- [ ] View successful payments
- [ ] Check pending payments
- [ ] Review failed payments
- [ ] Check refund requests

#### **5.4 Cleaner Payouts**
- [ ] View pending payout requests
- [ ] Review payout history
- [ ] Check total paid to cleaners
- [ ] Process pending payouts (if available)

**Payout Actions:**
- [ ] Approve payout request
- [ ] Reject payout (with reason)
- [ ] Mark as paid
- [ ] View payout details

#### **5.5 Transaction History**
- [ ] View all transactions
- [ ] Filter by type (booking payment, payout, refund)
- [ ] Search by transaction ID
- [ ] View transaction details

#### **5.6 Financial Reports**
- [ ] Generate revenue report
- [ ] Generate payout report
- [ ] Export financial data (CSV/Excel)
- [ ] Schedule automated reports (if available)

---

### **SECTION 6: PLATFORM SETTINGS** `/admin/settings`

#### **6.1 Access Settings**
- [ ] Navigate to `/admin/settings`
- [ ] Review available configuration options

**Settings Categories:**
- General Settings
- Email Settings
- SMS/Notification Settings
- Payment Settings
- Service Configuration
- Security Settings
- Feature Flags
- API Settings

#### **6.2 General Settings**
- [ ] Platform name
- [ ] Platform logo
- [ ] Support email
- [ ] Support phone
- [ ] Business hours
- [ ] Timezone
- [ ] Default language

#### **6.3 Email Settings**
- [ ] Email templates
- [ ] SMTP configuration
- [ ] Email notification preferences
- [ ] Test email sending

#### **6.4 SMS/Notification Settings**
- [ ] SMS provider settings
- [ ] Push notification configuration
- [ ] Notification preferences
- [ ] Test SMS/push

#### **6.5 Payment Settings**
- [ ] Stripe configuration (live vs test keys)
- [ ] Commission rate (%)
- [ ] Payment terms
- [ ] Refund policy settings
- [ ] Supported payment methods

#### **6.6 Service Configuration**
- [ ] Available service types
- [ ] Service categories
- [ ] Base pricing
- [ ] Service durations
- [ ] Add/edit/remove services

#### **6.7 Security Settings**
- [ ] Two-factor authentication (if available)
- [ ] Session timeout
- [ ] Password requirements
- [ ] IP whitelist/blacklist
- [ ] API rate limits

#### **6.8 Feature Flags**
- [ ] Enable/disable features
- [ ] Beta feature access
- [ ] Maintenance mode toggle
- [ ] A/B test configurations

#### **6.9 API Settings**
- [ ] API keys management
- [ ] Webhook configurations
- [ ] Third-party integrations
- [ ] API documentation access

---

### **SECTION 7: RISK MANAGEMENT** `/admin/risk`

#### **7.1 Access Risk Dashboard**
- [ ] Navigate to `/admin/risk`
- [ ] Review risk overview

**What You Should See:**
- Fraud detection alerts
- Suspicious activity log
- User verification queue
- Background check status
- Dispute management
- Ban/suspension history

#### **7.2 Fraud Detection**
- [ ] Review flagged transactions
- [ ] Check suspicious booking patterns
- [ ] Review duplicate account alerts
- [ ] Verify unusual activity reports

#### **7.3 User Verification Queue**
- [ ] View users pending verification
- [ ] Review submitted documents
- [ ] Approve or reject verifications
- [ ] Request additional information

#### **7.4 Background Checks** (For Cleaners)
- [ ] View pending background checks
- [ ] Review check results
- [ ] Approve or flag cleaners
- [ ] Track renewal dates

#### **7.5 Dispute Management**
- [ ] View active disputes
- [ ] Review dispute details (both sides)
- [ ] Mediate disputes
- [ ] Make final decisions
- [ ] Process refunds if needed

#### **7.6 Ban/Suspension History**
- [ ] View all suspended/banned users
- [ ] Review reasons for suspensions
- [ ] Check suspension durations
- [ ] Reinstate users if appropriate

---

### **SECTION 8: COMMUNICATION TOOLS** `/admin/communication`

#### **8.1 Access Communication Center**
- [ ] Navigate to `/admin/communication`
- [ ] Review communication options

**Available Tools:**
- Platform announcements
- Email broadcasts
- SMS campaigns
- In-app messages
- Chat moderation
- Support tickets

#### **8.2 Send Platform Announcement**
- [ ] Click "New Announcement"
- [ ] Select audience:
  - [ ] All Users
  - [ ] Clients Only
  - [ ] Cleaners Only
  - [ ] Admins Only
  - [ ] Custom segment
- [ ] Write announcement title
- [ ] Write announcement message
- [ ] Choose delivery method (Email, SMS, In-App, All)
- [ ] Schedule or send immediately
- [ ] Confirm and send

#### **8.3 Email Broadcast**
- [ ] Create new email campaign
- [ ] Select template or create custom
- [ ] Choose recipient segment
- [ ] Preview email
- [ ] Send test email to yourself
- [ ] Schedule or send broadcast

#### **8.4 SMS Campaign** (If configured)
- [ ] Create SMS message (160 char limit)
- [ ] Select recipients
- [ ] Preview and test
- [ ] Send campaign

#### **8.5 In-App Messages**
- [ ] Create in-app notification
- [ ] Target specific user groups
- [ ] Set priority (info, warning, urgent)
- [ ] Schedule display
- [ ] Send message

#### **8.6 Chat Moderation**
- [ ] View recent user-to-user conversations
- [ ] Flag inappropriate messages
- [ ] Warn users
- [ ] Ban users from chat
- [ ] Review reported messages

#### **8.7 Support Ticket Management**
- [ ] View open support tickets
- [ ] Assign tickets to team members
- [ ] Respond to tickets
- [ ] Escalate issues
- [ ] Close resolved tickets

---

### **SECTION 9: API MANAGEMENT** `/admin/api`

#### **9.1 Access API Management**
- [ ] Navigate to `/admin/api`
- [ ] Review API overview

**What You Should See:**
- API usage statistics
- Active API keys
- Rate limit monitoring
- Webhook management
- Integration settings
- Developer access control

#### **9.2 API Keys**
- [ ] View active API keys
- [ ] Create new API key
- [ ] Set key permissions
- [ ] Regenerate key
- [ ] Revoke key

#### **9.3 Rate Limiting**
- [ ] View current rate limits
- [ ] Monitor API usage
- [ ] Adjust rate limits for specific keys
- [ ] View rate limit violations

#### **9.4 Webhooks**
- [ ] View configured webhooks
- [ ] Add new webhook endpoint
- [ ] Test webhook delivery
- [ ] View webhook logs
- [ ] Retry failed webhooks

#### **9.5 Integrations**
- [ ] View third-party integrations
- [ ] Configure new integration
- [ ] Test integration connection
- [ ] Enable/disable integrations

---

### **SECTION 10: REPORTS** `/admin/reports`

#### **10.1 Access Reports**
- [ ] Navigate to `/admin/reports`
- [ ] Review available report types

**Report Categories:**
- User Reports
- Booking Reports
- Financial Reports
- Performance Reports
- Compliance Reports
- Custom Reports

#### **10.2 Generate User Report**
- [ ] Select "User Report"
- [ ] Choose date range
- [ ] Select metrics (registrations, active users, retention)
- [ ] Choose format (PDF, CSV, Excel)
- [ ] Generate report
- [ ] Download and verify

#### **10.3 Generate Booking Report**
- [ ] Select "Booking Report"
- [ ] Choose date range
- [ ] Filter by status/service type
- [ ] Select metrics (volume, revenue, completion rate)
- [ ] Generate and download

#### **10.4 Generate Financial Report**
- [ ] Select "Financial Report"
- [ ] Choose reporting period
- [ ] Include: revenue, commissions, payouts, refunds
- [ ] Generate detailed breakdown
- [ ] Export for accounting

#### **10.5 Performance Report**
- [ ] Select "Performance Report"
- [ ] Review platform KPIs
- [ ] Check SLA metrics
- [ ] View uptime statistics
- [ ] Download report

#### **10.6 Compliance Report** (If applicable)
- [ ] Generate compliance documentation
- [ ] Export audit logs
- [ ] Review security incidents
- [ ] Document policy adherence

#### **10.7 Schedule Automated Reports**
- [ ] Set up recurring reports
- [ ] Choose frequency (daily, weekly, monthly)
- [ ] Select recipients (email addresses)
- [ ] Save scheduled report

---

## 🔍 **COMPLETE TESTING CHECKLIST**

### **✅ Core Admin Functions**
- [ ] Can login as admin successfully
- [ ] Admin badge displays correctly
- [ ] Dashboard loads with correct data
- [ ] All statistics are accurate
- [ ] Charts render properly
- [ ] Navigation works across all pages

### **✅ User Management**
- [ ] Can view all users
- [ ] Search functionality works
- [ ] Filters work correctly
- [ ] Can view user details
- [ ] Can update user roles
- [ ] Can suspend/activate users
- [ ] Can delete users
- [ ] Pagination works

### **✅ Booking Management**
- [ ] Can view all bookings
- [ ] Can filter by status
- [ ] Can search bookings
- [ ] Can view booking details
- [ ] Can intervene in disputes
- [ ] Can process refunds

### **✅ Analytics**
- [ ] Platform metrics load correctly
- [ ] User analytics are accurate
- [ ] Financial data is correct
- [ ] Charts render properly
- [ ] Timeframe changes work

### **✅ Financial Management**
- [ ] Revenue totals are accurate
- [ ] Can view transactions
- [ ] Can manage payouts
- [ ] Can process payments
- [ ] Can export financial data

### **✅ Settings**
- [ ] Can access all settings
- [ ] Can modify configurations
- [ ] Changes save successfully
- [ ] Can test email/SMS
- [ ] Can manage API keys

### **✅ Communication**
- [ ] Can send announcements
- [ ] Email broadcasts work
- [ ] SMS messages send (if configured)
- [ ] Can manage support tickets
- [ ] Chat moderation works

### **✅ Reports**
- [ ] Can generate all report types
- [ ] Reports contain accurate data
- [ ] Export formats work (PDF, CSV, Excel)
- [ ] Can schedule automated reports

---

## 🐛 **ISSUES TO DOCUMENT**

As you test, note any issues:

### **Critical Issues (Breaks Functionality)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Major Issues (Impacts UX)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Minor Issues (Cosmetic/Polish)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Missing Features**
1. _____________________________________
2. _____________________________________
3. _____________________________________

---

## 💡 **ADMIN BEST PRACTICES**

### **Daily Tasks**
- [ ] Review dashboard for alerts
- [ ] Check pending verifications
- [ ] Review open support tickets
- [ ] Monitor active disputes
- [ ] Check system health

### **Weekly Tasks**
- [ ] Review user growth metrics
- [ ] Analyze booking trends
- [ ] Process cleaner payouts
- [ ] Review financial reports
- [ ] Update platform content

### **Monthly Tasks**
- [ ] Comprehensive analytics review
- [ ] Financial reconciliation
- [ ] Platform performance audit
- [ ] User feedback review
- [ ] Security audit

### **Security Practices**
- ✅ Never share admin credentials
- ✅ Use strong, unique password
- ✅ Enable 2FA when available
- ✅ Review audit logs regularly
- ✅ Keep API keys secure
- ✅ Monitor for suspicious activity

---

## 🆘 **TROUBLESHOOTING**

### **Can't Login**
- Verify credentials are correct
- Check backend server is running
- Clear browser cache/cookies
- Check browser console for errors

### **Dashboard Not Loading**
- Verify API connection (check Network tab)
- Ensure database has data
- Check backend logs for errors
- Restart both servers

### **Charts Not Displaying**
- May be due to missing data
- Check browser console for JS errors
- Verify API endpoints are responding
- Refresh page

### **Actions Not Saving**
- Check network requests in browser
- Verify backend is processing requests
- Check for validation errors
- Review backend logs

---

## 🎉 **ADMIN GUIDE COMPLETE!**

You now have everything you need to:
- ✅ Test all admin functionality
- ✅ Manage your PureTask platform
- ✅ Monitor performance and health
- ✅ Handle user issues and disputes
- ✅ Configure and optimize the system

**Next Steps:**
1. Work through this checklist systematically
2. Document any issues you find
3. Test client and cleaner guides next
4. Fix critical issues before deployment

---

**Happy Managing! 🚀**

