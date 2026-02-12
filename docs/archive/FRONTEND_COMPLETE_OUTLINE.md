# PureTask Frontend - Complete Outline & Explanation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Pages & Routes](#pages--routes)
5. [Components](#components)
6. [Hooks](#hooks)
7. [Contexts](#contexts)
8. [Libraries & Utilities](#libraries--utilities)
9. [Features & Functionality](#features--functionality)
10. [Configuration](#configuration)

---

## 🎯 Project Overview

**PureTask Frontend** is a comprehensive Next.js 16 application built with React 19 and TypeScript, providing a full-featured platform for connecting clients with professional cleaners. The application supports three user roles: **Clients**, **Cleaners**, and **Admins**, each with their own dedicated interfaces and workflows.

### Key Characteristics
- **Framework**: Next.js 16.1.1 (App Router)
- **React Version**: 19.2.3
- **TypeScript**: Full type safety throughout
- **Styling**: Tailwind CSS 4
- **State Management**: React Query (TanStack Query) + Zustand
- **Form Handling**: React Hook Form + Zod validation
- **Real-time**: WebSocket support via Socket.io
- **Mobile-First**: Fully responsive with mobile optimizations

---

## 🛠 Technology Stack

### Core Dependencies
- **Next.js 16.1.1** - React framework with App Router
- **React 19.2.3** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS framework
- **TanStack React Query 5.90.16** - Server state management
- **Zustand 5.0.9** - Client state management
- **Axios 1.13.2** - HTTP client
- **React Hook Form 7.71.1** - Form management
- **Zod 4.3.6** - Schema validation
- **Socket.io Client 4.8.3** - WebSocket communication
- **Lucide React 0.562.0** - Icon library

### Development Tools
- **Jest 30.2.0** - Testing framework
- **Testing Library** - Component testing
- **ESLint** - Code linting
- **Playwright** - E2E testing
- **MSW** - API mocking

---

## 📁 Project Structure

```
puretask-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages (75 pages)
│   │   ├── admin/              # Admin dashboard & tools (20+ pages)
│   │   ├── auth/               # Authentication pages
│   │   ├── booking/            # Booking flow
│   │   ├── cleaner/            # Cleaner pages (15+ pages)
│   │   ├── client/             # Client pages (5+ pages)
│   │   ├── messages/           # Messaging system
│   │   ├── search/             # Search & browse
│   │   └── [various]/          # Shared pages (help, terms, etc.)
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # 30+ reusable UI components
│   │   ├── features/            # Feature-specific components
│   │   ├── layout/             # Layout components
│   │   ├── forms/              # Form components
│   │   ├── onboarding/         # Onboarding wizard (12 components)
│   │   ├── admin/              # Admin-specific components
│   │   ├── mobile/            # Mobile-optimized components
│   │   └── [others]/           # Various feature components
│   │
│   ├── hooks/                  # 17 custom React hooks
│   ├── contexts/               # 5 React contexts
│   ├── lib/                    # Utilities & helpers
│   │   ├── api/               # API client functions
│   │   ├── mobile/            # Mobile utilities
│   │   ├── seo/               # SEO utilities
│   │   ├── validation/        # Validation schemas
│   │   └── [others]/          # Various utilities
│   │
│   ├── services/               # Service layer
│   ├── types/                  # TypeScript type definitions
│   ├── styles/                 # Global styles
│   └── tests/                 # Test files
│
├── public/                     # Static assets
├── scripts/                    # Build & audit scripts
└── [config files]              # Next.js, TypeScript, Tailwind configs
```

---

## 📄 Pages & Routes

### **Public Pages** (No Auth Required)
1. **`/`** - Landing/home page
2. **`/auth/login`** - User login
3. **`/auth/register`** - User registration
4. **`/auth/forgot-password`** - Password reset
5. **`/terms`** - Terms of Service
6. **`/privacy`** - Privacy Policy
7. **`/help`** - Help & Support
8. **`/search`** - Public cleaner search/browse

### **Client Pages** (Role: Client)
1. **`/client/dashboard`** - Client dashboard with stats
2. **`/client/bookings`** - List of all bookings
3. **`/client/bookings/[id]`** - Individual booking details
4. **`/client/recurring`** - Recurring booking management
5. **`/client/settings`** - Client account settings
6. **`/booking`** - Create new booking
7. **`/booking/confirm/[id]`** - Booking confirmation
8. **`/favorites`** - Saved favorite cleaners
9. **`/reviews`** - Reviews management
10. **`/messages`** - Messaging with cleaners
11. **`/notifications`** - Notification center

### **Cleaner Pages** (Role: Cleaner)
1. **`/cleaner/dashboard`** - Cleaner dashboard with stats
2. **`/cleaner/onboarding`** - 10-step onboarding wizard
3. **`/cleaner/profile`** - Profile management
4. **`/cleaner/jobs`** - Job management
5. **`/cleaner/jobs/[id]`** - Individual job details
6. **`/cleaner/jobs/requests`** - Job requests/invitations
7. **`/cleaner/availability`** - Availability schedule
8. **`/cleaner/calendar`** - Calendar view
9. **`/cleaner/earnings`** - Earnings & payouts
10. **`/cleaner/certifications`** - Certifications management
11. **`/cleaner/leaderboard`** - Leaderboard & rankings
12. **`/cleaner/progress`** - Progress tracking
13. **`/cleaner/team`** - Team management
14. **`/cleaner/[id]`** - Public cleaner profile view
15. **`/cleaner/ai-assistant`** - AI Assistant main page
16. **`/cleaner/ai-assistant/settings`** - AI settings
17. **`/cleaner/ai-assistant/templates`** - Message templates
18. **`/cleaner/ai-assistant/templates/new`** - Create template
19. **`/cleaner/ai-assistant/quick-responses`** - Quick responses
20. **`/cleaner/ai-assistant/history`** - Message history
21. **`/cleaner/ai-assistant/saved`** - Saved messages
22. **`/cleaner/ai-assistant/analytics`** - AI analytics

### **Admin Pages** (Role: Admin)
1. **`/admin/dashboard`** - Admin dashboard with system stats
2. **`/admin/users`** - User management
3. **`/admin/bookings`** - All bookings management
4. **`/admin/disputes`** - Dispute resolution
5. **`/admin/finance`** - Financial management
6. **`/admin/analytics`** - Analytics & reporting
7. **`/admin/reports`** - Custom reports
8. **`/admin/communication`** - Communication tools
9. **`/admin/risk`** - Risk management
10. **`/admin/settings`** - System settings
11. **`/admin/api`** - API management
12. **`/admin/id-verifications`** - ID verification dashboard (NEW)
13. **`/admin/tools`** - Admin tools index
14. **`/admin/tools/ai-settings`** - AI settings management
15. **`/admin/tools/ai-personality`** - AI personality wizard
16. **`/admin/tools/onboarding-wizard`** - Onboarding wizard preview
17. **`/admin/tools/insights`** - Insights dashboard
18. **`/admin/tools/certifications`** - Certifications management
19. **`/admin/tools/achievements`** - Achievements management
20. **`/admin/tools/leaderboard`** - Leaderboard management
21. **`/admin/tools/quick-responses`** - Quick responses management
22. **`/admin/tools/template-creator`** - Template creator
23. **`/admin/tools/template-editor`** - Template editor
24. **`/admin/tools/template-library`** - Template library
25. **`/admin/tools/test-ai-assistant`** - AI assistant testing
26. **`/admin/tools/legacy-admin-layout`** - Legacy layout preview
27. **`/admin/tools/legacy-admin-login`** - Legacy login preview
28. **`/admin/tools/settings-card`** - Settings card component
29. **`/admin/tools/tooltips`** - Tooltips component

### **Shared Pages**
1. **`/dashboard`** - Role-based dashboard redirect
2. **`/messages`** - Universal messaging (all roles)
3. **`/notifications`** - Universal notifications (all roles)
4. **`/reviews`** - Reviews (all roles)
5. **`/referral`** - Referral program
6. **`/api-test`** - API testing page (dev)

---

## 🧩 Components

### **UI Components** (`src/components/ui/` - 30+ components)
1. **AnimatedCard** - Card with animations
2. **Avatar** - User avatar display
3. **BackButton** - Navigation back button
4. **Badge** - Status badges
5. **Button** - Button component with variants
6. **Card** - Card container (CardHeader, CardContent, CardFooter)
7. **Charts** - Chart components
8. **ConfirmDialog** - Confirmation dialogs
9. **DarkModeToggle** - Dark mode toggle
10. **DatePicker** - Date selection
11. **Dropdown** - Dropdown menus
12. **EmptyState** - Empty state displays
13. **Input** - Form input with mobile optimization
14. **LazyComponent** - Lazy loading wrapper
15. **LazyImage** - Lazy-loaded images
16. **Loading** - Loading states
17. **LoadingSpinner** - Spinner component
18. **Modal** - Modal dialogs
19. **PageTransition** - Page transition animations
20. **Progress** - Progress bars
21. **ProgressBar** - Progress indicators
22. **Rating** - Star ratings
23. **RoleBadge** - Role badges
24. **Skeleton** - Skeleton loaders
25. **Table** - Data tables
26. **Tabs** - Tab navigation
27. **TimePicker** - Time selection
28. **Toast** - Toast notifications
29. **ToastContainer** - Toast container
30. **Toggle** - Toggle switches
31. **Tooltip** - Tooltips

### **Layout Components** (`src/components/layout/`)
1. **Header** - Main header/navbar
2. **Footer** - Site footer
3. **Sidebar** - Sidebar navigation
4. **MobileNav** - Mobile navigation menu
5. **BottomNav** - Bottom navigation bar (mobile)
6. **DashboardLayout** - Dashboard layout wrapper
7. **SkipNav** - Skip navigation link (a11y)

### **Form Components** (`src/components/forms/`)
1. **FormField** - Form field wrapper
2. **ErrorMessage** - Error message display
3. **FileUpload** - File upload component

### **Onboarding Components** (`src/components/onboarding/` - 12 components)
1. **OnboardingWizard** - Main wizard container
2. **OnboardingProgress** - Progress indicator
3. **TermsAgreementStep** - Step 1: Terms & Agreements
4. **BasicInfoStep** - Step 2: Basic Information
5. **PhoneVerificationStep** - Step 3: Phone Verification
6. **FaceVerificationStep** - Step 4: Face Photo Upload
7. **IDVerificationStep** - Step 5: ID Verification
8. **BackgroundCheckConsentStep** - Step 6: Background Check
9. **ServiceAreaStep** - Step 7: Service Areas
10. **AvailabilityStep** - Step 8: Availability
11. **RatesStep** - Step 9: Rates & Pricing
12. **OnboardingReviewStep** - Step 10: Review & Complete
13. **OnboardingComplete** - Completion screen

### **Feature Components** (`src/components/features/`)
- **admin/** - Admin-specific components
- **auth/** - Authentication components
- **booking/** - Booking flow components
- **cleaner/** - Cleaner-specific components
- **dashboard/** - Dashboard components
- **landing/** - Landing page components
- **messages/** - Messaging components
- **messaging/** - Messaging UI
- **notifications/** - Notification components
- **profile/** - Profile components
- **reviews/** - Review components
- **search/** - Search components
- **StatsCard** - Statistics card

### **Mobile Components** (`src/components/mobile/`)
1. **LazyImage** - Mobile-optimized images
2. **MobileInput** - Mobile-optimized inputs
3. **MobileTable** - Mobile-friendly tables
4. **PullToRefresh** - Pull-to-refresh functionality

### **Other Components**
- **ErrorBoundary** - Error boundary wrapper
- **ErrorDisplay** - Error display component
- **RetryButton** - Retry action button
- **ProtectedRoute** - Route protection wrapper
- **RoleGuard** - Role-based access guard
- **NotificationCenter** - Notification center
- **GlobalSearch** - Global search component
- **SearchAutocomplete** - Search autocomplete
- **MapView** - Map integration
- **AnalyticsInitializer** - Analytics setup
- **StructuredData** - SEO structured data

---

## 🎣 Hooks (`src/hooks/` - 17 hooks)

1. **useAdmin** - Admin operations & data
2. **useAnalytics** - Analytics tracking
3. **useBookings** - Booking management
4. **useCleanerAvailability** - Cleaner availability
5. **useCleanerEarnings** - Cleaner earnings & payouts
6. **useCleanerJobs** - Cleaner job management
7. **useCleanerOnboarding** - Onboarding flow state
8. **useCleaners** - Cleaner data & search
9. **useClientEnhanced** - Enhanced client features
10. **useErrorHandler** - Error handling
11. **useFormValidation** - Form validation
12. **useMessages** - Messaging functionality
13. **useMobile** - Mobile detection & utilities
14. **useNotifications** - Notification management
15. **useOnlineStatus** - Online/offline detection
16. **useProfile** - User profile management
17. **useSwipe** / **useSwipeGesture** - Swipe gestures

---

## 🔄 Contexts (`src/contexts/` - 5 contexts)

1. **AuthContext** - Authentication state & user data
2. **NotificationContext** - Notification state
3. **QueryProvider** - React Query provider setup
4. **ToastContext** - Toast notification state
5. **WebSocketContext** - WebSocket connection & real-time updates

---

## 📚 Libraries & Utilities (`src/lib/`)

### **API Layer** (`src/lib/api/`)
- **api.ts** - Main API client (Axios instance)
- **cleanerOnboarding.ts** - Onboarding API functions

### **Mobile Utilities** (`src/lib/mobile/`)
1. **gestures.ts** - Swipe gesture detection
2. **inputTypes.ts** - Mobile input type configuration
3. **performance.ts** - Mobile performance utilities
4. **touchTargets.ts** - Touch target sizing
5. **viewport.ts** - Viewport configuration

### **SEO Utilities** (`src/lib/seo/`)
- **metadata.ts** - SEO metadata generation
- **seo.ts** - SEO helpers

### **Validation** (`src/lib/validation/`)
- **schemas.ts** - Zod validation schemas

### **Other Utilities**
- **analytics.ts** - Analytics tracking
- **errorHandler.ts** - Error handling
- **errorTracking.ts** - Error tracking (Sentry-ready)
- **offline.ts** - Offline detection & request queuing
- **performance.ts** - Performance monitoring
- **retry.ts** - Retry logic with exponential backoff
- **roleRouting.ts** - Role-based routing
- **utils.ts** - General utilities
- **colors.ts** - Color utilities
- **config.ts** - Configuration
- **config/env.ts** - Environment variables
- **config/featureFlags.ts** - Feature flags
- **monitoring/performance.ts** - Performance monitoring
- **monitoring/sentry.ts** - Sentry integration

---

## ✨ Features & Functionality

### **1. Authentication & Authorization**
- ✅ User registration (email/password)
- ✅ Login/logout
- ✅ Password reset
- ✅ Role-based access control (Client, Cleaner, Admin)
- ✅ Protected routes
- ✅ JWT token management
- ✅ Session persistence

### **2. Client Features**
- ✅ Dashboard with stats
- ✅ Booking creation & management
- ✅ Recurring bookings
- ✅ Favorite cleaners
- ✅ Reviews & ratings
- ✅ Messaging with cleaners
- ✅ Payment management
- ✅ Address management
- ✅ Notification center

### **3. Cleaner Features**
- ✅ 10-step onboarding wizard
- ✅ Profile management
- ✅ Job management (accept/decline/complete)
- ✅ Availability scheduling
- ✅ Calendar view
- ✅ Earnings & payout tracking
- ✅ Certifications management
- ✅ Leaderboard & rankings
- ✅ Progress tracking
- ✅ Team management
- ✅ AI Assistant for messaging
- ✅ Message templates
- ✅ Quick responses
- ✅ Message history & analytics

### **4. Admin Features**
- ✅ Dashboard with system stats
- ✅ User management
- ✅ Booking management
- ✅ Dispute resolution
- ✅ Financial management
- ✅ Analytics & reporting
- ✅ Risk management
- ✅ Communication tools
- ✅ ID verification dashboard
- ✅ AI settings management
- ✅ System settings
- ✅ API management

### **5. Booking System**
- ✅ Booking creation flow
- ✅ Real-time price calculator
- ✅ Service selection
- ✅ Date/time selection
- ✅ Address management
- ✅ Payment processing
- ✅ Booking confirmation
- ✅ Status tracking
- ✅ Cancellation handling

### **6. Messaging System**
- ✅ Real-time messaging (WebSocket)
- ✅ Message history
- ✅ File attachments
- ✅ Read receipts
- ✅ AI-powered message suggestions
- ✅ Quick responses
- ✅ Message templates

### **7. Search & Discovery**
- ✅ Cleaner search/browse
- ✅ Filtering (location, price, rating)
- ✅ Sorting options
- ✅ Cleaner profile views
- ✅ Global search
- ✅ Search autocomplete

### **8. Mobile Optimization**
- ✅ Mobile-first responsive design
- ✅ Touch-optimized interactions
- ✅ Mobile navigation (bottom nav)
- ✅ Pull-to-refresh
- ✅ Swipe gestures
- ✅ Mobile-optimized inputs
- ✅ Mobile-friendly tables
- ✅ Viewport configuration

### **9. Onboarding System**
- ✅ 10-step guided onboarding
- ✅ Progress persistence (resume where left off)
- ✅ Phone verification (OTP)
- ✅ File uploads (photos, documents)
- ✅ Background check consent
- ✅ Service area selection
- ✅ Availability setup
- ✅ Rate configuration
- ✅ Review & completion

### **10. Performance & Optimization**
- ✅ Code splitting
- ✅ Lazy loading
- ✅ Image optimization
- ✅ Bundle size optimization
- ✅ Performance monitoring
- ✅ Caching strategies

### **11. Accessibility (a11y)**
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Color contrast compliance
- ✅ Focus management
- ✅ Skip navigation links

### **12. SEO**
- ✅ Meta tags
- ✅ Open Graph tags
- ✅ Structured data (JSON-LD)
- ✅ Sitemap generation
- ✅ Canonical URLs
- ✅ robots.txt

### **13. Error Handling**
- ✅ Error boundaries
- ✅ Retry mechanisms
- ✅ User-friendly error messages
- ✅ Error logging
- ✅ Offline detection
- ✅ Request queuing

### **14. Analytics & Monitoring**
- ✅ Google Analytics integration
- ✅ Event tracking
- ✅ Performance monitoring
- ✅ Error tracking (Sentry-ready)
- ✅ User behavior tracking

### **15. Testing Infrastructure**
- ✅ Jest unit tests
- ✅ React Testing Library
- ✅ Playwright E2E tests
- ✅ MSW API mocking
- ✅ Test helpers & mocks
- ✅ Coverage reporting

---

## ⚙️ Configuration

### **Next.js Configuration**
- App Router enabled
- TypeScript strict mode
- Image optimization
- Environment variables
- API routes (if needed)

### **Tailwind Configuration**
- Custom color palette
- Responsive breakpoints
- Custom utilities
- Dark mode support

### **TypeScript Configuration**
- Strict type checking
- Path aliases (@/ for src/)
- Type definitions

### **Environment Variables**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Maps API key

---

## 📊 Statistics

- **Total Pages**: 75+ pages
- **Components**: 100+ components
- **Hooks**: 17 custom hooks
- **Contexts**: 5 React contexts
- **API Endpoints**: Integrated with backend
- **Routes**: Fully protected with role-based access
- **Mobile Support**: Fully responsive
- **Accessibility**: WCAG compliant
- **Performance**: Optimized with lazy loading & code splitting

---

## 🎯 Key Highlights

1. **Comprehensive Role Support**: Full-featured interfaces for Clients, Cleaners, and Admins
2. **Mobile-First**: Optimized for all device sizes with mobile-specific components
3. **Real-Time Features**: WebSocket integration for messaging and notifications
4. **Advanced Onboarding**: 10-step guided flow with progress persistence
5. **AI Integration**: AI assistant for cleaners with templates and analytics
6. **Performance Optimized**: Lazy loading, code splitting, image optimization
7. **Accessible**: WCAG compliant with full keyboard navigation
8. **SEO Optimized**: Complete SEO implementation with structured data
9. **Error Resilient**: Comprehensive error handling and offline support
10. **Well Tested**: Full test suite with unit, integration, and E2E tests

---

## 🚀 Ready for Production

The frontend is production-ready with:
- ✅ Complete feature set
- ✅ Mobile optimization
- ✅ Accessibility compliance
- ✅ Performance optimization
- ✅ Error handling
- ✅ Testing infrastructure
- ✅ SEO implementation
- ✅ Analytics integration
- ✅ Security measures

---

**Last Updated**: Based on current codebase structure
**Status**: ✅ Production Ready
