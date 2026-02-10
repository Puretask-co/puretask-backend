# Frontend Build Requirements - Detailed Breakdown

**Date**: 2025-01-27  
**Purpose**: Detailed breakdown of what needs to be built for frontend development

---

## 1. Build Client Booking Flow

### What This Means
Create the complete user journey for clients to book cleaning services, from search to confirmation.

### Pages/Components Needed

#### A. **Booking Form Page** (`/booking` or `/book`)
**Purpose**: Main booking interface where clients enter job details

**Components to Build**:
- [ ] **Address Input** - Google Places autocomplete or manual entry
  - Street address
  - City, State, ZIP
  - Address validation
  - Service area check
  
- [ ] **Date/Time Picker** - Calendar and time selection
  - Date picker (min date = today + lead time)
  - Time window selection (e.g., 9 AM - 12 PM)
  - Available time slots
  - Holiday indicators (if federal holiday)
  
- [ ] **Service Type Selector** - What type of cleaning
  - Standard Cleaning
  - Deep Clean
  - Move In/Out Cleaning
  - Airbnb Cleaning
  - Custom service options
  
- [ ] **Duration/Size Input** - How long/big the job is
  - Hours selector (1-8 hours)
  - Or property size (sq ft, bedrooms)
  - Frequency (one-time, weekly, bi-weekly, monthly)
  
- [ ] **Add-ons/Optional Services** - Extra services
  - Inside oven
  - Inside fridge
  - Inside windows
  - Laundry
  - Organization
  
- [ ] **Special Instructions** - Text area for notes
  - Client notes
  - Access instructions
  - Pet information
  - Special requests

- [ ] **Price Preview** - Real-time price calculation
  - Shows credits required
  - Shows current credit balance
  - Shows if auto-refill is enabled
  - Holiday rate indicator (if applicable)

- [ ] **Credit Balance Display** - Current wallet status
  - "You have X credits"
  - "This job costs Y credits"
  - "You'll have Z credits remaining"
  - "Insufficient credits" warning (if needed)

- [ ] **Auto-Refill Toggle** - Enable/disable auto top-up
  - Checkbox or toggle
  - Shows estimated top-up amount
  - Payment method selector (if enabled)

- [ ] **Submit Button** - Create booking
  - "Book Now" or "Confirm Booking"
  - Loading state during submission
  - Error handling

**Backend API Calls Needed**:
- `POST /jobs` - Create booking
- `GET /pricing/estimate` - Get price estimate
- `GET /credits/balance` - Get current credit balance
- `GET /holidays` - Check if selected date is holiday

**Design Requirements**:
- Clean, step-by-step form layout
- Mobile-responsive
- Clear pricing transparency
- Error states for validation
- Success confirmation

---

#### B. **Price Summary Component** (Part of booking flow)
**Purpose**: Show detailed price breakdown before confirmation

**Components to Build**:
- [ ] **Line Items** - Breakdown of costs
  - Base service cost
  - Duration multiplier
  - Add-ons (if any)
  - Holiday rate (if applicable)
  - Platform fee (if shown)
  - Total credits required

- [ ] **Credit Status** - Wallet balance check
  - Current balance
  - Required amount
  - Shortfall (if any)
  - Auto-refill amount (if enabled)

- [ ] **Payment Method** - How to pay
  - Use existing credits
  - Auto-refill (if enabled)
  - Buy credits now (if insufficient)

**Backend API Calls Needed**:
- `GET /credits/balance` - Current balance
- `POST /credits/purchase` - Buy credits (if needed)

---

#### C. **Booking Confirmation Page** (`/booking/confirm/:jobId`)
**Purpose**: Show booking was successful and next steps

**Components to Build**:
- [ ] **Success Message** - "Booking Confirmed!"
  - Job ID
  - Scheduled date/time
  - Service address
  - Service type
  
- [ ] **Status Indicator** - Current job status
  - "Finding Cleaner" (if not assigned)
  - "Assigned to [Cleaner Name]" (if assigned)
  - Cleaner profile preview (if assigned)
  
