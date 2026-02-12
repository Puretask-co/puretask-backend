# Enhanced Cleaner Onboarding System - Implementation Outline
## Adapted for PureTask (Express/PostgreSQL + Next.js)

**Date**: 2025-01-27  
**Status**: Planning Phase  
**Based On**: Industry best practices (Handy, TaskRabbit, Thumbtack)

---

## 📋 **EXECUTIVE SUMMARY**

Transform the current 5-step basic onboarding into a comprehensive 10-step professional onboarding flow that:
- Ensures legal compliance (agreements, background checks)
- Verifies identity (phone, ID documents)
- Collects essential profile data
- Sets up availability and service areas
- Requires completion before dashboard access

---

## 🔄 **TECH STACK MAPPING**

| Reference Spec | PureTask Implementation |
|----------------|------------------------|
| Supabase Auth | JWT-based custom auth (`src/lib/auth.ts`) |
| Supabase Storage | AWS S3 / Cloudinary (TBD) or local storage |
| Supabase Edge Functions | Express API endpoints (`src/routes/cleaner.ts`) |
| Vite + React 18 | Next.js 16 + React 19 |
| TanStack React Query v5 | ✅ Already using |
| Framer Motion | ✅ Can add if needed |
| shadcn/ui | ✅ Already using custom UI components |

---

## 📊 **DATABASE SCHEMA CHANGES**

### **1. Existing Tables to Enhance**

#### `cleaner_profiles` (Already exists - needs additions)
```sql
-- Add these columns:
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS 
  professional_headline TEXT,
  profile_photo_url TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT false;
```

#### `users` (Already exists - may need phone)
```sql
-- Add if not exists:
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
```

### **2. New Tables to Create**

#### `cleaner_agreements`
```sql
CREATE TABLE IF NOT EXISTS cleaner_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL, -- 'terms_of_service', 'independent_contractor', 'background_check_consent'
  version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaner_agreements_cleaner_id ON cleaner_agreements(cleaner_id);
CREATE INDEX idx_cleaner_agreements_type ON cleaner_agreements(agreement_type);
```

#### `phone_verifications`
```sql
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone_number);
```

#### `id_verifications`
```sql
CREATE TABLE IF NOT EXISTS id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'drivers_license', 'passport', 'state_id'
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_id_verifications_cleaner_id ON id_verifications(cleaner_id);
CREATE INDEX idx_id_verifications_status ON id_verifications(status);
```

#### `background_checks`
```sql
CREATE TABLE IF NOT EXISTS background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'checkr',
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'passed', 'failed'
  report_url TEXT,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_background_checks_cleaner_id ON background_checks(cleaner_id);
CREATE INDEX idx_background_checks_status ON background_checks(status);
```

#### `cleaner_service_areas` (May already exist - verify)
```sql
CREATE TABLE IF NOT EXISTS cleaner_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaner_service_areas_cleaner_id ON cleaner_service_areas(cleaner_id);
CREATE INDEX idx_cleaner_service_areas_zip ON cleaner_service_areas(zip_code);
```

#### `availability_blocks` (May already exist - verify)
```sql
CREATE TABLE IF NOT EXISTS availability_blocks (
  id BIGSERIAL PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_blocks_cleaner_id ON availability_blocks(cleaner_id);
CREATE INDEX idx_availability_blocks_day ON availability_blocks(day_of_week);
```

---

## 🎯 **10-STEP ONBOARDING FLOW**

### **Step 1: Terms & Agreements** ✅
**Purpose**: Legal acceptance of Terms of Service and Independent Contractor Agreement

**Data Saved**:
- `cleaner_agreements` records (types: `terms_of_service`, `independent_contractor`)
- Captures `user_agent` and `ip_address` for audit

**Validation**: Both checkboxes must be checked

**UI Components**:
- `TermsAgreementStep.tsx`
- Checkboxes for ToS and Independent Contractor Agreement
- Links to full legal documents

---

### **Step 2: Basic Info** ✅ (Partially exists)
**Purpose**: Collect cleaner's name, bio, and professional headline

**Data Saved**:
- `cleaner_profiles.first_name`
- `cleaner_profiles.last_name`
- `cleaner_profiles.bio`
- `cleaner_profiles.professional_headline` (NEW)

**Validation**: 
- First name, last name required
- Bio minimum 20 characters
- Professional headline optional but recommended

**UI Components**:
- `BasicInfoStep.tsx` (enhance existing)

---

### **Step 3: Phone Verification** 🆕
**Purpose**: Verify phone number via SMS OTP for account security

