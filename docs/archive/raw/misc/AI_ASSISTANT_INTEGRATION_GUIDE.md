# 🤖 AI Assistant Integration Guide

## Complete Migration from Base44 to PureTask Backend

---

## **Phase 1: Backend Setup** ✅

### **Step 1.1: Run Database Migration**

```bash
# Apply the AI Assistant schema migration
psql $DATABASE_URL < DB/migrations/026_ai_assistant_schema.sql
```

**This adds:**
- `communication_settings` JSONB column to `cleaner_profiles`
- `message_delivery_log` table
- `ai_suggestions` table
- `ai_activity_log` table
- AI-related columns to `jobs` and `client_profiles`
- Helper functions for counting active features

### **Step 1.2: Install Dependencies**

```bash
npm install openai@^4.0.0
```

**Already have:**
- ✅ Express
- ✅ PostgreSQL (via Neon)
- ✅ TypeScript
- ✅ Your existing auth middleware

### **Step 1.3: Set Environment Variables**

```bash
# .env
OPENAI_API_KEY=sk-your-openai-key-here
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### **Step 1.4: Register AI Routes**

```typescript
// src/index.ts
import aiRouter from './routes/ai';

// Add after your existing routes
app.use('/ai', aiRouter);
```

---

## **Phase 2: Frontend Integration**

### **Step 2.1: Create API Client Adapter**

Create `src/frontend/lib/aiApi.ts`:

```typescript
// Replace Base44 SDK calls with your API

const API_BASE = '/api'; // Your API base URL

