// src/tests/mocks/twilio.ts
// Twilio API mocks for testing

export interface MockTwilioMessage {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  dateCreated: Date;
  dateSent?: Date;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Mock successful Twilio SMS send
 */
export function createMockTwilioSuccess(overrides?: Partial<MockTwilioMessage>): MockTwilioMessage {
  return {
    sid: "SM" + Math.random().toString(36).substring(2, 15),
    status: "sent",
    to: "+1234567890",
    from: "+15017122661",
    body: "Test message",
    dateCreated: new Date(),
    dateSent: new Date(),
    ...overrides,
  };
}

/**
 * Mock Twilio error response
 */
export function createMockTwilioError(
  errorCode: number = 21211,
  errorMessage: string = "Invalid phone number"
): MockTwilioMessage {
  return {
    sid: "",
    status: "failed",
    to: "+1234567890",
    from: "+15017122661",
    body: "",
    dateCreated: new Date(),
    errorCode,
    errorMessage,
  };
}

/**
 * Mock Twilio verification
 */
export interface MockTwilioVerification {
  sid: string;
  status: "pending" | "approved" | "canceled";
  to: string;
  channel: "sms" | "call" | "email";
}

export function createMockTwilioVerification(
  overrides?: Partial<MockTwilioVerification>
): MockTwilioVerification {
  return {
    sid: "VE" + Math.random().toString(36).substring(2, 15),
    status: "pending",
    to: "+1234567890",
    channel: "sms",
    ...overrides,
  };
}