**Data Saved**:
- `phone_verifications` table (OTP records)
- `cleaner_profiles.phone_number`
- `cleaner_profiles.phone_verified = true`

**Flow**:
1. User enters US phone number (E.164 format)
2. Backend sends OTP via Twilio
3. User enters 6-digit code
4. Backend verifies OTP
5. Marks profile as phone verified

**API Endpoints**:
- `POST /cleaner/onboarding/phone/send-otp`
- `POST /cleaner/onboarding/phone/verify-otp`

**UI Components**:
- `PhoneVerificationStep.tsx`

---

### **Step 4: Face Photo Upload** ✅ (Partially exists)
**Purpose**: Profile photo for client recognition

**Data Saved**:
- File uploaded to storage (S3/Cloudinary)
- `cleaner_profiles.profile_photo_url`

**Storage Path**: `{user_id}/face-{timestamp}.{ext}`

**Validation**: 
- Image file (JPEG, PNG, WebP)
- Max 5MB
- Face must be visible

**UI Components**:
- `FaceVerificationStep.tsx` (enhance existing)

---

### **Step 5: ID Verification** 🆕
**Purpose**: Government ID for identity verification

**Data Saved**:
- File uploaded to private storage
- `id_verifications` record with `status: 'pending'`

**Storage Path**: `{user_id}/{document_type}-{timestamp}.{ext}`

**Validation**: 
- Image or PDF
- Max 10MB
- Document type selected (drivers_license, passport, state_id)

**UI Components**:
- `IDVerificationStep.tsx`

---

### **Step 6: Background Check Consent** ✅ (Partially exists)
**Purpose**: FCRA authorization for background check

**Data Saved**:
- `cleaner_agreements` record (type: `background_check_consent`)
- `background_checks` record with `status: 'pending'`

**Validation**: Both FCRA consent and accuracy checkboxes

**UI Components**:
- `BackgroundCheckConsentStep.tsx` (enhance existing)

---

### **Step 7: Service Areas** 🆕
**Purpose**: Define zip codes where cleaner works

**Data Saved**:
- `cleaner_service_areas` records (zip codes)
- `cleaner_profiles.travel_radius_km` (update if needed)

**Validation**: 
- At least 1 zip code
- Valid 5-digit US format

**UI Components**:
- `ServiceAreaStep.tsx`

---

### **Step 8: Availability** ✅ (Partially exists)
**Purpose**: Set weekly working schedule

**Data Saved**:
- `availability_blocks` records for each enabled day

**Features**:
- Quick templates: "Weekdays 9-5", "Flexible", "Weekends Only"
- Day-by-day toggle with time pickers
- Time slots from 6:00 AM to 9:00 PM

**Validation**: At least 1 day enabled

**UI Components**:
- `AvailabilityStep.tsx` (enhance existing)

---

### **Step 9: Rates** ✅ (Partially exists)
**Purpose**: Set hourly rate and confirm travel radius

**Data Saved**:
- `cleaner_profiles.hourly_rate_credits`
- `cleaner_profiles.travel_radius_km`

**Validation**: 
- Rate between $20-$100 (or equivalent credits)
- Radius 5-50km

**UI Components**:
- `RatesStep.tsx` (enhance existing)

---

### **Step 10: Review & Complete** 🆕
**Purpose**: Final summary before activation

**Displays**:
- Profile photo preview
- Name and bio
- Hourly rate and travel radius
- Service areas count
- Available days count
- Checklist of completed items

**Data Saved on "Activate"**:
- `cleaner_profiles.onboarding_completed_at = now()`

**UI Components**:
- `OnboardingReviewStep.tsx`
- `OnboardingComplete.tsx` (success state)

---

## 📁 **FILE STRUCTURE**

