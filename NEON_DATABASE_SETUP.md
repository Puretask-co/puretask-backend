# 🗄️ Neon Database - Tables to Add

## ✅ **What Needs to Be Added:**

You need to run **2 new migrations** to add the latest features:

### **1. Gamification System (Migration 030)**
**Status:** ⚠️ Needs to be run
**File:** `DB/migrations/030_onboarding_gamification_system.sql`
**What it adds:**
- 9 new tables for gamification
- Onboarding progress tracking
- Achievements system
- Certifications
- Template library marketplace
- Tooltips system

### **2. Message History System (Migration 031)**
**Status:** ⚠️ Needs to be run  
**File:** `DB/migrations/031_message_history_system.sql`
**What it adds:**
- 2 new tables for message tracking
- Message history logging
- Saved messages (favorites)

---

## 🚀 **How to Add Them to Neon:**

### **Option 1: Run Setup Scripts (Recommended)**

```bash
# 1. Setup Gamification System
node scripts/setup-gamification.js

# 2. Setup Message History System
node scripts/setup-message-history.js
```

These scripts will:
- ✅ Connect to your Neon database
- ✅ Run the SQL migrations
- ✅ Create all tables
- ✅ Insert default data

---

### **Option 2: Manual via Neon Console**

If scripts don't work, you can copy/paste SQL directly:

#### **Step 1: Add Gamification Tables**

1. Go to your Neon console
2. Open SQL Editor
3. Copy contents from `DB/migrations/030_onboarding_gamification_system.sql`
4. Paste and run

#### **Step 2: Add Message History Tables**

1. Go to your Neon console
2. Open SQL Editor
3. Copy contents from `DB/migrations/031_message_history_system.sql`
4. Paste and run

---

## 📊 **Tables Being Added:**

### **From Migration 030 (Gamification):**

```
1. cleaner_onboarding_progress    - Track user onboarding
2. achievements                    - Achievement definitions
3. cleaner_achievements            - User earned achievements
4. certifications                  - Certification tiers
5. cleaner_certifications          - User earned certifications
6. template_library                - Public template marketplace
7. cleaner_saved_library_templates - User's saved templates
8. template_ratings                - Template ratings/reviews
9. onboarding_tooltips             - In-app help tooltips
```

### **From Migration 031 (Message History):**

```
1. cleaner_message_history         - All sent messages log
2. cleaner_saved_messages          - Personal favorites/drafts
```

**Total New Tables:** 11

---

## 🎯 **Quick Check - What Do You Already Have?**

To check if you need these, run this in Neon SQL Editor:

```sql
-- Check for gamification tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'cleaner_onboarding_progress',
    'achievements',
    'template_library',
    'cleaner_message_history',
    'cleaner_saved_messages'
  )
ORDER BY table_name;
```

**If you see fewer than 5 results, you need to run the migrations!**

---

## ⚡ **Recommended: Run Both Now**

```bash
# Step 1: Navigate to project
cd C:\Users\onlyw\Documents\GitHub\puretask-backend

# Step 2: Run gamification setup
node scripts/setup-gamification.js

# Step 3: Run message history setup
node scripts/setup-message-history.js

# Done! ✅
```

---

## 📝 **What Each Migration Does:**

### **Migration 030 - Gamification System:**

**Creates:**
- Onboarding wizard progress tracking
- 14 pre-loaded achievements
- 4-tier certification program
- Template marketplace with ratings
- Contextual tooltips system

**Enables:**
- Interactive onboarding
- Gamification badges
- Professional certifications
- Community template sharing
- First-time user guidance

---

### **Migration 031 - Message History:**

**Creates:**
- Complete message logging
- Conversation history
- Personal message favorites
- Usage analytics

**Enables:**
- Track all sent messages
- Review past conversations
- Save favorite replies
- Performance insights

---

## 🔍 **Verify Setup:**

After running the scripts, verify in Neon:

```sql
-- Should return 11 new tables
SELECT COUNT(*) as new_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'cleaner_onboarding_progress',
    'achievements',
    'cleaner_achievements',
    'certifications',
    'cleaner_certifications',
    'template_library',
    'cleaner_saved_library_templates',
    'template_ratings',
    'onboarding_tooltips',
    'cleaner_message_history',
    'cleaner_saved_messages'
  );
```

**Expected result:** `11`

---

## ✅ **Summary:**

| Migration | Tables | Features | Status |
|-----------|--------|----------|--------|
| **030_gamification** | 9 | Onboarding, achievements, certifications, marketplace | ⚠️ Run now |
| **031_message_history** | 2 | Message logging, saved messages | ⚠️ Run now |

**Total:** 11 new tables needed

---

## 🚀 **Run Now:**

```bash
# From project root:
node scripts/setup-gamification.js
node scripts/setup-message-history.js
```

**Time:** ~30 seconds  
**Result:** Full gamification + message tracking! 🎉

---

## ⚠️ **Troubleshooting:**

### **If scripts fail:**

1. **Check DATABASE_URL in .env:**
   ```
   DATABASE_URL=postgresql://...neon.tech/...
   ```

2. **Run SQL manually in Neon Console:**
   - Copy from `DB/migrations/030_onboarding_gamification_system.sql`
   - Paste into Neon SQL Editor
   - Run
   - Repeat for `031_message_history_system.sql`

3. **Check for errors:**
   - "table already exists" = Already done! ✅
   - "permission denied" = Check database user permissions
   - "uuid_generate_v4" error = Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` first

---

## 📖 **After Setup:**

**Test the new endpoints:**

```bash
# Test gamification
curl http://localhost:3000/cleaner/achievements \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test message history
curl http://localhost:3000/cleaner/messages/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Ready to add them now?** Run:
```bash
node scripts/setup-gamification.js
node scripts/setup-message-history.js
```

🎉 **Then you'll have everything!**

