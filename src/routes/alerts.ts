// src/routes/alerts.ts
// Smoke alert endpoint to verify Slack/Email alerting

import { Router } from "express";
import { sendAlert } from "../lib/alerting";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";

const alertsRouter = Router();

alertsRouter.use(requireAuth);

/**
 * @swagger
 * /alerts/smoke:
 *   post:
 *     summary: Alert smoke test
 *     description: Test alert system (Slack/Email) to verify alerting is working.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: 'string', default: 'Alert smoke test' }
 *               message: { type: 'string', default: 'This is a test alert' }
 *     responses:
 *       200:
 *         description: Alert sent successfully
 */
alertsRouter.post(
  "/smoke",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const { title = "Alert smoke test", message = "This is a test alert" } = req.body || {};
      await sendAlert({
        level: "info",
        title,
        message,
        details: { userId: req.user?.id || null },
      });
      res.json({ success: true });
    } catch (error) {
      res
        .status(500)
        .json({ error: { code: "ALERT_SMOKE_FAILED", message: (error as Error).message } });
    }
  })
);

export default alertsRouter;
