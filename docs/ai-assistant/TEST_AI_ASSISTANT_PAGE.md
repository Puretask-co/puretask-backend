# 🧪 AI Assistant & Template Testing Page

**File:** `admin-portal/components/TestAIAssistant.tsx`

---

## 🎯 What It Does

A comprehensive testing page (similar to your test-notifications page) where you can:

1. **✅ View Current AI Settings** - See all active AI configurations
2. **✅ Test AI Responses** - Generate AI responses to different scenarios
3. **✅ Test Templates** - Preview templates with custom variable values
4. **✅ Check Quick Responses** - See which quick responses match messages
5. **✅ Live Output Preview** - See exactly what clients will receive
6. **✅ Copy to Clipboard** - Easy copying of generated outputs

---

## 📸 Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 🧪 AI Assistant & Template Testing Lab                      │
│ Test and preview AI responses, templates, and quick responses│
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┐
│ 🤖 AI Settings│ 📝 Templates  │ ⚡ Quick Resp │
│ Tone: Friendly│ 15 templates  │ 20 responses │
│ Auto-Reply: ON│ Select one... │ Search...    │
└──────────────┴──────────────┴──────────────┘

┌─────────────────────────┬─────────────────────────┐
│ INPUT SECTION           │ OUTPUT SECTION          │
├─────────────────────────┼─────────────────────────┤
│ 🤖 Test AI Response     │ 💬 AI Response Output   │
│ Scenario: [Booking ▼]  │ ┌─────────────────────┐ │
│ Message: [________]     │ │ Hi! I'd be happy   │ │
│ [Generate AI Response]  │ │ to check my...     │ │
│ [Check Quick Response]  │ └─────────────────────┘ │
│                         │ [📋 Copy to Clipboard] │
├─────────────────────────┼─────────────────────────┤
│ 📝 Test Template        │ 📄 Template Output      │
│ Template: [Select ▼]   │ ┌─────────────────────┐ │
│ Variables:              │ │ Hi John! Your Deep │ │
│  client_name: [John]    │ │ Clean is confirmed │ │
│  date: [Jan 15]         │ │ for Jan 15...      │ │
│ [Render Template]       │ └─────────────────────┘ │
│                         │ [📋 Copy to Clipboard] │
├─────────────────────────┼─────────────────────────┤
│                         │ ⚡ Quick Response Match  │
│                         │ ┌─────────────────────┐ │
│                         │ │ Matched: "Yes, I   │ │
│                         │ │ have availability" │ │
│                         │ └─────────────────────┘ │
└─────────────────────────┴─────────────────────────┘

┌───────────────────────────────────────────────┐
│ ⚙️ Quick Actions                              │
│ [Edit AI Settings] [Create Template]          │
│ [Template Library] [Refresh Data]             │
└───────────────────────────────────────────────┘
```

---

## 🚀 How to Use

### **1. Add Route:**

```tsx
import TestAIAssistant from './components/TestAIAssistant';

<Route path="/test/ai" element={<TestAIAssistant />} />
```

### **2. Add Navigation Link:**

```tsx
<a href="/test/ai" className="nav-link">
  🧪 Test AI Assistant
</a>
```

### **3. Access the Page:**

```
http://localhost:3000/test/ai
```

---

## 🎮 Features

### **1. AI Response Tester** 🤖

**8 Pre-configured Scenarios:**
1. Booking Inquiry - "Do you have availability on Friday?"
2. Pricing Question - "How much for a 2-bedroom?"
3. Cancellation Request - "I need to cancel"
4. Running Late - "Are you still coming?"
5. Complaint - "You missed the bathroom"
6. Praise - "The house looks amazing!"
7. Reschedule - "Can we move to next week?"
8. Special Request - "Can you bring supplies?"

**How It Works:**
1. Select a scenario (or type custom message)
2. Click "Generate AI Response"
3. See AI-generated response based on your settings
4. Copy to clipboard if needed

**AI Settings Applied:**
- ✅ Tone (professional, friendly, casual, enthusiastic)
- ✅ Formality level
- ✅ Response length (brief, standard, detailed)
- ✅ Emoji usage (none, occasional, frequent)
- ✅ Auto-reply status
- ✅ Weekend mode
- ✅ Quiet hours

---

### **2. Template Tester** 📝

**Features:**
- Select any of your templates
- Edit all variable values
- Real-time preview
- See exactly what client receives
- Copy rendered template

**Example:**
```
Template: "Hi {client_name}! Your {service_type}..."

