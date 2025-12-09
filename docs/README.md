# 🧹 PureTask Backend

**Complete backend for PureTask - Uber-style cleaning marketplace platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue.svg)](https://neon.tech/)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment guide |
| [API Reference](./API_REFERENCE.md) | Complete API documentation |
| [Environment Variables](./ENV_TEMPLATE.md) | All configuration options |
| [Stripe Testing Cheat Sheet](./STRIPE_TESTING.md) | How to test payments, refunds, disputes, payouts |
| [Testing Data Setup](./TESTING_DATA_SETUP.md) | How to load schema/seed, wire Stripe, and validate data |
| [Stripe Testing Cheat Sheet](./STRIPE_TESTING.md) | How to test payments, refunds, disputes, payouts |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      PureTask Backend                           │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (Express.js)                                         │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │   Auth   │   Jobs   │ Credits  │  Admin   │  Stripe  │      │
│  │  Routes  │  Routes  │  Routes  │  Routes  │  Routes  │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
├─────────────────────────────────────────────────────────────────┤
│  Core Engines                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │Reliability│ Client  │Reschedule│ Cancel   │ Matching │      │
│  │  Engine  │  Risk   │  Engine  │ Engine   │  Engine  │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
│  ┌──────────┬──────────┬──────────┐                             │
│  │Flexibility│Inconven │Availabil │                             │
│  │  Engine  │  ience  │   ity    │                             │
│  └──────────┴──────────┴──────────┘                             │
├─────────────────────────────────────────────────────────────────┤
│  Services Layer                                                 │
│  Jobs · Credits · Payouts · Notifications · Analytics · etc.   │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  PostgreSQL (Neon) · 19 Migration Files · 60+ Tables           │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### Core Platform
- ✅ User authentication (JWT)
- ✅ Job lifecycle management
- ✅ Credit system (10 credits = $1 USD)
- ✅ Stripe payment integration
- ✅ Stripe Connect payouts
- ✅ Real-time job tracking
- ✅ Photo before/after requirements
- ✅ In-app messaging
- ✅ Push/Email/SMS notifications

### Scoring Engines
- ✅ **Reliability Score** - Cleaner performance scoring (0-100)
- ✅ **Client Risk Score** - Client behavior assessment
- ✅ **Flexibility Profiles** - Client/Cleaner flexibility tracking
- ✅ **Low Flexibility Badge** - Auto-assigned for inflexible cleaners

### Scheduling Engines
- ✅ **Rescheduling** - Time-bucketed reschedule requests
- ✅ **Cancellation** - Tiered fee structure with grace periods
- ✅ **Availability** - Weekly schedules + time-off management
- ✅ **Matching** - AI-powered cleaner-job matching

### Premium Features
- ✅ Subscription cleanings
- ✅ Cleaner boosts
- ✅ Referral program
- ✅ Multi-property support
- ✅ Team management
- ✅ Calendar integration

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (Neon account)
- Stripe account

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/puretask-backend.git
cd puretask-backend

# Install dependencies
npm install

# Copy environment template
# See docs/ENV_TEMPLATE.md for all variables
cp .env.example .env

# Run database migrations
# (See DEPLOYMENT_CHECKLIST.md for details)

# Start development server
npm run dev

# Server runs at http://localhost:4000
```

### Verify Installation

```bash
# Check TypeScript compiles
npm run typecheck

# Run tests
npm test

# Check health endpoint
curl http://localhost:4000/health
```

---

## 📁 Project Structure

```
puretask-backend/
├── src/
│   ├── config/          # Environment & configuration
│   │   └── env.ts       # Environment variable validation
│   ├── core/            # Core engines
│   │   ├── db/          # Core database modules
│   │   ├── reliabilityScoreV2Service.ts
│   │   ├── clientRiskService.ts
│   │   ├── rescheduleService.ts
│   │   ├── cancellationService.ts
│   │   ├── matchingService.ts
│   │   ├── flexibilityService.ts
│   │   ├── inconvenienceService.ts
│   │   └── availabilityService.ts
│   ├── db/              # Database client
│   │   └── client.ts    # PostgreSQL connection
│   ├── lib/             # Shared utilities
│   │   ├── auth.ts      # JWT authentication
│   │   ├── logger.ts    # Logging
│   │   ├── security.ts  # Security middleware
│   │   └── tiers.ts     # Tier name utilities
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # Auth middleware
│   │   ├── jwtAuth.ts   # JWT verification
│   │   └── rateLimit.ts # Rate limiting
│   ├── routes/          # API routes (21 files)
│   │   ├── auth.ts
│   │   ├── jobs.ts
│   │   ├── credits.ts
│   │   ├── admin.ts
│   │   └── ... (17 more)
│   ├── services/        # Business logic (30+ files)
│   │   ├── jobsService.ts
│   │   ├── creditsService.ts
│   │   ├── payoutsService.ts
│   │   └── ... (many more)
│   ├── state/           # State machines
│   │   └── jobStateMachine.ts
│   ├── types/           # TypeScript types
│   │   ├── db.ts        # Database types
│   │   └── api.ts       # API types
│   ├── workers/         # Background workers (18 files)
│   │   ├── autoCancelJobs.ts
│   │   ├── payoutWeekly.ts
│   │   └── ... (16 more)
│   └── index.ts         # Application entry point
├── DB/
│   └── migrations/      # SQL migrations (19 files)
├── scripts/
│   └── verifySchema.sql # Schema verification
├── docs/
│   ├── README.md        # This file
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── API_REFERENCE.md
│   └── ENV_TEMPLATE.md
└── package.json
```

---

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts
- `client_profiles` - Client-specific data
- `cleaner_profiles` - Cleaner-specific data
- `jobs` - Job bookings
- `addresses` - User addresses

### Credit System
- `credit_accounts` - User balances
- `credit_transactions` - Transaction ledger
- `credit_ledger` - Legacy ledger

### Payments
- `payment_intents` - Stripe payment tracking
- `payouts` - Cleaner payouts
- `stripe_customers` - Stripe customer IDs
- `stripe_connect_accounts` - Connect accounts

### Scoring Engines
- `cleaner_metrics` - Rolling metrics
- `cleaner_events` - Score events
- `client_risk_scores` - Risk scores
- `client_risk_events` - Risk events
- `cleaner_flex_profiles` - Flexibility stats
- `client_flex_profiles` - Client flexibility

### Scheduling
- `reschedule_events` - Reschedule requests
- `cancellation_events` - Cancellation history
- `availability_blocks` - Weekly availability
- `blackout_periods` - Time-off

### Other
- `job_photos` - Before/after photos
- `messages` - In-app messaging
- `disputes` - Job disputes
- `reviews` - Ratings/reviews
- `notification_templates` - Notification templates
- `admin_audit_log` - Admin actions

---

## 🔧 Configuration

### Tier System

| Tier | Score Range | Payout % | Description |
|------|-------------|----------|-------------|
| Developing | 0-59 | 80% | New cleaners |
| Semi Pro | 60-74 | 82% | Established |
| Pro | 75-89 | 84% | High performers |
| Elite | 90-100 | 85% | Top tier |

### Cancellation Fees

| Notice Period | Fee |
|---------------|-----|
| > 48 hours | 0% |
| 24-48 hours | 50% |
| < 24 hours | 100% |

*Clients get 2 lifetime grace cancellations*

### Policy Settings

| Setting | Default | Description |
|---------|---------|-------------|
| GPS radius | 250m | Check-in proximity |
| Min photos | 3 | Required for completion |
| Photo retention | 90 days | Auto-cleanup period |
| Dispute window | 48 hours | Time to file dispute |
| No-show bonus | 50 credits | Client compensation |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run smoke tests only
npm run test:smoke

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

---

## ⏰ Background Workers

| Worker | Schedule | Description |
|--------|----------|-------------|
| `auto-cancel` | 15 min | Cancel stale requested jobs |
| `auto-expire` | 1 hour | Expire awaiting approval jobs |
| `payout-weekly` | Sunday | Process weekly payouts |
| `kpi-daily` | Daily | Capture KPI snapshot |
| `reliability-recalc` | Daily | Recompute reliability scores |
| `credit-economy` | Daily | Credit system maintenance |
| `photo-cleanup` | Daily | Delete old photos |

---

## 🔒 Security

- JWT authentication with configurable expiration
- Bcrypt password hashing
- Helmet security headers
- CORS configuration
- Rate limiting per endpoint
- Stripe webhook signature verification
- n8n webhook HMAC authentication
- SQL injection prevention (parameterized queries)

---

## 📞 Support

For issues or questions:
1. Check the [API Reference](./API_REFERENCE.md)
2. Review [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
3. Open a GitHub issue

---

## 📄 License

UNLICENSED - Private software

