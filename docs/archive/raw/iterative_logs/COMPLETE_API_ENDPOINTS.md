# 🎯 Complete Backend API Endpoint Reference

**Status:** ✅ ALL ENDPOINTS IMPLEMENTED  
**Date:** January 9, 2026  
**Total Endpoints:** 40+ for Gamification, AI Assistant, Admin, and Test Page

---

## 🎮 **GAMIFICATION & ONBOARDING ENDPOINTS**

Base Path: `/cleaner/`

### **Onboarding Progress:**

```
GET    /cleaner/onboarding/progress
POST   /cleaner/onboarding/update
```

**Example:**
```bash
# Get progress
curl http://localhost:3000/cleaner/onboarding/progress \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update progress
curl -X POST http://localhost:3000/cleaner/onboarding/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profile_photo_uploaded": true, "bio_completed": true}'
```

---

### **Achievements:**

```
GET    /cleaner/achievements
POST   /cleaner/achievements/:id/mark-seen
```

**Example:**
```bash
# Get all achievements
curl http://localhost:3000/cleaner/achievements \
  -H "Authorization: Bearer YOUR_TOKEN"

# Mark as seen
curl -X POST http://localhost:3000/cleaner/achievements/ACHIEVEMENT_ID/mark-seen \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### **Certifications:**

```
GET    /cleaner/certifications
POST   /cleaner/certifications/:id/claim
```

**Example:**
```bash
# Get certifications with progress
curl http://localhost:3000/cleaner/certifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# Claim certification
curl -X POST http://localhost:3000/cleaner/certifications/CERT_ID/claim \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### **Template Library (Marketplace):**

```
GET    /template-library                    # Browse templates
GET    /template-library/:id                # Get single template ⭐ NEW!
POST   /template-library                    # Publish to marketplace ⭐ NEW!
GET    /template-library/saved              # Get user's saved templates
POST   /template-library/:id/save           # Save template to personal collection
POST   /template-library/:id/rate           # Rate a template
```

**Examples:**
```bash
# Browse marketplace
curl http://localhost:3000/template-library?category=residential&sort=rating \
  -H "Authorization: Bearer YOUR_TOKEN"

# Publish new template to marketplace ⭐ NEW!
curl -X POST http://localhost:3000/template-library \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "booking_confirmation",
    "template_name": "My Awesome Template",
    "template_content": "Hi {client_name}! Your booking is confirmed!",
    "variables": ["client_name"],
    "category": "residential",
    "description": "A friendly booking confirmation",
    "tags": ["friendly", "professional"]
  }'

# Save template from library
curl -X POST http://localhost:3000/template-library/TEMPLATE_ID/save \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customizedContent": "Customized version..."}'

# Rate template
curl -X POST http://localhost:3000/template-library/TEMPLATE_ID/rate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "review": "Great template!"}'
```

---

### **Tooltips:**

```
GET    /tooltips
POST   /tooltips/:id/dismiss
```

---

## 🤖 **AI ASSISTANT ENDPOINTS**

Base Path: `/cleaner/ai/`

### **AI Settings:**

```
GET    /cleaner/ai/settings
POST   /cleaner/ai/settings
```

**Example:**
```bash
# Get AI settings
curl http://localhost:3000/cleaner/ai/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update AI settings
curl -X POST http://localhost:3000/cleaner/ai/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tone": "friendly",
    "formality_level": "casual",
    "response_length": "standard",
    "emoji_usage": "occasional",
    "auto_reply_enabled": true
  }'
```

---

### **Templates (Personal):**

```
GET    /cleaner/ai/templates
POST   /cleaner/ai/templates
PUT    /cleaner/ai/templates/:id
DELETE /cleaner/ai/templates/:id
POST   /cleaner/ai/templates/:id/toggle
```

**Example:**
```bash
# Create personal template
curl -X POST http://localhost:3000/cleaner/ai/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "booking_confirmation",
    "template_name": "Friendly Confirmation",
    "template_content": "Hi {client_name}! Confirmed for {date}!",
    "is_active": true
  }'
```

---

### **Quick Responses:**

```
GET    /cleaner/ai/quick-responses
POST   /cleaner/ai/quick-responses
PUT    /cleaner/ai/quick-responses/:id
DELETE /cleaner/ai/quick-responses/:id
POST   /cleaner/ai/quick-responses/:id/favorite
```

---

### **Preferences:**

```
GET    /cleaner/ai/preferences
POST   /cleaner/ai/preferences
```

---

## ⚡ **AI ADVANCED ENDPOINTS**

Base Path: `/cleaner/ai/advanced/`

