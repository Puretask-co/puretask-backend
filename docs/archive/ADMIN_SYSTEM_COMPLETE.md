# 🎯 Admin System - Complete Reference

## ✅ **Admin Login Successful!**

**Your Admin Account:**
- Email: `nathan@puretask.co`
- Password: `BaileeJane7!`
- Role: **Admin** (with full privileges)

---

## 🏠 **Available Admin Pages**

After logging in, you can access these admin pages:

### **1. Main Dashboard** `/admin` or `/admin/dashboard`
**Features:**
- ✅ Real-time platform statistics
- ✅ Revenue trends and analytics
- ✅ User distribution charts
- ✅ Booking status overview
- ✅ Recent activity feed
- ✅ Quick action cards for pending items

**What you can see:**
- Total users, active bookings, revenue
- Daily booking trends (last 14 days)
- Client vs Cleaner distribution
- Completed vs Active vs Cancelled bookings
- Pending verifications & reported issues

---

### **2. User Management** `/admin/users`
**Features:**
- ✅ View all users (clients, cleaners, admins)
- ✅ Search users by name, email, or phone
- ✅ Filter by role (client, cleaner, admin)
- ✅ Filter by status (active, suspended, pending)
- ✅ Update user roles
- ✅ Suspend/activate user accounts
- ✅ Delete user accounts
- ✅ View detailed user profiles
- ✅ Pagination for large user lists

**Actions you can perform:**
- Change user roles (promote to admin, etc.)
- Suspend problematic users
- Activate pending accounts
- Delete spam/test accounts
- View user activity history

---

### **3. Booking Management** `/admin/bookings`
**Features:**
- ✅ View all bookings across the platform
- ✅ Filter by status (pending, confirmed, completed, cancelled)
- ✅ Search bookings by client or cleaner
- ✅ View booking details
- ✅ Monitor booking issues
- ✅ Track booking revenue
- ✅ Dispute resolution

**What you can monitor:**
- Booking trends and patterns
- Cancellation rates
- Popular services
- Peak booking times
- Revenue per booking type

---

### **4. Analytics** `/admin/analytics`
**Features:**
- ✅ Platform-wide metrics
- ✅ User growth analytics
- ✅ Financial analytics
- ✅ Service performance metrics
- ✅ Timeframe selection (day, week, month, year)
- ✅ Interactive charts and graphs

**Metrics available:**
- **Platform:** Total users, active users, bookings, revenue, growth rate
- **Users:** New clients, new cleaners, retention rate, churn rate
- **Financial:** GMV (Gross Merchandise Value), commission, avg booking value
- **Services:** Most popular services, revenue by service type

---

### **5. Financial Reports** `/admin/finance`
**Features:**
- ✅ Revenue tracking
- ✅ Payment processing overview
- ✅ Payout management
- ✅ Transaction history
- ✅ Financial reports export
- ✅ Commission tracking

**What you can manage:**
- Platform revenue
- Cleaner payouts
- Failed transactions
- Refund requests
- Revenue forecasting

---

### **6. Settings** `/admin/settings`
**Features:**
- ✅ Platform configuration
- ✅ Email templates
- ✅ Notification settings
- ✅ Payment gateway settings
- ✅ Feature flags
- ✅ API configurations
- ✅ Security settings

**What you can configure:**
- Service categories and pricing
- Email notification templates
- SMS notification settings
- Payment processing rules
- Platform maintenance mode
- User verification requirements

---

### **7. Risk Management** `/admin/risk`
**Features:**
- ✅ Fraud detection alerts
- ✅ Suspicious activity monitoring
- ✅ User verification queue
- ✅ Background check status
- ✅ Dispute management
- ✅ Ban/suspension history

**What you can monitor:**
- Fraudulent booking attempts
- Suspicious user behavior
- Disputed transactions
- Failed verifications
- High-risk users

---

### **8. Communication Tools** `/admin/communication`
**Features:**
- ✅ Send platform-wide announcements
- ✅ Email broadcast to user segments
- ✅ SMS notifications
- ✅ In-app message center
- ✅ Chat moderation
- ✅ Support ticket management

**What you can do:**
- Send announcements to all users
- Target messages to specific user groups (e.g., all cleaners)
- Moderate user-to-user conversations
- Manage support tickets
- Create email templates

---

### **9. API Management** `/admin/api`
**Features:**
- ✅ API key management
- ✅ Rate limit monitoring
- ✅ API usage statistics
- ✅ Webhook configuration
- ✅ Integration settings
- ✅ Developer access control

**What you can manage:**
- Third-party integrations
- API rate limits
- Webhook endpoints
- Developer accounts
- API documentation access

---

### **10. Reports** `/admin/reports`
**Features:**
- ✅ Generate custom reports
- ✅ Scheduled report delivery
- ✅ Export data (CSV, PDF, Excel)
- ✅ Historical data analysis
- ✅ Performance reports
- ✅ Compliance reports

**Report types available:**
- User activity reports
- Booking reports
- Financial reports
- Performance metrics
- Compliance and audit reports

---

## 🎨 **Visual Features**

### **Admin Badge**
- You'll see a **purple "Admin" badge** next to your name in the header
- This badge is visible across all pages
- Only admins see this badge

### **Role-Specific Navigation**
- The header shows "Admin Panel" instead of regular navigation
- You have access to all sections (admin, cleaner, and client pages)
- Quick access to admin dashboard from any page

### **Protected Routes**
- All admin pages are protected by `AdminGuard`
- Non-admin users are automatically redirected
- Unauthenticated users sent to login page

---

## 🚀 **How to Access**

