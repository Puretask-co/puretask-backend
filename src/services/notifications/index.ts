// src/services/notifications/index.ts
// Notification service exports

export * from "./types";
export * from "./templates";
export {
  sendNotification,
  sendNotificationToUser,
  getUserContactInfo,
} from "./notificationService";

// Notification preferences
export {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type UpdatePreferencesInput,
} from "./preferencesService";

// Job notification helpers
export * from "./jobNotifications";
