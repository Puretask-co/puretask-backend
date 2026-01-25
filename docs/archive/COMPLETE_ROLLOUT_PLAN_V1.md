# 🚀 **PURETASK - COMPLETE ROLLOUT PLAN**

**Strategy:** Phased versioning with incremental releases  
**Timeline:** 16 weeks from start to full platform  
**Approach:** Ship → Learn → Iterate → Scale

---

## 📋 **TABLE OF CONTENTS**

1. Versioning Strategy
2. Version 1.0 - MVP (Weeks 1-6)
3. Version 2.0 - Enhanced (Weeks 7-10)
4. Version 3.0 - Premium (Weeks 11-13)
5. Version 4.0 - Enterprise (Weeks 14-16)
6. UI/UX Specifications for Every Page
7. Component Library
8. Development Timeline
9. Launch Checklist

---

## 🎯 **VERSIONING STRATEGY**

### **Why Phased Releases?**

✅ **Benefits:**
- Ship working product in 6 weeks (not 16)
- Learn from real users at each phase
- Generate revenue while building
- Reduce risk (validate before building more)
- Easier QA and bug fixing
- Build features users actually want

❌ **Avoid:**
- Building everything then launching (4 months with no feedback)
- Feature bloat (70% unused features)
- Wasted development time
- High risk (what if users don't want it?)

---

## 🎯 **THE RELEASE PLAN**

```
┌─────────────────────────────────────────────────────┐
│  WEEK 1-6: Version 1.0 (MVP)                       │
│  → Core booking marketplace                         │
│  → 25 pages                                         │
│  → LAUNCH & GET USERS                              │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  WEEK 7-10: Version 2.0 (Enhanced)                 │
│  → Add AI Assistant                                 │
│  → Integrate your pre-built components             │
│  → +10 pages (35 total)                            │
│  → COMPETITIVE ADVANTAGE                            │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  WEEK 11-13: Version 3.0 (Premium)                 │
│  → Add Gamification                                 │
│  → Add Admin Dashboard                              │
│  → +10 pages (45 total)                            │
│  → SCALE & ENGAGE                                   │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  WEEK 14-16: Version 4.0 (Enterprise)              │
│  → Advanced features based on feedback              │
│  → Polish & optimization                            │
│  → +5-10 pages (50-55 total)                       │
│  → MATURE PLATFORM                                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 **VERSION 1.0 - MVP (Weeks 1-6)**

### **Goal:** Working marketplace where clients can book cleaners

### **Features:**
- ✅ User registration (client & cleaner)
- ✅ Search & browse cleaners
- ✅ Book & pay
- ✅ Manage bookings
- ✅ Basic messaging
- ✅ Reviews

### **Pages: 25 total**

---

## 📱 **V1.0 - DETAILED PAGE SPECIFICATIONS**

Let me give you EXACT UI/UX specs for every page:

---

### **PAGE 1: LANDING PAGE**

**Route:** `/`

**Purpose:** First impression, search entry point

**Layout:**
```
┌─────────────────────────────────────────────┐
│ HEADER                                      │
│ [Logo] [How It Works] [Sign Up] [Login]   │
├─────────────────────────────────────────────┤
│                                             │
│        HERO SECTION (Full Screen)          │
│   ╔═══════════════════════════════════╗    │
│   ║  "Book a Professional Cleaner     ║    │
│   ║   In Minutes"                     ║    │
│   ║                                   ║    │
│   ║  [Enter ZIP Code]  [Find Cleaners]║    │
│   ║                                   ║    │
│   ║  ⭐⭐⭐⭐⭐ Rated 4.9/5           ║    │
│   ║  1,000+ bookings completed        ║    │
│   ╚═══════════════════════════════════╝    │
│                                             │
├─────────────────────────────────────────────┤
│   HOW IT WORKS (3 Cards)                   │
│  ┌───────┐ ┌───────┐ ┌───────┐           │
│  │ 1.    │ │ 2.    │ │ 3.    │           │
│  │Search │ │ Book  │ │ Relax │           │
│  │       │ │       │ │       │           │
│  └───────┘ └───────┘ └───────┘           │
├─────────────────────────────────────────────┤
│   FEATURED CLEANERS (Carousel)             │
│  [Photo] [Rating] [Price] [Book Now]      │
├─────────────────────────────────────────────┤
│   PRICING CALCULATOR                        │
│  Service Type: [Dropdown]                  │
│  Hours: [Slider]                           │
│  → Estimated Cost: $XXX                    │
├─────────────────────────────────────────────┤
│   TRUST BADGES                              │
│  [Insured] [Background Checked] [Verified] │
├─────────────────────────────────────────────┤
│   TESTIMONIALS (3 Reviews)                 │
│  ⭐⭐⭐⭐⭐ "Amazing service!"            │
├─────────────────────────────────────────────┤
│   FAQs (Accordion)                         │
│  ▸ How does booking work?                  │
│  ▸ What if I need to cancel?               │
│  ▸ Are cleaners insured?                   │
├─────────────────────────────────────────────┤
│   FOOTER                                    │
│  About | Contact | Terms | Privacy         │
│  © 2026 PureTask                           │
└─────────────────────────────────────────────┘
```

**Components:**
- Hero banner with search
- Feature cards (3 steps)
- Cleaner carousel
- Pricing calculator
- Trust badges
- Testimonials
- FAQ accordion
- Footer

**Colors:**
- Primary: Blue (#3B82F6)
- Secondary: Green (#10B981)
- Background: Light gray (#F9FAFB)
- Text: Dark gray (#111827)

**Key Actions:**
- Search by zip code → Goes to search results
- Sign up / Login buttons
- Book Now on featured cleaners

---

### **PAGE 2: SIGN UP / LOGIN**

**Route:** `/auth`

**Purpose:** User authentication

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Logo]                                 │
├─────────────────────────────────────────┤
│                                         │
│     ┌─ TABS ─────────────────┐        │
│     │ [Login] │ [Sign Up]    │        │
│     └──────────────────────────┘        │
│                                         │
│  IF LOGIN TAB:                         │
│  ┌─────────────────────────┐          │
│  │ Email: [______________] │          │
│  │ Password: [__________] │          │
│  │                         │          │
│  │ [Forgot Password?]      │          │
│  │                         │          │
│  │    [Login Button]       │          │
│  │                         │          │
│  │    ─── OR ───          │          │
│  │                         │          │
│  │  [G] Continue with      │          │
│  │      Google            │          │
│  └─────────────────────────┘          │
│                                         │
│  IF SIGN UP TAB:                       │
│  ┌─────────────────────────┐          │
│  │ I am a:                 │          │
│  │ ○ Client (Book cleaning)│          │
│  │ ○ Cleaner (Offer services)│        │
│  │                         │          │
│  │ Name: [______________]  │          │
│  │ Email: [_____________]  │          │
│  │ Phone: [_____________]  │          │
│  │ Password: [__________]  │          │
│  │                         │          │
│  │ ☐ I agree to Terms     │          │
│  │                         │          │
│  │   [Sign Up Button]      │          │
│  │                         │          │
│  │    ─── OR ───          │          │
│  │                         │          │
│  │  [G] Sign up with       │          │
│  │      Google            │          │
│  └─────────────────────────┘          │
└─────────────────────────────────────────┘
```

**Validation:**
- Email format check
- Password minimum 8 characters
- Phone number format
- Terms must be checked

**Flow:**
1. User selects client or cleaner
2. Fills form
3. Submits
4. Email verification sent
5. Redirects to:
   - Client → Profile setup
   - Cleaner → Onboarding form

---

### **PAGE 3: EMAIL VERIFICATION**

**Route:** `/verify-email`

**Layout:**
```
┌─────────────────────────────────────────┐
│         [Logo]                          │
├─────────────────────────────────────────┤
│                                         │
│     📧                                  │
│                                         │
│   Verify Your Email                    │
│                                         │
│   We sent a verification code to:      │
│   user@email.com                       │
│                                         │
│   Enter Code:                          │
│   [_] [_] [_] [_] [_] [_]            │
│                                         │
│   [Verify Button]                      │
│                                         │
│   Didn't receive code?                 │
│   [Resend Code]                        │
│                                         │
└─────────────────────────────────────────┘
```

**After verification:**
- Client → Profile setup
- Cleaner → Onboarding

---

### **PAGE 4: CLIENT PROFILE SETUP**

**Route:** `/client/setup`

**Purpose:** Quick profile completion

**Layout:**
```
┌─────────────────────────────────────────┐
│  Complete Your Profile (2 min)         │
│  Progress: ████░░░░ 40%                │
├─────────────────────────────────────────┤
│                                         │
│  PERSONAL INFO                         │
│  ┌─────────────────────────┐          │
│  │ Full Name: [__________] │          │
│  │ Phone: [______________] │          │
│  │ [Upload Photo]          │          │
│  │   (Optional)            │          │
│  └─────────────────────────┘          │
│                                         │
│  DEFAULT ADDRESS                       │
│  ┌─────────────────────────┐          │
│  │ Street: [_____________] │          │
│  │ City: [_______________] │          │
│  │ State: [__] ZIP: [____]│          │
│  │ Apt/Unit: [___________] │          │
│  │                         │          │
│  │ Special Instructions:   │          │
│  │ [____________________] │          │
│  │ (Gate code, parking)   │          │
│  └─────────────────────────┘          │
│                                         │
│  PAYMENT METHOD                        │
│  ┌─────────────────────────┐          │
│  │ 💳 Card Number          │          │
│  │ [__________________]    │          │
│  │ Exp: [MM/YY] CVV: [___]│          │
│  │                         │          │
│  │ Billing ZIP: [_______] │          │
│  │                         │          │
│  │ ☐ Save for future       │          │
│  └─────────────────────────┘          │
│                                         │
│     [Skip for Now] [Complete Setup]    │
│                                         │
└─────────────────────────────────────────┘
```

**After completion:**
- Redirect to dashboard or search page

---

### **PAGE 5: CLEANER ONBOARDING**

**Route:** `/cleaner/onboarding`

**Purpose:** Collect all cleaner info at once

**Layout:**
```
┌─────────────────────────────────────────┐
│  Become a Cleaner                      │
│  Progress: ██░░░░░░░░ 20%             │
├─────────────────────────────────────────┤
│                                         │
│  📋 BASIC INFORMATION                  │
│  ┌─────────────────────────┐          │
│  │ Full Name: [__________] │          │
│  │ Phone: [______________] │          │
│  │ Address: [____________] │          │
│  │ [Upload Profile Photo]  │          │
│  └─────────────────────────┘          │
│                                         │
│  🏢 BUSINESS INFORMATION               │
│  ┌─────────────────────────┐          │
│  │ Business Type:          │          │
│  │ ○ Individual            │          │
│  │ ○ Small Business        │          │
│  │ ○ Agency               │          │
│  │                         │          │
│  │ Years Experience: [___] │          │
│  │                         │          │
│  │ ☐ I am insured          │          │
│  │   [Upload Certificate]  │          │
│  └─────────────────────────┘          │
│                                         │
│  🧹 SERVICES & PRICING                 │
│  ┌─────────────────────────┐          │
│  │ Services Offered:       │          │
│  │ ☑ Standard Cleaning     │          │
│  │ ☑ Deep Cleaning         │          │
│  │ ☐ Move-in/Move-out      │          │
│  │ ☐ Commercial            │          │
│  │                         │          │
│  │ Hourly Rate: $[___]/hr  │          │
│  │ Minimum Hours: [_]      │          │
│  │                         │          │
│  │ Service Areas (ZIP):    │          │
│  │ [Add ZIP codes]         │          │
│  │ Travel Radius: [__]mi   │          │
│  └─────────────────────────┘          │
│                                         │
│  📄 DOCUMENTS                          │
│  ┌─────────────────────────┐          │
│  │ [Upload ID]             │          │
│  │ [Upload Insurance]      │          │
│  │ [Before/After Photos]   │          │
│  │ (3-5 examples)          │          │
│  └─────────────────────────┘          │
│                                         │
│  💰 PAYOUT INFORMATION                 │
│  ┌─────────────────────────┐          │
│  │ Bank Name: [__________] │          │
│  │ Routing #: [__________] │          │
│  │ Account #: [__________] │          │
│  │ Account Type:           │          │
│  │ ○ Checking ○ Savings    │          │
│  └─────────────────────────┘          │
│                                         │
│  📅 INITIAL AVAILABILITY               │
│  ┌─────────────────────────┐          │
│  │ Monday:    9AM - 5PM    │          │
│  │ Tuesday:   9AM - 5PM    │          │
│  │ Wednesday: 9AM - 5PM    │          │
│  │ Thursday:  9AM - 5PM    │          │
│  │ Friday:    9AM - 5PM    │          │
│  │ Saturday:  ☐ Available  │          │
│  │ Sunday:    ☐ Available  │          │
│  └─────────────────────────┘          │
│                                         │
│  ☐ I agree to Terms & Background Check │
│                                         │
│    [Save Progress] [Submit Application]│
│                                         │
└─────────────────────────────────────────┘
```

**After submission:**
- "Application Submitted!" page
- Email notification
- Admin reviews
- Approval email sent
- Can then access cleaner dashboard

---

### **PAGE 6: SEARCH RESULTS**

**Route:** `/search?zip=12345&service=standard`

**Purpose:** Browse available cleaners

**Layout:**
```
┌─────────────────────────────────────────────┐
│  HEADER (Logged in)                        │
│  [Logo] [Messages] [Bookings] [Profile ▾] │
├───────────┬─────────────────────────────────┤
│ FILTERS   │  RESULTS                        │
│ SIDEBAR   │                                 │
│           │  Showing 12 cleaners in 10001   │
│ Location  │  Sort by: [Best Match ▾]        │
│ [10001]   │                                 │
│           │  ┌─────────────────────────┐   │
│ Service   │  │ [Photo] Jane Doe        │   │
│ ☑ Standard│  │ ⭐⭐⭐⭐⭐ 4.9 (47)     │   │
│ ☐ Deep    │  │ $45/hr • 5 years exp    │   │
│ ☐ Move    │  │ "Professional, reliable" │   │
│           │  │ Available: Today 2PM+   │   │
│ Rating    │  │ [View Profile] [Book Now]│   │
│ ⭐⭐⭐⭐+ │  └─────────────────────────┘   │
│           │                                 │
│ Price     │  ┌─────────────────────────┐   │
│ $30-$60   │  │ [Photo] John Smith      │   │
│ [slider]  │  │ ⭐⭐⭐⭐⭐ 4.8 (93)     │   │
│           │  │ $50/hr • 8 years exp    │   │
│ Avail.    │  │ "Detail-oriented, fast" │   │
│ ☑ Today   │  │ Available: Tomorrow 9AM │   │
│ ☐ This Wk │  │ [View Profile] [Book Now]│   │
│           │  └─────────────────────────┘   │
│ Features  │                                 │
│ ☐ Instant │  [More results...]             │
│ ☐ Pet OK  │                                 │
│ ☐ Top Rated│  [Load More]                   │
│           │                                 │
│ [Reset]   │  [MAP VIEW] [LIST VIEW]        │
└───────────┴─────────────────────────────────┘
```

**Features:**
- Live search as filters change
- Sorting options
- Quick book button
- View profile for details
- Save favorite (heart icon)
- Map view toggle

---

### **PAGE 7: CLEANER PROFILE**

**Route:** `/cleaner/[id]`

**Purpose:** Detailed cleaner information

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [← Back to Search]                         │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────┐  Jane Doe                  │
│  │ [  Photo  ]│  ⭐⭐⭐⭐⭐ 4.9/5         │
│  │           ]│  47 reviews                 │
│  │           ]│  ✓ Verified ✓ Insured      │
│  └────────────┘  Member since 2023         │
│                                             │
│  💰 $45/hour • 3 hour minimum              │
│                                             │
│  📍 Services: Manhattan, Brooklyn          │
│                                             │
│  [📅 Book Now]  [💬 Message]  [❤ Save]    │
│                                             │
├─────────────────────────────────────────────┤
│  TABS: [About] [Services] [Reviews] [Photos]│
├─────────────────────────────────────────────┤
│                                             │
│  ABOUT TAB:                                 │
│  "Hi! I'm Jane, a professional cleaner..." │
│                                             │
│  ✓ 5 years experience                      │
│  ✓ Background checked                      │
│  ✓ Insured & bonded                        │
│  ✓ Brings own supplies                     │
│  ✓ Pet-friendly                            │
│  ✓ Speaks: English, Spanish                │
│                                             │
│  Response time: 1 hour                     │
│  Acceptance rate: 95%                      │
│                                             │
├─────────────────────────────────────────────┤
│  SERVICES TAB:                              │
│  ☑ Standard Cleaning - $45/hr              │
│  ☑ Deep Cleaning - $55/hr                  │
│  ☑ Move-in/Move-out - $60/hr               │
│  ☐ Commercial                               │
│                                             │
│  What's included in standard cleaning:      │
│  • Kitchen: surfaces, sink, appliances     │
│  • Bathrooms: toilet, shower, mirror       │
│  • Living areas: dusting, vacuuming        │
│  • Bedrooms: dusting, vacuuming            │
│                                             │
│  Add-ons available:                        │
│  + Inside fridge ($20)                     │
│  + Inside oven ($25)                       │
│  + Windows ($30)                           │
│                                             │
├─────────────────────────────────────────────┤
│  REVIEWS TAB:                               │
│  ⭐⭐⭐⭐⭐ 5.0  Sarah M.  2 days ago      │
│  "Jane was amazing! Super thorough..."     │
│                                             │
│  ⭐⭐⭐⭐⭐ 5.0  Mike K.  1 week ago       │
│  "Best cleaner I've ever hired..."         │
│                                             │
│  [Load More Reviews]                       │
│                                             │
├─────────────────────────────────────────────┤
│  PHOTOS TAB:                                │
│  [Before/After Gallery]                    │
│  [Kitchen] [Bathroom] [Living Room]        │
│                                             │
└─────────────────────────────────────────────┘
```

**Sticky CTA:**
- Book Now button follows scroll
- Always visible

---

### **PAGE 8: BOOKING FORM**

**Route:** `/book/[cleanerId]`

**Purpose:** Complete booking in one page

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Book Jane Doe                              │
│  [Jane's Photo] ⭐ 4.9 (47 reviews)        │
├─────────────────────────────────────────────┤
│                                             │
│  1️⃣ SERVICE DETAILS                        │
│  ┌───────────────────────────┐            │
│  │ Service Type:             │            │
│  │ ○ Standard ($45/hr)       │            │
│  │ ○ Deep Clean ($55/hr)     │            │
│  │ ○ Move-in/out ($60/hr)    │            │
│  │                           │            │
│  │ Estimated Hours: [__]     │            │
│  │ (3 hour minimum)          │            │
│  └───────────────────────────┘            │
│                                             │
│  2️⃣ DATE & TIME                            │
│  ┌───────────────────────────┐            │
│  │ [📅 Calendar Picker]      │            │
│  │ Selected: Jan 15, 2026    │            │
│  │                           │            │
│  │ Start Time:               │            │
│  │ [9:00 AM ▾]              │            │
│  │                           │            │
│  │ Frequency:                │            │
│  │ ○ One-time                │            │
│  │ ○ Weekly                  │            │
│  │ ○ Bi-weekly              │            │
│  │ ○ Monthly                │            │
│  └───────────────────────────┘            │
│                                             │
│  3️⃣ LOCATION                               │
│  ┌───────────────────────────┐            │
│  │ Select Address:           │            │
│  │ ○ 123 Main St, Apt 4B     │            │
│  │ ○ Add new address...      │            │
│  │                           │            │
│  │ Property Size:            │            │
│  │ ○ Studio/1BR              │            │
│  │ ○ 2BR                     │            │
│  │ ○ 3BR+                    │            │
│  └───────────────────────────┘            │
│                                             │
│  4️⃣ ADD-ONS (Optional)                     │
│  ┌───────────────────────────┐            │
│  │ ☐ Inside fridge (+$20)    │            │
│  │ ☐ Inside oven (+$25)      │            │
│  │ ☐ Windows (+$30)          │            │
│  │ ☐ Laundry (+$15)         │            │
│  └───────────────────────────┘            │
│                                             │
│  5️⃣ SPECIAL INSTRUCTIONS                   │
│  ┌───────────────────────────┐            │
│  │ [Text area]               │            │
│  │ "Please focus on..."      │            │
│  │                           │            │
│  │ [Upload Photos] (optional)│            │
│  └───────────────────────────┘            │
│                                             │
│  6️⃣ PAYMENT                                │
│  ┌───────────────────────────┐            │
│  │ Card ending in 1234       │            │
│  │ [Change Payment Method]   │            │
│  └───────────────────────────┘            │
│                                             │
├─────────────────────────────────────────────┤
│  PRICE BREAKDOWN (Sticky Sidebar)          │
│  ┌───────────────────────────┐            │
│  │ Service (3 hrs)    $135   │            │
│  │ Add-ons            $20    │            │
│  │ Service Fee        $15    │            │
│  │ ─────────────────         │            │
│  │ Total              $170   │            │
│  │                           │            │
│  │ 💳 Pay at completion      │            │
│  │ ✓ 100% Money-back guarantee│          │
│  │                           │            │
│  │ [Confirm Booking]         │            │
│  │                           │            │
│  │ By booking, you agree to  │            │
│  │ [Terms] and [Cancellation]│            │
│  │ policy                    │            │
│  └───────────────────────────┘            │
└─────────────────────────────────────────────┘
```

