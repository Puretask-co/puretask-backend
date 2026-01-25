# Complete Build Plan - All Phases Detailed

**Date**: 2025-01-27  
**Goal**: Build ALL critical and non-critical pages for PureTask  
**Status**: Ready to Begin

---

## ✅ **CONFIRMATION: After 4 Phases, We Will Have Built Everything**

**Critical Pages**: ✅ 100% Complete (already done)  
**Non-Critical Pages**: Will be 100% Complete after 4 phases

**Total Pages to Build**: 26 pages across all phases

---

## 📋 **PHASE 1: CORE FEATURES** (2-3 weeks)

### **Goal**: Build essential features needed for basic platform functionality

---

### **1.1 Enhance Search/Browse Cleaners Page** (`/search`)

**Current Status**: Page exists, needs enhancement

**What Needs to Be Built**:

#### A. **Advanced Filters Component**
- [ ] **Location Filter**
  - ZIP code input
  - City/State input
  - Radius selector (5, 10, 15, 20, 25+ miles)
  - "Use my location" button (GPS)

- [ ] **Service Type Filter**
  - Checkboxes for:
    - Standard Cleaning
    - Deep Clean
    - Move In/Out
    - Airbnb Cleaning
  - "Select All" / "Clear All"

- [ ] **Rating Filter**
  - Minimum rating slider (0-5 stars)
  - "4+ stars only" quick filter
  - "4.5+ stars only" quick filter

- [ ] **Price Range Filter**
  - Min price input
  - Max price input
  - Price range slider
  - "Under $50", "$50-$100", "$100+" quick filters

- [ ] **Availability Filter**
  - Date picker
  - Time range selector
  - "Available today" quick filter
  - "Available this week" quick filter

- [ ] **Features Filter**
  - Checkboxes:
    - Verified
    - Background checked
    - Insured
    - Eco-friendly
    - Pet-friendly
    - Same-day available

#### B. **Sort Options**
- [ ] Sort dropdown with:
  - Distance (closest first)
  - Rating (highest first)
  - Price (lowest first)
  - Price (highest first)
  - Most reviews
  - Newest cleaners

#### C. **Search Results Display**
- [ ] **Cleaner Cards** (enhanced)
  - Profile photo
  - Name
  - Star rating + review count
  - Starting price
  - Distance from search location
  - Services offered (badges)
  - Availability indicator
  - "View Profile" button
  - "Book Now" button (quick book)

- [ ] **Map View Toggle**
  - List view / Map view toggle
  - Map with cleaner markers
  - Click marker to see cleaner card

- [ ] **Pagination**
  - Page numbers
  - "Load more" button
  - Results count ("Showing 1-20 of 150")

#### D. **Empty States**
- [ ] No results found
- [ ] No filters match
- [ ] Search error

**Backend APIs Needed**:
- `GET /cleaners/search` (already exists)
- Need to verify all filter params work

**Files to Create/Modify**:
- `src/app/search/page.tsx` (enhance existing)
- `src/components/features/search/FilterPanel.tsx` (new)
- `src/components/features/search/SortDropdown.tsx` (new)
- `src/components/features/search/CleanerCard.tsx` (enhance existing)
- `src/components/features/search/MapView.tsx` (new, optional)

**Estimated Time**: 8-12 hours

---

### **1.2 Complete Cleaner Profile View** (`/cleaner/[id]`)

**Current Status**: Page exists, needs completion

**What Needs to Be Built**:

#### A. **Profile Header**
- [ ] Large profile photo
- [ ] Name
- [ ] Star rating + review count
- [ ] "Book Now" button (prominent)
- [ ] "Message" button
- [ ] "Favorite" button (heart icon)

#### B. **About Section**
- [ ] Bio text
- [ ] Years of experience
- [ ] Languages spoken
- [ ] Certifications badges
- [ ] Verification badges (verified, background checked, insured)

#### C. **Services & Pricing**
- [ ] Services list with:
  - Service name
  - Hourly rate or flat rate
  - Minimum booking
  - Description

#### D. **Availability Calendar**
- [ ] Calendar widget showing:
  - Available dates (green)
  - Limited availability (yellow)
  - Unavailable (gray)
  - Booked (red)
