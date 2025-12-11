"use strict";
// src/routes/alerts.ts
// Smoke alert endpoint to verify Slack/Email alerting
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alerting_1 = require("../lib/alerting");
const auth_1 = require("../middleware/auth");
const alertsRouter = (0, express_1.Router)();
alertsRouter.use(auth_1.authMiddleware);
alertsRouter.post("/smoke", async (req, res) => {
    try {
        const { title = "Alert smoke test", message = "This is a test alert" } = req.body || {};
        await (0, alerting_1.sendAlert)({
            level: "info",
            title,
            message,
            details: { userId: req.user?.id || null },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: { code: "ALERT_SMOKE_FAILED", message: error.message } });
    }
});
exports.default = alertsRouter;
