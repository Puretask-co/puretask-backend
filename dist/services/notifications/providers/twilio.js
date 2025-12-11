"use strict";
// src/services/notifications/providers/twilio.ts
// Twilio SMS provider
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioProvider = exports.TwilioProvider = void 0;
const env_1 = require("../../../config/env");
const logger_1 = require("../../../lib/logger");
const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";
class TwilioProvider {
    constructor() {
        this.name = "twilio";
        this.channel = "sms";
    }
    isConfigured() {
        return !!(env_1.env.TWILIO_ACCOUNT_SID &&
            env_1.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_PHONE_NUMBER);
    }
    async send(payload) {
        if (!this.isConfigured()) {
            return {
                success: false,
                channel: "sms",
                error: "Twilio not configured",
            };
        }
        const accountSid = env_1.env.TWILIO_ACCOUNT_SID;
        const authToken = env_1.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        try {
            const url = `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`;
            const params = new URLSearchParams({
                To: payload.to || payload.phone || "",
                From: fromNumber,
                Body: payload.body || "",
            });
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": "Basic " +
                        Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });
            const responseData = await response.json();
            if (!response.ok) {
                logger_1.logger.error("twilio_send_failed", {
                    status: response.status,
                    error: responseData,
                    to: payload.to,
                });
                return {
                    success: false,
                    channel: "sms",
                    error: responseData.message || `Twilio error: ${response.status}`,
                };
            }
            logger_1.logger.info("sms_sent", {
                provider: "twilio",
                to: payload.to,
                messageId: responseData.sid,
                status: responseData.status,
            });
            return {
                success: true,
                channel: "sms",
                messageId: responseData.sid,
            };
        }
        catch (error) {
            logger_1.logger.error("twilio_error", {
                error: error.message,
                to: payload.to,
            });
            return {
                success: false,
                channel: "sms",
                error: error.message,
            };
        }
    }
}
exports.TwilioProvider = TwilioProvider;
exports.twilioProvider = new TwilioProvider();