- [ ] Time slots for selected date
- [ ] "Check Availability" button

#### E. **Reviews Section**
- [ ] Review cards with:
  - Client name (or "Anonymous")
  - Rating (stars)
  - Review text
  - Date
  - Photos (if any)
- [ ] Rating breakdown (5⭐, 4⭐, 3⭐, etc.)
- [ ] "Load more reviews" button
- [ ] "Write a review" button (if client has used this cleaner)

#### F. **Photo Gallery**
- [ ] Before/after photos
- [ ] Work samples
- [ ] Lightbox view for full-size images

#### G. **Location & Service Area**
- [ ] Map showing cleaner location
- [ ] Service radius
- [ ] Service areas list

**Backend APIs Needed**:
- `GET /cleaners/:id` (already exists)
- `GET /cleaners/:id/reviews` (already exists)
- `GET /cleaners/:id/availability` (already exists)
- `GET /cleaners/:id/photos` (may need to create)

**Files to Create/Modify**:
- `src/app/cleaner/[id]/page.tsx` (enhance existing)
- `src/components/features/cleaner/ProfileHeader.tsx` (new)
- `src/components/features/cleaner/ServicesList.tsx` (new)
- `src/components/features/cleaner/AvailabilityCalendar.tsx` (new)
- `src/components/features/cleaner/ReviewsSection.tsx` (new)
- `src/components/features/cleaner/PhotoGallery.tsx` (new)

**Estimated Time**: 10-14 hours

---

### **1.3 Build Messages Page** (`/messages`)

**Current Status**: Page exists, needs full implementation

**What Needs to Be Built**:

#### A. **Messages Layout**
- [ ] **Sidebar** - Conversation list
  - List of conversations
  - Unread indicator
  - Last message preview
  - Timestamp
  - Active conversation highlight

- [ ] **Main Area** - Chat interface
  - Message list
  - Input area
  - Send button
  - Attachment button

#### B. **Conversation List**
- [ ] **Conversation Cards**
  - Other user's photo/avatar
  - Name
  - Last message preview
  - Timestamp
  - Unread count badge
  - Job context (if related to job)

- [ ] **Filters**
  - All conversations
  - Unread only
  - Job-related only

- [ ] **Search**
  - Search conversations by name
  - Search messages

#### C. **Chat Interface**
- [ ] **Message Bubbles**
  - Sent messages (right, blue)
  - Received messages (left, gray)
  - Timestamp per message
  - Read receipts (✓✓)
  - Delivery status

- [ ] **Message Input**
  - Text input (multiline)
  - Emoji picker
  - Attachment button
  - Send button
  - Character count (if limit)

- [ ] **Attachments**
  - Photo upload
  - File upload (if allowed)
  - Preview before send
  - Remove attachment

- [ ] **Typing Indicator**
  - "User is typing..." indicator

#### D. **Job Context** (if message is job-related)
- [ ] Job card showing:
  - Job date/time
  - Address
  - Service type
  - Status
  - "View Job" link

#### E. **Real-time Updates**
- [ ] WebSocket connection
- [ ] New message notifications
- [ ] Read receipts
- [ ] Typing indicators

**Backend APIs Needed**:
- `GET /messages` - List conversations
- `GET /messages/:conversationId` - Get messages
- `POST /messages` - Send message
- `PATCH /messages/:id/read` - Mark as read
- WebSocket for real-time (may need setup)

**Files to Create/Modify**:
- `src/app/messages/page.tsx` (enhance existing)
- `src/components/features/messages/ConversationList.tsx` (new)
- `src/components/features/messages/ChatInterface.tsx` (new)
- `src/components/features/messages/MessageBubble.tsx` (new)
- `src/components/features/messages/MessageInput.tsx` (new)
- `src/services/message.service.ts` (enhance existing)
- `src/hooks/useMessages.ts` (enhance existing)

**Estimated Time**: 12-16 hours

---

### **1.4 Build Cleaner Profile Management** (`/cleaner/profile`)

**Current Status**: Not built

**What Needs to Be Built**:

