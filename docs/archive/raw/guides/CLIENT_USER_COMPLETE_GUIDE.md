# 👤 **CLIENT USER - COMPLETE GUIDE & TEST CHECKLIST**

## 📋 **Quick Reference**

**What is a Client?**
A client is someone who **needs cleaning services**. As a client, you can:
- Browse and search for professional cleaners
- Book cleaning services
- Manage your bookings
- Communicate with cleaners
- Rate and review services
- Manage your account and payment methods

**Client Dashboard:** http://localhost:3001/client/dashboard

---

## 🎯 **What Can Clients Do?**

- ✅ Register for a free account
- ✅ Browse available cleaners
- ✅ Search by location, rating, price
- ✅ View cleaner profiles and reviews
- ✅ Book cleaning services
- ✅ Choose service types (standard, deep clean, etc.)
- ✅ Schedule date and time
- ✅ Make secure payments
- ✅ Track booking status
- ✅ Chat with cleaners
- ✅ Rate and review cleaners
- ✅ Manage recurring bookings
- ✅ View booking history
- ✅ Update profile and preferences
- ✅ Manage payment methods
- ✅ Get customer support

---

## 🚀 **STEP-BY-STEP CLIENT GUIDE**

### **SECTION 1: REGISTRATION & FIRST LOGIN**

#### **1.1 Create Your Client Account**
- [ ] Go to: http://localhost:3001/auth/register
- [ ] You should see "Create Your Account" form

**Registration Form:**
- [ ] Select **"I'm a Client"** (radio button or toggle)
- [ ] Enter your first name
- [ ] Enter your last name
- [ ] Enter your email address
- [ ] Create a strong password (min 8 characters)
- [ ] Confirm password
- [ ] (Optional) Enter phone number
- [ ] Agree to Terms of Service
- [ ] Click "Create Account" or "Sign Up"

**Expected Result:**
- ✅ Account created successfully
- ✅ You're automatically logged in
- ✅ Redirected to `/client/dashboard`
- ✅ Welcome message displays

**Test Credentials (For this guide, create):**
- Email: `testclient@example.com`
- Password: `TestPass123!`

#### **1.2 First Login (If Already Registered)**
- [ ] Go to: http://localhost:3001/auth/login
- [ ] Enter your email
- [ ] Enter your password
- [ ] Click "Sign In"
- [ ] Should redirect to `/client/dashboard`

#### **1.3 Dashboard Overview**
After login, you should see:
- [ ] Welcome message with your name
- [ ] Quick action buttons ("Find a Cleaner", "View Bookings")
- [ ] Upcoming bookings (if any)
- [ ] Recent activity
- [ ] Favorite cleaners (if any)
- [ ] Client badge in header

---

### **SECTION 2: BROWSE & SEARCH FOR CLEANERS**

#### **2.1 Access Cleaner Search**
- [ ] Click "Find a Cleaner" button (on dashboard or header)
- [ ] Or navigate to: http://localhost:3001/search
- [ ] Search page should load

**What You Should See:**
- Search/filter bar at top
- Location/ZIP code input
- Service type selector
- Date/time picker (optional)
- List of available cleaners
- Cleaner cards with:
  - Profile photo
  - Name
  - Star rating (⭐)
  - Number of reviews
  - Starting price
  - Distance from you
  - Available services
  - "View Profile" button

#### **2.2 Search by Location**
- [ ] Enter ZIP code or address in location field
- [ ] Example: "10001" or "New York, NY"
- [ ] Click "Search"
- [ ] Results should update showing nearby cleaners
- [ ] Cleaners sorted by distance (closest first)

#### **2.3 Filter by Service Type**
- [ ] Click "Service Type" filter
- [ ] Select options:
  - [ ] Standard Cleaning
  - [ ] Deep Cleaning
  - [ ] Move In/Move Out
  - [ ] Post-Construction
  - [ ] Window Cleaning
  - [ ] Carpet Cleaning
- [ ] Apply filter
- [ ] Results show only cleaners offering selected services

#### **2.4 Filter by Rating**
- [ ] Click "Rating" filter
- [ ] Select minimum rating (e.g., 4+ stars, 4.5+ stars)
- [ ] Results show only highly-rated cleaners

