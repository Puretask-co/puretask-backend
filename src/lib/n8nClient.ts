// src/lib/n8nClient.ts
// n8n API client and webhook forwarding for PureTask
// - API: trigger workflows, list/status/executions (N8N_API_KEY, N8N_BASE_URL)
// - Webhook outbound: forward events to n8n (N8N_WEBHOOK_URL) via postJson

import { env } from "../config/env";
import { logger } from "./logger";
import { postJson } from "./httpClient";

const DEFAULT_N8N_BASE_URL = "https://puretask.app.n8n.cloud/api/v1";

function getN8nBaseUrl(): string {
  return env.N8N_BASE_URL || DEFAULT_N8N_BASE_URL;
}

// ============================================
// Types (for webhook payload and re-export)
// ============================================

export type N8nActorType = "client" | "cleaner" | "admin" | "system";

export interface N8nEventPayload {
  jobId: string | null;
  actorType: N8nActorType | null;
  actorId: string | null;
  eventName: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type N8nEventType = string; // e.g. job_created, job_completed, etc.

interface N8nApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Make authenticated request to n8n API
 */
async function n8nApiRequest(
  endpoint: string,
  options: N8nApiOptions = {}
): Promise<any> {
  const { method = "GET", body } = options;

  if (!env.N8N_API_KEY) {
    logger.warn("n8n_api_key_missing", { endpoint });
    throw new Error("N8N_API_KEY not configured");
  }

  try {
    const response = await fetch(`${getN8nBaseUrl()}${endpoint}`, {
      method,
      headers: {
        "X-N8N-API-KEY": env.N8N_API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} ${error}`);
    }

    return response.json();
  } catch (error) {
    logger.error("n8n_api_request_failed", {
      endpoint,
      method,
      error: (error as Error).message,
    });
    throw error;
  }
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
      method: "POST",
      body: data,
    });

    logger.info("n8n_workflow_triggered", {
      workflowId,
      executionId: result.data?.executionId,
    });

    return { executionId: result.data?.executionId || result.executionId };
  } catch (error) {
    logger.error("n8n_trigger_failed", {
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
    status?: "success" | "error" | "waiting" | "running";
  } = {}
): Promise<any[]> {
  const { limit = 10, status } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(status && { status }),
  });

  try {
    const result = await n8nApiRequest(
      `/workflows/${workflowId}/executions?${params}`
    );

    return result.data || [];
  } catch (error) {
    logger.error("n8n_get_executions_failed", {
      workflowId,
      error: (error as Error).message,
    });
    throw error;
  }
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
  try {
    const result = await n8nApiRequest(`/workflows/${workflowId}`);
    return result.data || result;
  } catch (error) {
    logger.error("n8n_get_status_failed", {
      workflowId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * List all workflows
 */
export async function listWorkflows(): Promise<any[]> {
  try {
    const result = await n8nApiRequest("/workflows");
    return result.data || [];
  } catch (error) {
    logger.error("n8n_list_workflows_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Activate/Deactivate workflow
 */
export async function setWorkflowActive(
  workflowId: string,
  active: boolean
): Promise<void> {
  try {
    await n8nApiRequest(`/workflows/${workflowId}`, {
      method: "PUT",
      body: { active },
    });

    logger.info("n8n_workflow_status_changed", { workflowId, active });
  } catch (error) {
    logger.error("n8n_set_active_failed", {
      workflowId,
      active,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get execution details
 */
export async function getExecutionDetails(executionId: string): Promise<any> {
  try {
    const result = await n8nApiRequest(`/executions/${executionId}`);
    return result.data || result;
  } catch (error) {
    logger.error("n8n_get_execution_failed", {
      executionId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Trigger workflow with retry logic
 */
export async function triggerN8nWorkflowWithRetry(
  workflowId: string,
  data: Record<string, unknown>,
  maxRetries = 3
): Promise<{ executionId: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await triggerN8nWorkflow(workflowId, data);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delayMs = 1000 * (attempt + 1); // 1s, 2s, 3s
      logger.warn("n8n_trigger_retry", {
        workflowId,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Failed after max retries");
}

/**
 * Check if n8n webhook (event forward) is configured
 */
export function isN8nWebhookConfigured(): boolean {
  return !!env.N8N_WEBHOOK_URL;
}

/**
 * Check if n8n API (workflow trigger/list/status) is configured
 */
export function isN8nApiConfigured(): boolean {
  return !!env.N8N_API_KEY;
}

/**
 * Check if n8n is configured (webhook and/or API; MCP URL optional for API)
 */
export function isN8nConfigured(): boolean {
  return isN8nWebhookConfigured() || isN8nApiConfigured();
}

/**
 * Forward an event to the n8n webhook URL (outbound).
 * Same payload shape as publishEvent → maybeForwardToN8n.
 * Used by events.ts so all n8n "send" logic lives here.
 */
export async function forwardEventToN8nWebhook(payload: N8nEventPayload): Promise<void> {
  if (!env.N8N_WEBHOOK_URL) {
    logger.warn("n8n_webhook_not_configured", { eventName: payload.eventName });
    return;
  }
  try {
    await postJson(env.N8N_WEBHOOK_URL, payload);
    logger.info("n8n_event_forwarded", {
      eventName: payload.eventName,
      jobId: payload.jobId,
    });
  } catch (err) {
    logger.error("n8n_forward_failed", {
      error: (err as Error).message,
      jobId: payload.jobId,
      eventName: payload.eventName,
    });
    throw err;
  }
}

/**
 * Send a generic JSON body to a webhook URL (e.g. custom n8n webhook trigger).
 */
export async function sendN8nWebhook(
  url: string,
  body: Record<string, unknown>
): Promise<void> {
  await postJson(url, body);
}

/**
 * Test n8n connection
 */
export async function testN8nConnection(): Promise<{
  connected: boolean;
  workflows?: number;
  error?: string;
}> {
  try {
    if (!isN8nApiConfigured()) {
      return {
        connected: false,
        error: "N8N_API_KEY not configured",
      };
    }

    const workflows = await listWorkflows();

    return {
      connected: true,
      workflows: workflows.length,
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
    };
  }
}