### **Frontend (Next.js)**
```
src/
├── app/
│   └── cleaner/
│       └── onboarding/
│           └── page.tsx                    # Main onboarding wizard
├── components/
│   └── onboarding/
│       ├── TermsAgreementStep.tsx          # Step 1
│       ├── BasicInfoStep.tsx              # Step 2 (enhance)
│       ├── PhoneVerificationStep.tsx      # Step 3 (NEW)
│       ├── FaceVerificationStep.tsx       # Step 4 (enhance)
│       ├── IDVerificationStep.tsx          # Step 5 (NEW)
│       ├── BackgroundCheckConsentStep.tsx # Step 6 (enhance)
│       ├── ServiceAreaStep.tsx             # Step 7 (NEW)
│       ├── AvailabilityStep.tsx            # Step 8 (enhance)
│       ├── RatesStep.tsx                   # Step 9 (enhance)
│       ├── OnboardingReviewStep.tsx        # Step 10 (NEW)
│       ├── OnboardingComplete.tsx          # Success (NEW)
│       └── OnboardingProgress.tsx           # Progress indicator
├── hooks/
│   ├── useCleanerOnboarding.ts            # Main onboarding state/mutations
│   ├── useCleanerAgreements.ts            # Agreement tracking
│   ├── useCleanerProfile.ts                # Profile data (enhance)
│   ├── usePhoneVerification.ts            # Phone OTP (NEW)
│   └── useUserProfile.ts                   # Onboarding status check (enhance)
└── lib/
    └── api/
        └── cleanerOnboarding.ts            # API client functions
```

### **Backend (Express)**
```
src/
├── routes/
│   └── cleaner.ts                         # Enhance existing
│       ├── POST /cleaner/onboarding/phone/send-otp
│       ├── POST /cleaner/onboarding/phone/verify-otp
│       ├── POST /cleaner/onboarding/agreements
│       ├── POST /cleaner/onboarding/basic-info
│       ├── POST /cleaner/onboarding/phone-verify
│       ├── POST /cleaner/onboarding/face-photo
│       ├── POST /cleaner/onboarding/id-verification
│       ├── POST /cleaner/onboarding/background-consent
│       ├── POST /cleaner/onboarding/service-areas
│       ├── POST /cleaner/onboarding/availability
│       ├── POST /cleaner/onboarding/rates
│       └── POST /cleaner/onboarding/complete
├── services/
│   ├── cleanerOnboardingService.ts        # NEW
│   ├── phoneVerificationService.ts        # NEW
│   └── fileUploadService.ts               # NEW or enhance
└── middleware/
    └── requireOnboardingComplete.ts      # NEW - route protection
```

---

## 🔐 **ROUTE PROTECTION**

### **Middleware: `requireOnboardingComplete`**
```typescript
// Redirect cleaners who haven't completed onboarding
if (user.role === 'cleaner' && !cleanerProfile.onboarding_completed_at) {
  if (req.path !== '/cleaner/onboarding') {
    return res.redirect('/cleaner/onboarding');
  }
}
```

### **Frontend: `ProtectedRoute` Enhancement**
```typescript
// Check onboarding status
const needsOnboarding = role === 'cleaner' && 
  !cleanerProfile?.onboarding_completed_at;

if (needsOnboarding && pathname !== '/cleaner/onboarding') {
  return <Navigate to="/cleaner/onboarding" replace />;
}
```

---

## 📱 **UI/UX FEATURES**

### **Progress Indicator**
- Visual progress bar (0-100%)
- Step dots with completion status
- Step numbers (1/10, 2/10, etc.)

### **Navigation**
- Back button on all steps (except first)
- Continue button (disabled until validation passes)
- Skip option for optional steps (if applicable)

### **Form Validation**
- Real-time validation
- Error messages below fields
- Disabled continue button until valid

### **Loading States**
- Spinner during API calls
- Disabled buttons during submission
- Success/error toast notifications

### **Mobile Responsive**
- Full mobile support
- Touch-friendly inputs
- Responsive layout

### **Quick Templates** (Availability Step)
- "Weekdays 9-5"
- "Flexible" (all days, 8 AM - 8 PM)
- "Weekends Only"
- Custom (day-by-day)

---

## 🔧 **API ENDPOINTS SPECIFICATION**

### **1. Phone Verification**
```typescript
POST /cleaner/onboarding/phone/send-otp
Body: { phone_number: string }
Response: { success: boolean }

POST /cleaner/onboarding/phone/verify-otp
Body: { phone_number: string, otp_code: string }
Response: { success: boolean, verified: boolean }
```

### **2. Agreements**
```typescript
POST /cleaner/onboarding/agreements
Body: { 
  terms_of_service: boolean,
  independent_contractor: boolean 
}
Response: { success: boolean }
```

### **3. Basic Info**
```typescript
POST /cleaner/onboarding/basic-info
Body: { 
  first_name: string,
  last_name: string,
  bio: string,
  professional_headline?: string
}
Response: { success: boolean, profile: CleanerProfile }
```

### **4. Face Photo**
```typescript
POST /cleaner/onboarding/face-photo
Body: FormData { file: File }
Response: { success: boolean, profile_photo_url: string }
```