#### **2.5 Filter by Price Range**
- [ ] Click "Price" filter
- [ ] Set minimum and maximum price
- [ ] Example: $50 - $150
- [ ] Results update to show cleaners in price range

#### **2.6 Filter by Availability**
- [ ] Click "Availability" filter
- [ ] Select date and time you need service
- [ ] Results show only cleaners available at that time

#### **2.7 Sort Results**
- [ ] Try sorting by:
  - [ ] Distance (closest first)
  - [ ] Rating (highest first)
  - [ ] Price (lowest first)
  - [ ] Most popular
  - [ ] Newest

---

### **SECTION 3: VIEW CLEANER PROFILES**

#### **3.1 Open Cleaner Profile**
- [ ] Click on any cleaner card or "View Profile"
- [ ] Cleaner profile page should open

**Profile Should Show:**
- [ ] Large profile photo
- [ ] Cleaner's name
- [ ] Overall star rating (⭐ 4.8/5.0)
- [ ] Total number of reviews
- [ ] "Book Now" button (prominent)
- [ ] About/bio section
- [ ] Years of experience
- [ ] Services offered with prices
- [ ] Availability calendar
- [ ] Reviews from past clients
- [ ] Photos of their work (before/after)
- [ ] Certifications/badges (if any)
- [ ] Response time
- [ ] Completion rate

#### **3.2 Review Services & Pricing**
- [ ] Scroll to "Services" section
- [ ] Review available services:

**Typical Services:**
- Standard Cleaning - $X/hour
- Deep Cleaning - $X/hour
- Move In/Out - $X flat rate
- Window Cleaning - $X flat rate
- Special requests available

- [ ] Check if pricing is hourly or flat rate
- [ ] Note any minimum booking requirements

#### **3.3 Check Availability**
- [ ] Scroll to availability calendar
- [ ] Check cleaner's available dates/times
- [ ] Green = Available
- [ ] Yellow = Limited availability
- [ ] Red = Booked

#### **3.4 Read Reviews**
- [ ] Scroll to "Reviews" section
- [ ] Read recent client reviews
- [ ] Check rating breakdown (5⭐, 4⭐, 3⭐, etc.)
- [ ] Look for:
  - Quality comments
  - Punctuality feedback
  - Professionalism notes
  - Value for money
  - Would recommend?

#### **3.5 View Work Photos** (If available)
- [ ] Check "Gallery" or "Before/After" section
- [ ] Review photos of completed work
- [ ] Verify quality of cleaning

#### **3.6 Save to Favorites**
- [ ] Click "❤️ Add to Favorites" button
- [ ] Cleaner should be saved to your favorites list
- [ ] Access favorites from dashboard later

---

### **SECTION 4: BOOKING A CLEANING SERVICE**

#### **4.1 Start Booking Process**
- [ ] From cleaner's profile, click "Book Now"
- [ ] Booking form should open

**Booking Form Steps:**
1. Select Service
2. Choose Date & Time
3. Provide Address
4. Add Special Instructions
5. Review & Confirm
6. Payment

#### **4.2 Select Service Type**
- [ ] Choose service from dropdown:
  - [ ] Standard Cleaning
  - [ ] Deep Cleaning
  - [ ] Move In/Out Cleaning
  - [ ] Other services
- [ ] Select duration (if applicable):
  - [ ] 2 hours
  - [ ] 3 hours
  - [ ] 4 hours
  - [ ] Custom
- [ ] Review price calculation

**Price Should Show:**
- Service base price
- Duration multiplier (if hourly)
- Any add-ons
- Subtotal
- Service fee
- **Total amount**

#### **4.3 Choose Date & Time**
- [ ] Click date picker
- [ ] Select desired date (future only)
- [ ] Choose start time from available slots
- [ ] Confirm end time (based on duration)
- [ ] Check if cleaner is available (green checkmark)

#### **4.4 Provide Service Address**
- [ ] Enter street address
- [ ] Enter city
- [ ] Enter state
- [ ] Enter ZIP code
- [ ] (Optional) Add apartment/unit number
- [ ] (Optional) Add gate code or access instructions

#### **4.5 Add Special Instructions**
- [ ] Text area for special requests
- [ ] Examples:
  - "Please focus on kitchen and bathrooms"
  - "Pet-friendly products required - we have a dog"
  - "Key is with building manager in unit 101"
  - "Please be quiet - baby napping"
