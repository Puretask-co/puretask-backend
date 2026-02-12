# 🔐 PureTask Test Accounts Reference

**Quick reference for all test accounts in the system**

---

## 🎯 Quick Access

### **All Seed Accounts Use This Password:**
```
Password: TestPass123!
```

### **User-Created Real Email Accounts Use:**
```
Password: BaileeJane7!
```

### **Connection Test Account Uses:**
```
Password: Test123!
```

---

## 👤 TEST ACCOUNTS

### **📧 REAL EMAIL TEST ACCOUNTS (User-Created)**

**Cleaner (Real Email):**
```
Email:    testcleaner.pt@gmail.com
Password: BaileeJane7!
Role:     cleaner
Name:     Test Cleaner (Real Email)
```

**Client (Real Email):**
```
Email:    testclient.pt@outlook.com
Password: BaileeJane7!
Role:     client
Name:     Test Client (Real Email)
```

**Use these to:**
- Verify real email notifications
- Test production-like email flows
- Validate signup and login with real inboxes

---

### **🛡️ ADMIN ACCOUNT**

```
Email:    testadmin@test.com
Password: TestPass123!
Role:     admin
Name:     Test Admin
```

**Use this to:**
- Access admin dashboard (`/admin/dashboard`)
- Manage users (`/admin/users`)
- View analytics (`/admin/analytics`)
- Manage bookings (`/admin/bookings`)
- Access all admin features

---

### **🧹 CLEANER ACCOUNTS**

**Cleaner #1:**
```
Email:    testcleaner1@test.com
Password: TestPass123!
Role:     cleaner
Name:     TestCleaner 1
```

**Cleaner #2:**
```
Email:    testcleaner2@test.com
Password: TestPass123!
Role:     cleaner
Name:     TestCleaner 2
```

**Cleaner #3:**
```
Email:    testcleaner3@test.com
Password: TestPass123!
Role:     cleaner
Name:     TestCleaner 3
```

**Use these to:**
- Access cleaner dashboard (`/cleaner/dashboard`)
- Manage calendar (`/cleaner/calendar`)
- Use AI assistant (`/cleaner/ai-assistant`)
- View bookings
- Manage team

---

### **👥 CLIENT ACCOUNTS**

**Client #1:**
```
Email:    testclient1@test.com
Password: TestPass123!
Role:     client
Name:     TestClient 1
```

**Client #2:**
```
Email:    testclient2@test.com
Password: TestPass123!
Role:     client
Name:     TestClient 2
```

**Client #3:**
```
Email:    testclient3@test.com
Password: TestPass123!
Role:     client
Name:     TestClient 3
```

**Client #4:**
```
Email:    testclient4@test.com
Password: TestPass123!
Role:     client
Name:     TestClient 4
```

**Client #5:**
```
Email:    testclient5@test.com
Password: TestPass123!
Role:     client
Name:     TestClient 5
```

**Use these to:**
- Search for cleaners (`/search`)
- Create bookings (`/booking`)
- View client dashboard (`/client/dashboard`)
- Manage bookings (`/client/bookings`)
- Write reviews

---

### **✅ CONNECTION TEST ACCOUNT**

```
Email:    testconnection@example.com
Password: Test123!
Role:     client
Name:     (not set)
```

**Note:** Created during connection testing

**Use this to:**
- Quick login tests
- Connection verification
- API endpoint testing

---

## 📊 Account Summary

```
Total Test Accounts: 10

1 Admin:     testadmin@test.com
3 Cleaners:  testcleaner1-3@test.com
5 Clients:   testclient1-5@test.com
1 Test:      testconnection@example.com

Password (9 accounts): TestPass123!
Password (1 account):  Test123!
```

**Additional Real Email Accounts (not in seed totals):**
- Cleaner: `testcleaner.pt@gmail.com`
- Client: `testclient.pt@outlook.com`

---

## 🎯 Quick Login URLs

### **Admin:**
```
URL: http://localhost:3001/auth/login
Email: testadmin@test.com
Password: TestPass123!
→ Redirects to: /admin/dashboard
```

### **Cleaner:**
```
URL: http://localhost:3001/auth/login
Email: testcleaner1@test.com
Password: TestPass123!
→ Redirects to: /cleaner/dashboard
```

### **Client:**
```
URL: http://localhost:3001/auth/login
Email: testclient1@test.com
Password: TestPass123!
→ Redirects to: /client/dashboard
```

---

## 🧪 Testing Scenarios

### **Test User Flows:**

#### **As a Client:**
1. Login: `testclient1@test.com` / `TestPass123!`
2. Search for cleaners
3. Create a booking
4. Send messages
5. Write a review

#### **As a Cleaner:**
1. Login: `testcleaner1@test.com` / `TestPass123!`
2. View dashboard
3. Check calendar
4. Use AI assistant
5. Respond to bookings

#### **As an Admin:**
1. Login: `testadmin@test.com` / `TestPass123!`
2. View all users
3. Monitor bookings
4. Check analytics
5. Manage platform