export const aiApi = {
  // Get AI settings
  getSettings: async () => {
    const res = await fetch(`${API_BASE}/ai/settings`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  // Update AI settings
  updateSettings: async (settings: any) => {
    const res = await fetch(`${API_BASE}/ai/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  // Get booking slot suggestions
  suggestSlots: async (params: any) => {
    const res = await fetch(`${API_BASE}/ai/suggest-slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(params)
    });
    return res.json();
  },

  // Process client response
  processClientResponse: async (data: any) => {
    const res = await fetch(`${API_BASE}/ai/process-client-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Send automated message
  sendMessage: async (data: any) => {
    const res = await fetch(`${API_BASE}/ai/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Get AI insights
  getInsights: async () => {
    const res = await fetch(`${API_BASE}/ai/insights`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  // Generate response suggestions
  generateResponse: async (params: any) => {
    const res = await fetch(`${API_BASE}/ai/generate-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(params)
    });
    return res.json();
  }
};

function getToken() {
  // Your token retrieval logic
  return localStorage.getItem('auth_token');
}
```

### **Step 2.2: Adapt React Components**

For **EACH** React component from the Base44 project, replace Base44 SDK calls with your API:

**Example: AIAssistantGuide.jsx**

**BEFORE (Base44):**
```javascript
import { base44 } from '@/api/base44Client';

const onStartSetup = async () => {
  const profile = await base44.entities.CleanerProfile.filter({
    user_email: currentUser.email
  });
  // ...
};
```

**AFTER (Your API):**
```javascript
import { aiApi } from '@/lib/aiApi';

const onStartSetup = async () => {
  const { settings } = await aiApi.getSettings();
  // ...
};
```

### **Step 2.3: Component Replacement Map**

| Base44 Call | Your API Replacement |
|-------------|---------------------|
| `base44.entities.CleanerProfile.filter()` | `aiApi.getSettings()` |
| `base44.entities.CleanerProfile.update()` | `aiApi.updateSettings()` |
| `base44.functions.invoke('agentAssistant')` | `aiApi.getInsights()` |
| `base44.functions.invoke('suggestBookingSlots')` | `aiApi.suggestSlots()` |
| `base44.integrations.Core.InvokeLLM()` | `aiApi.generateResponse()` |
| `base44.entities.Booking.filter()` | `fetch('/api/bookings?cleaner_id=...')` |
| `base44.auth.me()` | Your auth context (`useAuth()`) |

---

## **Phase 3: Copy Frontend Components**

### **Step 3.1: Copy All AI Components**

```bash
# Copy all AI-related components to your frontend
cp -r base44_project/src/components/ai your_project/src/components/
```

**Components to copy:**
- `AIAssistantGuide.jsx`
- `AIAssistantOnboardingWizard.jsx`
- `AIBadge.jsx`
- `AIFeatureShowcase.jsx`
- `AIImpactExplainer.jsx`
- `AIInsightsWidget.jsx`
- `AIResponseGenerator.jsx`
- `AIResponseSuggestions.jsx`
- `AISchedulingSettings.jsx`
- `AISchedulingSuggestions.jsx`
- `AISettingTooltip.jsx`
- `AITodoList.jsx`
- `AITooltip.jsx`
- `AICommunicationSettings.jsx`
- `AutomatedJobReminders.jsx`
- `CleanerAssistantWidget.jsx`
- `CommunicationService.js` *(Adapt to use your API)*
- `MessagePreview.jsx`
- `MessageSettingCard.jsx`
- `ReliabilityImpactWidget.jsx`
- `SmartMatchingSettings.jsx`

### **Step 3.2: Update All Component Imports**

In **EVERY** copied component, replace Base44 imports:

**BEFORE:**
```javascript
import { base44 } from '@/api/base44Client';
```

**AFTER:**
```javascript
import { aiApi } from '@/lib/aiApi';
```

### **Step 3.3: Update Component Logic**

**Example: AIInsightsWidget.jsx**

**BEFORE:**
```javascript
const loadInsights = async () => {
  const response = await base44.functions.invoke('agentAssistant', {
    action: 'get_dashboard_insights',
    cleaner_email: cleanerProfile.user_email
  });
  setInsights(response.data);
};
```

**AFTER:**
```javascript
const loadInsights = async () => {
  const insights = await aiApi.getInsights();
  setInsights(insights);
};
```

---

## **Phase 4: Automated Communication Setup**

### **Step 4.1: Create Cron Job Service**

```typescript
// src/workers/aiCommunicationWorker.ts

import { query } from '../db/client';
import { AICommunicationService } from '../services/aiCommunication';
import { logger } from '../lib/logger';

export class AICommunicationWorker {
  /**
   * Send pre-cleaning reminders
   * Run daily at 8 AM
   */
  static async sendPreCleaningReminders() {
    try {
      // Get bookings that need reminders
      const result = await query(`
        SELECT 
          j.id as booking_id,
          j.client_id,
          j.cleaner_id,
          j.scheduled_start_at,
          j.address,
          j.hours,
          cp.communication_settings
        FROM jobs j
        JOIN cleaner_profiles cp ON cp.user_id = j.cleaner_id
        WHERE j.status IN ('scheduled', 'accepted')
        AND DATE(j.scheduled_start_at) = CURRENT_DATE + INTERVAL '1 day'
        AND cp.communication_settings->'pre_cleaning_reminder'->>'enabled' = 'true'
        AND NOT EXISTS (
          SELECT 1 FROM message_delivery_log
          WHERE booking_id = j.id
          AND message_type = 'pre_cleaning_reminder'
        )
      `);

      for (const booking of result.rows) {
        await AICommunicationService.sendMessage({
          cleaner_id: booking.cleaner_id,
          client_id: booking.client_id,
          message_type: 'pre_cleaning_reminder',
          booking_id: booking.booking_id,
          custom_data: {
            date: new Date(booking.scheduled_start_at).toLocaleDateString(),
            time: new Date(booking.scheduled_start_at).toLocaleTimeString(),
            address: booking.address,
            hours: booking.hours
          }
        });

        logger.info('pre_cleaning_reminder_sent', { 
          booking_id: booking.booking_id 
        });
      }

      logger.info('pre_cleaning_reminders_completed', { 
        count: result.rows.length 
      });
    } catch (error) {
      logger.error('pre_cleaning_reminders_failed', { error });
    }
  }

  /**
   * Send review requests
   * Run every hour
   */
  static async sendReviewRequests() {
    try {
      const result = await query(`
        SELECT 
          j.id as booking_id,
          j.client_id,
          j.cleaner_id,
          j.actual_end_at,
          cp.communication_settings
        FROM jobs j
        JOIN cleaner_profiles cp ON cp.user_id = j.cleaner_id
        WHERE j.status = 'completed'
        AND j.actual_end_at IS NOT NULL
        AND j.actual_end_at > NOW() - INTERVAL '48 hours'
        AND cp.communication_settings->'review_request'->>'enabled' = 'true'
        AND NOT EXISTS (
          SELECT 1 FROM reviews WHERE job_id = j.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM message_delivery_log
          WHERE booking_id = j.id
          AND message_type = 'review_request'
        )
      `);

      for (const booking of result.rows) {
        const hours_after = booking.communication_settings?.review_request?.hours_after_completion || 24;
        const should_send_at = new Date(booking.actual_end_at);
        should_send_at.setHours(should_send_at.getHours() + hours_after);

        if (new Date() >= should_send_at) {
          await AICommunicationService.sendMessage({
            cleaner_id: booking.cleaner_id,
            client_id: booking.client_id,
            message_type: 'review_request',
            booking_id: booking.booking_id,
            custom_data: {
              review_link: `https://puretask.com/reviews/${booking.booking_id}`
            }
          });

          logger.info('review_request_sent', { booking_id: booking.booking_id });
        }
      }

      logger.info('review_requests_completed', { count: result.rows.length });
    } catch (error) {
      logger.error('review_requests_failed', { error });
    }
  }

  /**
   * Send booking confirmations
   * Triggered by booking status change
   */
  static async sendBookingConfirmation(bookingId: string) {
    try {
      const result = await query(`
        SELECT 
          j.id as booking_id,
          j.client_id,
          j.cleaner_id,
          j.scheduled_start_at,
          j.address,
          j.hours,
          j.entry_instructions,
          cp.communication_settings
        FROM jobs j
        JOIN cleaner_profiles cp ON cp.user_id = j.cleaner_id
        WHERE j.id = $1
        AND cp.communication_settings->'booking_confirmation'->>'enabled' = 'true'
      `, [bookingId]);

      if (result.rows.length > 0) {
        const booking = result.rows[0];

        await AICommunicationService.sendMessage({
          cleaner_id: booking.cleaner_id,
          client_id: booking.client_id,
          message_type: 'booking_confirmation',
          booking_id: booking.booking_id,
          custom_data: {
            date: new Date(booking.scheduled_start_at).toLocaleDateString(),
            time: new Date(booking.scheduled_start_at).toLocaleTimeString(),
            address: booking.address,
            hours: booking.hours,
            entry_instructions: booking.entry_instructions || 'N/A'
          }
        });

        logger.info('booking_confirmation_sent', { booking_id: bookingId });
      }
    } catch (error) {
      logger.error('booking_confirmation_failed', { error, bookingId });
    }
  }
}
```

### **Step 4.2: Set Up Cron Jobs**

```typescript
// src/workers/cronJobs.ts