- [ ] Add any important details

#### **4.6 Review Booking Summary**
- [ ] Review all booking details:
  - [ ] Cleaner name and photo
  - [ ] Service type
  - [ ] Date and time
  - [ ] Duration
  - [ ] Address
  - [ ] Special instructions
  - [ ] Total price

- [ ] Check "I agree to terms and conditions"
- [ ] Verify cancellation policy

#### **4.7 Payment**
- [ ] Enter payment method:
  - [ ] Credit/Debit Card
  - [ ] Saved payment method (if any)
  
**Card Payment:**
- [ ] Enter card number
- [ ] Enter expiration date (MM/YY)
- [ ] Enter CVV (3-4 digits)
- [ ] Enter billing ZIP code
- [ ] (Optional) Check "Save for future use"

- [ ] Click "Confirm & Pay"

**Expected Result:**
- ✅ Payment processes successfully
- ✅ Booking confirmation appears
- ✅ Confirmation email sent
- ✅ Redirected to booking details page

#### **4.8 Booking Confirmation**
After successful booking:
- [ ] Verify confirmation message displays
- [ ] Check for booking ID/reference number
- [ ] Confirm email received
- [ ] Review booking details
- [ ] Note cleaner's contact info (for chat)

---

### **SECTION 5: MANAGE YOUR BOOKINGS**

#### **5.1 Access Your Bookings**
- [ ] Navigate to `/client/dashboard`
- [ ] Or click "My Bookings" in navigation
- [ ] Should see list of your bookings

**Booking Categories:**
- [ ] Upcoming Bookings (future dates)
- [ ] In Progress (happening now)
- [ ] Completed (past bookings)
- [ ] Cancelled

#### **5.2 View Upcoming Bookings**
- [ ] Click "Upcoming" tab
- [ ] See all future scheduled cleanings
- [ ] Each booking card shows:
  - Cleaner photo and name
  - Service type
  - Date and time
  - Location (short address)
  - Status (Pending/Confirmed)
  - Action buttons (View, Message, Cancel)

#### **5.3 View Booking Details**
- [ ] Click on any booking or "View Details"
- [ ] Full booking page opens

**Booking Details Include:**
- Booking ID
- Status with timeline
- Cleaner information
- Service details
- Date, time, duration
- Full address
- Special instructions
- Price breakdown
- Payment status
- Cancellation policy
- Action buttons:
  - [ ] Message Cleaner
  - [ ] Modify Booking (if allowed)
  - [ ] Cancel Booking
  - [ ] Get Directions
  - [ ] Add to Calendar

#### **5.4 Modify a Booking** (If before 24 hours)
- [ ] From booking details, click "Modify"
- [ ] Can change:
  - [ ] Date/time (if cleaner available)
  - [ ] Service duration
  - [ ] Special instructions
- [ ] Cannot typically change service address (would need to cancel and rebook)
- [ ] Save changes
- [ ] Verify cleaner receives update notification

#### **5.5 Cancel a Booking**
- [ ] From booking details, click "Cancel Booking"
- [ ] Warning modal appears with cancellation policy
  
**Cancellation Policies (typical):**
- 48+ hours before: Full refund
- 24-48 hours: 50% refund
- Less than 24 hours: No refund
- Emergency cancellation: Contact support

- [ ] Select cancellation reason (dropdown)
- [ ] (Optional) Add explanation
- [ ] Confirm cancellation
- [ ] Verify refund amount (if applicable)
- [ ] Booking status changes to "Cancelled"

#### **5.6 Track In-Progress Booking**
On the day of service:
- [ ] Check booking status updates:
  - "Cleaner en route" (with ETA)
  - "Cleaner has arrived"
  - "Service in progress"
  - "Service completed - awaiting your confirmation"

- [ ] (Optional) Real-time tracking of cleaner location
- [ ] Receive notifications at each status change

#### **5.7 View Completed Bookings**
- [ ] Click "Completed" tab
- [ ] See history of past cleanings
- [ ] Each shows:
  - Date of service
  - Cleaner name
  - Service type
  - Amount paid
  - Review status (pending or completed)
  - "Book Again" button
  - "Leave Review" button (if not done)

---

