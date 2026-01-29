// src/integrations/n8n.ts
// Centralized n8n client (re-exports from lib for consistency)

export {
  sendN8nWebhook,
  sendN8nEvent,
  N8nEventType,
  N8nEventPayload,
} from "../lib/n8nClient";
