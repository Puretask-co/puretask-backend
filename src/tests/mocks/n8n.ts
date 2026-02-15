// src/tests/mocks/n8n.ts
// n8n webhook mocks for testing

export interface MockN8nWebhookRequest {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body: any;
  signature?: string;
}

export interface MockN8nWebhookResponse {
  status: number;
  body: any;
  headers: Record<string, string>;
}

/**
 * Mock successful n8n webhook response
 */
export function createMockN8nSuccess(data?: any): MockN8nWebhookResponse {
  return {
    status: 200,
    body: {
      success: true,
      data: data || {},
    },
    headers: {
      "content-type": "application/json",
    },
  };
}

/**
 * Mock n8n webhook error response
 */
export function createMockN8nError(
  status: number = 500,
  message: string = "Internal server error"
): MockN8nWebhookResponse {
  return {
    status,
    body: {
      success: false,
      error: message,
    },
    headers: {
      "content-type": "application/json",
    },
  };
}

/**
 * Mock n8n webhook request
 */
export function createMockN8nRequest(
  eventName: string,
  payload: any,
  overrides?: Partial<MockN8nWebhookRequest>
): MockN8nWebhookRequest {
  return {
    url: "https://n8n.example.com/webhook/test",
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": "test-signature",
    },
    body: {
      event: eventName,
      payload,
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Mock n8n webhook signature validation
 */
export function validateN8nSignature(signature: string, body: string, secret: string): boolean {
  // In real implementation, this would validate the signature
  // For testing, we can mock this
  return signature === "test-signature" || signature === secret;
}
