# 💾 Message History & Saved Messages System

## ✅ YES! You Can Save Everything!

### **Two Systems Available:**

1. **Message History** - Automatic logging of all sent messages
2. **Saved Messages** - Manual saving of drafts and favorites

---

## 📝 **1. MESSAGE HISTORY (Auto-Logging)**

### **What It Does:**
Automatically logs every message you send, creating a complete history!

### **What Gets Saved:**
- ✅ Full message content
- ✅ Who you sent it to
- ✅ When you sent it
- ✅ Which template you used (if any)
- ✅ The variables you filled in
- ✅ Which booking it was for
- ✅ Message type (confirmation, late, etc.)
- ✅ Channel (SMS, email, in-app)
- ✅ Character & word count
- ✅ Whether AI generated it

### **API Endpoints:**

#### **Log a Message (Automatic):**
```bash
POST /cleaner/messages/log

{
  "message_content": "Hi Sarah! Your Deep Clean is confirmed for Jan 15!",
  "recipient_type": "client",
  "recipient_name": "Sarah Johnson",
  "template_id": "uuid-of-template",
  "template_name": "Booking Confirmation",
  "variables_used": {
    "client_name": "Sarah",
    "service_type": "Deep Clean",
    "date": "Jan 15, 2025"
  },
  "booking_id": "booking-uuid",
  "message_type": "booking_confirmation",
  "channel": "manual",
  "was_ai_generated": false
}
```

**Response:**
```json
{
  "message": "Message logged successfully",
  "log": {
    "id": "log-uuid",
    "sentAt": "2025-01-10T10:30:00Z"
  }
}
```

---

#### **Get Message History:**
```bash
GET /cleaner/messages/history?limit=50&offset=0

# Optional filters:
GET /cleaner/messages/history?message_type=booking_confirmation
GET /cleaner/messages/history?channel=sms
GET /cleaner/messages/history?start_date=2025-01-01
```

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "Hi Sarah! Your Deep Clean is confirmed...",
      "recipientType": "client",
      "recipientName": "Sarah Johnson",
      "templateId": "template-uuid",
      "templateName": "Booking Confirmation",
      "variablesUsed": {...},
      "bookingId": "booking-uuid",
      "messageType": "booking_confirmation",
      "channel": "manual",
      "characterCount": 78,
      "wordCount": 14,
      "wasAIGenerated": false,
      "sentAt": "2025-01-10T10:30:00Z"
    }
  ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

---

#### **Get Message Statistics:**
```bash
GET /cleaner/messages/stats
```

**Response:**
```json
{
  "overview": {
    "total_messages": 142,
    "days_active": 28,
    "avg_character_count": 156,
    "avg_word_count": 32,
    "ai_generated_count": 45,
    "unique_templates_used": 8
  },
  "byType": [
    { "type": "booking_confirmation", "count": 56 },
    { "type": "job_complete", "count": 38 },
    { "type": "running_late", "count": 12 }
  ],
  "byChannel": [
    { "channel": "manual", "count": 89 },
    { "channel": "sms", "count": 32 },
    { "channel": "email", "count": 21 }
  ]
}
```

---

## 💾 **2. SAVED MESSAGES (Manual Drafts)**

### **What It Does:**
Save your own custom messages, drafts, and frequently-used replies!

### **Use Cases:**
- 📝 Save work-in-progress templates
- ⭐ Save your favorite go-to replies
- 💡 Save messages you want to reuse
- 🎯 Organize by category
- 🔖 Tag for easy finding

### **API Endpoints:**

#### **Get Saved Messages:**
```bash
GET /cleaner/messages/saved
```

**Response:**
```json
{
  "savedMessages": [
    {
      "id": "uuid",
      "title": "My Favorite Confirmation",
      "content": "Hey {client_name}! So excited to clean for you...",
      "category": "confirmations",
      "tags": ["friendly", "excited"],
      "timesUsed": 15,
      "lastUsedAt": "2025-01-09T...",
      "isFavorite": true,
      "createdAt": "2024-12-01T...",
      "updatedAt": "2025-01-09T..."
    }
  ],
  "count": 12
}
```

---

#### **Save a New Message:**
```bash
POST /cleaner/messages/saved

{
  "title": "Friendly Running Late",
  "content": "Hi {client_name}! Traffic is crazy today! Running about {minutes} minutes late. So sorry!",
  "category": "delays",
  "tags": ["apologetic", "friendly"],
  "is_favorite": false
}
```

**Response:**
```json
{
  "message": "Message saved successfully",
  "savedMessage": {
    "id": "uuid",
    "title": "Friendly Running Late",
    "content": "Hi {client_name}! Traffic is crazy...",
    "createdAt": "2025-01-10T..."
  }
}
```

---

#### **Update Saved Message:**
```bash
PUT /cleaner/messages/saved/:id

{
  "title": "Updated Title",
  "content": "Updated content...",
  "is_favorite": true
}
```

---

#### **Delete Saved Message:**
```bash
DELETE /cleaner/messages/saved/:id
```

---

#### **Track Usage:**
```bash
POST /cleaner/messages/saved/:id/use
```

This increments the `times_used` counter and updates `last_used_at`.

---

## 🎯 **How Templates vs Saved Messages Work:**