import cron from 'node-cron';
import { AICommunicationWorker } from './aiCommunicationWorker';
import { logger } from '../lib/logger';

export function setupAICronJobs() {
  // Daily at 8 AM: Send pre-cleaning reminders
  cron.schedule('0 8 * * *', async () => {
    logger.info('cron_job_started', { job: 'pre_cleaning_reminders' });
    await AICommunicationWorker.sendPreCleaningReminders();
  });

  // Every hour: Send review requests
  cron.schedule('0 * * * *', async () => {
    logger.info('cron_job_started', { job: 'review_requests' });
    await AICommunicationWorker.sendReviewRequests();
  });

  logger.info('ai_cron_jobs_initialized');
}
```

```typescript
// src/index.ts
import { setupAICronJobs } from './workers/cronJobs';

// After server starts
setupAICronJobs();
```

---

## **Phase 5: Testing**

### **Step 5.1: Unit Tests**

```typescript
// src/tests/unit/aiCommunication.test.ts

import { AICommunicationService } from '../../services/aiCommunication';

describe('AICommunicationService', () => {
  it('should replace template variables correctly', () => {
    const template = 'Hi {client_name}! Your cleaning is on {date} at {time}.';
    const data = {
      client_name: 'John Doe',
      date: 'January 15',
      time: '2:00 PM'
    };

    const result = AICommunicationService.replaceVariables(template, data);

    expect(result).toBe('Hi John Doe! Your cleaning is on January 15 at 2:00 PM.');
  });
});
```

### **Step 5.2: Integration Tests**

```bash
# Test AI scheduling endpoint
curl -X POST http://localhost:4000/api/ai/suggest-slots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client-123",
    "cleaner_id": "cleaner-456",
    "cleaning_type": "deep",
    "estimated_hours": 3,
    "address": "123 Main St"
  }'
