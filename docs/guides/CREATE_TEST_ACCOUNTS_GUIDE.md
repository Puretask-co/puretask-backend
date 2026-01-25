# 🧪 **CREATE TEST ACCOUNTS - QUICK GUIDE**

## 📋 **Overview**

Before you can test the Client and Cleaner experiences, you need to create test accounts. This guide shows you exactly how to create them step-by-step.

**Time Required:** 10-15 minutes total (5 min per account)

---

## 🎯 **What You'll Create**

1. **Test Cleaner Account** - To test the cleaner experience
2. **Test Client Account** - To test the client experience

**Note:** You already have an Admin account:
- Email: `nathan@puretask.co`
- Password: `BaileeJane7!`

---

## 🧹 **PART 1: CREATE TEST CLEANER ACCOUNT**

### **Step 1: Open Registration Page**
- [ ] Make sure frontend server is running (http://localhost:3001)
- [ ] Open browser and go to: **http://localhost:3001/auth/register**
- [ ] You should see "Create Your Account" page

### **Step 2: Fill Out Registration Form**

#### **Account Type Selection:**
- [ ] Look for radio buttons or toggle at the top
- [ ] **Select "I'm a Cleaner"** or **"Cleaner"** option
- [ ] This is CRITICAL - determines account type

**Visual Clue:** You should see the Cleaner option highlighted/selected

#### **Personal Information:**
- [ ] **First Name:** `Test`
- [ ] **Last Name:** `Cleaner`
- [ ] **Email:** `testcleaner.pt@gmail.com`
  - Real email for notification testing
- [ ] **Password:** `BaileeJane7!`
  - Must be strong enough (8+ characters)
  - Remember this!
- [ ] **Confirm Password:** `BaileeJane7!`
- [ ] **Phone Number:** `(555) 123-4567` or your real number

#### **Agreements:**
- [ ] Check "I agree to Terms of Service"
- [ ] Check "I agree to Cleaner Agreement" (if separate)

### **Step 3: Submit Registration**
- [ ] Click **"Create Account"** or **"Sign Up"** button
- [ ] Wait for processing (2-5 seconds)

### **Step 4: Expected Result**

**✅ Success Scenario:**
- You're automatically logged in
- Redirected to `/cleaner/onboarding` (onboarding wizard)
- See "Welcome!" or "Let's set up your profile" message

**⚠️ If You See Errors:**
- "Email already exists" → Use different email
- "Password too weak" → Use stronger password (add symbols, numbers)
- "Phone number invalid" → Use format: (555) 123-4567
- "Backend error" → Make sure backend server is running on port 4000

### **Step 5: Note Your Credentials**

**Write these down for testing:**
```
CLEANER TEST ACCOUNT
Email: testcleaner.pt@gmail.com
Password: BaileeJane7!
Role: Cleaner
Status: Pending (needs onboarding completion)
```

### **Step 6: Logout (For Now)**
- [ ] Click your profile icon/name in header
- [ ] Click "Logout" or "Sign Out"
- [ ] You'll be logged out and redirected to homepage

**Why logout?** So you can create the client account next.

---

## 👤 **PART 2: CREATE TEST CLIENT ACCOUNT**

### **Step 1: Return to Registration Page**
- [ ] Go to: **http://localhost:3001/auth/register**
- [ ] Make sure you're logged out from previous step

### **Step 2: Fill Out Registration Form**

#### **Account Type Selection:**
- [ ] Look for radio buttons or toggle at the top
- [ ] **Select "I'm a Client"** or **"Client"** option
- [ ] This is CRITICAL - determines account type

**Visual Clue:** You should see the Client option highlighted/selected

#### **Personal Information:**
- [ ] **First Name:** `Test`
- [ ] **Last Name:** `Client`
- [ ] **Email:** `testclient.pt@outlook.com`
  - Must be DIFFERENT from cleaner email
  - Real email for notification testing
- [ ] **Password:** `BaileeJane7!`
  - Use same password as cleaner for consistency
  - Remember this!
- [ ] **Confirm Password:** `BaileeJane7!`
- [ ] **Phone Number:** `(555) 987-6543` or your real number (optional for clients)

#### **Agreements:**
- [ ] Check "I agree to Terms of Service"

### **Step 3: Submit Registration**
- [ ] Click **"Create Account"** or **"Sign Up"** button
- [ ] Wait for processing (2-5 seconds)

### **Step 4: Expected Result**

**✅ Success Scenario:**
- You're automatically logged in
- Redirected to `/client/dashboard` (client dashboard)
- See "Welcome!" message and empty dashboard (no bookings yet)

**⚠️ If You See Errors:**
- "Email already exists" → Use different email
- "Password too weak" → Use stronger password
- "Backend error" → Make sure backend server is running on port 4000

### **Step 5: Note Your Credentials**

**Write these down for testing:**
```
CLIENT TEST ACCOUNT
Email: testclient.pt@outlook.com
Password: BaileeJane7!
Role: Client
Status: Active (ready to use)
```

### **Step 6: Logout**
- [ ] Click your profile icon/name in header
- [ ] Click "Logout" or "Sign Out"
- [ ] You'll be logged out

---

## 📝 **YOUR TEST ACCOUNTS - REFERENCE SHEET**

**Copy this for easy reference during testing:**

```
═══════════════════════════════════════════════
           PURETASK TEST ACCOUNTS
═══════════════════════════════════════════════

👨‍💼 ADMIN ACCOUNT (Pre-existing)
Email:    nathan@puretask.co
Password: BaileeJane7!
Access:   http://localhost:3001/auth/login
Dashboard: /admin

───────────────────────────────────────────────

🧹 CLEANER ACCOUNT (Just Created)
Email:    testcleaner.pt@gmail.com
Password: BaileeJane7!
Access:   http://localhost:3001/auth/login
Dashboard: /cleaner/dashboard

───────────────────────────────────────────────

👤 CLIENT ACCOUNT (Just Created)
Email:    testclient.pt@outlook.com
Password: BaileeJane7!
Access:   http://localhost:3001/auth/login
Dashboard: /client/dashboard

═══════════════════════════════════════════════
```

---

## ✅ **VERIFICATION CHECKLIST**

Before proceeding to main testing, verify you can login with each account:

### **Test Admin Login:**
- [ ] Go to http://localhost:3001/auth/login
- [ ] Enter: `nathan@puretask.co`
- [ ] Enter: `BaileeJane7!`
- [ ] Click "Sign In"
- [ ] Should redirect to `/admin` or `/admin/dashboard`
- [ ] Should see purple "Admin" badge in header
- [ ] Logout

### **Test Cleaner Login:**
- [ ] Go to http://localhost:3001/auth/login
- [ ] Enter: `testcleaner.pt@gmail.com`
- [ ] Enter: `BaileeJane7!`
- [ ] Click "Sign In"
- [ ] Should redirect to `/cleaner/dashboard` or `/cleaner/onboarding`
- [ ] Should see blue "Cleaner" badge in header
- [ ] Logout

### **Test Client Login:**
- [ ] Go to http://localhost:3001/auth/login
- [ ] Enter: `testclient.pt@outlook.com`
- [ ] Enter: `BaileeJane7!`
- [ ] Click "Sign In"
- [ ] Should redirect to `/client/dashboard`
- [ ] Should see green "Client" badge in header
- [ ] Logout

**✅ If all three work, you're ready to start testing!**

---

## 🐛 **TROUBLESHOOTING**

### **Problem: "Cannot create account" or "Registration fails"**

**Check:**
1. Backend server is running on port 4000
   - Open terminal, check for "PureTask Backend running on 0.0.0.0:4000"
2. Frontend can reach backend
   - Check `.env.local` has: `NEXT_PUBLIC_API_URL=http://localhost:4000`
3. Database is connected
   - Check backend terminal for database connection errors

**Solution:**
- Restart both servers (see main guide)
- Clear browser cache
- Try in incognito/private window

### **Problem: "Email already exists"**

**Solution:**
- Use a different email
- Or use email variations:
  - `mytestcleaner1@example.com`
  - `mytestcleaner2@example.com`
  - `test.cleaner@example.com`

### **Problem: "After registration, I see a blank page"**

**Check:**
- Browser console (F12) for JavaScript errors
- Network tab (F12) for failed API calls

**Solution:**
- Refresh the page
- Try logging in again at http://localhost:3001/auth/login
- Check if account was created (login as admin and check users list)

### **Problem: "I can't tell if I selected Cleaner or Client"**

**Visual Clues:**
- Selected radio button should be filled/checked
- Selected toggle should be highlighted
- May show different text/instructions based on selection

**To Verify After Registration:**
- Look at the badge in header (Cleaner = blue, Client = green)
- Check which dashboard you're on (/cleaner/dashboard vs /client/dashboard)

**If Wrong:**
- Logout
- Create new account with correct selection
- Or login as admin and change the user's role manually

### **Problem: "No role badge showing after login"**

**Possible Causes:**
- Role not set properly in database
- Frontend not receiving user data correctly

**Solution:**
1. Login as admin (`nathan@puretask.co`)
2. Go to User Management
3. Find your test account
4. Verify role is set correctly (Cleaner or Client)
5. If not, update the role
6. Logout and login again with test account

---

## 🎓 **UNDERSTANDING ACCOUNT TYPES**

### **What's the Difference?**

| Feature | Client | Cleaner | Admin |
|---------|--------|---------|-------|
| Can book services | ✅ Yes | ❌ No | ✅ Yes (for testing) |
| Can offer services | ❌ No | ✅ Yes | ❌ No |
| See client dashboard | ✅ Yes | ❌ No | ✅ Yes (can view all) |
| See cleaner dashboard | ❌ No | ✅ Yes | ✅ Yes (can view all) |
| See admin panel | ❌ No | ❌ No | ✅ Yes |
| Badge color | Green | Blue | Purple |

### **When Creating Account:**

**If you want to:**
- **Book cleaning services** → Create Client account
- **Provide cleaning services** → Create Cleaner account
- **Manage the platform** → Use Admin account (already exists)

---

## 🚀 **NEXT STEPS**

Now that you have all three test accounts:

### **1. Start with Admin Testing**
- [ ] Open: `docs/guides/ADMIN_USER_COMPLETE_GUIDE.md`
- [ ] Login as admin
- [ ] Work through admin checklist
- [ ] Verify you can see your test accounts in user management

### **2. Then Cleaner Testing**
- [ ] Open: `docs/guides/CLEANER_USER_COMPLETE_GUIDE.md`
- [ ] Login as cleaner
- [ ] Complete onboarding process
- [ ] Set up your cleaner profile

### **3. Finally Client Testing**
- [ ] Open: `docs/guides/CLIENT_USER_COMPLETE_GUIDE.md`
- [ ] Login as client
- [ ] Search for your test cleaner
- [ ] Try booking a service

### **4. Integration Testing**
- [ ] Test interactions between accounts
- [ ] Client books → Cleaner accepts
- [ ] Messages between client and cleaner
- [ ] Admin monitors everything

---

## 💡 **PRO TIPS**

### **For Easier Testing:**

1. **Use Simple, Consistent Passwords**
   - Use one password for both test accounts
   - Keep it consistent during testing

2. **Use Descriptive Email Addresses**
   - `testcleaner.pt@gmail.com` - cleaner account
   - `testclient.pt@outlook.com` - client account
   - Or: `yourname+cleaner@gmail.com`, `yourname+client@gmail.com` (Gmail ignores +text)

3. **Save Credentials in a Text File**
   - Create `test-accounts.txt` on desktop
   - Copy/paste credentials as needed
   - Delete after testing

4. **Open Multiple Browser Windows**
   - Window 1: Admin account (Chrome)
   - Window 2: Cleaner account (Chrome Incognito)
   - Window 3: Client account (Firefox)
   - See all perspectives simultaneously

5. **Use Browser Profiles (Advanced)**
   - Chrome Profile 1: Admin
   - Chrome Profile 2: Cleaner
   - Chrome Profile 3: Client
   - Stay logged in to all simultaneously

---

## 📋 **QUICK CHECKLIST**

**Before Starting Main Testing:**

- [ ] Frontend server running (http://localhost:3001)
- [ ] Backend server running (http://localhost:4000)
- [ ] Admin account works (`nathan@puretask.co`)
- [ ] Cleaner test account created
- [ ] Client test account created
- [ ] All three accounts can login successfully
- [ ] Credentials noted and saved
- [ ] Browser console clear of errors
- [ ] Ready to start comprehensive testing

---

## 🎉 **YOU'RE READY!**

With your three test accounts created, you can now:
- ✅ Test all three user experiences
- ✅ Test interactions between user types
- ✅ Complete all testing guides
- ✅ Find and fix any issues
- ✅ Prepare for production launch

---

## 📞 **Need Help?**

If you encounter issues:
1. Check the Troubleshooting section above
2. Review browser console for errors (F12)
3. Check backend terminal for error messages
4. Verify both servers are running
5. Try restarting servers if needed

---

## 🚀 **NEXT: Start Testing!**

**Now go to:**
```
docs/guides/MASTER_TESTING_GUIDE.md
```

And begin your comprehensive testing journey!

---

**Happy Testing! 🎯✨**

