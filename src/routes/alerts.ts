// src/routes/alerts.ts
// Smoke alert endpoint to verify Slack/Email alerting

import { Router } from "express";
import { sendAlert } from "../lib/alerting";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";

const alertsRouter = Router();

alertsRouter.use(requireAuth);

alertsRouter.post("/smoke", async (req: AuthedRequest, res) => {
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
    res.status(500).json({ error: { code: "ALERT_SMOKE_FAILED", message: (error as Error).message } });
  }
});

export default alertsRouter;

