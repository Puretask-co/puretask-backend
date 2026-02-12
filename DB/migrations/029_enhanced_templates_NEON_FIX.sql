-- Migration 029: Enhanced Cleaner AI Templates & Quick Responses (NEON COMPATIBLE)
-- Adds professional templates and comprehensive quick response library
-- FIXED: Uses DEFAULT cleaner_id instead of querying cleaner_profiles

-- ============================================
-- ADDITIONAL PROFESSIONAL TEMPLATES
-- ============================================

INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_default, is_active) VALUES
('DEFAULT', 'job_complete_detailed', 'Professional Completion',
 'Hi {client_name}! ✨ I''ve just finished cleaning your {property_type}. Everything has been cleaned and organized according to your specifications. {rooms_cleaned} rooms completed. Please let me know if you need anything adjusted. Thank you for trusting me with your home! - {cleaner_name}',
 '["client_name", "property_type", "rooms_cleaned", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'review_request_detailed', 'Review Request',
 'Hi {client_name}! I hope you''re enjoying your freshly cleaned space! 🌟 If you were happy with my service, I would really appreciate it if you could leave a quick review. It helps me grow my business and helps other clients find great cleaning services. Thank you so much! - {cleaner_name}',
 '["client_name", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'rescheduling', 'Rescheduling Request',
 'Hi {client_name}, I need to reschedule our appointment originally set for {original_date} at {original_time}. {reason}. I have availability on {alternative_dates}. Would any of these work for you? I apologize for any inconvenience! - {cleaner_name}',
 '["client_name", "original_date", "original_time", "reason", "alternative_dates", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'running_late_detailed', 'Running Late Alert',
 'Hi {client_name}, I''m running about {minutes} minutes late due to {reason}. My new ETA is {new_eta}. I apologize for the delay and appreciate your patience! I''ll still complete the full cleaning as scheduled. - {cleaner_name}',
 '["client_name", "minutes", "reason", "new_eta", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'special_instructions', 'Special Instructions',
 'Hi {client_name}! Quick reminder about your cleaning tomorrow at {time}. I have noted your special instructions: {instructions}. If you need to add or change anything, please let me know before I arrive. Looking forward to it! 🧹 - {cleaner_name}',
 '["client_name", "time", "instructions", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'payment_thanks', 'Payment Thank You',
 'Hi {client_name}! Thank you so much for your payment of {amount}! 💰 It was a pleasure cleaning your {property_type}. I look forward to serving you again soon. Have a wonderful day! - {cleaner_name}',
 '["client_name", "amount", "property_type", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'vacation_reply', 'Vacation Auto-Reply',
 'Hi {client_name}! Thank you for reaching out. I''m currently on vacation from {start_date} to {end_date} and will have limited availability. I''ll respond to your message as soon as I return. For urgent matters, please contact {backup_contact}. Thank you for your understanding! 🌴 - {cleaner_name}',
 '["client_name", "start_date", "end_date", "backup_contact", "cleaner_name"]'::jsonb, false, false),

('DEFAULT', 'weather_delay', 'Weather Delay',
 'Hi {client_name}, Due to {weather_condition}, I may experience some delays today. I''m still planning to clean your property at {scheduled_time}, but wanted to give you a heads up that I might be {delay_minutes} minutes late. I''ll keep you updated! Stay safe! 🌧️ - {cleaner_name}',
 '["client_name", "weather_condition", "scheduled_time", "delay_minutes", "cleaner_name"]'::jsonb, false, true),

('DEFAULT', 'first_client_welcome', 'First Time Welcome',
 'Hi {client_name}! 👋 Welcome! I''m so excited to clean your {property_type} for the first time on {date} at {time}. I''ll arrive with all necessary supplies and equipment. If you have any specific preferences or areas you''d like me to focus on, please let me know! I can''t wait to make your space sparkle! ✨ - {cleaner_name}',
 '["client_name", "property_type", "date", "time", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'issue_resolution', 'Issue Resolution',
 'Hi {client_name}, Thank you for bringing {issue} to my attention. I take pride in my work and I''m sorry this didn''t meet your expectations. I''d like to make this right - I can {solution}. Your satisfaction is my top priority. Please let me know how you''d like to proceed. - {cleaner_name}',
 '["client_name", "issue", "solution", "cleaner_name"]'::jsonb, true, true),