#### A. **Profile Information Tab**
- [ ] **Personal Details Form**
  - Profile photo upload
  - First name
  - Last name
  - Email (read-only or editable)
  - Phone number
  - Bio textarea (500 char limit)
  - Years of experience
  - Languages spoken (multi-select)

- [ ] **Address Information**
  - Street address
  - City, State, ZIP
  - Service radius (miles)

- [ ] **Save Button**
  - Validation
  - Success/error messages

#### B. **Services & Pricing Tab**
- [ ] **Services List**
  - Add service button
  - Service cards with:
    - Service name
    - Hourly rate input
    - Flat rate toggle
    - Minimum hours
    - Description
    - Edit/Delete buttons

- [ ] **Service Form Modal**
  - Service type selector
  - Rate input
  - Rate type (hourly/flat)
  - Minimum booking
  - Description

#### C. **Service Areas Tab**
- [ ] **Service Areas List**
  - Current service areas
  - Add new area button
  - Edit/Delete buttons

- [ ] **Add Service Area Form**
  - ZIP code input
  - City/State input
  - Radius selector
  - Map picker (optional)

#### D. **Verification Tab**
- [ ] **Verification Status**
  - Background check status
  - ID verification status
  - Address verification status

- [ ] **Documents Upload**
  - ID upload
  - Proof of address upload
  - Certifications upload
  - Document status (pending/approved/rejected)

#### E. **Settings Tab**
- [ ] **Notification Preferences**
  - Email notifications toggle
  - SMS notifications toggle
  - Push notifications toggle
  - Job request notifications
  - Payment notifications

- [ ] **Account Settings**
  - Change password
  - Two-factor authentication (if implemented)
  - Delete account

**Backend APIs Needed**:
- `GET /cleaner/profile` (already exists)
- `PATCH /cleaner/profile` (already exists)
- `GET /cleaner/services` (may need to create)
- `POST /cleaner/services` (may need to create)
- `PUT /cleaner/services/:id` (may need to create)
- `DELETE /cleaner/services/:id` (may need to create)
- `GET /cleaner/service-areas` (already exists)
- `POST /cleaner/service-areas` (already exists)
- `DELETE /cleaner/service-areas/:id` (already exists)

**Files to Create/Modify**:
- `src/app/cleaner/profile/page.tsx` (new)
- `src/components/features/cleaner/ProfileForm.tsx` (new)
- `src/components/features/cleaner/ServicesManager.tsx` (new)
- `src/components/features/cleaner/ServiceAreasManager.tsx` (new)
- `src/components/features/cleaner/VerificationStatus.tsx` (new)
- `src/services/cleanerProfile.service.ts` (new)

**Estimated Time**: 14-18 hours

---

### **1.5 Build Cleaner Job Details Page** (`/cleaner/jobs/[id]`)

**Current Status**: Not built

**What Needs to Be Built**:

#### A. **Job Header**
- [ ] Job ID
- [ ] Status badge
- [ ] Service type
- [ ] Date & time
- [ ] Address

#### B. **Client Information**
- [ ] Client photo/avatar
- [ ] Client name
- [ ] Client rating (as client)
- [ ] "Message Client" button
- [ ] "Call Client" button (if phone available)

#### C. **Job Details**
- [ ] **Service Information**
  - Service type
  - Duration
  - Special instructions
  - Add-ons

- [ ] **Location**
  - Full address
  - Map view
  - "Get Directions" button (Google Maps)
  - Parking instructions (if provided)

- [ ] **Payment Information**
  - Credits earned
  - USD amount
  - Payout status

#### D. **Job Actions** (based on status)
- [ ] **If Status = "accepted"**
  - "Start Job" button
  - "Cancel Job" button

- [ ] **If Status = "in_progress"**
  - "Check In" button (GPS)
  - "Upload Before Photos" button
  - "Complete Job" button

- [ ] **If Status = "completed"**
  - "View Photos" button
  - "View Payment" button

#### E. **Status Timeline**
- [ ] Visual timeline showing:
  - Job created
  - Job accepted
  - Cleaner on the way
  - Job started
  - Job completed
  - Client approved

#### F. **Photo Upload**
- [ ] **Before Photos**
  - Upload button
  - Photo preview
  - Delete photo
  - Minimum 2 photos required