```

---

## **Phase 6: Deployment Checklist**

### **Before Production**

- [ ] Run database migration on production
- [ ] Set all environment variables
- [ ] Test SMS sending (Twilio)
- [ ] Test email sending
- [ ] Verify OpenAI API key works
- [ ] Set up cron job monitoring
- [ ] Configure error alerting (Sentry, etc.)
- [ ] Load test AI endpoints (expect 2-5s response times)
- [ ] Set up cost monitoring (OpenAI, Twilio)
- [ ] Create admin dashboard for AI analytics

---

## **Cost Estimates**

**For 1000 Active Cleaners:**

| Service | Cost/Month |
|---------|------------|
| OpenAI GPT-4 | ~$500 |
| Twilio SMS | ~$200 |
| Email (SendGrid) | ~$50 |
| **Total** | **~$750** |

**Per Cleaner:** $0.75/month  
**ROI:** If each cleaner earns +$100/month from AI = **13,233% ROI**

---

## **Monitoring & Analytics**

### **Key Metrics to Track**

```sql
-- Message delivery rates
SELECT 
  message_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE (delivery_results::jsonb->0->>'success')::boolean) as successful
FROM message_delivery_log
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY message_type;

-- AI suggestion acceptance rates
SELECT 
  suggestion_type,
  COUNT(*) as total_suggestions,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'accepted') / COUNT(*), 2) as acceptance_rate
FROM ai_suggestions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY suggestion_type;

-- Active AI features per cleaner
SELECT 
  ai_features_active_count,
  COUNT(*) as cleaner_count
FROM cleaner_profiles
WHERE ai_onboarding_completed = true
GROUP BY ai_features_active_count
ORDER BY ai_features_active_count DESC;
```

---

## **Troubleshooting**

### **Issue: SMS Not Sending**

```bash
# Check Twilio credentials
curl -X GET 'https://api.twilio.com/2010-04-01/Accounts.json' \
  -u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN
```

### **Issue: OpenAI Rate Limits**

```typescript
// Add retry logic with exponential backoff
import { Configuration, OpenAIApi } from 'openai';

const openai = new OpenAIApi(configuration);

async function callWithRetry(fn: Function, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.response?.status === 429 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

---

## **Next Steps**

1. ✅ Run database migration
2. ✅ Copy backend services
3. ✅ Register AI routes
4. ✅ Copy frontend components
5. ✅ Update all Base44 references
6. ✅ Set up cron jobs
7. ✅ Test end-to-end
8. ✅ Deploy to staging
9. ✅ Beta test with 10 cleaners
10. ✅ Full production launch

---

**Questions?** Check the code comments or reach out!

