// src/services/notifications/index.ts
// Notification service exports

export * from "./types";
export * from "./templates";
export {
  sendNotification,
  sendNotificationToUser,
  getUserContactInfo,
} from "./notificationService";

// Job notification helpers
export * from "./jobNotifications";