- [ ] **Next Steps** - What happens next
  - "We're finding the perfect cleaner for you"
  - "You'll be notified when a cleaner accepts"
  - "Cleaner will arrive on [date] at [time]"
  
- [ ] **Actions** - What client can do
  - "View Booking Details"
  - "Message Cleaner" (if assigned)
  - "Cancel Booking" (if allowed)
  - "Book Another Service"

**Backend API Calls Needed**:
- `GET /jobs/:id` - Get job details
- `GET /cleaners/:id` - Get cleaner details (if assigned)

---

#### D. **Booking Status Page** (`/bookings/:id`)
**Purpose**: View and manage an active booking

**Components to Build**:
- [ ] **Job Details Card** - All booking information
  - Date/time
  - Address
  - Service type
  - Duration
  - Status badge
  
- [ ] **Cleaner Info** - Assigned cleaner details
  - Profile photo
  - Name
  - Rating
  - "Message" button
  - "View Profile" link
  
- [ ] **Status Timeline** - Job progress
  - Created
  - Assigned (if applicable)
  - Confirmed
  - On the way (if applicable)
  - In progress
  - Completed
  
- [ ] **Actions** - Available actions
  - Cancel booking
  - Reschedule
  - Message cleaner
  - View photos (after completion)
  
- [ ] **Payment Info** - Credits used
  - Amount charged
  - Credits held in escrow
  - Release status

**Backend API Calls Needed**:
- `GET /jobs/:id` - Get job details
- `GET /jobs/:id/events` - Get job status history
- `POST /jobs/:id/cancel` - Cancel booking
- `GET /messages?jobId=:id` - Get messages

---

### Design Files Needed
- [ ] Booking form wireframes
- [ ] Price summary component design
- [ ] Confirmation page design
- [ ] Status page design
- [ ] Mobile responsive layouts
- [ ] Error state designs
- [ ] Loading state designs

---

## 2. Build Cleaner Dashboard

### What This Means
Create the main interface for cleaners to manage their business, view jobs, track earnings, and manage availability.

### Pages/Components Needed

#### A. **Cleaner Dashboard Home** (`/cleaner/dashboard`)
**Purpose**: Main landing page for cleaners after login

**Components to Build**:
- [ ] **Welcome Section** - Personalized greeting
  - "Welcome back, [Name]!"
  - Current tier (Bronze, Silver, Gold, Platinum)
  - Reliability score display
  
- [ ] **Quick Stats Cards** - Key metrics at a glance
  - Total earnings (this week/month)
  - Jobs completed (this week/month)
  - Upcoming jobs (count)
  - Average rating
  - Reliability score
  
- [ ] **Upcoming Jobs** - Next scheduled jobs
  - Job cards with:
    - Date/time
    - Client name
    - Address
    - Service type
    - Status
    - "View Details" button
  
- [ ] **Recent Activity** - Latest updates
  - New job requests
  - Job completions
  - Payments received
  - Rating received
  
- [ ] **Quick Actions** - Common tasks
  - "View Calendar"
  - "Check Job Requests"
  - "View Earnings"
  - "Update Availability"

**Backend API Calls Needed**:
- `GET /cleaner/dashboard` - Dashboard summary
- `GET /jobs?status=upcoming` - Upcoming jobs
- `GET /cleaner/stats` - Statistics

---

#### B. **Cleaner Calendar Page** (`/cleaner/calendar`)
**Purpose**: View and manage availability schedule

**Components to Build**:
- [ ] **Calendar View** - Monthly/weekly calendar
  - Calendar grid
  - Job markers on dates
  - Availability indicators
  - Holiday badges (federal holidays)
  
- [ ] **Job List** - Jobs for selected date
  - Job cards
  - Time slots
  - Client info
  - Status
  
- [ ] **Availability Controls** - Set availability
  - Toggle availability for date
  - Set time windows
  - Block dates
  - Holiday availability settings
  
- [ ] **Holiday Settings** - Federal holiday controls
  - "Available on holidays" toggle
  - "Enable holiday rate" toggle
  - Per-holiday overrides
  - Holiday rate multiplier display

