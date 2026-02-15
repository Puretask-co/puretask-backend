// src/services/notifications/providers/onesignal.ts
// OneSignal push notification provider

import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";
import type { PushPayload, NotificationResult, NotificationProvider } from "../types";

const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

export class OneSignalProvider implements NotificationProvider {
  name = "onesignal";
  channel = "push" as const;

  isConfigured(): boolean {
    return !!(env.ONESIGNAL_APP_ID && env.ONESIGNAL_API_KEY);
  }

  async send(payload: PushPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: "push",
        error: "OneSignal not configured",
      };
    }

    if (!payload.tokens || payload.tokens.length === 0) {
      return {
        success: false,
        channel: "push",
        error: "No push tokens provided",
      };
    }

    try {
      const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: env.ONESIGNAL_APP_ID,
          include_player_ids: payload.tokens,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: payload.data || {},
          ios_badgeType: payload.badge ? "SetTo" : undefined,
          ios_badgeCount: payload.badge,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error("onesignal_send_failed", {
          status: response.status,
          error: responseData,
          tokenCount: payload.tokens.length,
        });
        return {
          success: false,
          channel: "push",
          error: responseData.errors?.[0] || `OneSignal error: ${response.status}`,
        };
      }

      logger.info("push_sent", {
        provider: "onesignal",
        tokenCount: payload.tokens.length,
        messageId: responseData.id,
        recipients: responseData.recipients,
      });

      return {
        success: true,
        channel: "push",
        messageId: responseData.id,
      };
    } catch (error) {
      logger.error("onesignal_error", {
        error: (error as Error).message,
        tokenCount: payload.tokens.length,
      });
      return {
        success: false,
        channel: "push",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send to all users with a specific tag/segment
   */
  async sendToSegment(options: {
    segment: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: "push",
        error: "OneSignal not configured",
      };
    }

    try {
      const response = await fetch(ONESIGNAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${env.ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: env.ONESIGNAL_APP_ID,
          included_segments: [options.segment],
          headings: { en: options.title },
          contents: { en: options.body },
          data: options.data || {},
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          channel: "push",
          error: responseData.errors?.[0] || `OneSignal error: ${response.status}`,
        };
      }

      return {
        success: true,
        channel: "push",
        messageId: responseData.id,
      };
    } catch (error) {
      return {
        success: false,
        channel: "push",
        error: (error as Error).message,
      };
    }
  }
}

export const oneSignalProvider = new OneSignalProvider();
