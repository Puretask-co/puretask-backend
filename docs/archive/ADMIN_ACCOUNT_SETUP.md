# 🔐 **ADMIN ACCOUNT SETUP - NATHAN@PURETASK.CO**

## ✅ **Your Admin Credentials**

```
📧 Email:    nathan@puretask.co
🔑 Password: BaileeJane7!
👑 Role:     admin
```

---

## 🚀 **Quick Setup (Choose One Method)**

### **Method 1: Neon Console** (Recommended - Easiest!)

1. **Go to:** https://console.neon.tech
2. **Login** to your Neon account
3. **Select** your PureTask project
4. **Click** "SQL Editor" in the left menu
5. **Copy and paste** this SQL:

```sql
UPDATE users 
SET 
  password_hash = '$2b$10$rg2GyobyIg8K.o7wIbBXbuwKvZIWvf8UPK0NJw0VrKMV/uIi0cXgm',
  role = 'admin'
WHERE LOWER(email) = 'nathan@puretask.co';

-- Verify it worked:
SELECT id, email, role, full_name 
FROM users 
WHERE LOWER(email) = 'nathan@puretask.co';
```

6. **Click** "Run" button
7. **Verify** the output shows `role: admin`

**✅ DONE! You can now login!**

---

### **Method 2: SQL File** (If you have psql installed)

1. **Open PowerShell** in your backend folder
2. **Run:**

```powershell
cd C:\Users\onlyw\Documents\GitHub\puretask-backend

# Get your DATABASE_URL
$dbUrl = (Get-Content .env | Select-String "DATABASE_URL" | ForEach-Object { $_.Line.Split('=',2)[1].Trim() })

# Run the SQL file
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" $dbUrl -f scripts/setup-admin-nathan.sql
```

---

## 🎉 **Login as Admin**

Once setup is complete:

1. **Go to:** http://localhost:3001/auth/login
2. **Enter:**
   - Email: `nathan@puretask.co`
   - Password: `BaileeJane7!`
3. **Click** "Sign In"
4. **You'll be redirected to:** `/admin` (Admin Dashboard)

---

## 🎯 **What You Can Do as Admin**

As an admin, you have **FULL ACCESS** to:

### **✅ View Everything:**
- All user accounts (cleaners, clients, admins)
- All bookings and transactions
- Platform analytics and statistics
- System logs and activity

### **✅ Manage Users:**
- View all user profiles
- Edit user information
- Change user roles
- Deactivate/activate accounts
- Delete users (if needed)

### **✅ Manage Bookings:**
- View all bookings
- Edit booking details
- Cancel bookings
- Resolve disputes

### **✅ Platform Settings:**
- Update platform configuration
- Manage pricing/fees
- Configure payment settings
- Update platform rules

### **✅ Access All Dashboards:**
- Admin dashboard (`/admin`)
- Cleaner dashboards (`/cleaner/dashboard`)
- Client dashboards (`/client/dashboard`)
- Can view any user's perspective

---

## 🔒 **Security Notes**

### **Important Security Practices:**

1. **Never share admin credentials** - Admin access = full platform control
2. **Use strong password** - Your current password is good! Keep it secure
3. **Change password regularly** - Every 90 days recommended
4. **Don't create admin accounts via public registration** - Always use database/scripts
5. **Limit admin accounts** - Only create them for trusted team members

### **How Admins are Different:**

```
Regular Users (Client/Cleaner):
✅ Can register via website
✅ See their own data only
✅ Limited permissions
❌ Cannot access admin pages
❌ Cannot view other users' data

Admins:
❌ Cannot register via website (security!)
✅ See ALL data
✅ Full permissions
✅ Can access all pages
✅ Can manage all users
```

---

## 👥 **Creating Additional Admins**

If you need to create more admin accounts in the future:

### **Option 1: Update Existing User**

```sql
-- In Neon SQL Editor:
UPDATE users 
SET role = 'admin' 
WHERE email = 'someuser@example.com';
```

### **Option 2: Use the Script**

```powershell
# Generate password hash
node scripts/hash-password.js

# Update the SQL file with new email and hash
# Then run: psql $DATABASE_URL -f scripts/setup-admin-nathan.sql
```

---

## 📋 **Verification Checklist**

After setup, verify:

- [ ] Can login with nathan@puretask.co / BaileeJane7!
- [ ] Redirects to `/admin` after login
- [ ] Header shows purple "Admin" badge
- [ ] Can see "Admin Panel" in navigation
- [ ] Profile icon click goes to `/admin`

---

## 🔧 **Troubleshooting**

### **Problem: Can't login with new password**

**Solution 1:** Run the SQL again in Neon Console
**Solution 2:** Check if email is exactly `nathan@puretask.co` (case-insensitive but check spelling)

### **Problem: Login works but doesn't show admin features**

**Solution:** Verify role with this SQL:
```sql
SELECT email, role FROM users WHERE email = 'nathan@puretask.co';
```

Should show `role: admin`

### **Problem: Database trigger errors**

**Solution:** Use the Neon Console method instead of scripts (avoids trigger issues)

---

## 📊 **Current Account Status**

Based on the system check:

```
✅ Account EXISTS: nathan@puretask.co
🆔 User ID: ac6858c7-bd34-45de-a7d6-ca295a30227a
👑 Role: admin (needs password update)
```

**Next Step:** Run the SQL in Neon Console to update the password to `BaileeJane7!`

---

## 🎓 **Remember:**

1. **Regular users can ONLY register as Client or Cleaner** ✅
2. **Admin accounts must be created via database** ✅
3. **This is correct security practice** ✅
4. **Your current setup is secure** ✅

---

## ✅ **Summary:**

1. **Account Email:** nathan@puretask.co  ✅ (exists)
2. **Account Role:** admin  ✅ (set)
3. **Password:** BaileeJane7!  ⏳ (needs SQL update)

**Run the SQL in Neon Console, then login!** 🚀

---

**Created:** January 11, 2026  
**Status:** Ready to login after SQL update  
**Next:** Login at http://localhost:3001/auth/login