### **5. ID Verification**
```typescript
POST /cleaner/onboarding/id-verification
Body: FormData { 
  file: File,
  document_type: 'drivers_license' | 'passport' | 'state_id'
}
Response: { success: boolean, id_verification_id: string }
```

### **6. Background Check Consent**
```typescript
POST /cleaner/onboarding/background-consent
Body: { 
  fcra_consent: boolean,
  accuracy_consent: boolean 
}
Response: { success: boolean, background_check_id: string }
```

### **7. Service Areas**
```typescript
POST /cleaner/onboarding/service-areas
Body: { 
  zip_codes: string[],
  travel_radius_km: number
}
Response: { success: boolean }
```

### **8. Availability**
```typescript
POST /cleaner/onboarding/availability
Body: { 
  blocks: Array<{
    day_of_week: number,
    start_time: string,
    end_time: string,
    is_active: boolean
  }>
}
Response: { success: boolean }
```

### **9. Rates**
```typescript
POST /cleaner/onboarding/rates
Body: { 
  hourly_rate_credits: number,
  travel_radius_km: number
}
Response: { success: boolean }
```

### **10. Complete Onboarding**
```typescript
POST /cleaner/onboarding/complete
Body: {}
Response: { 
  success: boolean,
  onboarding_completed_at: string,
  redirect_to: '/cleaner/dashboard'
}
```

---

## 🗄️ **STORAGE STRATEGY**

### **Option 1: AWS S3** (Recommended for production)
- Bucket: `puretask-cleaner-documents`
- Public folder: `profile-photos/{user_id}/`
- Private folder: `identity-documents/{user_id}/`
- Use AWS SDK for uploads

### **Option 2: Cloudinary** (Alternative)
- Public folder: `profile-photos`
- Private folder: `identity-documents`
- Automatic image optimization

### **Option 3: Local Storage** (Development only)
- Store in `uploads/` directory
- Not recommended for production

---

## ✅ **IMPLEMENTATION CHECKLIST**

### **Phase 1: Database & Backend**
- [ ] Create database migration for new tables
- [ ] Add columns to `cleaner_profiles`
- [ ] Create `cleaner_agreements` table
- [ ] Create `phone_verifications` table
- [ ] Create `id_verifications` table
- [ ] Create `background_checks` table
- [ ] Create `cleaner_service_areas` table (if not exists)
- [ ] Create `availability_blocks` table (if not exists)
- [ ] Create API endpoints for all 10 steps
- [ ] Implement phone OTP service (Twilio integration)
- [ ] Implement file upload service
- [ ] Create `requireOnboardingComplete` middleware
- [ ] Add route protection logic

### **Phase 2: Frontend Components**
- [ ] Create `OnboardingProgress` component
- [ ] Create `TermsAgreementStep` component
- [ ] Enhance `BasicInfoStep` component
- [ ] Create `PhoneVerificationStep` component
- [ ] Enhance `FaceVerificationStep` component
- [ ] Create `IDVerificationStep` component
- [ ] Enhance `BackgroundCheckConsentStep` component
- [ ] Create `ServiceAreaStep` component
- [ ] Enhance `AvailabilityStep` component
- [ ] Enhance `RatesStep` component
- [ ] Create `OnboardingReviewStep` component
- [ ] Create `OnboardingComplete` component

### **Phase 3: Hooks & State Management**
- [ ] Create `useCleanerOnboarding` hook
- [ ] Create `useCleanerAgreements` hook
- [ ] Create `usePhoneVerification` hook
- [ ] Enhance `useCleanerProfile` hook
- [ ] Enhance `useUserProfile` hook for onboarding check
- [ ] Create API client functions

### **Phase 4: Integration & Testing**
- [ ] Integrate all steps into main onboarding page
- [ ] Add route protection to `ProtectedRoute`
- [ ] Test complete flow end-to-end
- [ ] Test phone verification flow
- [ ] Test file uploads
- [ ] Test validation and error handling
- [ ] Test mobile responsiveness
- [ ] Test onboarding completion redirect

### **Phase 5: Polish & Documentation**
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success animations
- [ ] Add toast notifications
- [ ] Update documentation
- [ ] Create user guide

---

## 🚀 **NEXT STEPS**

1. **Review this outline** with team
2. **Approve database schema changes**
3. **Choose storage solution** (S3/Cloudinary)
4. **Begin Phase 1** (Database & Backend)
5. **Iterate through phases** systematically

---

**Status**: ✅ Outline Complete - Ready for Implementation  
**Estimated Time**: 2-3 weeks for full implementation  
**Priority**: High (Critical for cleaner onboarding)