**Backend API Calls Needed**:
- `GET /cleaner/calendar?month=X&year=Y` - Get calendar data
- `GET /holidays` - Get federal holidays
- `GET /cleaner/holiday-settings` - Get holiday settings
- `PUT /cleaner/holiday-settings` - Update holiday settings
- `GET /cleaner/holiday-overrides` - Get holiday overrides
- `POST /cleaner/holiday-overrides` - Create holiday override

---

#### C. **Job Requests Page** (`/cleaner/jobs/requests`)
**Purpose**: View and accept/decline job requests

**Components to Build**:
- [ ] **Job Request Cards** - Available jobs
  - Client name/rating
  - Job date/time
  - Address
  - Service type
  - Duration
  - Credits offered
  - Distance from cleaner
  - "Accept" button
  - "Decline" button
  - "View Details" link
  
- [ ] **Filters** - Filter job requests
  - Date range
  - Service type
  - Distance
  - Credits range
  
- [ ] **Sort Options** - Sort jobs
  - Date
  - Credits
  - Distance
  - Client rating

**Backend API Calls Needed**:
- `GET /jobs?status=pending&available=true` - Get available jobs
- `POST /jobs/:id/accept` - Accept job
- `POST /jobs/:id/decline` - Decline job

---

#### D. **Earnings Dashboard** (`/cleaner/earnings`)
**Purpose**: Track earnings, payouts, and financial history

**Components to Build**:
- [ ] **Earnings Summary** - Total earnings
  - This week
  - This month
  - All time
  - Pending payouts
  - Available for payout
  
- [ ] **Earnings Chart** - Visual earnings over time
  - Line chart or bar chart
  - Weekly/monthly breakdown
  - Filter by time period
  
- [ ] **Payout History** - Past payouts
  - Payout date
  - Amount
  - Status (completed, pending, failed)
  - Transaction ID
  
- [ ] **Job Earnings List** - Individual job earnings
  - Job date
  - Client
  - Service type
  - Credits earned
  - Status
  - Payout date (if paid)
  
- [ ] **Payout Actions** - Request payouts
  - "Request Payout" button
  - Payout method selector
  - Minimum payout threshold display

**Backend API Calls Needed**:
- `GET /cleaner/earnings` - Get earnings summary
- `GET /cleaner/payouts` - Get payout history
- `GET /cleaner/jobs?status=completed` - Get completed jobs
- `POST /payouts/request` - Request payout

---

#### E. **Cleaner Profile Page** (`/cleaner/profile`)
**Purpose**: Manage cleaner profile and settings

**Components to Build**:
- [ ] **Profile Information** - Personal details
  - Profile photo upload
  - Name
  - Bio
  - Phone
  - Address
  - Years of experience
  - Licenses/certifications
  
- [ ] **Services & Pricing** - Service offerings
  - Service types offered
  - Hourly rates
  - Service area
  - Availability preferences
  
- [ ] **Settings** - Account settings
  - Notification preferences
  - Payment methods
  - Tax information
  - Background check status

**Backend API Calls Needed**:
- `GET /cleaner/profile` - Get profile
- `PUT /cleaner/profile` - Update profile
- `GET /cleaner/services` - Get services
- `PUT /cleaner/services` - Update services

---

### Design Files Needed
- [ ] Dashboard layout wireframes
- [ ] Calendar component design
- [ ] Job request cards design
- [ ] Earnings dashboard design
- [ ] Profile page design
- [ ] Mobile responsive layouts

---

## 3. Build Admin Dashboard

### What This Means
Create the administrative interface for managing the platform, users, jobs, disputes, and analytics.

### Pages/Components Needed

#### A. **Admin Dashboard Home** (`/admin/dashboard`)
**Purpose**: Main admin landing page with overview metrics

**Components to Build**:
- [ ] **Key Metrics Cards** - Platform overview
  - Total users (clients, cleaners)
  - Active jobs
  - Revenue (today/week/month)
  - Pending disputes
  - System health status
  
