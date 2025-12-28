# n8n API Integration Helper

## 🔑 n8n API Client

Helper functions for interacting with n8n API directly.

### Configuration

```bash
N8N_API_KEY=your-api-key-here
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http
```

### Usage Examples

#### 1. Trigger Workflow Programmatically

```typescript
import { triggerN8nWorkflow } from './lib/n8nClient';

// Trigger a workflow by ID
await triggerN8nWorkflow('workflow-id', {
  jobId: job.id,
  event: 'job.created'
});
```

#### 2. Get Workflow Executions

```typescript
import { getWorkflowExecutions } from './lib/n8nClient';

const executions = await getWorkflowExecutions('workflow-id', {
  limit: 10,
  status: 'success'
});
```

#### 3. Check Workflow Status

```typescript
import { getWorkflowStatus } from './lib/n8nClient';

const status = await getWorkflowStatus('workflow-id');
console.log('Active:', status.active);
```

### n8n API Client Implementation

Create `src/lib/n8nClient.ts`:

```typescript
import { env } from '../config/env';
import { logger } from './logger';

const N8N_BASE_URL = 'https://puretask.app.n8n.cloud/api/v1';

interface N8nApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * Make authenticated request to n8n API
 */
async function n8nApiRequest(
  endpoint: string,
  options: N8nApiOptions = {}
): Promise<any> {
  const { method = 'GET', body } = options;

  const response = await fetch(`${N8N_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'X-N8N-API-KEY': env.N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`n8n API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Trigger a workflow by ID
 */
export async function triggerN8nWorkflow(
  workflowId: string,
  data: Record<string, unknown>
): Promise<{ executionId: string }> {
  try {
    const result = await n8nApiRequest(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: data,
    });

    logger.info('n8n_workflow_triggered', { workflowId, executionId: result.data.executionId });
    return { executionId: result.data.executionId };
  } catch (error) {
    logger.error('n8n_trigger_failed', {
      workflowId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get workflow executions
 */
export async function getWorkflowExecutions(
  workflowId: string,
  options: {
    limit?: number;
    status?: 'success' | 'error' | 'waiting' | 'running';
  } = {}
): Promise<any[]> {
  const { limit = 10, status } = options;
  
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(status && { status }),
  });

  const result = await n8nApiRequest(
    `/workflows/${workflowId}/executions?${params}`
  );

  return result.data;
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(workflowId: string): Promise<{
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}> {
  const result = await n8nApiRequest(`/workflows/${workflowId}`);
  return result.data;
}

/**
 * List all workflows
 */
export async function listWorkflows(): Promise<any[]> {
  const result = await n8nApiRequest('/workflows');
  return result.data;
}

/**
 * Activate/Deactivate workflow
 */
export async function setWorkflowActive(
  workflowId: string,
  active: boolean
): Promise<void> {
  await n8nApiRequest(`/workflows/${workflowId}`, {
    method: 'PUT',
    body: { active },
  });

  logger.info('n8n_workflow_status_changed', { workflowId, active });
}

/**
 * Get execution details
 */
export async function getExecutionDetails(executionId: string): Promise<any> {
  const result = await n8nApiRequest(`/executions/${executionId}`);
  return result.data;
}
```

### Usage in Job Service

```typescript
// src/services/jobsService.ts

import { triggerN8nWorkflow } from '../lib/n8nClient';

export async function createJob(data: CreateJobInput): Promise<Job> {
  // Create job in database
  const job = await insertJob(data);

  // Trigger n8n notification workflow
  try {
    await triggerN8nWorkflow('job-notifications', {
      event: 'job.created',
      jobId: job.id,
      clientEmail: data.clientEmail,
      scheduledDate: data.scheduled_start_at,
      address: data.address,
    });
  } catch (error) {
    // Don't fail job creation if notification fails
    logger.error('n8n_notification_failed', { jobId: job.id, error });
  }

  return job;
}
```

### Error Handling

```typescript
import { triggerN8nWorkflow } from '../lib/n8nClient';

try {
  await triggerN8nWorkflow('workflow-id', data);
} catch (error) {
  if (error.message.includes('404')) {
    console.error('Workflow not found');
  } else if (error.message.includes('401')) {
    console.error('Invalid API key');
  } else {
    console.error('n8n API error:', error);
  }
}
```

### Testing

```typescript
// Test API connection
import { listWorkflows } from '../lib/n8nClient';

const workflows = await listWorkflows();
console.log('Available workflows:', workflows.length);
```

### Security Best Practices

1. **Never commit API key**
   - Store in `.env`
   - Use Railway variables in production

2. **Validate responses**
   ```typescript
   const result = await triggerN8nWorkflow(workflowId, data);
   if (!result.executionId) {
     throw new Error('Invalid response from n8n');
   }
   ```

3. **Implement retry logic**
   ```typescript
   async function triggerWithRetry(
     workflowId: string,
     data: unknown,
     maxRetries = 3
   ) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await triggerN8nWorkflow(workflowId, data);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
       }
     }
   }
   ```

4. **Rate limiting**
   - n8n has API rate limits
   - Implement queuing for high volume
   - Use bulk operations when possible

### Railway Configuration

Add to Railway environment variables:

```bash
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http
```

### Common Use Cases

#### 1. Send Email After Job Completion
```typescript
await triggerN8nWorkflow('email-sender', {
  to: client.email,
  template: 'job-completed',
  data: {
    jobId: job.id,
    cleanerName: cleaner.name,
    rating: job.rating,
  }
});
```

#### 2. Schedule Reminder
```typescript
await triggerN8nWorkflow('schedule-reminder', {
  jobId: job.id,
  scheduledFor: job.scheduled_start_at,
  reminderTime: '1-hour-before',
});
```

#### 3. Track Analytics Event
```typescript
await triggerN8nWorkflow('analytics-tracker', {
  event: 'job_completed',
  properties: {
    jobId: job.id,
    duration: actualDuration,
    rating: job.rating,
  }
});
```

### Monitoring

```typescript
// Check workflow health
import { getWorkflowStatus } from '../lib/n8nClient';

const healthCheck = async () => {
  const criticalWorkflows = [
    'job-notifications',
    'payment-processor',
    'email-sender'
  ];

  for (const workflowId of criticalWorkflows) {
    const status = await getWorkflowStatus(workflowId);
    if (!status.active) {
      logger.error('workflow_inactive', { workflowId });
      // Send alert
    }
  }
};
```

### n8n API Documentation

- **API Docs**: https://docs.n8n.io/api/
- **Authentication**: API Key in `X-N8N-API-KEY` header
- **Base URL**: `https://puretask.app.n8n.cloud/api/v1`
- **Rate Limits**: Check n8n documentation

### Troubleshooting

**401 Unauthorized**
- Check API key is correct
- Verify API key has not expired
- Ensure header is `X-N8N-API-KEY` not `Authorization`

**404 Not Found**
- Verify workflow ID is correct
- Check workflow exists in n8n
- Ensure workflow is published

**500 Internal Server Error**
- Check n8n logs
- Verify workflow configuration
- Test workflow manually in n8n UI

---

**API Key**: Configured in `.env` ✅
**Base URL**: `https://puretask.app.n8n.cloud/api/v1` ✅
**Documentation**: https://docs.n8n.io/api/ ✅

