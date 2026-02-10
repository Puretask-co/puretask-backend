// src/tests/mocks/sendgrid.ts
// SendGrid API mocks for testing

export interface MockSendGridResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

/**
 * Mock successful SendGrid email send
 */
export function createMockSendGridSuccess(): MockSendGridResponse {
  return {
    statusCode: 202,
    body: {
      message: 'Email sent successfully',
    },
    headers: {},
  };
}

/**
 * Mock SendGrid error response
 */
export function createMockSendGridError(
  statusCode: number = 400,
  message: string = 'Bad Request'
): MockSendGridResponse {
  return {
    statusCode,
    body: {
      errors: [
        {
          message,
          field: null,
          help: null,
        },
      ],
    },
    headers: {},
  };
}

/**
 * Mock SendGrid email data
 */
export interface MockEmailData {
  to: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

/**
 * Create mock email data
 */
export function createMockEmailData(overrides?: Partial<MockEmailData>): MockEmailData {
  return {
    to: 'test@example.com',
    from: 'noreply@puretask.com',
    subject: 'Test Email',
    html: '<p>Test email content</p>',
    ...overrides,
  };
}