- [ ] **After Photos**
  - Upload button
  - Photo preview
  - Delete photo
  - Minimum 2 photos required

#### G. **Check-In/Check-Out**
- [ ] **Check-In**
  - GPS location capture
  - Timestamp
  - "Check In" button
  - Location accuracy indicator

- [ ] **Check-Out**
  - GPS location capture
  - Timestamp
  - "Check Out" button

**Backend APIs Needed**:
- `GET /jobs/:id` (already exists)
- `POST /jobs/:id/transition` (already exists)
- `POST /jobs/:id/check-in` (may need to create)
- `POST /jobs/:id/check-out` (may need to create)
- `POST /jobs/:id/photos` (may need to create)
- `GET /jobs/:id/photos` (may need to create)

**Files to Create/Modify**:
- `src/app/cleaner/jobs/[id]/page.tsx` (new)
- `src/components/features/jobs/JobHeader.tsx` (new)
- `src/components/features/jobs/ClientInfo.tsx` (new)
- `src/components/features/jobs/JobActions.tsx` (new)
- `src/components/features/jobs/StatusTimeline.tsx` (new)
- `src/components/features/jobs/PhotoUpload.tsx` (new)
- `src/components/features/jobs/CheckInOut.tsx` (new)

**Estimated Time**: 12-16 hours

---

### **1.6 Build Admin Disputes Page** (`/admin/disputes`)

**Current Status**: Not built

**What Needs to Be Built**:

#### A. **Disputes List Table**
- [ ] **Table Columns**
  - Dispute ID
  - Job ID (link to job)
  - Client name
  - Cleaner name
  - Dispute reason
  - Status (pending/reviewing/resolved)
  - Created date
  - Actions (Review button)

- [ ] **Filters**
  - Status filter (all/pending/reviewing/resolved)
  - Date range filter
  - Client filter
  - Cleaner filter

- [ ] **Sort Options**
  - Date (newest first)
  - Date (oldest first)
  - Status

#### B. **Dispute Details View/Modal**
- [ ] **Dispute Information**
  - Dispute ID
  - Job ID (link)
  - Created date
  - Status
  - Dispute reason
  - Dispute description

- [ ] **Job Information**
  - Job details card
  - Service type
  - Date/time
  - Address
  - Credits amount

- [ ] **Client Information**
  - Client name
  - Client rating
  - Client history

- [ ] **Cleaner Information**
  - Cleaner name
  - Cleaner rating
  - Cleaner history

- [ ] **Photos**
  - Before photos
  - After photos
  - Comparison view

- [ ] **Messages**
  - Conversation between client and cleaner
  - Dispute-related messages highlighted

#### C. **Resolution Options**
- [ ] **Resolution Form**
  - Resolution type selector:
    - Full refund to client
    - Partial refund (amount input)
    - No refund
    - Adjust cleaner earnings
  - Admin notes (required)
  - Resolution reason
  - "Resolve Dispute" button

- [ ] **Confirmation Modal**
  - Review resolution details
  - Confirm action
  - "Cancel" button

#### D. **Dispute History**
- [ ] Timeline of dispute events:
  - Dispute created
  - Admin reviewed
  - Resolution applied
  - Refund processed (if applicable)

#### E. **Bulk Actions** (optional)
- [ ] Select multiple disputes
- [ ] Bulk status update
- [ ] Bulk assign to admin

**Backend APIs Needed**:
- `GET /admin/disputes` (may need to create)
- `GET /admin/disputes/:id` (may need to create)
- `POST /admin/disputes/:id/resolve` (may need to create)
- `GET /jobs/:id` (already exists)
- `GET /jobs/:id/photos` (may need to create)
- `GET /messages?jobId=:id` (may need to create)

**Files to Create/Modify**:
- `src/app/admin/disputes/page.tsx` (new)
- `src/components/admin/DisputesTable.tsx` (new)
- `src/components/admin/DisputeDetails.tsx` (new)
- `src/components/admin/DisputeResolution.tsx` (new)
- `src/services/adminDisputes.service.ts` (new)
- `src/hooks/useAdminDisputes.ts` (new)

**Estimated Time**: 14-18 hours

---

