# 📝 What Are Templates & How To Use Them

## 🎯 **What Templates Are:**

Templates are **pre-written message templates** that cleaners use to communicate with their clients. Think of them as "fill-in-the-blank" messages that save time!

---

## 💡 **Real-World Example:**

### **Without Templates:**
Every time you get a new booking, you manually type:
```
"Hi Sarah! Thank you for booking with me. Your deep cleaning 
is confirmed for January 15th at 2:00 PM at 123 Main St. 
I'll bring all supplies. Looking forward to it! - John"
```

**Problems:**
- ⏰ Takes 2-3 minutes per message
- 😰 Might forget important details
- 📝 Inconsistent messaging
- 🔄 Repeat the same thing 20 times a day

### **With Templates:**
You create ONE template:
```
"Hi {client_name}! Thank you for booking with me. Your 
{service_type} is confirmed for {date} at {time} at 
{property_address}. I'll bring all supplies. Looking 
forward to it! - {cleaner_name}"
```

**Benefits:**
- ⚡ Takes 5 seconds to send
- ✅ Never forget details
- 💼 Professional every time
- 🎉 Saves 5-10 hours per week!

---

## 🔄 **How Templates Work:**

### **Step 1: Create Template (One Time)**
```
Template: "Hi {client_name}! Your {service_type} is 
confirmed for {date} at {time}!"
```

### **Step 2: AI Fills Variables (Automatic)**
When you have a booking, the AI automatically replaces:
- `{client_name}` → "Sarah"
- `{service_type}` → "Deep Clean"
- `{date}` → "January 15, 2025"
- `{time}` → "2:00 PM"

### **Step 3: Final Message (Ready to Send)**
```
"Hi Sarah! Your Deep Clean is confirmed for 
January 15, 2025 at 2:00 PM!"
```

---

## 📚 **Types of Templates:**

### **1. Booking Confirmation**
**When:** New booking received  
**Example:**
```
"Hi {client_name}! 🎉 Your {service_type} is confirmed 
for {date} at {time}! I'll arrive at {property_address} 
with all professional supplies. Can't wait to make your 
{property_type} sparkle! - {cleaner_name}"
```

### **2. Running Late**
**When:** Traffic or delay  
**Example:**
```
"Hi {client_name}, I'm running about 15 minutes late due 
to traffic. I'll be there around {time}. Sorry for the 
delay and thank you for your patience!"
```

### **3. Job Complete**
**When:** Finished cleaning  
**Example:**
```
"Hi {client_name}! ✨ Your cleaning is complete! Today 
I cleaned: {services_performed}. Total time: {duration}. 
Your {property_type} looks amazing! Please let me know 
if you need anything else."
```

### **4. Review Request**
**When:** After successful job  
**Example:**
```
"Hi {client_name}! ❤️ I hope you're loving your freshly 
cleaned space! If you were happy with my service, would 
you mind leaving a quick review? It really helps my small 
business. Thank you so much! 🙏"
```

### **5. Reschedule**
**When:** Client asks to change date  
**Example:**
```
"Hi {client_name}, no problem at all! I have availability 
on {next_booking_date}. Would that work for you? Let me 
know what works best!"
```

---

## 🚀 **How To Use Templates:**

### **Option 1: Manual Use (Copy & Paste)**

1. **Go to your templates**
2. **Select the right template** (e.g., "Booking Confirmation")
3. **AI fills in the variables automatically** from the booking data
4. **Copy the message**
5. **Paste into SMS/Email/App**
6. **Send!**

**Time:** 10 seconds vs 3 minutes typing!

---

### **Option 2: AI Auto-Send (Future Feature)**

With AI Assistant enabled:
1. **New booking comes in** → AI detects it
2. **AI selects right template** → "Booking Confirmation"
3. **AI fills variables** → From booking data
4. **AI sends message** → Automatically to client
5. **You get notified** → "Message sent to Sarah"

**Time:** 0 seconds (fully automated)!

---

## 🎮 **How To "Activate" a Template:**

### **In Your System:**

**Step 1: Create/Save Template**
```
Location: Template Creator or Template Library
Action: Click "Save to My Collection"
Status: Template is now in your personal collection
```

**Step 2: Mark as Active**
```
Location: Your Templates List
Action: Toggle "Active" switch to ON
Status: Template is now available for use
```

**Step 3: Use Template**
```
Method 1 (Manual):
- Go to booking
- Click "Use Template"
- Select template
- AI fills variables
- Copy & send

Method 2 (Auto - Future):
- AI detects booking event
- AI selects appropriate template
- AI sends automatically
```

---

## 💻 **Using Templates in Test Page:**

### **What You Can Do Now:**

**1. Create Template:**
- Go to `/templates/create`
- Write your message with `{variables}`
- Click "Save to My Collection"
- Template is now active!

**2. Test Template:**
- Go to `/test/ai`
- Click on your template
- Edit the variable values
- Click "Render Template"
- See the final message!cd C:\Users\onlyw\Documents\GitHub\puretask-backend\reactSetup
npm run dev
- Copy to clipboard
- Use in real conversation!