- [ ] **Charts** - Visual analytics
  - Revenue chart (line/bar)
  - Job volume chart
  - User growth chart
  - Top performing cleaners
  
- [ ] **Recent Activity** - Latest platform events
  - New registrations
  - Job completions
  - Disputes filed
  - Payouts processed
  
- [ ] **Quick Actions** - Common admin tasks
  - "View All Jobs"
  - "Manage Users"
  - "Handle Disputes"
  - "View Analytics"
  - "System Settings"

**Backend API Calls Needed**:
- `GET /admin/dashboard` - Dashboard summary
- `GET /admin/analytics` - Analytics data
- `GET /admin/metrics` - Key metrics

---

#### B. **Jobs Management Page** (`/admin/jobs`)
**Purpose**: View and manage all jobs on the platform

**Components to Build**:
- [ ] **Jobs Table** - List of all jobs
  - Job ID
  - Client name
  - Cleaner name
  - Date/time
  - Status
  - Credits amount
  - Actions (view, edit, cancel)
  
- [ ] **Filters** - Filter jobs
  - Status
  - Date range
  - Client
  - Cleaner
  - Service type
  
- [ ] **Job Details Modal** - View full job details
  - All job information
  - Status history
  - Messages
  - Photos
  - Payment info
  - Admin actions (override, refund, etc.)

**Backend API Calls Needed**:
- `GET /admin/jobs` - Get all jobs
- `GET /admin/jobs/:id` - Get job details
- `PUT /admin/jobs/:id` - Update job
- `POST /admin/jobs/:id/override` - Override job status

---

#### C. **Users Management Page** (`/admin/users`)
**Purpose**: Manage clients and cleaners

**Components to Build**:
- [ ] **Users Table** - List of all users
  - Name
  - Email
  - Role (client/cleaner/admin)
  - Status (active/suspended)
  - Registration date
  - Actions (view, edit, suspend)
  
- [ ] **User Details View** - Full user information
  - Profile details
  - Job history
  - Payment history
  - Reliability score (if cleaner)
  - Risk score
  - Admin actions

**Backend API Calls Needed**:
- `GET /admin/users` - Get all users
- `GET /admin/users/:id` - Get user details
- `PUT /admin/users/:id` - Update user
- `POST /admin/users/:id/suspend` - Suspend user

---

#### D. **Disputes Management Page** (`/admin/disputes`)
**Purpose**: Handle job disputes and resolutions

**Components to Build**:
- [ ] **Disputes List** - All open disputes
  - Job ID
  - Client name
  - Cleaner name
  - Dispute reason
  - Status
  - Created date
  - "Review" button
  
- [ ] **Dispute Review Modal** - Review dispute details
  - Dispute description
  - Job details
  - Photos (before/after)
  - Messages
  - Resolution options:
    - Full refund
    - Partial refund
    - No refund
    - Adjust earnings

**Backend API Calls Needed**:
- `GET /admin/disputes` - Get all disputes
- `GET /admin/disputes/:id` - Get dispute details
- `POST /admin/disputes/:id/resolve` - Resolve dispute

---

#### E. **Analytics Page** (`/admin/analytics`)
**Purpose**: View platform analytics and reports

**Components to Build**:
- [ ] **Revenue Analytics** - Financial metrics
  - Revenue chart
  - Credits purchased
  - Payouts processed
  - Platform fees collected
  
- [ ] **Job Analytics** - Job metrics
  - Jobs created
  - Jobs completed
  - Cancellation rate
  - Average job value
  
- [ ] **User Analytics** - User metrics
  - New registrations
  - Active users
  - Retention rate
  - User growth

**Backend API Calls Needed**:
- `GET /admin/analytics` - Get analytics data
- `GET /admin/analytics/revenue` - Revenue analytics
- `GET /admin/analytics/jobs` - Job analytics
- `GET /admin/analytics/users` - User analytics

---

### Design Files Needed
- [ ] Admin dashboard layout
- [ ] Jobs management table design
- [ ] Users management design
- [ ] Disputes review interface
- [ ] Analytics charts design