## 📊 **PHASE 1 SUMMARY**

**Total Pages/Features**: 6  
**Total Estimated Time**: 70-94 hours (2-3 weeks)  
**Priority**: CRITICAL - Must complete for platform to function

**Pages to Build**:
1. Enhance `/search` page
2. Complete `/cleaner/[id]` page
3. Build `/messages` page
4. Build `/cleaner/profile` page
5. Build `/cleaner/jobs/[id]` page
6. Build `/admin/disputes` page

---

## 📋 **PHASE 2: USER EXPERIENCE** (2-3 weeks)

### **Goal**: Enhance user experience with convenience features

---

### **2.1 Build Favorites Page** (`/favorites`)

**What Needs to Be Built**:

#### A. **Favorites List**
- [ ] Grid/list view of favorited cleaners
- [ ] Cleaner cards (reuse from search)
- [ ] Empty state ("No favorites yet")

#### B. **Favorites Actions**
- [ ] Remove from favorites (heart icon)
- [ ] "Book Now" button
- [ ] "View Profile" button

#### C. **Filters & Sort**
- [ ] Filter by service type
- [ ] Sort by rating, price, distance

**Backend APIs Needed**:
- `GET /favorites` (may need to create)
- `POST /favorites/:cleanerId` (may need to create)
- `DELETE /favorites/:cleanerId` (may need to create)

**Files to Create/Modify**:
- `src/app/favorites/page.tsx` (enhance existing)
- `src/services/favorites.service.ts` (new)
- `src/hooks/useFavorites.ts` (new)

**Estimated Time**: 4-6 hours

---

### **2.2 Build Recurring Bookings** (`/client/recurring`)

**What Needs to Be Built**:

#### A. **Recurring Bookings List**
- [ ] List of active recurring bookings
- [ ] Each card shows:
  - Cleaner name
  - Service type
  - Frequency (weekly/bi-weekly/monthly)
  - Next booking date
  - Status (active/paused/cancelled)

#### B. **Create Recurring Booking**
- [ ] Form with:
  - Select cleaner
  - Service type
  - Frequency selector
  - Start date
  - End date (optional)
  - Time slot
  - Address

#### C. **Manage Recurring Booking**
- [ ] Edit frequency
- [ ] Pause recurring
- [ ] Resume recurring
- [ ] Cancel recurring
- [ ] Skip next booking
- [ ] View booking history

**Backend APIs Needed**:
- `GET /recurring-bookings` (may need to create)
- `POST /recurring-bookings` (may need to create)
- `PATCH /recurring-bookings/:id` (may need to create)
- `DELETE /recurring-bookings/:id` (may need to create)

**Files to Create/Modify**:
- `src/app/client/recurring/page.tsx` (enhance existing)
- `src/components/features/recurring/RecurringBookingCard.tsx` (new)
- `src/components/features/recurring/CreateRecurringForm.tsx` (new)
- `src/services/recurring.service.ts` (new)

**Estimated Time**: 8-12 hours

---

### **2.3 Build Client Settings** (`/client/settings`)

**What Needs to Be Built**:

#### A. **Profile Tab**
- [ ] Edit name
- [ ] Edit email
- [ ] Edit phone
- [ ] Change password
- [ ] Profile photo upload

#### B. **Address Book**
- [ ] List of saved addresses
- [ ] Add new address
- [ ] Edit address
- [ ] Delete address
- [ ] Set default address

#### C. **Payment Methods**
- [ ] List of saved payment methods
- [ ] Add new payment method (Stripe)
- [ ] Set default payment method
- [ ] Delete payment method

#### D. **Notification Preferences**
- [ ] Email notifications toggle
- [ ] SMS notifications toggle
- [ ] Push notifications toggle
- [ ] Job updates notifications
- [ ] Marketing emails toggle

#### E. **Credit Settings**
- [ ] Auto-refill toggle
- [ ] Auto-refill threshold
- [ ] Auto-refill amount
- [ ] Payment method for auto-refill

#### F. **Account Settings**
- [ ] Delete account option
- [ ] Export data option