### **SECTION 6: COMMUNICATION WITH CLEANERS**

#### **6.1 Access Messaging**
- [ ] From dashboard, click "Messages"
- [ ] Or from booking details, click "Message Cleaner"
- [ ] Chat interface opens

**Messaging Interface:**
- [ ] List of conversations (left sidebar)
- [ ] Active chat with cleaner (right side)
- [ ] Cleaner's name and photo at top
- [ ] Related booking info displayed
- [ ] Text input at bottom
- [ ] Send button

#### **6.2 Send a Message**
- [ ] Type message in text field
- [ ] Examples:
  - "What time will you arrive?"
  - "I forgot to mention - please use the side entrance"
  - "Can you bring pet-safe cleaning products?"
  - "Thanks for the great service!"
- [ ] Click "Send" or press Enter
- [ ] Message appears in chat
- [ ] Read receipts show when cleaner has seen it

#### **6.3 Receive Messages**
- [ ] New message notification appears (badge)
- [ ] Click to open conversation
- [ ] Read cleaner's message
- [ ] Respond as needed

#### **6.4 Send Photos** (If supported)
- [ ] Click photo/attachment icon
- [ ] Select photo from device
- [ ] Example: "Here's the area that needs special attention"
- [ ] Send photo in chat

#### **6.5 Pre-Service Communication**
Common messages before service:
- [ ] Confirm arrival time
- [ ] Share access instructions
- [ ] Mention special requests
- [ ] Ask about supplies needed

#### **6.6 During Service Communication**
- [ ] Quick check-ins
- [ ] Answer cleaner's questions
- [ ] Approve additional services (if offered)

#### **6.7 Post-Service Communication**
- [ ] Confirm satisfaction
- [ ] Ask any follow-up questions
- [ ] Thank cleaner
- [ ] Discuss next booking

---

### **SECTION 7: RATINGS & REVIEWS**

#### **7.1 Leave a Review After Service**
After service completion:
- [ ] Navigate to completed booking
- [ ] Click "Leave Review" button
- [ ] Review form opens

**Review Form:**
- [ ] **Star Rating** (1-5 stars)
  - 5 ⭐⭐⭐⭐⭐ Excellent
  - 4 ⭐⭐⭐⭐ Good
  - 3 ⭐⭐⭐ Average
  - 2 ⭐⭐ Poor
  - 1 ⭐ Very Poor

- [ ] **Category Ratings** (Optional)
  - Quality of work (1-5 stars)
  - Punctuality (1-5 stars)
  - Professionalism (1-5 stars)
  - Value for money (1-5 stars)
  - Communication (1-5 stars)

- [ ] **Written Review** (Optional but recommended)
  - Min 50 characters
  - Max 500 characters
  - Be honest and constructive

- [ ] **Would you recommend?** (Yes/No)

- [ ] **Upload Photos** (Optional)
  - Before/after if applicable
  - Shows quality of work

- [ ] Click "Submit Review"

**Expected Result:**
- ✅ Review submitted successfully
- ✅ Thank you message appears
- ✅ Review appears on cleaner's profile (after moderation)
- ✅ You can edit review within 48 hours

#### **7.2 Review Tips** (Best Practices)
Good reviews mention:
- [ ] Specific services performed well
- [ ] Cleaner's attitude and professionalism
- [ ] Quality of cleaning
- [ ] Punctuality and communication
- [ ] Would you hire again?

Example: 
"Maria did an excellent deep clean of our 2BR apartment. She was on time, very thorough, and the kitchen and bathrooms sparkle! Professional and friendly. Would definitely book again. 5 stars! ⭐⭐⭐⭐⭐"

#### **7.3 Edit Your Review** (Within 48 hours)
- [ ] Go to booking details
- [ ] Click "Edit Review"
- [ ] Make changes
- [ ] Save updated review

---

### **SECTION 8: RECURRING BOOKINGS**

#### **8.1 Set Up Recurring Service**
- [ ] From a cleaner's profile or after a successful booking
- [ ] Click "Schedule Recurring Service"
- [ ] Recurring booking form opens

**Recurring Setup:**
- [ ] Select frequency:
  - [ ] Weekly (every 7 days)
  - [ ] Bi-weekly (every 14 days)
  - [ ] Monthly (every 30 days)
  - [ ] Custom schedule