### **Templates (Formal System):**
```
Location: /cleaner/ai/templates
Purpose: Official message templates with AI integration
Features: 
  - Active/inactive toggle
  - Usage tracking
  - Variables system
  - Can publish to marketplace
Use Case: Professional, reusable templates
```

### **Saved Messages (Personal Notes):**
```
Location: /cleaner/messages/saved
Purpose: Personal drafts and quick saves
Features:
  - Favorites
  - Categories & tags
  - Times used tracking
  - Quick access
Use Case: Personal favorites, drafts, experimental messages
```

### **Message History (Auto-Log):**
```
Location: /cleaner/messages/history
Purpose: Complete record of everything sent
Features:
  - Automatic logging
  - Analytics
  - Search & filter
  - Statistics
Use Case: Track performance, review past messages
```

---

## 🚀 **Real-World Usage:**

### **Scenario 1: Using a Template**
```javascript
// User selects template and sends message
// Your app automatically logs it:

await fetch('/cleaner/messages/log', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' },
  body: JSON.stringify({
    message_content: renderedMessage,
    recipient_name: "Sarah",
    template_id: template.id,
    template_name: "Booking Confirmation",
    variables_used: { client_name: "Sarah", date: "Jan 15" },
    message_type: "booking_confirmation",
    channel: "manual"
  })
});
```

### **Scenario 2: Saving a Great Message**
```javascript
// User writes a great message and wants to save it
const saveMessage = async () => {
  await fetch('/cleaner/messages/saved', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer TOKEN' },
    body: JSON.stringify({
      title: "My Perfect Reply",
      content: messageContent,
      category: "general",
      tags: ["friendly", "professional"],
      is_favorite: true
    })
  });
};
```

### **Scenario 3: Reviewing History**
```javascript
// User wants to see what they sent to Sarah
const getHistory = async () => {
  const response = await fetch(
    '/cleaner/messages/history?recipient_name=Sarah',
    { headers: { 'Authorization': 'Bearer TOKEN' } }
  );
  const data = await response.json();
  // Show history in UI
};
```

---

## 📊 **What You Can Track:**

### **Personal Analytics:**
- 📈 Total messages sent
- 📅 Messages per day/week/month
- ⏱️ Average message length
- 🤖 AI-generated vs manual
- 📋 Most-used templates
- 💬 Most common message types
- 📱 Preferred channels

### **Performance Insights:**
- ⚡ Response time trends
- 🎯 Template effectiveness
- 📊 Message patterns
- 🔍 Search past conversations
- 📈 Growth over time

---

## 🛠️ **Setup Instructions:**

### **1. Run Migration:**
```bash
node scripts/setup-message-history.js
```

### **2. Start Using:**
All endpoints are now available at `/cleaner/messages/*`

### **3. Auto-Log Messages:**
Add this to your message sending code:

```javascript
// After sending a message, log it:
const logMessage = async (messageData) => {
  try {
    await fetch('/cleaner/messages/log', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message_content: messageData.content,
        recipient_name: messageData.recipientName,
        template_id: messageData.templateId,
        message_type: messageData.type,
        channel: 'manual'
      })
    });
  } catch (error) {
    console.error('Failed to log message:', error);
    // Don't block the user if logging fails
  }
};
```

---

## 🎮 **Example: Complete Workflow**

```javascript
// 1. User writes/generates message
const message = renderTemplate(template, variables);

// 2. User sends message (your existing code)
await sendMessage(message, recipient);

// 3. Auto-log to history
await logMessage({
  content: message,
  recipientName: recipient.name,
  templateId: template.id,
  templateName: template.name,
  variablesUsed: variables,
  messageType: 'booking_confirmation',
  channel: 'manual'
});

// 4. Optionally: User can save as favorite
if (userClicksSave) {
  await fetch('/cleaner/messages/saved', {
    method: 'POST',
    body: JSON.stringify({
      title: "Awesome Confirmation",
      content: message,
      is_favorite: true
    })
  });
}

// 5. Later: User reviews history
const history = await fetch('/cleaner/messages/history');
// Show in UI: "You sent 142 messages this month!"
```

---

## 📝 **Summary:**

| Feature | Purpose | Auto/Manual | Location |
|---------|---------|-------------|----------|
| **Templates** | Reusable messages with variables | Manual create, auto-use | `/cleaner/ai/templates` |
| **Message History** | Log of everything sent | Automatic | `/cleaner/messages/history` |
| **Saved Messages** | Personal favorites & drafts | Manual | `/cleaner/messages/saved` |

---

## ✅ **What You Asked For:**

### **"Save all written replies?"**
✅ YES! Use `/cleaner/messages/log` - logs everything automatically

### **"Save templates?"**
✅ YES! Two ways:
1. **Formal templates:** `/cleaner/ai/templates` (already exists!)
2. **Quick saves:** `/cleaner/messages/saved` (NEW!)

---

## 🚀 **Get Started:**

```bash
# 1. Run migration
node scripts/setup-message-history.js

# 2. Start backend
npm run dev

# 3. Test endpoints
curl http://localhost:3000/cleaner/messages/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Status:** ✅ READY TO USE!  
**New Endpoints:** 8  
**New Tables:** 2  

🎉 **Now you can track EVERYTHING!**

