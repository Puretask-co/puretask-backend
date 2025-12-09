"use strict";
// src/services/notifications/providers/onesignal.ts
// OneSignal push notification provider
Object.defineProperty(exports, "__esModule", { value: true });
exports.oneSignalProvider = exports.OneSignalProvider = void 0;
const env_1 = require("../../../config/env");
const logger_1 = require("../../../lib/logger");
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
class OneSignalProvider {
    constructor() {
        this.name = "onesignal";
        this.channel = "push";
    }
    isConfigured() {
        return !!(env_1.env.ONESIGNAL_APP_ID && env_1.env.ONESIGNAL_API_KEY);
    }
    async send(payload) {
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
                    "Authorization": `Basic ${env_1.env.ONESIGNAL_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_id: env_1.env.ONESIGNAL_APP_ID,
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
                logger_1.logger.error("onesignal_send_failed", {
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
            logger_1.logger.info("push_sent", {
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
        }
        catch (error) {
            logger_1.logger.error("onesignal_error", {
                error: error.message,
                tokenCount: payload.tokens.length,
            });
            return {
                success: false,
                channel: "push",
                error: error.message,
            };
        }
    }
    /**
     * Send to all users with a specific tag/segment
     */
    async sendToSegment(options) {
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
                    "Authorization": `Basic ${env_1.env.ONESIGNAL_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_id: env_1.env.ONESIGNAL_APP_ID,
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
        }
        catch (error) {
            return {
                success: false,
                channel: "push",
                error: error.message,
            };
        }
    }
}
exports.OneSignalProvider = OneSignalProvider;
exports.oneSignalProvider = new OneSignalProvider();