- [ ] Choose day of week (e.g., "Every Monday")
- [ ] Choose time (e.g., "10:00 AM")
- [ ] Select service type
- [ ] Select duration
- [ ] Enter address (same each time or rotating)
- [ ] Set start date (first occurrence)
- [ ] Set end date or "Until I cancel"

- [ ] Review pricing (may get recurring discount)
- [ ] Confirm recurring booking

**Expected Result:**
- ✅ Recurring series created
- ✅ All future bookings appear in calendar
- ✅ Automatic booking confirmation before each occurrence
- ✅ Automatic payment on each booking

#### **8.2 Manage Recurring Bookings**
- [ ] View all recurring series from dashboard
- [ ] See next scheduled occurrence
- [ ] Total bookings in series
- [ ] Actions:
  - [ ] Skip next occurrence
  - [ ] Pause series temporarily
  - [ ] Cancel entire series
  - [ ] Modify schedule

#### **8.3 Skip One Occurrence**
- [ ] Select the specific booking to skip
- [ ] Click "Skip This One"
- [ ] Confirm
- [ ] That date is removed, next occurrence remains scheduled

#### **8.4 Cancel Recurring Series**
- [ ] Click "Manage Recurring Booking"
- [ ] Click "Cancel Series"
- [ ] Choose:
  - [ ] Cancel all future bookings
  - [ ] Cancel after X occurrences
- [ ] Confirm cancellation

---

### **SECTION 9: PAYMENTS & BILLING**

#### **9.1 Access Payment Settings**
- [ ] Navigate to `/client/settings` or profile menu
- [ ] Click "Payment Methods" tab

**What You Should See:**
- Saved payment methods (cards)
- Default payment method (starred/highlighted)
- Transaction history
- Invoices/receipts

#### **9.2 Add Payment Method**
- [ ] Click "Add Payment Method" or "Add Card"
- [ ] Enter card details:
  - [ ] Card number (16 digits)
  - [ ] Cardholder name
  - [ ] Expiration date (MM/YY)
  - [ ] CVV (3-4 digits)
  - [ ] Billing ZIP code
- [ ] (Optional) Set as default
- [ ] Click "Save Card"
- [ ] Card is securely saved (shows last 4 digits)

#### **9.3 Manage Saved Cards**
- [ ] View all saved cards
- [ ] Set default card (star icon)
- [ ] Remove card (delete icon)
- [ ] Update card details (if expired)

#### **9.4 View Transaction History**
- [ ] Click "Transaction History" or "Billing"
- [ ] See all past charges:
  - Date
  - Booking ID
  - Cleaner name
  - Service type
  - Amount charged
  - Payment method used
  - Status (Success/Failed/Refunded)
  - Download receipt

#### **9.5 Download Invoices/Receipts**
- [ ] From transaction history
- [ ] Click "Download Receipt" for any transaction
- [ ] PDF receipt downloads with:
  - Booking details
  - Service breakdown
  - Payment info
  - Tax info (if applicable)
  - Business details for expense reports

#### **9.6 Handle Failed Payments**
If a payment fails:
- [ ] You'll receive email notification
- [ ] Booking may be on hold
- [ ] Update payment method
- [ ] Retry payment
- [ ] Or cancel booking if cannot pay

#### **9.7 Request Refund**
If service was unsatisfactory:
- [ ] Go to completed booking
- [ ] Click "Request Refund" or "Report Issue"
- [ ] Select reason:
  - Service not completed
  - Poor quality
  - Cleaner no-show
  - Damaged property
  - Other
- [ ] Provide details and evidence (photos if applicable)
- [ ] Submit request
- [ ] Admin will review (usually within 24-48 hours)
- [ ] Refund processed to original payment method

---

### **SECTION 10: PROFILE & ACCOUNT SETTINGS**

#### **10.1 Access Account Settings**
- [ ] Click your profile icon/name in header
- [ ] Select "Settings" or "Account"
- [ ] Or navigate to `/client/settings`

**Settings Categories:**
- Personal Information
- Contact Details
- Address Book
- Preferences
- Notifications
- Privacy & Security
- Payment Methods (covered above)