**Backend APIs Needed**:
- `GET /client/profile` (may need to create)
- `PATCH /client/profile` (may need to create)
- `GET /client/addresses` (may need to create)
- `POST /client/addresses` (may need to create)
- `GET /client/payment-methods` (may need to create)
- `POST /client/payment-methods` (may need to create)

**Files to Create/Modify**:
- `src/app/client/settings/page.tsx` (enhance existing)
- `src/components/features/settings/ProfileTab.tsx` (new)
- `src/components/features/settings/AddressBook.tsx` (new)
- `src/components/features/settings/PaymentMethods.tsx` (new)
- `src/services/clientSettings.service.ts` (new)

**Estimated Time**: 10-14 hours

---

### **2.4 Build Reviews Page** (`/reviews`)

**What Needs to Be Built**:

#### A. **Reviews Given Tab**
- [ ] List of reviews client has written
- [ ] Each review shows:
  - Cleaner name
  - Rating
  - Review text
  - Date
  - "Edit Review" button
  - "Delete Review" button

#### B. **Write Review Form**
- [ ] Rating selector (1-5 stars)
- [ ] Review text textarea
- [ ] Photo upload (optional)
- [ ] "Submit Review" button

#### C. **Edit Review**
- [ ] Pre-filled form
- [ ] Update rating
- [ ] Update text
- [ ] "Update Review" button

**Backend APIs Needed**:
- `GET /reviews/given` (may need to create)
- `POST /reviews` (may need to create)
- `PATCH /reviews/:id` (may need to create)
- `DELETE /reviews/:id` (may need to create)

**Files to Create/Modify**:
- `src/app/reviews/page.tsx` (enhance existing)
- `src/components/features/reviews/ReviewCard.tsx` (new)
- `src/components/features/reviews/WriteReviewForm.tsx` (new)
- `src/services/reviews.service.ts` (new)

**Estimated Time**: 6-8 hours

---

### **2.5 Build Cleaner Availability Settings** (`/cleaner/availability`)

**What Needs to Be Built**:

#### A. **Weekly Schedule Editor**
- [ ] Day-by-day schedule (Mon-Sun)
- [ ] For each day:
  - Available toggle
  - Start time picker
  - End time picker
  - Add multiple time slots
  - Remove time slot

#### B. **Time Off Management**
- [ ] List of time off entries
- [ ] Add time off:
  - Start date
  - End date
  - All day toggle
  - Start/end time (if not all day)
  - Reason (optional)
- [ ] Edit time off
- [ ] Delete time off

#### C. **Preferences**
- [ ] Maximum jobs per day
- [ ] Minimum job duration
- [ ] Maximum job duration
- [ ] Buffer time between jobs
- [ ] Accept same-day bookings toggle

**Backend APIs Needed**:
- `GET /cleaner/availability` (already exists)
- `PUT /cleaner/availability` (already exists)
- `GET /cleaner/time-off` (already exists)
- `POST /cleaner/time-off` (already exists)
- `DELETE /cleaner/time-off/:id` (already exists)
- `GET /cleaner/preferences` (already exists)
- `PUT /cleaner/preferences` (already exists)

**Files to Create/Modify**:
- `src/app/cleaner/availability/page.tsx` (new)
- `src/components/features/availability/WeeklySchedule.tsx` (new)
- `src/components/features/availability/TimeOffManager.tsx` (new)
- `src/components/features/availability/PreferencesForm.tsx` (new)

**Estimated Time**: 8-12 hours

---

## 📊 **PHASE 2 SUMMARY**

**Total Pages/Features**: 5  
**Total Estimated Time**: 36-52 hours (1-2 weeks)  
**Priority**: HIGH - Improves user experience significantly

---

## 📋 **PHASE 3: ADMIN TOOLS** (1-2 weeks)

### **Goal**: Complete admin management tools

---

### **3.1 Complete Admin Finance Page** (`/admin/finance`)

**What Needs to Be Built**:

#### A. **Revenue Overview**
- [ ] Revenue cards:
  - Today's revenue
  - This week's revenue
  - This month's revenue
  - All-time revenue

#### B. **Credits Purchased**
- [ ] Chart showing credits purchased over time
- [ ] Table of credit purchases
- [ ] Filter by date range

