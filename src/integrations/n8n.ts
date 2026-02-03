// src/integrations/n8n.ts
// Centralized n8n integration (re-exports from lib for consistency)
// Use this module when you need: trigger workflow, forward event to n8n, or check n8n config

export {
  triggerN8nWorkflow,
  triggerN8nWorkflowWithRetry,
  getWorkflowExecutions,
  getWorkflowStatus,
  listWorkflows,
  setWorkflowActive,
  getExecutionDetails,
  isN8nConfigured,
  isN8nWebhookConfigured,
  isN8nApiConfigured,
  testN8nConnection,
  forwardEventToN8nWebhook,
  sendN8nWebhook,
  type N8nEventPayload,
  type N8nActorType,
  type N8nEventType,
} from "../lib/n8nClient";