```
POST   /cleaner/ai/advanced/export               # Export all settings
POST   /cleaner/ai/advanced/import               # Import settings
POST   /cleaner/ai/advanced/template-preview     # Preview template
POST   /cleaner/ai/advanced/template-duplicate/:id
POST   /cleaner/ai/advanced/reset-defaults
POST   /cleaner/ai/advanced/templates/batch-toggle
GET    /cleaner/ai/advanced/template-search
GET    /cleaner/ai/advanced/insights
GET    /cleaner/ai/advanced/suggestions
```

---

## 👑 **ADMIN ENDPOINTS**

Base Path: `/admin/`

### **Admin Settings:**

```
GET    /admin/settings
GET    /admin/settings/:key
POST   /admin/settings/:key
POST   /admin/settings/bulk-update
GET    /admin/settings/history/:key
GET    /admin/settings/export
```

### **Admin Analytics:**

```
GET    /admin/analytics/overview
GET    /admin/analytics/revenue
GET    /admin/analytics/bookings
GET    /admin/analytics/users
```

### **Admin User Management:**

```
GET    /admin/cleaners
GET    /admin/cleaners/:id
PUT    /admin/cleaners/:id
POST   /admin/cleaners/:id/verify
POST   /admin/cleaners/:id/suspend

GET    /admin/clients
GET    /admin/clients/:id
PUT    /admin/clients/:id
```

### **Admin Bookings:**

```
GET    /admin/bookings
GET    /admin/bookings/:id
PUT    /admin/bookings/:id
POST   /admin/bookings/:id/cancel
POST   /admin/bookings/:id/reschedule
```

### **Admin Finance:**

```
GET    /admin/finance/revenue
GET    /admin/finance/payouts
POST   /admin/finance/payouts/:id/process
```

### **Admin Risk:**

```
GET    /admin/risk/alerts
GET    /admin/risk/disputes
POST   /admin/risk/disputes/:id/resolve
```

---

## 📊 **TESTING ENDPOINTS FOR DEMO MODE**

The Test Page works with **demo data** when APIs aren't available, but here are the real endpoints it uses:

### **Used by Test Page:**

```
GET    /cleaner/ai/settings              ✅ (loads AI settings)
GET    /cleaner/ai/templates             ✅ (loads templates)
GET    /cleaner/ai/quick-responses       ✅ (loads quick responses)
GET    /template-library                 ✅ (browse marketplace)
POST   /template-library                 ✅ (publish template) ⭐ NEW!
POST   /template-library/:id/save        ✅ (save from marketplace)
POST   /template-library/:id/rate        ✅ (rate template)
POST   /cleaner/onboarding/update        ✅ (track progress)
```

---

## 🔐 **Authentication**

All endpoints (except auth endpoints) require a JWT token:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

**Get Token:**
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "nathan@puretask.co", "password": "BaileeJane7!"}'

# Response includes: { "token": "eyJhbGc..." }
```

---

## 🌐 **Base URLs**

**Development:**
```
http://localhost:3000
```

**Production:**
```
https://api.puretask.com
```

**React Frontend:**
```
http://localhost:5173    (Development)
https://app.puretask.com (Production)
```

---

## ✅ **NEW ENDPOINTS ADDED TODAY:**

1. **POST `/template-library`** ⭐
   - Publish templates to marketplace
   - Auto-tracks in onboarding progress
   - Unlocks achievements

2. **GET `/template-library/:id`** ⭐
   - Get single template details
   - Includes ratings and usage stats

---

## 🎯 **Complete Feature Coverage:**

| Feature | Endpoints | Status |
|---------|-----------|--------|
| **Onboarding** | 2 | ✅ Complete |
| **Achievements** | 2 | ✅ Complete |
| **Certifications** | 2 | ✅ Complete |
| **Template Library** | 6 | ✅ Complete |
| **AI Settings** | 2 | ✅ Complete |
| **AI Templates** | 5 | ✅ Complete |
| **Quick Responses** | 5 | ✅ Complete |
| **AI Preferences** | 2 | ✅ Complete |
| **AI Advanced** | 9 | ✅ Complete |
| **Tooltips** | 2 | ✅ Complete |
| **Admin** | 30+ | ✅ Complete |

**Total:** 60+ endpoints implemented!

---

## 🚀 **Quick Start:**

### **1. Start Backend:**
```bash
npm run dev
```

### **2. Test an Endpoint:**
```bash
# Get achievements
curl http://localhost:3000/cleaner/achievements \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **3. Use Test Page:**
```
http://localhost:5173/test/ai
```

---

## 📝 **Notes:**

- ✅ All endpoints require authentication (except `/health`, `/auth/*`)
- ✅ Demo mode in Test Page works without backend
- ✅ All endpoints return JSON
- ✅ Errors follow consistent format: `{ error: { code, message } }`
- ✅ Rate limiting applied (100 requests/15min general, varies by endpoint)

---

**Status:** 🎉 **ALL ENDPOINTS COMPLETE AND READY!**  
**Date:** January 10, 2026  
**Version:** 1.0.0

🚀 **Full backend API ready for production!**