**Smart Features:**
- Real-time price calculation
- Availability checking
- Calendar shows only available dates
- Form validation
- Save progress (logged in users)

---

### **PAGE 9: BOOKING CONFIRMATION**

**Route:** `/booking/[id]/confirmed`

**Layout:**
```
┌─────────────────────────────────────────┐
│         ✅ Booking Confirmed!          │
├─────────────────────────────────────────┤
│                                         │
│  Booking #12345                        │
│                                         │
│  ┌─────────────────────────┐          │
│  │ [Jane's Photo]          │          │
│  │ Jane Doe                │          │
│  │ ⭐ 4.9 (47 reviews)     │          │
│  │                         │          │
│  │ 📅 Jan 15, 2026        │          │
│  │ 🕐 9:00 AM - 12:00 PM  │          │
│  │ 📍 123 Main St, Apt 4B │          │
│  │                         │          │
│  │ Service: Standard Clean │          │
│  │ Total: $170            │          │
│  └─────────────────────────┘          │
│                                         │
│  📧 Confirmation sent to your email    │
│                                         │
│  WHAT'S NEXT:                         │
│  ✓ Jane will arrive at 9:00 AM        │
│  ✓ You'll get a reminder 24hrs before │
│  ✓ Payment will be charged after      │
│    service completion                  │
│                                         │
│  ┌─────────────────────────┐          │
│  │ [📅 Add to Calendar]    │          │
│  │ [💬 Message Jane]       │          │
│  │ [📄 View Details]       │          │
│  │ [🔄 Reschedule]        │          │
│  └─────────────────────────┘          │
│                                         │
│  [← Back to Dashboard]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Actions:**
- Add to calendar (creates .ics file)
- Message cleaner
- View full booking details
- Reschedule if needed

---

---

### **PAGE 10: CLIENT DASHBOARD**

**Route:** `/client/dashboard`

**Purpose:** Central hub for client activity

**Layout:**
```
┌─────────────────────────────────────────────┐
│  HEADER                                     │
│  [Logo] [Messages(2)] [Bookings] [Profile] │
├─────────────────────────────────────────────┤
│                                             │
│  Welcome back, Sarah! 👋                   │
│                                             │
│  NEXT BOOKING                               │
│  ┌───────────────────────────────┐        │
│  │ 📅 Tomorrow, Jan 15 at 9:00 AM│        │
│  │ 🧹 Standard Clean with Jane   │        │
│  │ 📍 123 Main St                │        │
│  │                               │        │
│  │ [View Details] [Message Jane] │        │
│  └───────────────────────────────┘        │
│                                             │
│  QUICK ACTIONS                             │
│  ┌──────┐ ┌──────┐ ┌──────┐             │
│  │ 🔍  │ │ 🔄   │ │ ❤️   │             │
│  │ Book │ │Repeat│ │Favs  │             │
│  └──────┘ └──────┘ └──────┘             │
│                                             │
│  YOUR STATS                                │
│  ┌────────────────────────────┐           │
│  │ 12 Total Bookings          │           │
│  │ 3 Favorite Cleaners        │           │
│  │ $1,240 Total Spent         │           │
│  └────────────────────────────┘           │
│                                             │
│  FAVORITE CLEANERS                         │
│  ┌────────┬────────┬────────┐            │
│  │ Jane   │ Mike   │ Lisa   │            │
│  │ ⭐4.9  │ ⭐4.8  │ ⭐5.0  │            │
│  │[Book]  │[Book]  │[Book]  │            │
│  └────────┴────────┴────────┘            │
│                                             │
│  RECENT ACTIVITY                           │
│  • Booking completed - Rate Jane ⭐        │
│  • New message from Mike                   │
│  • Your favorite cleaner is available!     │
│                                             │
│  REFERRAL PROGRAM                          │
│  ┌────────────────────────────┐           │
│  │ 🎁 Give $20, Get $20       │           │
│  │ Your code: SARAH20         │           │
│  │ [Share Link]               │           │
│  │                            │           │
│  │ Referrals: 2 (earned $40!) │           │
│  └────────────────────────────┘           │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Upcoming booking card (prominent)
- Quick book action (searches nearby)
- Repeat last booking
- Favorites grid
- Activity feed
- Referral widget

