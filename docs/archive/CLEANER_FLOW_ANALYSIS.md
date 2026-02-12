# Cleaner Flow - Complete Analysis & Requirements

**Date**: 2025-01-27  
**Purpose**: Analyze all requirements for incomplete cleaner flow pages

---

## 📋 **ANALYSIS: What Cleaners Need**

Based on the cleaner guide and backend APIs, cleaners need:

### 1. **Cleaner Calendar Page** (`/cleaner/calendar`)
**Current Status**: Partially built (has holiday settings, needs full calendar)

**What's Needed**:
- ✅ Holiday settings (already built)
- ❌ Full calendar view with:
  - Monthly/weekly calendar grid
  - Bookings displayed on dates
  - Availability toggles per day
  - Time off management
  - Service area display
- ❌ Availability management:
  - Weekly schedule (Mon-Sun with time slots)
  - Block/unblock dates
  - Set time windows
  - View conflicts

**Backend APIs Available**:
- `GET /cleaner/availability` - Get availability
- `PUT /cleaner/availability` - Update availability
- `GET /cleaner/schedule` - Get schedule
- `GET /cleaner/time-off` - Get time off
- `POST /cleaner/time-off` - Add time off
- `DELETE /cleaner/time-off/:id` - Delete time off
- `GET /jobs` - Get assigned jobs (for calendar display)

---

### 2. **Cleaner Job Requests Page** (`/cleaner/jobs/requests`)
**Current Status**: Not built

**What's Needed**:
- List of available jobs (jobs without assigned cleaner)
- Job details for each:
  - Client name/rating
  - Date/time
  - Address
  - Service type
  - Duration
  - Credits offered
  - Distance from cleaner
  - Special instructions
- Accept/Decline buttons
- Filters:
  - Date range
  - Service type
  - Distance
  - Credits range
- Sort options:
  - Date
  - Credits
  - Distance

**Backend APIs Available**:
- `GET /jobs` - Returns `{ assigned, available }` for cleaners
- `POST /jobs/:jobId/transition` with `event_type: "job_accepted"` - Accept job
- `GET /jobs/:jobId` - Get job details

**Note**: To decline, cleaner simply doesn't accept (no explicit decline endpoint needed, but can add one if needed)

---

### 3. **Cleaner Earnings Page** (`/cleaner/earnings`)
**Current Status**: Not built

**What's Needed**:
- Earnings Summary:
  - Pending earnings (credits + USD)
  - Paid out (credits + USD)
  - Next payout date
  - Payout schedule
- Earnings Chart:
  - Earnings over time (line/bar chart)
  - Weekly/monthly breakdown
- Payout History:
  - List of past payouts
  - Payout date
  - Amount
  - Status
  - Transaction ID
- Job Earnings List:
  - Individual job earnings
  - Job date
  - Client
  - Service type
  - Credits earned
  - Status (pending/paid)
  - Payout date (if paid)
- Payout Actions:
  - Request payout button (if instant payout available)
  - Payout method display
  - Minimum payout threshold

**Backend APIs Available**:
- `GET /cleaner/earnings` - Returns earnings summary
- `GET /cleaner/payouts` - Returns payout history
- `GET /jobs` with status=completed - Get completed jobs for earnings list

---

## 🎯 **IMPLEMENTATION PLAN**

### Page 1: Complete Cleaner Calendar
**Components Needed**:
1. Calendar grid component (monthly view)
2. Availability editor (weekly schedule)
3. Time off manager
4. Booking display on calendar
5. Holiday indicators (already have)

**Features**:
- View calendar by month
- See all bookings on calendar
- Set weekly availability (Mon-Sun time slots)
- Block dates (time off)
- View conflicts
- Holiday settings (already built)

---

### Page 2: Build Job Requests Page
**Components Needed**:
1. Job request cards
2. Filters component
3. Sort dropdown
4. Accept/Decline modals
5. Job details modal

**Features**:
- List available jobs
- Filter and sort
- Accept job (transitions to "accepted")
- View job details
- See distance/credits

---

### Page 3: Build Earnings Page
**Components Needed**:
1. Earnings summary cards
2. Earnings chart
3. Payout history table
4. Job earnings list
5. Request payout button

**Features**:
- View earnings summary
- See earnings trends
- View payout history
- See per-job earnings
- Request payout (if available)

---

## 📊 **BACKEND API MAPPING**

### Calendar APIs:
```
GET  /cleaner/availability          → Get weekly availability
PUT  /cleaner/availability          → Update weekly availability
GET  /cleaner/schedule              → Get schedule (bookings)
GET  /cleaner/time-off              → Get time off entries
POST /cleaner/time-off              → Add time off
DELETE /cleaner/time-off/:id       → Delete time off
GET  /jobs                          → Get assigned jobs (for calendar)
```

### Job Requests APIs:
```
GET  /jobs                          → Get available jobs (returns { available })
GET  /jobs/:jobId                   → Get job details
POST /jobs/:jobId/transition        → Accept job (event_type: "job_accepted")
```

### Earnings APIs:
```
GET  /cleaner/earnings              → Get earnings summary
GET  /cleaner/payouts               → Get payout history
GET  /jobs?status=completed         → Get completed jobs
```

---

## 🚀 **READY TO BUILD**

All backend APIs are ready. Now building all 3 pages...
