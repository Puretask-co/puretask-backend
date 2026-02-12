# 🧪 Cleaner AI Settings API - Testing Guide

Quick guide to test all the new Cleaner AI Settings API endpoints.

## 🔑 Prerequisites

1. **Get a Cleaner Auth Token**

First, you need to authenticate as a cleaner. If you have a test cleaner account, login to get a token:

```bash
# Login as cleaner
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-cleaner@email.com",
    "password": "your-password"
  }'
```

Save the token from the response. For all tests below, replace `YOUR_TOKEN` with your actual token.

---

## 📊 Test 1: Get All Settings

```bash
curl -X GET http://localhost:3000/cleaner/ai/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "cleanerId": "cleaner_123",
  "settings": {
    "communication": [
      {
        "key": "booking_confirmation.enabled",
        "value": true,
        "description": "Send automatic booking confirmations",
        "enabled": true,
        "lastUpdated": "2025-01-09T..."
      }
    ],
    "scheduling": [...],
    "matching": [...],
    "notifications": [...]
  },
  "totalSettings": 12
}
```

---

## 📝 Test 2: Get Settings by Category

```bash
curl -X GET http://localhost:3000/cleaner/ai/settings/communication \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✏️ Test 3: Update a Single Setting

```bash
curl -X PATCH http://localhost:3000/cleaner/ai/settings/booking_confirmation.enabled \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": false,
    "enabled": true
  }'
```

**Expected Response:**
```json
{
  "message": "Setting updated successfully",
  "setting": {
    "key": "booking_confirmation.enabled",
    "value": false,
    "enabled": true,
    "lastUpdated": "2025-01-09T..."
  }
}
```

---

## 🔄 Test 4: Bulk Update Settings

```bash
curl -X POST http://localhost:3000/cleaner/ai/settings/bulk-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": [
      {
        "key": "booking_confirmation.enabled",
        "value": true
      },
      {
        "key": "pre_cleaning_reminder.hours_before",
        "value": 48
      },
      {
        "key": "daily_summary.enabled",
        "value": true
      }
    ]
  }'
```

---

## 📄 Test 5: Get All Templates

```bash
curl -X GET http://localhost:3000/cleaner/ai/templates \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Filter by type:**
```bash
curl -X GET "http://localhost:3000/cleaner/ai/templates?type=booking_confirmation" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "templates": [
    {
      "id": "uuid",
      "type": "booking_confirmation",
      "name": "Default Confirmation",
      "content": "Hi {client_name}! Your cleaning is confirmed...",
      "variables": ["client_name", "date", "time"],
      "isDefault": true,
      "active": true,
      "usageCount": 0,
      "createdAt": "2025-01-09T..."
    }
  ],
  "count": 3
}
```

---

## ➕ Test 6: Create a New Template

```bash
curl -X POST http://localhost:3000/cleaner/ai/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateType": "job_complete",
    "templateName": "Custom Completion Message",
    "templateContent": "Hi {client_name}! Just finished cleaning your {property_type}. Everything looks amazing! 🌟 Let me know if you need anything else. - {cleaner_name}",
    "variables": ["client_name", "property_type", "cleaner_name"]
  }'
```

**Expected Response:**
```json
{
  "message": "Template created successfully",
  "template": {
    "id": "new-uuid",
    "type": "job_complete",
    "name": "Custom Completion Message",
    "content": "Hi {client_name}!...",
    "variables": ["client_name", "property_type", "cleaner_name"],
    "isDefault": false,
    "active": true,
    "createdAt": "2025-01-09T..."
  }
}
```

---

## ✏️ Test 7: Update a Template

```bash
# Replace TEMPLATE_ID with actual template ID from previous response
curl -X PATCH http://localhost:3000/cleaner/ai/templates/TEMPLATE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "Updated Completion Message",
    "templateContent": "Hi {client_name}! All done! Your place is sparkling clean! ✨",
    "isActive": true
  }'
```

---

## 🗑️ Test 8: Delete a Template

```bash
curl -X DELETE http://localhost:3000/cleaner/ai/templates/TEMPLATE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💬 Test 9: Get Quick Responses

```bash
curl -X GET http://localhost:3000/cleaner/ai/quick-responses \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Filter by category:**
```bash
curl -X GET "http://localhost:3000/cleaner/ai/quick-responses?category=pricing" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "responses": [
    {
      "id": "uuid",
      "category": "pricing",
      "triggerKeywords": ["price", "cost", "rate", "how much"],
      "text": "My rates depend on...",
      "favorite": false,
      "usageCount": 0,
      "createdAt": "2025-01-09T..."
    }
  ],
  "count": 3
}
```

---

## ➕ Test 10: Create Quick Response

```bash
curl -X POST http://localhost:3000/cleaner/ai/quick-responses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "cancellation",
    "triggerKeywords": ["cancel", "cancellation", "policy"],
    "responseText": "I understand plans change! You can cancel up to 24 hours before your appointment for a full refund. Within 24 hours, there is a 50% cancellation fee. Same-day cancellations are non-refundable."
  }'
```

---

## ✏️ Test 11: Update Quick Response

```bash
curl -X PATCH http://localhost:3000/cleaner/ai/quick-responses/RESPONSE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "responseText": "Updated cancellation policy text...",
    "isFavorite": true
  }'
```

---

## 🗑️ Test 12: Delete Quick Response

