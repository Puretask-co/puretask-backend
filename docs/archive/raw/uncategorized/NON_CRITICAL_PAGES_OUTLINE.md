# Non-Critical Pages - What We've Outlined But Haven't Built

**Date**: 2025-01-27  
**Purpose**: List all pages outlined in requirements/guides that are not yet built or need completion

---

## 📊 **OVERVIEW**

**Critical Pages**: ✅ **100% Complete**  
**Non-Critical Pages**: 🟡 **~40% Complete** (many exist but need completion)

---

## 👤 **CLIENT - Non-Critical Pages**

### ✅ **Built & Complete**
1. ✅ Booking form (`/booking`)
2. ✅ Booking confirmation (`/booking/confirm/[id]`)
3. ✅ Booking details/status (`/client/bookings/[id]`)
4. ✅ Client dashboard (`/client/dashboard`)
5. ✅ Client bookings list (`/client/bookings`)

### 🟡 **Exist But Need Completion**

#### 1. **Search/Browse Cleaners** (`/search`)
**Status**: Exists, needs verification/completion
**What's Needed**:
- [ ] Advanced filters (rating, price, distance, availability)
- [ ] Sort options (distance, rating, price)
- [ ] Map view (optional)
- [ ] Cleaner cards with full details
- [ ] Pagination

#### 2. **Cleaner Profile View** (`/cleaner/[id]`)
**Status**: Exists, needs verification/completion
**What's Needed**:
- [ ] Full cleaner profile display
- [ ] Services & pricing
- [ ] Reviews section
- [ ] Availability calendar
- [ ] "Book Now" button
- [ ] Photo gallery

#### 3. **Favorites** (`/favorites`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] List of favorited cleaners
- [ ] Add/remove favorites
- [ ] Quick book from favorites
- [ ] Empty state

#### 4. **Recurring Bookings** (`/client/recurring`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] List of recurring bookings
- [ ] Create recurring booking
- [ ] Edit recurring schedule
- [ ] Pause/resume recurring
- [ ] Cancel recurring

#### 5. **Client Settings** (`/client/settings`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Profile information (name, email, phone)
- [ ] Address book
- [ ] Payment methods
- [ ] Notification preferences
- [ ] Credit auto-refill settings
- [ ] Account deletion

#### 6. **Messages** (`/messages`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Message list (conversations)
- [ ] Chat interface
- [ ] Send/receive messages
- [ ] File attachments (photos)
- [ ] Read receipts
- [ ] Notifications

#### 7. **Reviews** (`/reviews`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] List of reviews given/received
- [ ] Write review form
- [ ] Edit review
- [ ] Review details

#### 8. **Help/Support** (`/help`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] FAQ section
- [ ] Contact support form
- [ ] Help articles
- [ ] Video tutorials
- [ ] Live chat (optional)

### ❌ **Not Built Yet**

#### 9. **Credit Purchase Page** (`/credits/purchase`)
**What's Needed**:
- [ ] Credit packages display
- [ ] Stripe payment integration
- [ ] Purchase history
- [ ] Auto-refill settings

#### 10. **Referral Program** (`/referral`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Referral code display
- [ ] Share referral link
- [ ] Referral history
- [ ] Rewards earned

---

## 🧹 **CLEANER - Non-Critical Pages**

### ✅ **Built & Complete**
1. ✅ Cleaner dashboard (`/cleaner/dashboard`)
2. ✅ Cleaner calendar (`/cleaner/calendar`)
3. ✅ Cleaner job requests (`/cleaner/jobs/requests`)
4. ✅ Cleaner earnings (`/cleaner/earnings`)
5. ✅ Cleaner onboarding (`/cleaner/onboarding`)

### 🟡 **Exist But Need Completion**

#### 1. **Cleaner Profile Management** (`/cleaner/profile`)
**Status**: Not built (mentioned in requirements)
**What's Needed**:
- [ ] Edit profile information
- [ ] Upload/change profile photo
- [ ] Update bio
- [ ] Manage services & pricing
- [ ] Update service areas
- [ ] Background check status
- [ ] Verification documents

#### 2. **Cleaner AI Assistant** (`/cleaner/ai-assistant/*`)
**Status**: Pages exist, needs verification
**What's Needed**:
- [ ] AI assistant chat interface
- [ ] Quick responses
- [ ] Templates
- [ ] Analytics
- [ ] Settings

#### 3. **Cleaner Certifications** (`/cleaner/certifications`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Display certifications
- [ ] Upload new certifications
- [ ] Edit/delete certifications
- [ ] Verification status

#### 4. **Cleaner Leaderboard** (`/cleaner/leaderboard`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Rankings display
- [ ] Filter by category
- [ ] Personal ranking
- [ ] Rewards/badges

#### 5. **Cleaner Progress** (`/cleaner/progress`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Reliability score tracking
- [ ] Tier progression
- [ ] Goals & achievements
- [ ] Performance metrics