('DEFAULT', 'referral_thanks', 'Referral Thank You',
 'Hi {client_name}! 🎉 Thank you so much for referring {referred_name} to my services! I really appreciate you spreading the word. As a token of my gratitude, I''d like to offer you {referral_discount} off your next cleaning. You''re amazing! - {cleaner_name}',
 '["client_name", "referred_name", "referral_discount", "cleaner_name"]'::jsonb, false, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMPREHENSIVE QUICK RESPONSES
-- ============================================

INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text) VALUES
('DEFAULT', 'payment', ARRAY['payment', 'pay', 'card', 'cash', 'venmo', 'paypal', 'zelle'],
 'I accept multiple payment methods for your convenience: credit/debit cards through the platform, Venmo, Zelle, PayPal, or cash. Payment is due immediately after service completion. All transactions are secure and you''ll receive a receipt. Which method works best for you?'),

('DEFAULT', 'cancellation', ARRAY['cancel', 'cancellation', 'refund', 'policy'],
 'My cancellation policy: FREE cancellation up to 48 hours before your appointment. Cancellations 24-48 hours in advance incur a 50% fee. Cancellations within 24 hours or no-shows are charged the full amount. This helps me manage my schedule and serve all my clients fairly. Need to reschedule? Just let me know ASAP!'),

('DEFAULT', 'pets_detailed', ARRAY['pet', 'dog', 'cat', 'animal', 'puppy'],
 'I love pets! 🐾 I''m comfortable cleaning homes with pets and have experience with dogs, cats, and other animals. For safety and efficiency, I do ask that pets be secured in a separate room during cleaning if possible. Please let me know about any pets so I can plan accordingly. Also, please inform me of any aggressive behaviors or special considerations.'),

('DEFAULT', 'supplies_detailed', ARRAY['supplies', 'products', 'bring', 'provide', 'cleaning products', 'equipment'],
 'I bring all necessary cleaning supplies and equipment including eco-friendly products, vacuum, mop, and microfiber cloths. All supplies are professional-grade and safe for most surfaces. If you prefer I use your specific products (due to allergies or preferences), I''m happy to do so! Just let me know beforehand. My supplies are included in the service price.'),

('DEFAULT', 'special_requests', ARRAY['special', 'extra', 'additional', 'custom', 'specific'],
 'I''m happy to accommodate special requests! Common add-ons include: interior windows, inside fridge/oven, laundry, organizing, and deep cleaning specific areas. Some requests may require additional time and cost. Please describe what you need, and I''ll let you know if it''s included in the standard service or provide a quote for the add-on.'),

('DEFAULT', 'access', ARRAY['parking', 'access', 'key', 'gate', 'code', 'enter', 'lockbox'],
 'Please provide access information before my arrival: parking location (street/driveway/garage), building entry codes, gate codes, lockbox combinations, or key pickup location. If you''ll be home, just let me know! For security, I can also work with electronic locks or key exchange apps. Clear access instructions help me arrive and start on time.'),

('DEFAULT', 'issues', ARRAY['issue', 'problem', 'concern', 'complaint', 'not satisfied', 'disappointed'],
 'I''m sorry to hear you''re not completely satisfied! Your happiness is my priority. Please let me know specifically what didn''t meet your expectations, and I''ll make it right. I offer a satisfaction guarantee - if something was missed or not cleaned to your standards, I''ll return within 24 hours to address it at no extra charge. Thank you for giving me the opportunity to fix this!'),