```bash
curl -X DELETE http://localhost:3000/cleaner/ai/quick-responses/RESPONSE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎛️ Test 13: Get AI Preferences

```bash
curl -X GET http://localhost:3000/cleaner/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "preferences": {
    "communicationTone": "professional_friendly",
    "formalityLevel": 3,
    "emojiUsage": "moderate",
    "responseSpeed": "balanced",
    "businessHoursOnly": false,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "fullAutomationEnabled": false,
    "requireApprovalForBookings": true,
    "autoAcceptInstantBook": true,
    "autoDeclineOutsideHours": false,
    "learnFromResponses": true,
    "suggestBetterResponses": true,
    "autoImproveTemplates": false,
    "shareAnonymizedData": true,
    "allowAiTraining": true,
    "priorityGoal": "balanced",
    "targetWeeklyHours": null,
    "preferredBookingSize": "any",
    "createdAt": "2025-01-09T...",
    "updatedAt": "2025-01-09T..."
  }
}
```

---

## ✏️ Test 14: Update AI Preferences

### **Make AI More Professional**
```bash
curl -X PATCH http://localhost:3000/cleaner/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "communicationTone": "professional",
    "formalityLevel": 4,
    "emojiUsage": "minimal"
  }'
```

### **Enable Full Automation**
```bash
curl -X PATCH http://localhost:3000/cleaner/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullAutomationEnabled": true,
    "requireApprovalForBookings": false,
    "priorityGoal": "maximize_bookings"
  }'
```

### **Set Quiet Hours**
```bash
curl -X PATCH http://localhost:3000/cleaner/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursStart": "22:00:00",
    "quietHoursEnd": "07:00:00",
    "businessHoursOnly": false
  }'
```

### **Set Target Weekly Hours**
```bash
curl -X PATCH http://localhost:3000/cleaner/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetWeeklyHours": 30,
    "priorityGoal": "work_life_balance"
  }'
```

---

## 📊 Test 15: Get AI Insights

```bash
curl -X GET http://localhost:3000/cleaner/ai/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "templates": [
    {
      "template_type": "booking_confirmation",
      "count": 1,
      "total_usage": 0
    },
    {
      "template_type": "pre_cleaning_reminder",
      "count": 1,
      "total_usage": 0
    },
    {
      "template_type": "on_my_way",
      "count": 1,
      "total_usage": 0
    }
  ],
  "quickResponses": [
    {
      "response_category": "pricing",
      "count": 1,
      "total_usage": 0,
      "favorites": 0
    },
    {
      "response_category": "availability",
      "count": 1,
      "total_usage": 0,
      "favorites": 0
    },
    {
      "response_category": "services",
      "count": 1,
      "total_usage": 0,
      "favorites": 0
    }
  ],
  "settings": {
    "enabled": 12,
    "disabled": 0
  },
  "generatedAt": "2025-01-09T..."
}
```

---

## 🎯 Complete Test Sequence

Run all tests in order to verify full functionality:

```bash
#!/bin/bash

TOKEN="your-token-here"
BASE_URL="http://localhost:3000"

echo "1. Get all settings"
curl -X GET "$BASE_URL/cleaner/ai/settings" -H "Authorization: Bearer $TOKEN"

echo "\n2. Get communication settings"
curl -X GET "$BASE_URL/cleaner/ai/settings/communication" -H "Authorization: Bearer $TOKEN"

echo "\n3. Update a setting"
curl -X PATCH "$BASE_URL/cleaner/ai/settings/booking_confirmation.enabled" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": true}'

echo "\n4. Get templates"
curl -X GET "$BASE_URL/cleaner/ai/templates" -H "Authorization: Bearer $TOKEN"

echo "\n5. Create template"
curl -X POST "$BASE_URL/cleaner/ai/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateType": "job_complete",
    "templateName": "Test Template",
    "templateContent": "Test content {client_name}",
    "variables": ["client_name"]
  }'

echo "\n6. Get quick responses"
curl -X GET "$BASE_URL/cleaner/ai/quick-responses" -H "Authorization: Bearer $TOKEN"

echo "\n7. Get preferences"
curl -X GET "$BASE_URL/cleaner/ai/preferences" -H "Authorization: Bearer $TOKEN"

echo "\n8. Update preferences"
curl -X PATCH "$BASE_URL/cleaner/ai/preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"communicationTone": "professional", "formalityLevel": 4}'

echo "\n9. Get insights"
curl -X GET "$BASE_URL/cleaner/ai/insights" -H "Authorization: Bearer $TOKEN"

echo "\n\n✅ All tests complete!"
```

Save this as `test-ai-api.sh`, make it executable with `chmod +x test-ai-api.sh`, and run it!

---

## 🔍 Troubleshooting

### **401 Unauthorized**
- Check that your token is valid
- Make sure you're using a cleaner account (not admin or client)
- Token might be expired - get a new one

### **404 Not Found**
- Verify the server is running on port 3000
- Check that the route is registered in `src/index.ts`
- Ensure migration was run successfully

### **500 Internal Server Error**
- Check server logs for details
- Verify database connection
- Ensure migration created all tables

### **Validation Errors**
- Check request body format
- Ensure all required fields are present
- Verify data types match schema

---

## ✅ Success Criteria

All tests should:
- ✅ Return 200/201 status codes
- ✅ Return properly formatted JSON
- ✅ Show expected data structure
- ✅ Persist changes to database
- ✅ Maintain data isolation (only your settings)

---

**Happy Testing!** 🧪✨