#### 6. **Cleaner Team** (`/cleaner/team`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Team members list
- [ ] Add team members
- [ ] Manage team permissions
- [ ] Team earnings split

### ❌ **Not Built Yet**

#### 7. **Cleaner Job Details** (`/cleaner/jobs/[id]`)
**What's Needed**:
- [ ] Full job details
- [ ] Client information
- [ ] Check-in/check-out
- [ ] Photo upload
- [ ] Status updates
- [ ] Navigation to location

#### 8. **Cleaner Availability Settings** (`/cleaner/availability`)
**What's Needed**:
- [ ] Weekly schedule editor
- [ ] Time off management
- [ ] Service area management
- [ ] Preferences (max jobs per day, etc.)

#### 9. **Cleaner Messages** (`/cleaner/messages`)
**What's Needed**:
- [ ] Message list
- [ ] Chat interface
- [ ] Quick responses
- [ ] File attachments

---

## 👨‍💼 **ADMIN - Non-Critical Pages**

### ✅ **Built & Complete**
1. ✅ Admin dashboard (`/admin/dashboard`)
2. ✅ Admin analytics (`/admin/analytics`)
3. ✅ Admin bookings (`/admin/bookings`)
4. ✅ Admin users (`/admin/users`)

### 🟡 **Exist But Need Completion**

#### 1. **Admin Disputes** (`/admin/disputes`)
**Status**: Not found in directory, needs building
**What's Needed**:
- [ ] Disputes list table
- [ ] Filter by status
- [ ] Dispute details view
- [ ] Resolution options (refund, no refund, partial)
- [ ] Dispute history
- [ ] Admin notes

#### 2. **Admin Finance** (`/admin/finance`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Revenue overview
- [ ] Credits purchased
- [ ] Payouts processed
- [ ] Platform fees
- [ ] Financial reports
- [ ] Transaction history

#### 3. **Admin Communication** (`/admin/communication`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Send announcements
- [ ] Email templates
- [ ] SMS templates
- [ ] Push notification management
- [ ] Communication history

#### 4. **Admin Risk** (`/admin/risk`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Risk score dashboard
- [ ] Flagged users
- [ ] Fraud detection
- [ ] Risk alerts
- [ ] Risk mitigation actions

#### 5. **Admin Reports** (`/admin/reports`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Generate reports
- [ ] Export data (CSV, PDF)
- [ ] Custom date ranges
- [ ] Report templates
- [ ] Scheduled reports

#### 6. **Admin Settings** (`/admin/settings`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] Platform settings
- [ ] Feature flags
- [ ] Pricing configuration
- [ ] System configuration
- [ ] Integration settings

#### 7. **Admin API** (`/admin/api`)
**Status**: Page exists, needs implementation
**What's Needed**:
- [ ] API key management
- [ ] API usage stats
- [ ] Webhook configuration
- [ ] API documentation

---

## 📋 **SUMMARY BY PRIORITY**

### **HIGH PRIORITY (Should Build Next)**
1. **Client**: Search/browse cleaners (enhancement)
2. **Client**: Cleaner profile view (enhancement)
3. **Client**: Messages page (core feature)
4. **Cleaner**: Cleaner profile management (core feature)
5. **Cleaner**: Job details page (core feature)
6. **Admin**: Disputes management (core feature)

### **MEDIUM PRIORITY (Nice to Have)**
1. **Client**: Favorites page
2. **Client**: Recurring bookings
3. **Client**: Client settings
4. **Client**: Reviews page
5. **Cleaner**: Availability settings page
6. **Cleaner**: Messages page
7. **Admin**: Finance page
8. **Admin**: Communication page

### **LOW PRIORITY (Future Enhancements)**
1. **Client**: Help/support page
2. **Client**: Referral program
3. **Cleaner**: AI assistant pages
4. **Cleaner**: Certifications page
5. **Cleaner**: Leaderboard
6. **Cleaner**: Progress tracking
7. **Cleaner**: Team management
8. **Admin**: Risk management
9. **Admin**: Reports
10. **Admin**: Settings
11. **Admin**: API management

---

## 🎯 **RECOMMENDED NEXT STEPS**

### **Phase 1: Core Features (2-3 weeks)**
1. Enhance search/browse cleaners page
2. Complete cleaner profile view
3. Build messages page (client & cleaner)
4. Build cleaner profile management
5. Build cleaner job details page
6. Build admin disputes page

### **Phase 2: User Experience (2-3 weeks)**
1. Build favorites page
2. Build recurring bookings
3. Build client settings
4. Build reviews page
5. Build cleaner availability settings

### **Phase 3: Admin Tools (1-2 weeks)**
1. Complete admin finance page
2. Complete admin communication page
3. Complete admin settings

### **Phase 4: Enhancements (Ongoing)**
1. Help/support page
2. Referral program
3. Cleaner AI assistant
4. All other low-priority pages

---

**Total Non-Critical Pages**: ~30 pages  
**Built**: ~12 pages (40%)  
**Need Building/Completion**: ~18 pages (60%)
