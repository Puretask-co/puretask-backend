# Runbook: Handle a Production Incident

**When to use:** Errors spike, app is down, or users report critical issues.

**Who:** On-call or whoever is designated. Escalate per your team’s policy.

---

## 1. Acknowledge

- [ ] Acknowledge alert (Sentry, UptimeRobot, PagerDuty, or manual report).
- [ ] Post in Slack/channel: “Investigating [brief description].”

---

## 2. Triage: Is it the backend?

- [ ] **Health checks**
  - `GET https://<your-api>/health` → expect 200.
  - `GET https://<your-api>/health/ready` → expect 200 (DB/Redis ready).
- [ ] **Sentry**  
  - Open Sentry → check for new or spiking errors.  
  - Note error message and stack; link to this runbook in comms if useful.
- [ ] **UptimeRobot / status**  
  - Check if monitors are red and when they started failing.

If health is OK and no backend errors, the issue may be frontend, network, or user-side. Still communicate and hand off if needed.

---

## 3. Mitigate

**If there was a recent deploy:**

- [ ] Consider **rollback** first.  
  - See [rollback-deploy.md](rollback-deploy.md).  
  - Roll back if errors started right after deploy and you don’t have a quick fix.

**If no recent deploy:**

- [ ] **High error rate / 5xx:**  
  - Check Sentry for the top errors.  
  - Check Railway (or host) for OOM, restarts, or resource limits.  
  - Restart the service if it’s stuck; scale up if resource-limited.
- [ ] **DB-related errors:**  
  - Check Neon status and connection limits.  
  - See [DATABASE_RECOVERY.md](../active/01-HIGH/DATABASE_RECOVERY.md) if you suspect data or connectivity issues.
- [ ] **External dependency (Stripe, SendGrid, etc.):**  
  - Check status pages; we have circuit breakers and retries — wait for recovery or disable non-critical flows if you have a feature flag.

---

## 4. Communicate

- [ ] Post updates in Slack/channel (e.g. “Investigating,” “Mitigated by rollback,” “Resolved”).
- [ ] Update status page if you have one.
- [ ] If users are affected, send a short incident summary when resolved.

---

## 5. After the incident

- [ ] Write a short **post-incident note** (what happened, what we did, what we’ll do next).
- [ ] If something was missing (runbook, alert, access), add it so next time is smoother.

---

**Quick links**

- [rollback-deploy.md](rollback-deploy.md)  
- [MONITORING_SETUP.md](../active/00-CRITICAL/MONITORING_SETUP.md)  
- [SECURITY_INCIDENT_RESPONSE.md](../active/00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) (for security/secret exposure)  
- [DATABASE_RECOVERY.md](../active/01-HIGH/DATABASE_RECOVERY.md)