#### C. **Payouts Processed**
- [ ] Total payouts
- [ ] Payouts by status
- [ ] Payout history table
- [ ] Failed payouts list

#### D. **Platform Fees**
- [ ] Total fees collected
- [ ] Fees by period
- [ ] Fee breakdown chart

#### E. **Financial Reports**
- [ ] Export to CSV
- [ ] Export to PDF
- [ ] Custom date range reports

**Backend APIs Needed**:
- `GET /admin/finance/revenue` (may need to create)
- `GET /admin/finance/credits` (may need to create)
- `GET /admin/finance/payouts` (may need to create)
- `GET /admin/finance/fees` (may need to create)

**Files to Create/Modify**:
- `src/app/admin/finance/page.tsx` (enhance existing)
- `src/components/admin/RevenueOverview.tsx` (new)
- `src/components/admin/PayoutsTable.tsx` (new)
- `src/services/adminFinance.service.ts` (new)

**Estimated Time**: 8-12 hours

---

### **3.2 Complete Admin Communication Page** (`/admin/communication`)

**What Needs to Be Built**:

#### A. **Send Announcements**
- [ ] Form to send announcement:
  - Recipients (all users/clients/cleaners/specific users)
  - Subject
  - Message body
  - Channel (email/SMS/push/all)
  - Schedule send (optional)
  - "Send" button

#### B. **Email Templates**
- [ ] List of email templates
- [ ] Create new template
- [ ] Edit template
- [ ] Delete template
- [ ] Preview template

#### C. **SMS Templates**
- [ ] List of SMS templates
- [ ] Create new template
- [ ] Edit template
- [ ] Delete template

#### D. **Push Notification Management**
- [ ] Send push notification
- [ ] Notification history
- [ ] Delivery stats

#### E. **Communication History**
- [ ] List of all sent communications
- [ ] Filter by type, date, recipient
- [ ] View details
- [ ] Resend (if failed)

**Backend APIs Needed**:
- `POST /admin/announcements` (may need to create)
- `GET /admin/templates` (may need to create)
- `POST /admin/templates` (may need to create)
- `GET /admin/communications` (may need to create)

**Files to Create/Modify**:
- `src/app/admin/communication/page.tsx` (enhance existing)
- `src/components/admin/AnnouncementForm.tsx` (new)
- `src/components/admin/TemplateManager.tsx` (new)
- `src/services/adminCommunication.service.ts` (new)

**Estimated Time**: 10-14 hours

---

### **3.3 Complete Admin Settings Page** (`/admin/settings`)

**What Needs to Be Built**:

#### A. **Platform Settings**
- [ ] Platform name
- [ ] Platform logo upload
- [ ] Support email
- [ ] Support phone
- [ ] Terms of Service URL
- [ ] Privacy Policy URL

#### B. **Feature Flags**
- [ ] Toggle features on/off:
  - Bookings enabled
  - New registrations
  - Payments
  - Payouts
  - Messaging
  - Reviews

#### C. **Pricing Configuration**
- [ ] Credit to USD conversion rate
- [ ] Platform fee percentage
- [ ] Cleaner payout percentages (by tier)
- [ ] Minimum booking amount
- [ ] Maximum booking amount

#### D. **System Configuration**
- [ ] Minimum lead time (hours)
- [ ] Auto-cancel time (hours)
- [ ] Payout schedule
- [ ] Notification settings

#### E. **Integration Settings**
- [ ] Stripe settings
- [ ] SendGrid settings
- [ ] Twilio settings
- [ ] OneSignal settings
- [ ] n8n settings

**Backend APIs Needed**:
- `GET /admin/settings` (may need to create)
- `PUT /admin/settings` (may need to create)
- `GET /admin/settings/features` (may need to create)
- `PUT /admin/settings/features` (may need to create)

**Files to Create/Modify**:
- `src/app/admin/settings/page.tsx` (enhance existing)
- `src/components/admin/PlatformSettings.tsx` (new)
- `src/components/admin/FeatureFlags.tsx` (new)
- `src/components/admin/PricingConfig.tsx` (new)
- `src/services/adminSettings.service.ts` (new)

**Estimated Time**: 10-14 hours

---

## 📊 **PHASE 3 SUMMARY**