---

## 4. Wire Up Authentication

### What This Means
Connect frontend authentication flows to backend JWT authentication system.

### Components Needed

#### A. **Authentication Context/Provider**
**Purpose**: Manage authentication state across the app

**Components to Build**:
- [ ] **AuthContext** - React context for auth state
  - User data
  - Token management
  - Login/logout functions
  - Token refresh logic
  
- [ ] **AuthProvider** - Provider component
  - Wraps app
  - Initializes auth state
  - Handles token storage
  - Auto-refresh tokens

---

#### B. **Login Page** (`/auth/login`)
**Purpose**: User login interface

**Components to Build**:
- [ ] **Login Form** - Email/password form
  - Email input
  - Password input
  - "Remember me" checkbox
  - "Forgot password?" link
  - "Sign In" button
  - "Sign up" link
  
- [ ] **OAuth Buttons** - Social login (if implemented)
  - "Continue with Google"
  - "Continue with Facebook"
  
- [ ] **Error Handling** - Show login errors
  - Invalid credentials
  - Account suspended
  - Network errors
  
- [ ] **Success Handling** - After login
  - Store JWT token
  - Redirect based on role:
    - Client → `/client/dashboard`
    - Cleaner → `/cleaner/dashboard`
    - Admin → `/admin/dashboard`

**Backend API Calls Needed**:
- `POST /auth/login` - Login
- `POST /auth/oauth/google` - Google OAuth (if implemented)
- `POST /auth/oauth/facebook` - Facebook OAuth (if implemented)

---

#### C. **Register Page** (`/auth/register`)
**Purpose**: User registration interface

**Components to Build**:
- [ ] **Registration Form** - Sign up form
  - Role selector (Client/Cleaner)
  - First name
  - Last name
  - Email
  - Password
  - Confirm password
  - Phone (optional for clients, required for cleaners)
  - Terms of Service checkbox
  - "Create Account" button
  
- [ ] **Role-Specific Fields** - Additional fields based on role
  - Cleaner: Background check consent
  - Cleaner: Business information
  
- [ ] **Success Handling** - After registration
  - Auto-login
  - Redirect to onboarding (if cleaner)
  - Redirect to dashboard (if client)

**Backend API Calls Needed**:
- `POST /auth/register` - Register new user

---

#### D. **Protected Route Component**
**Purpose**: Protect routes that require authentication

**Components to Build**:
- [ ] **ProtectedRoute** - Route wrapper
  - Checks if user is authenticated
  - Redirects to login if not
  - Checks user role (if role-specific route)
  - Shows loading state during auth check

---

#### E. **Auth Middleware/Interceptor**
**Purpose**: Automatically add auth token to API requests

**Components to Build**:
- [ ] **API Client** - HTTP client with auth
  - Adds `Authorization: Bearer <token>` header
  - Handles token refresh
  - Handles 401 errors (redirect to login)
  - Base URL configuration

---

#### F. **Logout Functionality**
**Purpose**: Handle user logout

**Components to Build**:
- [ ] **Logout Button** - In header/nav
  - "Logout" button
  - Confirmation (optional)
  - Clear token from storage
  - Redirect to login

**Backend API Calls Needed**:
- `POST /auth/logout` - Logout (optional, can be client-side only)

---

### Design Files Needed
- [ ] Login page design
- [ ] Register page design
- [ ] Auth flow diagrams
- [ ] Error state designs

---

## 5. Test User Flows

### What This Means
Create and execute end-to-end tests for complete user journeys.

### Test Flows Needed

#### A. **Client Booking Flow Test**
**Steps to Test**:
1. [ ] Client registers account
2. [ ] Client logs in
3. [ ] Client navigates to booking page
4. [ ] Client enters address
5. [ ] Client selects date/time
6. [ ] Client selects service type
7. [ ] Client sees price estimate
8. [ ] Client has sufficient credits (or buys credits)
9. [ ] Client submits booking
10. [ ] Client sees confirmation
11. [ ] Client receives email confirmation
12. [ ] Client can view booking status
13. [ ] Client can message cleaner (when assigned)
14. [ ] Client receives job completion notification
15. [ ] Client can approve/dispute job
16. [ ] Client can rate cleaner