1. **Login** at `http://localhost:3001/auth/login`
   - Email: `nathan@puretask.co`
   - Password: `BaileeJane7!`

2. **You'll be automatically redirected** to `/admin` → `/admin/dashboard`

3. **Navigate using:**
   - Header "Admin Panel" button
   - Direct URLs (e.g., `/admin/users`)
   - Quick action cards on the dashboard
   - Footer links (under "Admin Portal" section)

---

## 🔒 **Security Features**

### **Admin-Only Access**
- All `/admin/*` routes are protected
- Role verified on both frontend and backend
- JWT token includes role claim

### **Audit Logging**
- All admin actions are logged
- Tracks who made changes and when
- Available in activity feed

### **Multi-Level Protection**
1. **Frontend:** `AdminGuard` component blocks rendering
2. **Backend:** API endpoints check user role
3. **Database:** Role stored in `users.role` column

---

## 📊 **Dashboard Features Explained**

### **Stats Overview (Top Cards)**
- **Total Users:** Count of all registered users
- **Active Bookings:** Bookings in progress
- **Total Revenue:** Platform lifetime revenue
- **Pending Issues:** Reported problems/disputes

### **Quick Actions**
- **Pending Verifications:** Users/cleaners awaiting approval
- **Reported Issues:** Active support tickets and disputes

### **Charts**
1. **Revenue Trends:** Line chart showing revenue over time
   - Toggle between Week/Month/Year views
2. **Daily Bookings:** Bar chart of bookings (last 14 days)
3. **User Distribution:** Donut chart (Clients vs Cleaners)
4. **Booking Status:** Donut chart (Completed/Active/Cancelled)

### **Activity Feed**
- Real-time platform activity
- User registrations
- Booking completions
- Payment events
- System alerts

---

## 🛠️ **Common Admin Tasks**

### **1. Approve a New Cleaner**
1. Go to `/admin/users`
2. Filter by role: "Cleaner"
3. Filter by status: "Pending"
4. Click on the cleaner
5. Review their profile
6. Click "Approve" or "Reject"

### **2. Handle a Dispute**
1. Go to `/admin/bookings`
2. Filter by: "Disputed"
3. Click on the booking
4. Review both parties' messages
5. Make a decision (refund, cancel, or resolve)

### **3. Send Platform Announcement**
1. Go to `/admin/communication`
2. Click "New Announcement"
3. Select audience (All Users, Clients Only, Cleaners Only)
4. Write message
5. Click "Send"

### **4. View Platform Performance**
1. Go to `/admin/analytics`
2. Select timeframe
3. Review metrics:
   - User growth
   - Booking trends
   - Revenue performance
4. Export reports if needed

### **5. Manage Payouts**
1. Go to `/admin/finance`
2. View pending payouts
3. Approve/reject payout requests
4. Track payment processing

---

## 🎓 **Best Practices**

### **Regular Monitoring**
- ✅ Check dashboard daily for pending issues
- ✅ Review new user registrations
- ✅ Monitor booking trends
- ✅ Track revenue metrics

### **User Management**
- ✅ Verify cleaners before approval
- ✅ Respond to reported issues promptly
- ✅ Review suspended accounts regularly
- ✅ Keep spam/test accounts cleaned up

### **Financial Oversight**
- ✅ Reconcile payments weekly
- ✅ Review payout requests
- ✅ Monitor for fraudulent transactions
- ✅ Track commission rates

### **Security**
- ✅ Never share admin credentials
- ✅ Review audit logs regularly
- ✅ Keep API keys secure
- ✅ Enable 2FA (when available)

---

## 🆘 **Troubleshooting**

### **Can't Access Admin Pages (404 Error)**
**Solution:**
- Make sure you're logged in as admin
- Check that frontend server is running: `npm run dev` in frontend folder
- Verify your admin role is set in the database

### **Admin Dashboard Shows No Data**
**Solution:**
- Make sure backend server is running on port 4000
- Check `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000`
- Verify database connection is working

### **Changes Not Saving**
**Solution:**
- Check browser console for errors
- Verify API endpoints are responding
- Check backend logs for errors
- Ensure database is accessible

### **User Can't See Admin Features**
**Solution:**
1. Check their role in database:
   ```sql
   SELECT email, role FROM users WHERE email = 'nathan@puretask.co';
   ```
2. Should return `role = 'admin'`
3. If not, run the SQL from `ADMIN_ACCOUNT_SETUP.md`

---

## 📱 **Mobile Access**

All admin pages are **responsive** and work on:
- ✅ Desktop (optimal)
- ✅ Tablet (good)
- ✅ Mobile (basic functionality)

**Note:** Some advanced features work best on desktop due to data density.

---

## 📈 **Future Enhancements**

Planned admin features:
- [ ] Two-factor authentication (2FA)
- [ ] Advanced fraud detection
- [ ] Automated report scheduling
- [ ] Bulk user actions
- [ ] Custom dashboard widgets
- [ ] Real-time notifications
- [ ] Advanced search filters
- [ ] Data export automation

---

## 🎉 **You're All Set!**

Your admin system is **fully functional** and ready to use!

**Next Steps:**
1. ✅ Login with your admin credentials
2. ✅ Explore the dashboard
3. ✅ Try accessing different admin pages
4. ✅ Familiarize yourself with the layout
5. ✅ Test key admin functions

---

## 📞 **Need Help?**

- **Documentation:** See `/docs/guides/` folder
- **API Reference:** `/docs/api/` folder
- **Troubleshooting:** This document (above)

**Have fun managing your PureTask platform! 🎉**