('DEFAULT', 'tipping', ARRAY['tip', 'gratuity', 'extra', 'appreciation'],
 'Tips are never expected but always appreciated! 😊 If you''re happy with my service and would like to leave a tip, you can add it through the platform, Venmo, Zelle, or cash. The industry standard is 15-20% for exceptional service, but any amount is gratefully received. Your positive reviews and referrals also mean the world to me!'),

('DEFAULT', 'frequency', ARRAY['weekly', 'biweekly', 'monthly', 'recurring', 'regular', 'schedule'],
 'I offer flexible scheduling options: Weekly (most popular for busy families), Bi-weekly (great balance of clean home and budget), Monthly (perfect for light maintenance), or One-time cleanings. Recurring clients receive priority scheduling and discounted rates! Regular cleaning also means each session is faster since we maintain consistent cleanliness. What frequency works best for your lifestyle?'),

('DEFAULT', 'eco_friendly', ARRAY['eco', 'green', 'natural', 'organic', 'chemical', 'safe', 'toxic'],
 'I use eco-friendly, non-toxic cleaning products that are safe for children, pets, and the environment! 🌱 All products are EPA-approved and free from harsh chemicals. They''re highly effective while being gentle on surfaces and safe for your family. If you have specific allergies or sensitivities, please let me know and I can accommodate with specialized products.'),

('DEFAULT', 'time_estimate', ARRAY['how long', 'duration', 'time', 'hours', 'minutes'],
 'Cleaning time depends on home size, condition, and service type. Typical estimates: Studio/1BR (1.5-2 hours), 2BR (2-3 hours), 3BR (3-4 hours), 4BR+ (4-6 hours). Deep cleaning takes 50% longer than standard cleaning. First-time cleanings are usually longer. I work efficiently but thoroughly - quality is never rushed! I''ll provide a specific time estimate once I know your home details.'),

('DEFAULT', 'background', ARRAY['background', 'check', 'verified', 'insured', 'bonded', 'trust'],
 'Your safety and peace of mind are paramount! ✅ I am fully background-checked, insured, and bonded through PureTask. All cleaners on this platform undergo thorough vetting including criminal background checks and reference verification. I also carry liability insurance to protect your property. You can view my verification status, reviews, and ratings on my profile.'),

('DEFAULT', 'move_cleaning', ARRAY['move', 'moving', 'move-in', 'move-out', 'empty', 'vacant'],
 'I specialize in move-in/move-out cleanings! These are deep cleans of empty properties including: all surfaces, inside cabinets/drawers, appliances (inside/out), baseboards, windows, and more. Perfect for getting your deposit back or preparing your new home! These cleanings are priced by square footage and condition. I can provide a quote with photos or details of the property.'),

('DEFAULT', 'same_day', ARRAY['same day', 'today', 'urgent', 'emergency', 'asap', 'last minute'],
 'I occasionally have same-day availability for urgent cleanings! 🚨 Same-day bookings are subject to availability and typically require a rush fee. Please message me with your location, home size, and timeframe, and I''ll let you know if I can accommodate you today. For best availability, I recommend booking at least 48 hours in advance.'),

('DEFAULT', 'whats_included', ARRAY['include', 'included', 'standard', 'basic', 'what do you clean', 'service'],
 'My standard cleaning includes: Kitchen (counters, sink, appliances exterior, floors), Bathrooms (toilet, shower/tub, sink, mirrors, floors), Living areas (dusting, vacuuming, mopping), Bedrooms (dusting, vacuuming, making beds), General (trash removal, surface cleaning). NOT included: inside oven/fridge, windows, laundry, dishes, organizing. These can be added for an additional fee!')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE cleaner_ai_templates IS 'Enhanced with 11 professional message templates covering all common scenarios';
COMMENT ON TABLE cleaner_quick_responses IS 'Enhanced with 15 comprehensive quick responses for common client questions';

SELECT 'Migration 029: Enhanced Cleaner AI Templates & Responses - COMPLETE!' AS status;