---

### **PAGE 11: MY BOOKINGS**

**Route:** `/client/bookings`

**Purpose:** View all bookings (past/upcoming)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  My Bookings                                │
│                                             │
│  [Upcoming] [Past] [Cancelled]             │
├─────────────────────────────────────────────┤
│                                             │
│  UPCOMING (3)                              │
│  ┌─────────────────────────────┐          │
│  │ [Photo] Jane Doe            │          │
│  │ ⭐ 4.9 (47 reviews)         │          │
│  │                             │          │
│  │ Standard Clean              │          │
│  │ 📅 Tomorrow, 9:00 AM       │          │
│  │ 📍 123 Main St             │          │
│  │ 💰 $170                    │          │
│  │                             │          │
│  │ Status: ✅ Confirmed       │          │
│  │                             │          │
│  │ [View] [Message] [Cancel]  │          │
│  └─────────────────────────────┘          │
│                                             │
│  ┌─────────────────────────────┐          │
│  │ [Photo] Mike Smith          │          │
│  │ ⭐ 4.8 (93 reviews)         │          │
│  │                             │          │
│  │ Deep Clean                  │          │
│  │ 📅 Jan 20, 2:00 PM         │          │
│  │ 📍 456 Oak Ave             │          │
│  │ 💰 $220                    │          │
│  │                             │          │
│  │ Status: ✅ Confirmed       │          │
│  │                             │          │
│  │ [View] [Message] [Cancel]  │          │
│  └─────────────────────────────┘          │
│                                             │
└─────────────────────────────────────────────┘
```

**Clicking "View" opens modal:**
```
┌─────────────────────────────┐
│  Booking Details            │
│  #12345                     │
├─────────────────────────────┤
│  [Jane's Photo]             │
│  Jane Doe ⭐ 4.9           │
│                             │
│  📅 Jan 15, 9:00 AM-12PM   │
│  📍 123 Main St, Apt 4B    │
│  🧹 Standard Clean (3hrs)  │
│                             │
│  Add-ons:                  │
│  • Inside fridge ($20)     │
│                             │
│  Instructions:             │
│  "Please focus on kitchen" │
│                             │
│  💰 Total: $170            │
│  Payment: Card ...1234     │
│                             │
│  [Message Jane]            │
│  [Reschedule]              │
│  [Cancel Booking]          │
│  [Add to Calendar]         │
│                             │
│  Cancellation Policy:      │
│  Free until 24hrs before   │
│                             │
└─────────────────────────────┘
```

---

### **PAGE 12: MESSAGES / INBOX**

**Route:** `/messages`

**Purpose:** Chat with cleaners

**Layout:**
```
┌────────────┬────────────────────────────────┐
│ CHATS      │  CONVERSATION                  │
│            │                                │
│ Jane Doe   │  Chat with Jane Doe            │
│ ○ Online   │  ⭐ 4.9 • [View Profile]      │
│ 2m ago     │  ──────────────────────────    │
│ ────────   │                                │
│ "Thanks!"  │  📅 Booking: Tomorrow 9AM     │
│            │                                │
│ Mike Smith │  ┌──────────────────────┐     │
│ ● Offline  │  │ Hi! I'm looking      │ ME  │
│ 2h ago     │  │ forward to tomorrow! │     │
│ ────────   │  └──────────────────────┘     │
│ "See you!" │  10:30 AM                      │
│            │                                │
│ Lisa Brown │  ┌──────────────────────┐     │
│ ○ Online   │  │ Great! I'll arrive   │JANE │
│ 1d ago     │  │ at 9am sharp. Gate   │     │
│ ────────   │  │ code needed?         │     │
│ "Perfect!" │  └──────────────────────┘     │
│            │  10:32 AM                      │
│            │                                │
│ [+ New]    │  ┌──────────────────────┐     │
│            │  │ Code is 1234         │ ME  │
│            │  └──────────────────────┘     │
│            │  10:35 AM                      │
│            │                                │
│            │  ┌──────────────────────┐     │
│            │  │ Perfect, thanks! 👍  │JANE │
│            │  └──────────────────────┘     │
│            │  10:36 AM                      │
│            │                                │
│            │  ──────────────────────────    │
│            │                                │
│            │  [Type message...]  [📎][Send]│
│            │                                │
└────────────┴────────────────────────────────┘
```

**Features:**
- Real-time messaging
- Online status indicators
- Quick booking reference
- File attachments
- Push notifications

---

### **PAGE 13: LEAVE REVIEW (Modal/Overlay)**

**Route:** Opens as modal after booking completion

**Layout:**
```
┌─────────────────────────────┐
│  Rate Your Experience       │
├─────────────────────────────┤
│                             │
│  [Jane's Photo]             │
│  Jane Doe                   │
│                             │
│  How was your cleaning?     │
│  ⭐ ⭐ ⭐ ⭐ ⭐          │
│  Tap to rate                │
│                             │
│  Tell us more:              │
│  ┌─────────────────────┐   │
│  │ [Text area]         │   │
│  │ "Jane was amazing..." │  │
│  │                     │   │
│  └─────────────────────┘   │
│                             │
│  Rate specific areas:       │
│  Quality      ⭐⭐⭐⭐⭐ │
│  Punctuality  ⭐⭐⭐⭐⭐ │
│  Friendliness ⭐⭐⭐⭐⭐ │
│                             │
│  Add photos (optional):     │
│  [Upload Photos]            │
│                             │
│  ☐ I'd book Jane again     │
│                             │
│  [Skip] [Submit Review]     │
│                             │
└─────────────────────────────┘
```

**Trigger:**
- Email/notification 2 hours after booking
- Dashboard notification
- Prompted on next login

---

### **PAGE 14: CLIENT SETTINGS**

**Route:** `/client/settings`

**Purpose:** Manage account & preferences

**Layout:**
```
┌─────────────────────────────────────────┐
│  Account Settings                       │
│                                         │
│  [Profile] [Payment] [Addresses]       │
│  [Notifications] [Security]            │
├─────────────────────────────────────────┤
│                                         │
│  PROFILE TAB:                          │
│  ┌─────────────────────────┐          │
│  │ [Current Photo]         │          │
│  │ [Change Photo]          │          │
│  │                         │          │
│  │ Full Name: [_________]  │          │
│  │ Email: [_____________]  │          │
│  │ Phone: [_____________]  │          │
│  │                         │          │
│  │ [Save Changes]          │          │
│  └─────────────────────────┘          │
│                                         │
│  PAYMENT TAB:                          │
│  ┌─────────────────────────┐          │
│  │ SAVED CARDS              │          │
│  │ ┌───────────────────┐   │          │
│  │ │ 💳 Visa ...1234   │   │          │
│  │ │ Expires 12/27     │   │          │
│  │ │ [Edit] [Remove]   │   │          │
│  │ └───────────────────┘   │          │
│  │                         │          │
│  │ [+ Add New Card]        │          │
│  │                         │          │
│  │ Default payment: Card 1234│         │
│  └─────────────────────────┘          │
│                                         │
│  ADDRESSES TAB:                        │
│  ┌─────────────────────────┐          │
│  │ HOME (Default)          │          │
│  │ 123 Main St, Apt 4B     │          │
│  │ New York, NY 10001      │          │
│  │ Gate code: 1234         │          │
│  │ [Edit] [Remove]         │          │
│  │                         │          │
│  │ OFFICE                  │          │
│  │ 456 Oak Ave             │          │
│  │ New York, NY 10002      │          │
│  │ [Edit] [Remove]         │          │
│  │                         │          │
│  │ [+ Add New Address]     │          │
│  └─────────────────────────┘          │
│                                         │
│  NOTIFICATIONS TAB:                    │
│  ┌─────────────────────────┐          │
│  │ Email Notifications:    │          │
│  │ ☑ Booking confirmations │          │
│  │ ☑ Reminders             │          │
│  │ ☑ Messages              │          │
│  │ ☐ Promotions            │          │
│  │                         │          │
│  │ SMS Notifications:      │          │
│  │ ☑ Booking reminders     │          │
│  │ ☑ Cleaner on the way    │          │
│  │ ☐ Marketing messages    │          │
│  │                         │          │
│  │ Push Notifications:     │          │
│  │ ☑ New messages          │          │
│  │ ☑ Booking updates       │          │
│  │                         │          │
│  │ [Save Preferences]      │          │
│  └─────────────────────────┘          │
│                                         │
│  SECURITY TAB:                         │
│  ┌─────────────────────────┐          │
│  │ Change Password         │          │
│  │ Current: [___________]  │          │
│  │ New: [_______________]  │          │
│  │ Confirm: [___________]  │          │
│  │ [Update Password]       │          │
│  │                         │          │
│  │ Two-Factor Auth:        │          │
│  │ ○ Disabled              │          │
│  │ [Enable 2FA]            │          │
│  │                         │          │
│  │ Connected Accounts:     │          │
│  │ [G] Google (connected)  │          │
│  │ [f] Facebook [Connect]  │          │
│  │                         │          │
│  │ [Delete Account]        │          │
│  │ (Permanently delete)    │          │
│  └─────────────────────────┘          │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🧹 **CLEANER PAGES**

---

### **PAGE 15: VERIFICATION PENDING**

**Route:** `/cleaner/pending`

**Purpose:** Show application status

**Layout:**
```
┌─────────────────────────────────────────┐
│         🕐 Application Pending          │
├─────────────────────────────────────────┤
│                                         │
│  Thanks for applying, John!            │
│                                         │
│  We're reviewing your application.     │
│  This usually takes 1-3 business days. │
│                                         │
│  YOUR APPLICATION:                     │
│  ┌─────────────────────────┐          │
│  │ ✅ Basic Info           │          │
│  │ ✅ Documents Uploaded   │          │
│  │ ✅ Background Check     │          │
│  │ 🕐 Admin Review         │          │
│  └─────────────────────────┘          │
│                                         │
│  WHAT'S NEXT:                         │
│  • Background check (24-48 hours)      │
│  • Admin review (1-2 days)             │
│  • Approval email sent                 │
│                                         │
│  WHILE YOU WAIT:                       │
│  📖 [Read Getting Started Guide]       │
│  📱 [Download Mobile App]              │
│  👥 [Join Cleaner Community]           │
│                                         │
│  Questions? [Contact Support]          │
│                                         │
└─────────────────────────────────────────┘
```

**After approval:**
- Email notification
- SMS notification
- Can access cleaner dashboard

---

### **PAGE 16: CLEANER DASHBOARD**

**Route:** `/cleaner/dashboard`

**Purpose:** Central hub for cleaner activity

**Layout:**
```
┌─────────────────────────────────────────────┐
│  HEADER                                     │
│  [Logo] [Calendar] [Messages] [Earnings]   │
│  [Profile ▾]                                │
├─────────────────────────────────────────────┤
│                                             │
│  Welcome back, Jane! 👋                    │
│                                             │
│  TODAY'S SCHEDULE                          │
│  ┌───────────────────────────────┐        │
│  │ 🕐 9:00 AM - 12:00 PM         │        │
│  │ Standard Clean for Sarah      │        │
│  │ 📍 123 Main St (2.5mi away)  │        │
│  │ 💰 $135                       │        │
│  │                               │        │
│  │ [Start Job] [Navigate] [Call] │        │
│  └───────────────────────────────┘        │
│                                             │
│  │ 🕐 2:00 PM - 5:00 PM          │        │
│  │ Deep Clean for Mike           │        │
│  │ 📍 456 Oak Ave (3.1mi away)   │        │
│  │ 💰 $165                       │        │
│  │                               │        │
│  │ [View Details] [Message]      │        │
│  └───────────────────────────────┘        │
│                                             │
│  NEW JOB OFFERS (2)                        │
│  ┌───────────────────────────────┐        │
│  │ Tomorrow, 10:00 AM            │        │
│  │ Standard Clean (3hrs)         │        │
│  │ 📍 789 Elm St (1.8mi)         │        │
│  │ 💰 $135                       │        │
│  │ [Accept] [Decline]            │        │
│  └───────────────────────────────┘        │
│                                             │
│  TODAY'S STATS                             │
│  ┌──────┬──────┬──────┬──────┐           │
│  │ Jobs │Hours │Miles │ $ Est│           │
│  │  2   │  6   │ 5.6  │ $300 │           │
│  └──────┴──────┴──────┴──────┘           │
│                                             │
│  THIS WEEK                                 │
│  ┌────────────────────────────┐           │
│  │ Jobs: 12 (👍 +2 from last) │           │
│  │ Earnings: $1,240           │           │
│  │ Rating: ⭐ 4.9 (47 reviews)│           │
│  │ Response Rate: 98%         │           │
│  └────────────────────────────┘           │
│                                             │
│  RECENT REVIEWS                            │
│  ⭐⭐⭐⭐⭐ "Amazing work!" - Sarah      │
│  ⭐⭐⭐⭐⭐ "Super thorough" - Mike      │
│                                             │
│  QUICK ACTIONS                             │
│  [📅 Manage Availability]                 │
│  [💰 Request Payout]                      │
│  [📊 View Analytics]                      │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Today's jobs (top priority)
- New job offers (actionable)
- Quick stats
- Recent activity
- Quick actions

---

### **PAGE 17: CLEANER CALENDAR**

**Route:** `/cleaner/calendar`

**Purpose:** View all jobs, manage availability

**Layout:**
```
┌─────────────────────────────────────────────┐
│  My Calendar                                │
│  [Week] [Month] [List]                     │
│                                             │
│  January 2026                [< Today >]   │
├─────────────────────────────────────────────┤
│                                             │
│  CALENDAR VIEW:                            │
│  ┌────┬────┬────┬────┬────┬────┬────┐    │
│  │Mon │Tue │Wed │Thu │Fri │Sat │Sun │    │
│  ├────┼────┼────┼────┼────┼────┼────┤    │
│  │    │    │ 14 │ 15 │ 16 │ 17 │ 18 │    │
│  │    │    │    │[9am│    │BLOCKED    │    │
│  │    │    │    │ 3hrs│    │    │    │    │
│  │    │    │    │]   │[2pm│    │    │    │
│  │    │    │    │    │ 3hrs│    │    │    │
│  │    │    │    │    │]   │    │    │    │
│  ├────┼────┼────┼────┼────┼────┼────┤    │
│  │ 19 │ 20 │ 21 │ 22 │ 23 │ 24 │ 25 │    │
│  │[10am│[2pm│OFFER│    │    │    │    │    │
│  │ 4hrs│ 3hrs│[9am│    │    │    │    │    │
│  │]   │]   │ 2hrs│    │    │    │    │    │
│  │    │    │]   │    │    │    │    │    │
│  └────┴────┴────┴────┴────┴────┴────┘    │
│                                             │
│  COLOR KEY:                                │
│  🟦 Confirmed  🟨 Pending Offer           │
│  🟥 Blocked    ⬜ Available               │
│                                             │
│  CLICKED JOB DETAILS (Modal):             │
│  ┌─────────────────────────────┐          │
│  │ Jan 15, 9:00 AM - 12:00 PM  │          │
│  │ Standard Clean              │          │
│  │                             │          │
│  │ [Sarah's Photo]             │          │
│  │ Sarah M.                    │          │
│  │ ⭐ 4.8 (12 bookings)       │          │
│  │                             │          │
│  │ 📍 123 Main St             │          │
│  │    2.5 miles away           │          │
│  │    [Get Directions]         │          │
│  │                             │          │
│  │ 💰 Payment: $135           │          │
│  │    Base (3hrs): $135        │          │
│  │    Add-on: $0               │          │
│  │                             │          │
│  │ 📝 Instructions:            │          │
│  │ "Please focus on kitchen"  │          │
│  │                             │          │
│  │ [Start Job]                 │          │
│  │ [Message Sarah]             │          │
│  │ [Cancel] (fee may apply)    │          │
│  └─────────────────────────────┘          │
│                                             │
│  AVAILABILITY MANAGEMENT:                  │
│  [+ Block Time Off]                        │
│  [Edit Weekly Schedule]                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Calendar with all jobs
- Color-coded status
- Click job → See details modal
- Block time off
- Accept/decline offers
- Navigate to address
- Start job (tracks time)

---

### **PAGE 18: JOB DETAILS (Modal)**

Already shown above in calendar, but can also be accessed from:
- Job list
- Dashboard
- Notifications

**Actions available:**
- Start Job (begins timer)
- Complete Job (ends timer, prompts payment)
- Message Client
- Navigate (opens maps)
- Call Client
- Cancel (with policy warning)

---

### **PAGE 19: CLEANER MESSAGES**

Same layout as Page 12 (Client Messages), but from cleaner perspective.

**Additional features for cleaners:**
- Quick responses (pre-saved templates)
- Send availability
- Send invoice/receipt

---

### **PAGE 20: EARNINGS DASHBOARD**

**Route:** `/cleaner/earnings`

**Purpose:** Track income & request payouts

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Earnings                                   │
│  [Overview] [Transactions] [Payouts]       │
├─────────────────────────────────────────────┤
│                                             │
│  OVERVIEW TAB:                             │
│                                             │
│  CURRENT BALANCE                           │
│  ┌───────────────────────────────┐        │
│  │ 💰 $1,240.00                  │        │
│  │                               │        │
│  │ Available for payout          │        │
│  │ [Request Payout]              │        │
│  └───────────────────────────────┘        │
│                                             │
│  PENDING EARNINGS: $300.00                 │
│  (Jobs completed, payment processing)       │
│                                             │
│  THIS MONTH                                │
│  ┌──────────────────────────────┐         │
│  │ [Earnings Chart]              │         │
│  │  $500                         │         │
│  │  $400                    ▄    │         │
│  │  $300         ▄    ▄    ▐▌   │         │
│  │  $200    ▄   ▐▌  ▐▌  ▄ ▐▌   │         │
│  │  $100   ▐▌  ▐▌  ▐▌  ▐▌▐▌   │         │
│  │   W1   W2   W3   W4   W5    │         │
│  └──────────────────────────────┘         │
│                                             │
│  BREAKDOWN                                 │
│  ┌──────────────────────────────┐         │
│  │ Gross Earnings:    $1,500.00  │         │
│  │ Platform Fee (15%): -$225.00  │         │
│  │ Tips:               +$45.00   │         │
│  │ ─────────────────────         │         │
│  │ Net Earnings:      $1,320.00  │         │
│  └──────────────────────────────┘         │
│                                             │
│  STATS THIS MONTH                          │
│  Jobs: 24 | Hours: 72 | Avg: $55/hr      │
│                                             │
│  TRANSACTIONS TAB:                         │
│  ┌─────────────────────────────┐          │
│  │ Jan 14 • Sarah M.           │          │
│  │ Standard Clean (3hrs)       │          │
│  │ +$135.00                    │          │
│  │                             │          │
│  │ Jan 13 • Mike K.            │          │
│  │ Deep Clean (4hrs)           │          │
│  │ +$220.00                    │          │
│  │                             │          │
│  │ Jan 12 • Lisa B.            │          │
│  │ Standard Clean (2hrs)       │          │
│  │ +$90.00                     │          │
│  │                             │          │
│  │ [Load More]                 │          │
│  └─────────────────────────────┘          │
│                                             │
│  PAYOUTS TAB:                              │
│  ┌─────────────────────────────┐          │
│  │ Jan 10, 2026                │          │
│  │ Status: ✅ Completed        │          │
│  │ Amount: $1,100.00           │          │
│  │ Method: Bank ...4567        │          │
│  │ [View Receipt]              │          │
│  │                             │          │
│  │ Jan 3, 2026                 │          │
│  │ Status: ✅ Completed        │          │
│  │ Amount: $950.00             │          │
│  │ Method: Bank ...4567        │          │
│  │ [View Receipt]              │          │
│  └─────────────────────────────┘          │
│                                             │
│  PAYOUT SETTINGS                           │
│  [Manage Bank Account]                     │
│  Automatic payouts: Weekly                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Current balance (big and prominent)
- Request payout button
- Earnings chart
- Transaction history
- Past payouts
- Fee breakdown

---

### **PAGE 21: CLEANER SETTINGS**

**Route:** `/cleaner/settings`

**Purpose:** Manage profile, services, availability

**Layout:**
```
┌─────────────────────────────────────────┐
│  Settings                               │
│                                         │
│  [Profile] [Services] [Availability]   │
│  [Banking] [Notifications] [Security]  │
├─────────────────────────────────────────┤
│                                         │
│  PROFILE TAB:                          │
│  ┌─────────────────────────┐          │
│  │ [Current Photo]         │          │
│  │ [Change Photo]          │          │
│  │                         │          │
│  │ Name: [_____________]   │          │
│  │ Email: [____________]   │          │
│  │ Phone: [____________]   │          │
│  │                         │          │
│  │ Bio:                    │          │
│  │ [Text area]             │          │
│  │ "Professional cleaner..." │         │
│  │                         │          │
│  │ Years Experience: [___] │          │
│  │                         │          │
│  │ Before/After Photos:    │          │
│  │ [Gallery]               │          │
│  │ [Upload More]           │          │
│  │                         │          │
│  │ [Save Changes]          │          │
│  └─────────────────────────┘          │
│                                         │
│  SERVICES TAB:                         │
│  ┌─────────────────────────┐          │
│  │ SERVICES OFFERED         │          │
│  │                         │          │
│  │ ☑ Standard Clean        │          │
│  │   Rate: $[45]/hr        │          │
│  │   Min hours: [3]        │          │
│  │   [Edit Description]    │          │
│  │                         │          │
│  │ ☑ Deep Clean            │          │
│  │   Rate: $[55]/hr        │          │
│  │   Min hours: [4]        │          │
│  │   [Edit Description]    │          │
│  │                         │          │
│  │ ☐ Move-in/Move-out      │          │
│  │   [Enable Service]      │          │
│  │                         │          │
│  │ ☐ Commercial            │          │
│  │   [Enable Service]      │          │
│  │                         │          │
│  │ ADD-ONS                  │          │
│  │ ☑ Inside fridge ($20)   │          │
│  │ ☑ Inside oven ($25)     │          │
│  │ ☑ Windows ($30)         │          │
│  │ [+ Add Custom Add-on]   │          │
│  │                         │          │
│  │ SERVICE AREAS            │          │
│  │ ZIP Codes: 10001, 10002 │          │
│  │ [Edit ZIP Codes]        │          │
│  │ Travel radius: [10] mi  │          │
│  │                         │          │
│  │ [Save Changes]          │          │
│  └─────────────────────────┘          │
│                                         │
│  AVAILABILITY TAB:                     │
│  ┌─────────────────────────┐          │
│  │ WEEKLY SCHEDULE          │          │
│  │                         │          │
│  │ Monday                  │          │
│  │ ☑ Available             │          │
│  │ [9:00 AM] to [6:00 PM]  │          │
│  │                         │          │
│  │ Tuesday                 │          │
│  │ ☑ Available             │          │
│  │ [9:00 AM] to [6:00 PM]  │          │
│  │                         │          │
│  │ Wednesday               │          │
│  │ ☑ Available             │          │
│  │ [9:00 AM] to [6:00 PM]  │          │
│  │                         │          │
│  │ [Show All Days]         │          │
│  │                         │          │
│  │ BOOKING PREFERENCES      │          │
│  │ Min notice: [24] hours  │          │
│  │ Max bookings/day: [3]   │          │
│  │ Buffer between: [30]min │          │
│  │                         │          │
│  │ ☑ Accept instant bookings│         │
│  │ ☐ Require approval       │          │
│  │                         │          │
│  │ [Save Changes]          │          │
│  └─────────────────────────┘          │
│                                         │
│  BANKING TAB:                          │
│  ┌─────────────────────────┐          │
│  │ PAYOUT METHOD            │          │
│  │                         │          │
│  │ Bank: Chase Bank        │          │
│  │ Account: ****4567       │          │
│  │ [Edit Bank Info]        │          │
│  │                         │          │
│  │ PAYOUT SCHEDULE          │          │
│  │ ○ Weekly (every Monday) │          │
│  │ ○ Bi-weekly             │          │
│  │ ○ Monthly               │          │
│  │                         │          │
│  │ Minimum balance: $100   │          │
│  │                         │          │
│  │ [Save Changes]          │          │
│  └─────────────────────────┘          │
│                                         │
│  (Notifications & Security tabs        │
│   similar to Client Settings)          │
│                                         │
└─────────────────────────────────────────┘
```

---

## 👑 **ADMIN PAGES (OPTIONAL FOR V1.0)**

For MVP, you can manage via database directly, but if you want basic admin:

---

### **PAGE 22: ADMIN LOGIN**

**Route:** `/admin/login`

**Separate from client/cleaner login**

**Layout:**
```
┌─────────────────────────────────────────┐
│                                         │
│         🔐 ADMIN ACCESS                │
│                                         │
│  ┌─────────────────────────┐          │
│  │ Email: [______________] │          │
│  │ Password: [__________]  │          │
│  │                         │          │
│  │ [Login to Admin Panel]  │          │
│  └─────────────────────────┘          │
│                                         │
└─────────────────────────────────────────┘
```

---

### **PAGE 23: ADMIN DASHBOARD**

**Route:** `/admin/dashboard`

**Purpose:** Platform overview & management

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [Admin] PureTask Admin Panel              │
│  [Dashboard] [Users] [Bookings] [Finance]  │
│  [Settings] [Logout]                       │
├─────────────────────────────────────────────┤
│                                             │
│  PLATFORM OVERVIEW                         │
│                                             │
│  ┌───────┬───────┬───────┬───────┐        │
│  │ Users │Bookings│Revenue│Active │        │
│  │ 1,247 │  3,521 │$87.5K │  34   │        │
│  │ +12%  │  +8%   │ +15%  │       │        │
│  └───────┴───────┴───────┴───────┘        │
│                                             │
│  REVENUE CHART (Last 30 Days)              │
│  ┌──────────────────────────────┐         │
│  │ [Line Chart]                  │         │
│  │  $4K                     ▄    │         │
│  │  $3K         ▄    ▄    ▄▌    │         │
│  │  $2K    ▄   ▐▌  ▄▌  ▄▐▌     │         │
│  │  $1K   ▐▌  ▐▌  ▐▌  ▐▐▌      │         │
│  │        Week 1-4                │         │
│  └──────────────────────────────┘         │
│                                             │
│  RECENT ACTIVITY                           │
│  • New cleaner: John D. (pending approval) │
│  • Booking #3522 completed                 │
│  • Payout processed: $1,240 to Jane        │
│  • New client: Sarah M.                    │
│                                             │
│  PENDING ACTIONS                           │
│  ┌────────────────────────────┐           │
│  │ ⚠️ 3 Cleaners awaiting     │           │
│  │    approval [Review]        │           │
│  │                            │           │
│  │ ⚠️ 1 Dispute open          │           │
│  │    [View Dispute]           │           │
│  │                            │           │
│  │ ⚠️ 2 Payouts pending       │           │
│  │    [Process Payouts]        │           │
│  └────────────────────────────┘           │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **PAGE 24: ADMIN USER MANAGEMENT**

**Route:** `/admin/users`

**Layout:**
```
┌─────────────────────────────────────────────┐
│  User Management                            │
│  [All Users] [Clients] [Cleaners] [Pending]│
├─────────────────────────────────────────────┤
│                                             │
│  Search: [__________] [Filter ▾] [Export]  │
│                                             │
│  CLEANERS TAB:                             │
│  ┌───────────────────────────────────┐    │
│  │ [Photo] Jane Doe                  │    │
│  │ jane@email.com                    │    │
│  │ ⭐ 4.9 • 47 reviews               │    │
│  │ Status: ✅ Active                 │    │
│  │ Joined: Jan 1, 2025               │    │
│  │ Earnings: $12,450                 │    │
│  │ [View] [Edit] [Suspend]           │    │
│  └───────────────────────────────────┘    │
│                                             │
│  PENDING TAB:                              │
│  ┌───────────────────────────────────┐    │
│  │ [Photo] John Smith                │    │
│  │ john@email.com                    │    │
│  │ Applied: Jan 14, 2026             │    │
│  │ Documents: ✅ Complete            │    │
│  │ Background: 🕐 Pending            │    │
│  │ [Approve] [Reject] [View Details] │    │
│  └───────────────────────────────────┘    │
│                                             │
│  [Load More]                               │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **PAGE 25: ADMIN BOOKINGS**

**Route:** `/admin/bookings`

**Purpose:** View/manage all bookings

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Booking Management                         │
│  [All] [Active] [Completed] [Cancelled]    │
├─────────────────────────────────────────────┤
│                                             │
│  Search: [__________] [Date Range] [Export]│
│                                             │
│  ┌───────────────────────────────────┐    │
│  │ #3522 • Jan 15, 9:00 AM           │    │
│  │ Sarah M. → Jane D.                │    │
│  │ Standard Clean • $135              │    │
│  │ Status: ✅ Completed              │    │
│  │ Payment: ✅ Processed             │    │
│  │ [View Details]                     │    │
│  └───────────────────────────────────┘    │
│                                             │
│  ┌───────────────────────────────────┐    │
│  │ #3521 • Jan 14, 2:00 PM           │    │
│  │ Mike K. → John S.                 │    │
│  │ Deep Clean • $220                  │    │
│  │ Status: ⚠️ Disputed               │    │
│  │ Issue: "Not fully cleaned"         │    │
│  │ [Resolve Dispute]                  │    │
│  └───────────────────────────────────┘    │
│                                             │
│  [Load More]                               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ✅ **V1.0 MVP - ALL 25 PAGES COMPLETE!**

### **RECAP - V1.0 Pages:**

**Public & Auth (6):**
1. Landing page
2. Sign up / Login (tabs)
3. Email verification
4. Client profile setup
5. Cleaner onboarding
6. Search results

**Client Dashboard (8):**
7. Cleaner profile
8. Booking form
9. Booking confirmation
10. Client dashboard
11. My bookings (+ details modal)
12. Messages
13. Leave review (modal)
14. Client settings

**Cleaner Dashboard (6):**
15. Verification pending
16. Cleaner dashboard
17. Calendar (+ job details modal)
18. (Job details - covered in #17)
19. Messages
20. Earnings dashboard
21. Cleaner settings

**Admin (Optional, 3-4):**
22. Admin login
23. Admin dashboard
24. User management
25. Booking management

---

## 🎯 **NEXT STEPS**

This covers the complete UI/UX specifications for **Version 1.0 (MVP)**!

Would you like me to now create:

1. **Version 2.0 specs** (Adding AI Assistant)
2. **Version 3.0 specs** (Adding Gamification + Full Admin)
3. **Version 4.0 specs** (Advanced features)
4. **Component Library** (Reusable UI components)
5. **Development Timeline** (Week-by-week plan)
6. **Tech Stack & Architecture** (How to build it)

Let me know what you'd like next! 🚀