#### **10.2 Update Personal Information**
- [ ] Click "Personal Information" tab
- [ ] Update fields:
  - [ ] First name
  - [ ] Last name
  - [ ] Profile photo (upload new)
  - [ ] Date of birth (optional)
  - [ ] Gender (optional)
- [ ] Click "Save Changes"
- [ ] Verify updates appear immediately

#### **10.3 Update Contact Details**
- [ ] Click "Contact Details" tab
- [ ] Update:
  - [ ] Email address (will require verification)
  - [ ] Phone number
  - [ ] Preferred contact method
- [ ] Save changes

**Note:** Changing email requires verification:
- [ ] Enter new email
- [ ] Click "Update Email"
- [ ] Check new email inbox for verification link
- [ ] Click link to confirm
- [ ] Email is updated

#### **10.4 Manage Address Book**
- [ ] Click "Address Book" or "Saved Addresses"
- [ ] See list of saved addresses
- [ ] Add new address:
  - [ ] Label (e.g., "Home", "Office", "Mom's House")
  - [ ] Street address
  - [ ] City, State, ZIP
  - [ ] Access instructions
  - [ ] Set as default
- [ ] Edit existing addresses
- [ ] Delete addresses
- [ ] Quick-select when booking

#### **10.5 Set Preferences**
- [ ] Click "Preferences" tab
- [ ] Set:
  - [ ] Preferred service days/times
  - [ ] Preferred cleaner attributes (pet-friendly, eco products, etc.)
  - [ ] Language preference
  - [ ] Currency (if international)
  - [ ] Timezone

#### **10.6 Notification Settings**
- [ ] Click "Notifications" tab
- [ ] Control what notifications you receive

**Email Notifications:**
- [ ] Booking confirmations
- [ ] Booking reminders (24hr before)
- [ ] Cleaner messages
- [ ] Payment receipts
- [ ] Promotional offers
- [ ] Newsletter

**SMS Notifications:**
- [ ] Booking confirmations
- [ ] Cleaner en route alerts
- [ ] Service completion
- [ ] Important updates

**Push Notifications (Mobile App):**
- [ ] Real-time messages
- [ ] Booking updates
- [ ] Promotions

- [ ] Save notification preferences

#### **10.7 Privacy & Security**
- [ ] Click "Privacy & Security" tab

**Security Settings:**
- [ ] Change password
  - [ ] Enter current password
  - [ ] Enter new password (min 8 chars)
  - [ ] Confirm new password
  - [ ] Save
  
- [ ] Enable Two-Factor Authentication (if available)
  - [ ] Link phone number
  - [ ] Receive SMS code
  - [ ] Enable 2FA
  
- [ ] View active sessions
  - [ ] See logged-in devices
  - [ ] Log out from other devices

**Privacy Settings:**
- [ ] Profile visibility
  - [ ] Public (visible to all cleaners)
  - [ ] Private (only to booked cleaners)
  
- [ ] Review visibility
  - [ ] Display name on reviews
  - [ ] Anonymous reviews
  
- [ ] Data export
  - [ ] Request your data (GDPR)
  - [ ] Download personal information

#### **10.8 Delete Account** (⚠️ Permanent)
- [ ] Scroll to bottom of settings
- [ ] Click "Delete Account"
- [ ] Warning modal appears explaining consequences
- [ ] Must cancel all active bookings first
- [ ] Enter password to confirm
- [ ] Select reason for leaving
- [ ] Click "Permanently Delete Account"
- [ ] Account and data are deleted

---

## 🔍 **COMPLETE TESTING CHECKLIST**

### **✅ Registration & Login**
- [ ] Can create client account
- [ ] Receives confirmation email
- [ ] Can login successfully
- [ ] Redirected to correct dashboard
- [ ] Client badge displays

### **✅ Cleaner Search & Browse**
- [ ] Can access search page
- [ ] Location search works
- [ ] Service filters work
- [ ] Rating filter works
- [ ] Price filter works
- [ ] Availability filter works
- [ ] Results display correctly
- [ ] Sorting works

### **✅ Cleaner Profiles**
- [ ] Can view cleaner profiles
- [ ] All profile info displays
- [ ] Services and pricing clear
- [ ] Availability calendar works
- [ ] Reviews load and display
- [ ] Can save to favorites

