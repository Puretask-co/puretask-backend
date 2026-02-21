# 🧹 **CLEANER USER - COMPLETE GUIDE & TEST CHECKLIST**

## 📋 **Quick Reference**

**What is a Cleaner?**
A cleaner is a **professional service provider** who offers cleaning services through PureTask. As a cleaner, you can:
- Create a professional profile
- Set your own prices and services
- Manage your availability
- Receive and accept booking requests
- Build your reputation through reviews
- Earn income on your schedule
- Grow your cleaning business

**Cleaner Dashboard:** http://localhost:3001/cleaner/dashboard

---

## 🎯 **What Can Cleaners Do?**

- ✅ Register and complete professional profile
- ✅ Verify identity and credentials
- ✅ Set services offered and pricing
- ✅ Manage availability calendar
- ✅ Receive booking requests
- ✅ Accept or decline bookings
- ✅ View your schedule
- ✅ Navigate to client locations
- ✅ Track job progress
- ✅ Chat with clients
- ✅ Receive payments automatically
- ✅ Track earnings and analytics
- ✅ Build your reputation via reviews
- ✅ Manage recurring clients
- ✅ Access cleaner resources and training
- ✅ Request payouts
- ✅ Get customer support

---

## 🚀 **STEP-BY-STEP CLEANER GUIDE**

### **SECTION 1: REGISTRATION & ONBOARDING**

#### **1.1 Create Your Cleaner Account**
- [ ] Go to: http://localhost:3001/auth/register
- [ ] You should see "Create Your Account" form

**Registration Form:**
- [ ] Select **"I'm a Cleaner"** (radio button or toggle)
- [ ] Enter your first name
- [ ] Enter your last name
- [ ] Enter your email address
- [ ] Create a strong password (min 8 characters)
- [ ] Confirm password
- [ ] Enter phone number (required for cleaners)
- [ ] Agree to Terms of Service
- [ ] Agree to Cleaner Agreement
- [ ] Click "Create Account"

**Expected Result:**
- ✅ Account created successfully
- ✅ Automatically logged in
- ✅ Redirected to `/cleaner/onboarding` (first-time setup)

**Test Credentials (For this guide, create):**
- Email: `testcleaner@example.com`
- Password: `TestPass123!`

#### **1.2 Complete Onboarding** (First-Time Setup)

**Step 1: Personal Information**
- [ ] Upload profile photo (professional headshot)
- [ ] Enter business name (optional - if you have a company)
- [ ] Write your bio/introduction (150-500 characters)
- [ ] Select years of experience
- [ ] Add languages spoken
- [ ] Click "Next"

**Bio Tips:**
- Introduce yourself
- Mention experience
- Highlight specialties
- Be friendly and professional

Example: "Hi! I'm Sarah, a professional cleaner with 5+ years experience. I specialize in deep cleaning and eco-friendly products. Detail-oriented and reliable. Can't wait to help make your space sparkle!"

**Step 2: Services & Pricing**
- [ ] Select services you offer:
  - [ ] Standard Cleaning ($X/hour)
  - [ ] Deep Cleaning ($X/hour or flat)
  - [ ] Move In/Move Out Cleaning
  - [ ] Post-Construction Cleaning
  - [ ] Window Cleaning
  - [ ] Carpet Cleaning
  - [ ] Laundry Service
  - [ ] Organization Services
  - [ ] Other (specify)

- [ ] For each service, set your rate:
  - Hourly rate OR
  - Flat rate
  
- [ ] Set minimum booking:
  - [ ] Minimum hours (e.g., 2-hour minimum)
  - [ ] Or flat minimum fee

- [ ] Add any service extras:
  - [ ] Eco-friendly products (+$X)
  - [ ] Same-day service (+$X)
  - [ ] After-hours (+$X)
  - [ ] Pet-friendly
  - [ ] Child-friendly
  
- [ ] Click "Next"

**Step 3: Service Area**
- [ ] Enter your primary location (address or ZIP)
- [ ] Set service radius (miles):
  - [ ] 5 miles
  - [ ] 10 miles
  - [ ] 15 miles
  - [ ] 20 miles
  - [ ] 25+ miles
  - [ ] Custom