**3. Publish to Marketplace:**
- Create a great template
- Click "Publish to Marketplace"
- Other cleaners can use it!
- You get featured if it's popular!

---

## 🎯 **Real-World Workflow:**

### **Monday Morning (Without Templates):**
```
9:00 AM - New booking: Sarah, Deep Clean, 2 PM
         → Type 5 min message ⏰

9:15 AM - New booking: John, Move-out, 4 PM
         → Type 5 min message ⏰

9:30 AM - New booking: Lisa, Standard, 10 AM
         → Type 5 min message ⏰

Total: 15 minutes just on confirmations! 😰
```

### **Monday Morning (With Templates):**
```
9:00 AM - New booking: Sarah, Deep Clean, 2 PM
         → Click template → Send ⚡ (10 seconds)

9:15 AM - New booking: John, Move-out, 4 PM
         → Click template → Send ⚡ (10 seconds)

9:30 AM - New booking: Lisa, Standard, 10 AM
         → Click template → Send ⚡ (10 seconds)

Total: 30 seconds! 🎉 Saved 14.5 minutes!
```

**Over a week:** Save 5-10 hours!  
**Over a month:** Save 20-40 hours!  
**Over a year:** Save 240-480 hours! (That's 30-60 workdays!)

---

## 📊 **Template Variables Available:**

You can use these in any template:

```
{client_name}           - "Sarah"
{client_full_name}      - "Sarah Johnson"
{cleaner_name}          - "John"
{cleaner_full_name}     - "John Smith"
{date}                  - "January 15, 2025"
{time}                  - "2:00 PM"
{property_type}         - "apartment" or "house"
{property_address}      - "123 Main St, Apt 4B"
{service_type}          - "Deep Clean" or "Standard Clean"
{duration}              - "3 hours"
{price}                 - "$150"
{booking_id}            - "#BK-12345"
{special_instructions}  - Client's special requests
{services_performed}    - "Kitchen, 2 bathrooms, 2 bedrooms"
{payment_method}        - "Credit Card"
{next_booking_date}     - "February 15, 2025"
```

---

## ✅ **Best Practices:**

### **DO:**
✅ Use friendly, professional tone  
✅ Include all important details  
✅ Add emojis sparingly (1-2 per message)  
✅ Keep under 1000 characters  
✅ Test with preview before using  
✅ Create templates for common scenarios  

### **DON'T:**
❌ Use too many emojis (looks unprofessional)  
❌ Write super long messages (TL;DR)  
❌ Forget to include key information  
❌ Use overly formal language (be friendly!)  
❌ Have typos (proofread!)  

---

## 🎓 **Template Strategy:**

### **Must-Have Templates (Start with these 5):**

1. **Booking Confirmation** - Most used!
2. **Running Late** - Emergencies happen
3. **Job Complete** - Professional finish
4. **Review Request** - Grow your business
5. **Reschedule** - Flexibility

### **Nice-to-Have Templates:**

6. Thank you message
7. Follow-up message
8. Special offer
9. Holiday greeting
10. Weather delay

### **Power User Templates:**

11. Move-in/move-out specific
12. Commercial cleaning
13. Deep clean details
14. Recurring booking reminder
15. Payment reminder

---

## 💡 **Pro Tips:**

### **Tip 1: Personalize Your Templates**
Don't use generic templates! Add your personal touch:
```
Generic: "Your cleaning is confirmed."
Better: "Can't wait to make your space sparkle! ✨"
```

### **Tip 2: Test Before Using**
Always test in the Test Page first:
1. Go to `/test/ai`
2. Select template
3. Fill in variables
4. Preview output
5. Make sure it sounds right!

### **Tip 3: Save Time with Quick Responses**
For very short replies, use Quick Responses instead:
```
Trigger: "how much"
Response: "My rates start at $100 for standard cleaning!"
```

### **Tip 4: Update Regularly**
Review templates monthly:
- Do they still sound like you?
- Any outdated info?
- Can they be improved?

---

## 🎯 **Summary:**

**What:** Pre-written messages with variables  
**Why:** Save 5-10 hours per week  
**How:** Create once, use forever  
**Where:** Test page, Template Creator, Template Library  
**When:** Every client interaction  

**Benefits:**
- ⚡ Respond instantly
- ✅ Never forget details
- 💼 Always professional
- 🎉 More time for actual cleaning
- 💰 More bookings (faster responses win!)

---

## 🚀 **Get Started:**

1. **Create your first template:**
   - Go to `/templates/create`
   - Write a booking confirmation
   - Use variables like `{client_name}` and `{date}`
   - Save it!

2. **Test it:**
   - Go to `/test/ai`
   - Select your template
   - See how it looks with real data
   - Copy and use!

3. **Create more:**
   - Running late template
   - Job complete template
   - Review request template

4. **Save hours:**
   - Use templates for every message
   - Watch your time savings grow!

---

**Templates = Your secret weapon for growing your cleaning business!** 🚀

Every successful cleaner uses templates. Start today and save 5-10 hours this week!