### **✅ Booking Process**
- [ ] Can initiate booking
- [ ] Service selection works
- [ ] Date/time picker works
- [ ] Address form works
- [ ] Special instructions save
- [ ] Booking summary accurate
- [ ] Payment processing works
- [ ] Confirmation received

### **✅ Booking Management**
- [ ] Can view all bookings
- [ ] Upcoming bookings display
- [ ] Booking details complete
- [ ] Can modify bookings
- [ ] Can cancel bookings
- [ ] Refund policy clear
- [ ] Booking history accurate

### **✅ Messaging**
- [ ] Can send messages
- [ ] Can receive messages
- [ ] Notifications work
- [ ] Read receipts work
- [ ] Can send photos (if supported)

### **✅ Reviews & Ratings**
- [ ] Can leave reviews
- [ ] Star rating works
- [ ] Written review saves
- [ ] Photos can be uploaded
- [ ] Review appears on cleaner profile
- [ ] Can edit review

### **✅ Recurring Bookings**
- [ ] Can set up recurring service
- [ ] Frequency options work
- [ ] Can view all occurrences
- [ ] Can skip occurrence
- [ ] Can cancel series

### **✅ Payments**
- [ ] Can add payment method
- [ ] Cards save securely
- [ ] Can set default card
- [ ] Transaction history accurate
- [ ] Receipts downloadable
- [ ] Refund requests work

### **✅ Account Settings**
- [ ] Can update personal info
- [ ] Can change email/phone
- [ ] Address book works
- [ ] Preferences save
- [ ] Notification settings work
- [ ] Privacy settings work
- [ ] Can change password

---

## 🐛 **ISSUES TO DOCUMENT**

### **Critical Issues (Breaks Functionality)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Major Issues (Impacts UX)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Minor Issues (Cosmetic/Polish)**
1. _____________________________________
2. _____________________________________
3. _____________________________________

### **Missing Features**
1. _____________________________________
2. _____________________________________
3. _____________________________________

---

## 💡 **CLIENT BEST PRACTICES**

### **Booking Tips**
- ✅ Book services at least 24-48 hours in advance
- ✅ Read cleaner reviews carefully
- ✅ Communicate special requests clearly
- ✅ Provide accurate address and access info
- ✅ Be home or available by phone during service
- ✅ Leave honest reviews to help others

### **Communication Tips**
- ✅ Respond to cleaner messages promptly
- ✅ Confirm appointment 24 hours before
- ✅ Notify cleaner of any changes ASAP
- ✅ Be clear and respectful

### **Payment Tips**
- ✅ Keep payment method up to date
- ✅ Download receipts for records/taxes
- ✅ Review charges before confirming
- ✅ Contact support if you see errors

### **Safety Tips**
- ✅ Only book through PureTask platform
- ✅ Don't share personal financial info via chat
- ✅ Report suspicious activity to admin
- ✅ Review cleaner profiles and ratings

---

## 🆘 **TROUBLESHOOTING**

### **Can't Find Cleaners in My Area**
- Try expanding search radius
- Check if you entered correct location
- Try searching by ZIP code instead of address
- Contact support to add cleaners in your area

### **Booking Payment Failed**
- Verify card details are correct
- Check card has sufficient funds
- Try different card
- Contact your bank
- Contact support if issue persists

### **Cleaner Not Responding to Messages**
- Wait 24 hours (they may be busy)
- Try calling if phone number provided
- Check booking status (may be auto-confirmed)
- Contact support if no response before service

### **Need to Cancel Within 24 Hours**
- Cancellation fee may apply
- Contact cleaner directly first
- Contact support for emergency cancellations
- Review cancellation policy

### **Unsatisfied with Service**
- Contact cleaner first to resolve
- Request refund through booking page
- Document issues with photos
- Contact support for mediation
- Leave honest review

---

## 🎉 **CLIENT GUIDE COMPLETE!**

You now know everything about:
- ✅ Creating and managing your client account
- ✅ Finding and booking cleaners
- ✅ Managing bookings and payments
- ✅ Communicating effectively
- ✅ Leaving helpful reviews
- ✅ Optimizing your experience

**Next Steps:**
1. Work through this checklist systematically
2. Test all features as a client
3. Document any issues found
4. Compare with cleaner experience next

---

**Happy Booking! 🏡✨**