- [ ] (Optional) Select specific ZIP codes you serve
- [ ] (Optional) Add travel fee for distant jobs

- [ ] Click "Next"

**Step 4: Availability**
- [ ] Set your general availability by day:

**Example Schedule:**
- Monday: 9:00 AM - 5:00 PM
- Tuesday: 9:00 AM - 5:00 PM
- Wednesday: 9:00 AM - 5:00 PM
- Thursday: 9:00 AM - 5:00 PM
- Friday: 9:00 AM - 3:00 PM
- Saturday: 10:00 AM - 2:00 PM
- Sunday: Not available

- [ ] Set buffer time between jobs (30 min - 2 hours)
- [ ] Set maximum bookings per day
- [ ] Click "Next"

**Step 5: Verification Documents**
- [ ] Upload government-issued ID (Driver's License, Passport)
  - Photo should be clear and readable
  - All corners visible
  - Not expired

- [ ] Upload proof of address (Utility bill, Bank statement)
  - Within last 3 months
  - Shows your name and address

- [ ] (Optional) Upload certifications:
  - Cleaning certifications
  - Business license
  - Insurance certificate
  - Background check

- [ ] Agree to background check (if required)
- [ ] Click "Next"

**Step 6: Payment Information**
- [ ] Enter bank account for payouts:
  - [ ] Bank name
  - [ ] Account holder name
  - [ ] Routing number (9 digits)
  - [ ] Account number
  - [ ] Account type (Checking/Savings)

- [ ] Or set up alternative payout:
  - [ ] PayPal email
  - [ ] Venmo
  - [ ] Other payment platform

- [ ] Set payout frequency:
  - [ ] Weekly (every Monday)
  - [ ] Bi-weekly
  - [ ] Monthly
  - [ ] After each job (instant)

- [ ] Click "Next"

**Step 7: Review & Submit**
- [ ] Review all information
- [ ] Check profile preview (how clients see you)
- [ ] Make any edits needed
- [ ] Read and agree to Cleaner Terms
- [ ] Click "Submit Profile"

**Expected Result:**
- ✅ Profile submitted for review
- ✅ "Pending Approval" status
- ✅ Email confirmation sent
- ✅ Estimated approval time: 24-48 hours
- ✅ Can access dashboard but profile not yet visible to clients

#### **1.3 Profile Approval Process**
- [ ] Wait for admin review (typically 24-48 hours)
- [ ] Check email for:
  - Approval notification, OR
  - Request for additional information

**Once Approved:**
- ✅ Profile goes live
- ✅ Visible to clients
- ✅ Can receive booking requests
- ✅ "Active" badge on profile

**If Changes Requested:**
- [ ] Review admin feedback
- [ ] Make required updates
- [ ] Resubmit for approval

---

### **SECTION 2: CLEANER DASHBOARD OVERVIEW**

#### **2.1 Access Your Dashboard**
- [ ] Navigate to: http://localhost:3001/cleaner/dashboard
- [ ] Or click "My Dashboard" in navigation

**Dashboard Sections:**
- [ ] Today's Schedule (at-a-glance)
- [ ] Pending Booking Requests (action required)
- [ ] Quick Stats (earnings, jobs, rating)
- [ ] Upcoming Jobs (next 7 days)
- [ ] Recent Activity
- [ ] Quick Actions
- [ ] Earnings This Week/Month
- [ ] New Messages

#### **2.2 Dashboard Quick Stats**
Review your performance metrics:
- [ ] **Jobs This Month:** Count of completed jobs
- [ ] **Earnings This Month:** Total income (before fees)
- [ ] **Your Rating:** ⭐ X.X/5.0 (average)
- [ ] **Response Rate:** X% (how fast you reply)
- [ ] **Acceptance Rate:** X% (requests you accept)
- [ ] **Completion Rate:** X% (jobs you finish)
- [ ] **Repeat Clients:** Number of recurring customers

#### **2.3 Today's Schedule**
- [ ] View today's bookings in timeline view
- [ ] See upcoming job (if any)
- [ ] Check job details (time, location, client)
- [ ] Navigate to job location (GPS/Maps)
- [ ] Update job status

---

### **SECTION 3: MANAGING BOOKING REQUESTS**

#### **3.1 Receive Booking Request**
When a client requests your services:
- [ ] Notification appears (bell icon with badge)
- [ ] Email notification sent
- [ ] SMS notification (if enabled)
- [ ] Request appears in "Pending Requests" section

#### **3.2 Review Booking Request**
- [ ] Click on booking request
- [ ] Request details modal/page opens

**Request Should Show:**
- [ ] Client name and photo
- [ ] Client rating (as a client)
- [ ] Number of previous bookings (new client or repeat)
- [ ] Service requested
- [ ] Date and time
- [ ] Duration
- [ ] Location (address)
- [ ] Distance from you
- [ ] Special instructions from client
- [ ] Price breakdown (your earnings)
- [ ] Auto-acceptance deadline (e.g., "Respond within 24 hours")

#### **3.3 Check Your Availability**
- [ ] Verify date/time doesn't conflict with existing bookings
- [ ] Check if location is within your service area
- [ ] Confirm you can provide the requested service
- [ ] Review travel time from previous/next jobs

#### **3.4 Accept Booking**
- [ ] Click "Accept Booking" button
- [ ] Confirmation modal may appear
- [ ] Booking is added to your schedule
- [ ] Client is notified immediately
- [ ] You receive booking confirmation email

**Expected Result:**
- ✅ Booking status: "Confirmed"
- ✅ Appears in "Upcoming Jobs"
- ✅ Added to your calendar
- ✅ Client can now message you

#### **3.5 Decline Booking**
If you can't accept:
- [ ] Click "Decline Booking"
- [ ] Select reason (optional but recommended):
  - [ ] Schedule conflict
  - [ ] Outside service area
  - [ ] Don't offer this service
  - [ ] Price not acceptable
  - [ ] Other

- [ ] (Optional) Add personal message to client
- [ ] Confirm decline

**Expected Result:**
- ✅ Request removed from your queue
- ✅ Client is notified
- ✅ Client can book with another cleaner
- ✅ Does not negatively impact acceptance rate (if valid reason)

**Note:** Declining too many requests may affect your visibility in search results.

#### **3.6 Counter-Offer** (If Available)
If request needs modification:
- [ ] Click "Send Counter-Offer"
- [ ] Modify:
  - [ ] Different time/date
  - [ ] Different service type
  - [ ] Different price
  - [ ] Different duration

- [ ] Add explanation message
- [ ] Send counter-offer
- [ ] Wait for client response

---

### **SECTION 4: MANAGING YOUR SCHEDULE**

#### **4.1 Access Schedule/Calendar**
- [ ] Navigate to `/cleaner/schedule` or `/cleaner/calendar`
- [ ] Or click "My Schedule" from dashboard

**Calendar Views:**
- [ ] Day view (hourly breakdown)
- [ ] Week view (7 days at a glance)
- [ ] Month view (full month)
- [ ] List view (chronological list)

#### **4.2 View Upcoming Jobs**
- [ ] See all confirmed bookings
- [ ] Color-coded by status:
  - Blue: Confirmed
  - Green: In Progress
  - Gray: Completed
  - Red: Cancelled
  - Yellow: Pending

- [ ] Each booking shows:
  - Time
  - Duration
  - Client name
  - Service type
  - Location (shortened)
  - Earnings

#### **4.3 Block Out Time** (Unavailable)
To mark time as unavailable:
- [ ] Click on calendar time slot
- [ ] Select "Block Time" or "Mark Unavailable"
- [ ] Choose:
  - Specific date/time
  - All day
  - Recurring block

- [ ] Add reason (optional, for your records):
  - Personal appointment
  - Vacation
  - Training
  - Other commitment

- [ ] Save block

**Result:** That time won't be available for client bookings.

#### **4.4 Set Vacation/Time Off**
For extended time off:
- [ ] Click "Time Off" or "Vacation Mode"
- [ ] Select start date
- [ ] Select end date
- [ ] All time during period becomes unavailable
- [ ] (Optional) Add auto-reply message for clients
- [ ] Confirm vacation

**Note:** Inform existing clients of upcoming time off in advance.

#### **4.5 Update Recurring Availability**
To change your regular hours:
- [ ] Go to Settings → Availability
- [ ] Modify hours for specific days
- [ ] Example: Close earlier on Fridays
- [ ] Save changes
- [ ] Future bookings adjust automatically

---

### **SECTION 5: COMPLETING JOBS**

#### **5.1 Pre-Job Checklist**
Before heading to job:
- [ ] Review job details one more time
- [ ] Check special instructions
- [ ] Verify you have all supplies needed
- [ ] Check route/travel time (GPS)
- [ ] Ensure phone is charged (for communication)
- [ ] Update status to "En Route" when leaving

#### **5.2 Update Job Status: "En Route"**
- [ ] Open booking from dashboard
- [ ] Click "Start Travel" or "En Route"
- [ ] Client receives notification with ETA
- [ ] (Optional) Share live location with client

#### **5.3 Arriving at Location**
- [ ] Update status to "Arrived"
- [ ] Client is notified
- [ ] Start timer (if using in-app timer)
- [ ] Introduce yourself to client
- [ ] Confirm service details

#### **5.4 During Service**
- [ ] Update status to "In Progress"
- [ ] Follow client's special instructions
- [ ] Focus on quality work
- [ ] Take before/after photos (with permission)
- [ ] Communicate if you find additional issues
- [ ] Stay professional

#### **5.5 Additional Services/Upsells**
If you notice additional work needed:
- [ ] Take photo of area/issue
- [ ] Send message to client via app
- [ ] Example: "I noticed the oven needs deep cleaning. I can do it for an additional $X if you'd like?"
- [ ] Wait for client approval
- [ ] Document approval in chat
- [ ] Add extra service to booking

#### **5.6 Complete Job**
When finished:
- [ ] Do final walkthrough
- [ ] Take "after" photos (for your records and client)
- [ ] Update status to "Completed"
- [ ] Stop timer
- [ ] Client is notified to review service

#### **5.7 Request Client Approval**
- [ ] In app, click "Request Completion Approval"
- [ ] Client receives notification to inspect
- [ ] Client confirms completion
- [ ] Payment is processed automatically
- [ ] Job moves to "Completed" status

**If Client Raises Issues:**
- [ ] Review concerns
- [ ] Offer to address any problems
- [ ] Resolve before leaving (if possible)
- [ ] Document resolution in notes

---

### **SECTION 6: COMMUNICATION WITH CLIENTS**

#### **6.1 Access Messages**
- [ ] From dashboard, click "Messages"
- [ ] Or from specific booking, click "Message Client"
- [ ] Chat interface opens

**Messaging Best Practices:**
- ✅ Respond within 1-2 hours during business hours
- ✅ Be professional and friendly
- ✅ Confirm understanding of requests
- ✅ Provide updates proactively
- ✅ Use proper grammar and spelling

#### **6.2 Pre-Service Communication**
Before the job:
- [ ] Confirm appointment 24 hours ahead
- [ ] Ask about parking/access
- [ ] Confirm client will be home (or key access)
- [ ] Ask about pets/children
- [ ] Clarify any special instructions

**Example Messages:**
- "Hi [Client Name]! Confirming our appointment tomorrow at 10 AM for a deep clean. Will you be home, or should I pick up a key somewhere?"
- "Just checking - do you have any pets I should know about? I'm pet-friendly!"
- "I'll bring all my supplies. Do you prefer eco-friendly products, or is standard fine?"

#### **6.3 Day-of Communication**
On the job day:
- [ ] Send "On my way!" message when leaving
- [ ] Provide updated ETA if delayed
- [ ] Send "I've arrived" message
- [ ] Ask any last-minute questions

#### **6.4 During Service Communication**
- [ ] Send progress updates for longer jobs
- [ ] Share photos of areas you've completed
- [ ] Alert client if you need anything
- [ ] Ask about additional services

**Example:**
- "Kitchen and living room are done! Moving to bedrooms now. ✨"
- "Quick question - would you like me to clean inside the refrigerator? I can do it for no extra charge since we're ahead of schedule!"

#### **6.5 Post-Service Communication**
After job:
- [ ] Thank client for their business
- [ ] Ask if they're satisfied
- [ ] Mention you'd love to work with them again
- [ ] Provide any care instructions

**Example:**
- "All done! Hope you love how everything looks. Let me know if you need anything else. Would be happy to set up a recurring schedule! 😊"

#### **6.6 Handle Difficult Conversations**
If issues arise:
- [ ] Stay calm and professional
- [ ] Listen to client's concerns
- [ ] Acknowledge their feelings
- [ ] Offer solutions
- [ ] Document everything in chat
- [ ] Escalate to support if needed

---

### **SECTION 7: EARNINGS & PAYOUTS**

#### **7.1 View Earnings Dashboard**
- [ ] Navigate to `/cleaner/earnings` or "Earnings"
- [ ] Or click "Earnings" from dashboard

**Earnings Overview Shows:**
- [ ] Today's earnings
- [ ] This week's earnings
- [ ] This month's earnings
- [ ] Last month (for comparison)
- [ ] Year-to-date total
- [ ] Pending earnings (not yet paid out)
- [ ] Available for payout
- [ ] Next payout date

#### **7.2 Earnings Breakdown**
- [ ] View earnings by:
  - Time period (daily, weekly, monthly)
  - Service type (which services earn most)
  - Client type (new vs repeat)
  
**Charts Should Show:**
- [ ] Earnings trend over time (line chart)
- [ ] Earnings by service type (pie chart)
- [ ] Busiest days/times (bar chart)

#### **7.3 Transaction History**
- [ ] See all completed jobs with payments
- [ ] Each transaction shows:
  - Date of service
  - Client name
  - Service type
  - Service fee (what client paid)
  - Platform fee (PureTask commission %)
  - Your net earnings
  - Payout status

**Typical Transaction:**
- Service Fee: $120.00
- Platform Fee (15%): -$18.00
- **Your Earnings: $102.00**
- Status: Paid Out / Pending

#### **7.4 Understand Fees**
Platform takes a commission on each booking:
- [ ] Review commission rate (typically 10-20%)
- [ ] Fee is deducted automatically
- [ ] What you see in "Net Earnings" is what you receive

**What's Included in Platform Fee:**
- ✅ Payment processing
- ✅ Customer support
- ✅ Marketing/client acquisition
- ✅ Insurance coverage
- ✅ Dispute resolution
- ✅ Platform maintenance

#### **7.5 Request Payout**
When you have earnings available:
- [ ] Go to Earnings → "Request Payout"
- [ ] See available balance
- [ ] Minimum payout amount (e.g., $50)
- [ ] Click "Request Payout"
- [ ] Select bank account (if multiple)
- [ ] Confirm request

**Payout Timeline:**
- Requested: Immediately
- Processing: 1-2 business days
- Received: 3-5 business days (depending on bank)

**Or Automated Payouts:**
- [ ] Set up automatic payouts
- [ ] Choose frequency (weekly, bi-weekly, monthly)
- [ ] Minimum threshold (e.g., auto-payout when balance reaches $100)

#### **7.6 Tax Information**
- [ ] Download earnings statements for taxes
- [ ] Export year-end summary (Form 1099-NEC in US)
- [ ] Track expenses for deductions:
  - Supplies
  - Mileage
  - Equipment
  - Insurance
  - Training

**Tip:** Consult a tax professional. As an independent contractor, you're responsible for your own taxes.

---

### **SECTION 8: REVIEWS & RATINGS**

#### **8.1 View Your Reviews**
- [ ] Navigate to "Reviews" or "Ratings"
- [ ] Or access from your profile

**Review Dashboard Shows:**
- [ ] Overall average rating (⭐ X.X / 5.0)
- [ ] Total number of reviews
- [ ] Rating breakdown:
  - 5 stars: X reviews
  - 4 stars: X reviews
  - 3 stars: X reviews
  - 2 stars: X reviews
  - 1 star: X reviews

- [ ] Recent reviews (newest first)
- [ ] Category ratings:
  - Quality of Work
  - Punctuality
  - Professionalism
  - Value for Money
  - Communication

#### **8.2 Read Client Reviews**
- [ ] Read all reviews (good and constructive)
- [ ] Look for patterns in feedback
- [ ] Celebrate positive reviews
- [ ] Learn from constructive criticism

**Reviews Include:**
- Star rating
- Written review
- Service type reviewed
- Date of service
- Client name (or anonymous)
- Your response (if you replied)

#### **8.3 Respond to Reviews**
Best practice: Respond to all reviews, especially constructive ones

**For Positive Reviews:**
- [ ] Thank the client
- [ ] Mention something specific
- [ ] Invite them to book again

**Example:**
"Thank you so much, Jennifer! I'm thrilled you're happy with the deep clean. It was a pleasure working with you, and I'd love to help you again anytime. 😊"

**For Critical Reviews:**
- [ ] Stay professional (don't get defensive)
- [ ] Acknowledge their concerns
- [ ] Apologize if appropriate
- [ ] Explain what happened (briefly)
- [ ] Mention how you've improved
- [ ] Offer to make it right

**Example:**
"I'm sorry your experience wasn't perfect. I appreciate your feedback about the bathroom - you're right that I should have double-checked. I've since improved my checklist process. I'd love the opportunity to make it right. Please reach out if I can help."

#### **8.4 Dispute Unfair Reviews** (If Needed)
If a review is:
- False or misleading
- Abusive or inappropriate
- Violates review policy

- [ ] Click "Report Review"
- [ ] Select reason
- [ ] Provide explanation and evidence
- [ ] Submit report to admin
- [ ] Admin will review within 48 hours

**Note:** Admins don't remove negative reviews just because they're negative. Only if they violate policy.

#### **8.5 Request Reviews**
To build your reputation:
- [ ] After completing job, gently remind client
- [ ] "I'd really appreciate a review if you have a moment!"
- [ ] Don't pressure or incentivize (against policy)
- [ ] Focus on great service (reviews will follow)

---

### **SECTION 9: PROFILE MANAGEMENT**

#### **9.1 View Your Public Profile**
- [ ] Click "View My Profile" or "Preview Profile"
- [ ] See your profile as clients see it

**Profile Should Display:**
- [ ] Professional photo
- [ ] Name / Business name
- [ ] Average rating with stars
- [ ] Number of reviews
- [ ] Years of experience
- [ ] Bio/About section
- [ ] Services offered with prices
- [ ] Service area
- [ ] Availability indicator
- [ ] Reviews section
- [ ] Photo gallery (if uploaded)
- [ ] Certifications/badges
- [ ] "Book Now" button

#### **9.2 Edit Profile Information**
- [ ] Go to Settings → Profile
- [ ] Update any information:
  - [ ] Profile photo
  - [ ] Bio/About me
  - [ ] Business name
  - [ ] Experience level
  - [ ] Languages

- [ ] Save changes
- [ ] Changes appear immediately on public profile

#### **9.3 Update Services & Pricing**
- [ ] Go to Settings → Services
- [ ] Add new services
- [ ] Remove services you no longer offer
- [ ] Update pricing (be strategic - check competitors)
- [ ] Modify service descriptions
- [ ] Save changes

**Pricing Tips:**
- Research competitor rates in your area
- Don't undervalue your work
- Consider offering package deals
- Adjust for demand (busy seasons)

#### **9.4 Upload Work Photos**
Build trust with a portfolio:
- [ ] Go to Profile → Gallery or "My Work"
- [ ] Upload before/after photos
- [ ] Add captions
- [ ] Organize by service type
- [ ] Delete old/poor-quality photos

**Photo Tips:**
- ✅ High-quality, well-lit photos
- ✅ Show transformation (before & after)
- ✅ Clean, professional presentation
- ✅ Get client permission before posting
- ❌ Don't include identifiable personal items
- ❌ No messy or unflattering shots

#### **9.5 Update Service Area**
- [ ] Go to Settings → Service Area
- [ ] Adjust radius (expand or reduce)
- [ ] Add/remove specific ZIP codes
- [ ] Update travel fees
- [ ] Save changes

#### **9.6 Manage Availability Settings**
- [ ] Go to Settings → Availability
- [ ] Update regular hours by day
- [ ] Set buffer time between jobs
- [ ] Set max bookings per day
- [ ] Enable/disable instant booking
- [ ] Save changes

---

### **SECTION 10: CLEANER RESOURCES & SUPPORT**

#### **10.1 Access Cleaner Resources**
- [ ] Navigate to "Resources" or "Cleaner Hub"

**Resources May Include:**
- [ ] Cleaning guides and best practices
- [ ] Safety tips and protocols
- [ ] Customer service training
- [ ] Business growth tips
- [ ] Marketing yourself
- [ ] Product recommendations
- [ ] Video tutorials
- [ ] Community forum
- [ ] FAQ / Knowledge base

#### **10.2 Contact Support**
If you need help:
- [ ] Click "Support" or "Help"
- [ ] Options:
  - [ ] Live chat (fastest for urgent issues)
  - [ ] Email support
  - [ ] Phone support (if available)
  - [ ] Submit ticket

**Common Support Topics:**
- Payment issues
- Difficult client situations
- Technical problems with app
- Account verification
- Policy questions
- Dispute resolution

#### **10.3 Report Client Issues**
If a client is:
- Inappropriate or abusive
- Requesting off-platform payment
- Making you uncomfortable
- Violating terms

- [ ] Click "Report Issue" from booking or chat
- [ ] Select issue type
- [ ] Provide details
- [ ] Submit report
- [ ] Support will investigate

**Your Safety Is Priority:** Don't hesitate to leave a situation that feels unsafe and report it.

#### **10.4 Join Cleaner Community** (If Available)
- [ ] Access cleaner forum or community
- [ ] Connect with other cleaners
- [ ] Share tips and experiences
- [ ] Ask questions
- [ ] Learn from seasoned pros

---

## 🔍 **COMPLETE TESTING CHECKLIST**

### **✅ Registration & Onboarding**
- [ ] Can create cleaner account
- [ ] Onboarding wizard works
- [ ] Can upload profile photo
- [ ] Services selection works
- [ ] Pricing setup works
- [ ] Service area configuration works
- [ ] Availability calendar setup works
- [ ] Document upload works
- [ ] Bank account info saves
- [ ] Profile submits successfully
- [ ] Approval status updates

### **✅ Dashboard**
- [ ] Dashboard loads correctly
- [ ] Quick stats display accurately
- [ ] Today's schedule shows
- [ ] Pending requests visible
- [ ] Can access all sections
- [ ] Cleaner badge displays

### **✅ Booking Management**
- [ ] Receives booking notifications
- [ ] Can view request details
- [ ] Can accept bookings
- [ ] Can decline bookings
- [ ] Counter-offers work (if available)
- [ ] Bookings appear in schedule
- [ ] Can update job status
- [ ] Completion workflow works

### **✅ Schedule/Calendar**
- [ ] Calendar displays correctly
- [ ] All views work (day/week/month)
- [ ] Can view upcoming jobs
- [ ] Can block time off
- [ ] Vacation mode works
- [ ] Can update recurring availability

### **✅ Job Workflow**
- [ ] Can start travel/update en route
- [ ] Can mark arrived
- [ ] Can mark in progress
- [ ] Can complete job
- [ ] Can request client approval
- [ ] Photos can be uploaded
- [ ] Additional services can be added

### **✅ Messaging**
- [ ] Can send messages to clients
- [ ] Can receive messages
- [ ] Notifications work
- [ ] Read receipts work
- [ ] Can send photos

### **✅ Earnings**
- [ ] Earnings dashboard displays
- [ ] Transaction history accurate
- [ ] Charts render correctly
- [ ] Can request payout
- [ ] Payout status tracked
- [ ] Tax docs downloadable

### **✅ Reviews**
- [ ] Can view all reviews
- [ ] Average rating calculates correctly
- [ ] Can respond to reviews
- [ ] Can report inappropriate reviews

### **✅ Profile Management**
- [ ] Can view public profile
- [ ] Can edit profile info
- [ ] Can update services/pricing
- [ ] Can upload work photos
- [ ] Can update service area
- [ ] Changes save and display

### **✅ Support & Resources**
- [ ] Can access resources
- [ ] Can contact support
- [ ] Can report issues
- [ ] Knowledge base accessible

---

## 🐛 **ISSUES TO DOCUMENT**

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

## 💡 **CLEANER BEST PRACTICES**

### **Building Your Reputation**
- ✅ Accept jobs promptly (high acceptance rate boosts visibility)
- ✅ Respond to messages within 1-2 hours
- ✅ Be punctual - arrive on time, every time
- ✅ Do excellent work - quality over speed
- ✅ Communicate proactively
- ✅ Follow client instructions carefully
- ✅ Ask for reviews from satisfied clients
- ✅ Maintain professional appearance and demeanor

### **Growing Your Business**
- ✅ Offer competitive but fair pricing
- ✅ Expand service offerings as you gain experience
- ✅ Provide exceptional customer service
- ✅ Build repeat client relationships
- ✅ Maintain 4.5+ star average
- ✅ Keep high completion rate (95%+)
- ✅ Update availability regularly
- ✅ Upload quality work photos

### **Professional Standards**
- ✅ Bring all necessary supplies and equipment
- ✅ Dress professionally and neatly
- ✅ Be respectful of client's property
- ✅ Maintain confidentiality and privacy
- ✅ Follow safety protocols
- ✅ Use appropriate products for each surface
- ✅ Leave space cleaner than you found it
- ✅ Do final walkthrough before marking complete

### **Financial Management**
- ✅ Track all income for taxes
- ✅ Keep receipts for business expenses
- ✅ Set aside money for taxes (20-30% typically)
- ✅ Request payouts regularly
- ✅ Review earnings reports monthly
- ✅ Consider business insurance
- ✅ Set financial goals

### **Safety & Security**
- ✅ Trust your instincts - decline unsafe situations
- ✅ Share your schedule with someone you trust
- ✅ Keep phone charged and accessible
- ✅ Follow COVID-19 or health protocols
- ✅ Use proper cleaning product safety measures
- ✅ Report any safety concerns immediately
- ✅ Never accept off-platform payments (against policy)

---

## 🆘 **TROUBLESHOOTING**

### **Not Receiving Booking Requests**
- Ensure profile is approved and active
- Check service area and availability settings
- Update profile with better photos and description
- Lower prices temporarily to build initial reviews
- Verify you're offering services clients are searching for

### **Client Cancelled Booking**
- Review cancellation policy (did they cancel in time?)
- You may receive cancellation fee if last-minute
- Don't take it personally - life happens
- Keep calendar open for new bookings

### **Dispute Over Service Quality**
- Stay calm and professional
- Review what was agreed upon in booking
- Offer to return and address issues
- Provide photos/evidence of work done
- Contact support for mediation if needed
- Document everything

### **Payment Delayed**
- Check payout status in earnings dashboard
- Verify bank account info is correct
- Allow 3-5 business days for transfer
- Contact support if still not received after 7 days

### **Low Rating Received**
- Read review carefully and objectively
- Identify what went wrong
- Respond professionally
- Implement changes to prevent future issues
- Focus on getting more positive reviews to balance it
- One bad review among many good ones won't hurt much

---

## 🎉 **CLEANER GUIDE COMPLETE!**

You now know everything about:
- ✅ Becoming a PureTask cleaner
- ✅ Setting up your professional profile
- ✅ Managing bookings and your schedule
- ✅ Completing jobs successfully
- ✅ Communicating with clients
- ✅ Earning and managing income
- ✅ Building your reputation
- ✅ Growing your cleaning business

**Next Steps:**
1. Complete this testing checklist
2. Test the full cleaner experience
3. Document all issues found
4. Compare with admin and client guides
5. Compile comprehensive feedback

---

**Happy Cleaning! 🧹✨💼**