**Total Pages/Features**: 3  
**Total Estimated Time**: 28-40 hours (1 week)  
**Priority**: MEDIUM - Important for admin operations

---

## 📋 **PHASE 4: ENHANCEMENTS** (Ongoing)

### **Goal**: Add polish and additional features

---

### **4.1 Help/Support Page** (`/help`)

**What Needs to Be Built**:
- [ ] FAQ section with categories
- [ ] Search FAQ
- [ ] Contact support form
- [ ] Help articles
- [ ] Video tutorials (embedded)
- [ ] Live chat widget (optional)

**Estimated Time**: 6-8 hours

---

### **4.2 Referral Program** (`/referral`)

**What Needs to Be Built**:
- [ ] Referral code display
- [ ] Share referral link (social media)
- [ ] Referral history
- [ ] Rewards earned
- [ ] Referral stats

**Estimated Time**: 6-8 hours

---

### **4.3 Cleaner AI Assistant Pages** (`/cleaner/ai-assistant/*`)

**What Needs to Be Built**:
- [ ] AI chat interface
- [ ] Quick responses library
- [ ] Template management
- [ ] Analytics dashboard
- [ ] Settings

**Estimated Time**: 12-16 hours

---

### **4.4 Cleaner Certifications** (`/cleaner/certifications`)

**What Needs to Be Built**:
- [ ] Display certifications
- [ ] Upload new certification
- [ ] Edit certification
- [ ] Delete certification
- [ ] Verification status

**Estimated Time**: 4-6 hours

---

### **4.5 Cleaner Leaderboard** (`/cleaner/leaderboard`)

**What Needs to Be Built**:
- [ ] Rankings table
- [ ] Filter by category
- [ ] Personal ranking highlight
- [ ] Rewards/badges display

**Estimated Time**: 6-8 hours

---

### **4.6 Cleaner Progress** (`/cleaner/progress`)

**What Needs to Be Built**:
- [ ] Reliability score display
- [ ] Tier progression chart
- [ ] Goals & achievements
- [ ] Performance metrics

**Estimated Time**: 6-8 hours

---

### **4.7 Cleaner Team** (`/cleaner/team`)

**What Needs to Be Built**:
- [ ] Team members list
- [ ] Add team member
- [ ] Edit team member
- [ ] Remove team member
- [ ] Team permissions
- [ ] Earnings split configuration

**Estimated Time**: 8-12 hours

---

### **4.8 Admin Risk Page** (`/admin/risk`)

**What Needs to Be Built**:
- [ ] Risk score dashboard
- [ ] Flagged users list
- [ ] Fraud detection alerts
- [ ] Risk mitigation actions

**Estimated Time**: 8-12 hours

---

### **4.9 Admin Reports Page** (`/admin/reports`)

**What Needs to Be Built**:
- [ ] Report generator
- [ ] Export to CSV/PDF
- [ ] Custom date ranges
- [ ] Report templates
- [ ] Scheduled reports

**Estimated Time**: 8-12 hours

---

### **4.10 Admin API Page** (`/admin/api`)

**What Needs to Be Built**:
- [ ] API key management
- [ ] API usage statistics
- [ ] Webhook configuration
- [ ] API documentation

**Estimated Time**: 6-8 hours

---

## 📊 **PHASE 4 SUMMARY**

**Total Pages/Features**: 10  
**Total Estimated Time**: 70-98 hours (2-3 weeks)  
**Priority**: LOW - Nice to have enhancements

---

## 🎯 **COMPLETE BUILD SUMMARY**

### **Total Across All Phases**:
- **Phase 1**: 6 pages, 70-94 hours
- **Phase 2**: 5 pages, 36-52 hours
- **Phase 3**: 3 pages, 28-40 hours
- **Phase 4**: 10 pages, 70-98 hours

**GRAND TOTAL**: 24 pages, 204-284 hours (5-7 weeks)

### **After Completion**:
✅ All critical pages: 100%  
✅ All non-critical pages: 100%  
✅ Complete PureTask frontend: 100%

---

## 🚀 **READY TO BEGIN**

**Starting with Phase 1, Feature 1.1: Enhance Search/Browse Cleaners Page**