Variables:
- client_name: John
- service_type: Deep Clean
- date: January 15

Output: "Hi John! Your Deep Clean is confirmed..."
```

---

### **3. Quick Response Checker** ⚡

**Features:**
- Type any message
- Automatically find matching quick responses
- See which trigger phrases match
- Test your quick response library

**Example:**
```
Message: "How much do you charge?"
Match: "Pricing Information" → "My rates start at $100..."
```

---

### **4. Current Settings Display**

**Shows:**
- ✅ Tone setting
- ✅ Formality level
- ✅ Response length
- ✅ Emoji usage
- ✅ Auto-reply (ON/OFF)
- ✅ Weekend mode (ON/OFF)
- ✅ Quiet hours (ON/OFF)

---

### **5. Template Library**

**Displays:**
- All your templates
- Template type
- Number of variables
- Click to select for testing

---

### **6. Quick Response Library**

**Displays:**
- All quick responses
- Trigger phrases
- Categories
- Favorite indicators

---

## 🎯 Use Cases

### **Use Case 1: Test New AI Settings**
1. Go to AI Settings page
2. Change tone from "professional" to "friendly"
3. Come to test page
4. Refresh data
5. Generate responses and compare

### **Use Case 2: Preview Template Before Sending**
1. Select template
2. Enter real client data
3. Preview output
4. Copy and send to client

### **Use Case 3: Train Staff**
1. Show staff the test page
2. Demonstrate different scenarios
3. Show how AI responds
4. Train on template usage

### **Use Case 4: Debug Issues**
1. Client complains about tone
2. Test the scenario
3. See actual AI output
4. Adjust settings
5. Re-test

---

## 📊 API Endpoints Used

```typescript
GET /cleaner/ai/settings              - Load AI settings
GET /cleaner/ai/templates             - Load all templates
GET /cleaner/ai/quick-responses       - Load quick responses
```

---

## 🎨 Visual Design

**Color Coding:**
- 🔵 **Blue** - AI Response outputs
- 🟢 **Green** - Template outputs
- 🟣 **Purple** - Quick Response outputs
- ⚪ **White** - Input panels
- ⚙️ **Gray** - Settings and config

**Layout:**
- **Left Side:** Input controls
- **Right Side:** Output previews
- **Top:** Current settings display
- **Bottom:** Quick actions

---

## ✅ Features Checklist

- [x] Load and display current AI settings
- [x] Load all templates
- [x] Load all quick responses
- [x] 8 pre-configured test scenarios
- [x] Custom message input
- [x] AI response generation (simulated)
- [x] Template rendering with variables
- [x] Variable editor for testing
- [x] Quick response matching
- [x] Copy to clipboard functionality
- [x] Refresh/reload data
- [x] Quick action buttons
- [x] Responsive design
- [x] Color-coded outputs

---

## 🔧 Customization

### **Add More Scenarios:**

```typescript
const scenarios = [
  ...
  { 
    value: 'emergency', 
    label: 'Emergency', 
    message: 'I have a water leak! Can you come ASAP?' 
  },
];
```

### **Add More Variables:**

```typescript
const [testVariables, setTestVariables] = useState({
  ...
  emergency_fee: '$50',
  insurance_info: 'Policy #12345',
});
```

---

## 📱 Responsive Design

- ✅ Desktop: 2-column layout
- ✅ Tablet: 2-column stacked
- ✅ Mobile: Single column
- ✅ All controls accessible
- ✅ Scrollable sections

---

## 🎊 Summary

**You now have:**
- ✅ Comprehensive AI testing page
- ✅ Template preview tool
- ✅ Quick response tester
- ✅ 8 realistic scenarios
- ✅ Variable editor
- ✅ Copy to clipboard
- ✅ Live settings display
- ✅ Quick action buttons

**Perfect for:**
- 🧪 Testing AI configurations
- 📝 Previewing templates
- 🎓 Training staff
- 🐛 Debugging issues
- 📊 Demonstrating features
- ✨ Quality assurance

---

**Access:** `http://localhost:3000/test/ai`

🚀 **Your AI Testing Lab is ready!**

