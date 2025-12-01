// src/services/notifications/types.ts
// Notification system types

export type NotificationChannel = "email" | "sms" | "push";

export type NotificationType =
  // Job lifecycle
  | "job.created"
  | "job.accepted"
  | "job.on_my_way"
  | "job.started"
  | "job.completed"
  | "job.awaiting_approval"
  | "job.approved"
  | "job.disputed"
  | "job.cancelled"
  // Payments
  | "credits.purchased"
  | "credits.low"
  | "payout.processed"
  | "payout.failed"
  // Account
  | "welcome"
  | "password.reset";

export interface NotificationPayload {
  userId?: string; // For failures/logging and external_id targeting
  email?: string; // Target email address
  phone?: string; // Target phone number (E.164 format)
  pushToken?: string; // OneSignal player_id
  type: NotificationType;
  channel: NotificationChannel;
  data: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationResult>;
  isConfigured(): boolean;
}

// Template data types for type safety
export interface JobNotificationData {
  jobId: string;
  clientName?: string;
  cleanerName?: string;
  address?: string;
  scheduledDate?: string;
  creditAmount?: number;
  rating?: number;
}

export interface PaymentNotificationData {
  amount?: number;
  credits?: number;
  transactionId?: string;
}

export interface AccountNotificationData {
  name?: string;
  resetToken?: string;
  resetUrl?: string;
}