**Test Cases**:
- [ ] Happy path (all steps work)
- [ ] Insufficient credits (auto-refill works)
- [ ] Invalid address (error handling)
- [ ] Past date selection (validation)
- [ ] Holiday booking (holiday rate applies)
- [ ] Booking cancellation
- [ ] Payment failure handling

---

#### B. **Cleaner Workflow Test**
**Steps to Test**:
1. [ ] Cleaner registers account
2. [ ] Cleaner completes onboarding
3. [ ] Cleaner sets availability
4. [ ] Cleaner receives job request
5. [ ] Cleaner views job details
6. [ ] Cleaner accepts job
7. [ ] Cleaner navigates to job location
8. [ ] Cleaner checks in (GPS)
9. [ ] Cleaner uploads before photos
10. [ ] Cleaner completes work
11. [ ] Cleaner uploads after photos
12. [ ] Cleaner checks out
13. [ ] Cleaner receives payment
14. [ ] Cleaner can view earnings
15. [ ] Cleaner can request payout

**Test Cases**:
- [ ] Happy path
- [ ] Cleaner declines job
- [ ] Cleaner is late (reliability impact)
- [ ] Cleaner no-shows (penalty)
- [ ] Photo upload fails
- [ ] GPS check-in fails
- [ ] Payout request

---

#### C. **Admin Management Flow Test**
**Steps to Test**:
1. [ ] Admin logs in
2. [ ] Admin views dashboard
3. [ ] Admin views all jobs
4. [ ] Admin views job details
5. [ ] Admin overrides job status (if needed)
6. [ ] Admin views disputes
7. [ ] Admin reviews dispute
8. [ ] Admin resolves dispute (refund/no refund)
9. [ ] Admin views user list
10. [ ] Admin suspends user
11. [ ] Admin views analytics

**Test Cases**:
- [ ] Happy path
- [ ] Dispute resolution (various outcomes)
- [ ] User suspension
- [ ] Job override
- [ ] Analytics data accuracy

---

### Testing Tools Needed
- [ ] **E2E Testing Framework** - Cypress, Playwright, or similar
- [ ] **Test Accounts** - Pre-created test users
- [ ] **Test Data** - Sample jobs, bookings
- [ ] **Mock Services** - Mock payment, email, SMS (for testing)

---

## Summary: What Needs to Be Built

### Pages (15+ pages)
1. Client booking form
2. Booking confirmation
3. Booking status/details
4. Client dashboard
5. Cleaner dashboard
6. Cleaner calendar
7. Cleaner job requests
8. Cleaner earnings
9. Cleaner profile
10. Admin dashboard
11. Admin jobs management
12. Admin users management
13. Admin disputes
14. Admin analytics
15. Login/Register pages

### Components (50+ components)
- Forms (booking, profile, settings)
- Cards (job cards, cleaner cards, stat cards)
- Tables (jobs, users, disputes)
- Charts (earnings, analytics)
- Modals (job details, dispute review)
- Navigation (headers, sidebars)
- Status indicators
- Loading states
- Error states

### Integration Work
- API client setup
- Authentication wiring
- Token management
- Error handling
- Loading states
- Form validation

### Design Work
- Wireframes for all pages
- Component designs
- Mobile responsive layouts
- Error state designs
- Loading state designs
- User flow diagrams

---

## Estimated Effort

**Pages**: 15-20 pages × 4-8 hours = **60-160 hours**  
**Components**: 50+ components × 2-4 hours = **100-200 hours**  
**Integration**: Auth, API, error handling = **40-60 hours**  
**Design**: Wireframes, designs, responsive = **40-80 hours**  
**Testing**: E2E tests, user flows = **40-60 hours**

**Total**: **280-560 hours** (7-14 weeks for 1 developer)

---

**Last Updated**: 2025-01-27  
**Status**: Ready for implementation