---

## 🔄 Test Multi-User Scenarios

### **Booking Flow:**
```
1. Client logs in (testclient1@test.com)
2. Searches for cleaners
3. Books testcleaner1@test.com
4. Logout

5. Cleaner logs in (testcleaner1@test.com)
6. Views new booking request
7. Accepts/rejects booking
8. Logout

9. Admin logs in (testadmin@test.com)
10. Views transaction
11. Monitors both users
```

### **Messaging Flow:**
```
1. Client (testclient2@test.com) sends message
2. Cleaner (testcleaner2@test.com) receives and replies
3. Admin (testadmin@test.com) can view conversation
```

---

## 📝 Password Recovery

### **If You Forget:**

**For seed accounts:**
- Password is always: `TestPass123!`
- Check this file!

**For connection test:**
- Password is: `Test123!`

**To reset all:**
```powershell
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run seed
```

---

## 🛠️ Creating More Test Accounts

### **Method 1: Use Registration**
1. Go to `/auth/register`
2. Fill in details
3. Choose role
4. Register

### **Method 2: Run Seed Script**
```powershell
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run seed
```

### **Method 3: API Call**
```powershell
$body = @{
  email = "newuser@test.com"
  password = "YourPassword123!"
  role = "client"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:4000/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

## 🔐 Security Notes

### **⚠️ IMPORTANT:**

These are **TEST ACCOUNTS ONLY**!

**DO NOT USE IN PRODUCTION:**
- Simple passwords
- Well-known emails
- No real data

**Before Production:**
1. Delete all test accounts
2. Use strong passwords
3. Enable email verification
4. Add 2FA (optional)
5. Monitor for suspicious activity

---

## 📋 Quick Reference Card

```
┌──────────────────────────────────────────┐
│         PURETASK TEST ACCOUNTS           │
├──────────────────────────────────────────┤
│                                          │
│  ADMIN:                                  │
│  testadmin@test.com / TestPass123!       │
│                                          │
│  CLEANER:                                │
│  testcleaner1@test.com / TestPass123!    │
│                                          │
│  CLIENT:                                 │
│  testclient1@test.com / TestPass123!     │
│                                          │
│  TEST:                                   │
│  testconnection@example.com / Test123!   │
│                                          │
└──────────────────────────────────────────┘
```

**Print or bookmark this page!** 📌

---

## 🎯 Role-Based Access

### **What Each Role Can Access:**

#### **👥 Client:**
- `/` - Homepage
- `/search` - Find cleaners
- `/booking` - Create booking
- `/client/dashboard` - Client overview
- `/client/bookings` - My bookings
- `/client/recurring` - Recurring services
- `/client/settings` - Account settings
- `/messages` - Chat with cleaners
- `/reviews` - Write reviews
- `/favorites` - Saved cleaners

#### **🧹 Cleaner:**
- `/cleaner/dashboard` - Cleaner overview
- `/cleaner/calendar` - Schedule
- `/cleaner/team` - Team management
- `/cleaner/ai-assistant` - AI chat
- `/cleaner/progress` - Performance tracking
- `/cleaner/certifications` - Licenses
- `/messages` - Chat with clients

#### **🛡️ Admin:**
- All client pages ✓
- All cleaner pages ✓
- `/admin/dashboard` - Admin overview
- `/admin/users` - User management
- `/admin/bookings` - All bookings
- `/admin/finance` - Financial data
- `/admin/analytics` - Platform analytics
- `/admin/reports` - Generate reports
- `/admin/settings` - Platform settings
- **Everything!** ✓

---

## 🧪 Testing Tips

### **Tip 1: Use Different Browsers**
- Chrome: Admin account
- Firefox: Cleaner account
- Edge: Client account
- Test simultaneous logins!

### **Tip 2: Incognito/Private Mode**
- Test without caching
- Verify fresh sessions
- Check cookies

### **Tip 3: Mobile Testing**
- Resize browser
- Test on actual phone
- Check responsive design

### **Tip 4: Role Switching**
- Logout and login as different roles
- Test permission boundaries
- Verify role-based features

---

## 📞 Quick Help

### **Can't Login?**

1. **Check password** - Is it `TestPass123!` or `Test123!`?
2. **Check email** - Did you type it correctly?
3. **Backend running?** - Check `http://localhost:4000/health`
4. **Frontend running?** - Check `http://localhost:3001`
5. **Database connected?** - Check backend logs

### **Account Not Found?**

Run the seed script:
```powershell
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run seed
```

---

## 🎉 Summary

```
✅ 1 Admin account
✅ 3 Cleaner accounts  
✅ 5 Client accounts
✅ 1 Connection test account

✅ All passwords documented
✅ All roles covered
✅ Ready for testing!

SAVE THIS FILE FOR EASY REFERENCE! 📌
```

---

**Last Updated:** January 11, 2026  
**Location:** `TEST_ACCOUNTS_REFERENCE.md`  
**Bookmark This Page!** 🔖

