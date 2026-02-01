# Runbook: Rollback a Deploy

**When to use:** Errors or critical bug appeared right after a deploy; rollback is the fastest way to restore service.

**Who:** Anyone with deploy access (e.g. Railway). Prefer rollback over “fix forward” when the impact is high and the fix is not trivial.

---

## 1. Decide to rollback

- [ ] Confirm: errors or issues started after the last deploy (check Sentry / logs / time of deploy).
- [ ] Rollback is chosen (e.g. error rate above threshold, or critical feature broken).

---

## 2. Rollback on Railway

1. **Open Railway** → Your project → Service (backend).
2. Go to **Deployments**.
3. Find the **last known good** deployment (before the bad one).  
   - Check “Success” and the time it was deployed.
4. **Redeploy that deployment:**
   - Click the three dots (⋮) on that deployment → **Redeploy** (or use “Rollback” if the UI shows it).
5. Wait for the deployment to finish and the service to be live.
6. **Verify:**  
   - `GET https://<your-api>/health` and `/health/ready` → 200.  
   - Check Sentry: new errors should drop.  
   - Quick smoke test (login, one critical flow).

---

## 3. If you use another host (e.g. Heroku, Render)

- **Heroku:** `heroku releases` then `heroku rollback` to previous release.
- **Render:** Dashboard → Service → Deploys → open previous successful deploy → “Rollback” or redeploy.
- **Generic:** Redeploy the previous commit or tag that was last known good.

---

## 4. Database migrations

- **Do not** run “migrate down” in a hurry unless you have a tested, safe down migration and have run it in staging.
- **Preferred:** Leave the DB as-is. The rolled-back app should still work with the current schema (we avoid breaking schema changes in a single deploy).
- If a migration truly broke the app and you have a down script that you’ve tested, run it only after the rollback and document it.

---

## 5. Notify and document

- [ ] Post in Slack/channel: “Rolled back to deployment X due to [brief reason].”
- [ ] Update status page if needed.
- [ ] Write a short incident note: what was deployed, why we rolled back, and what to fix before re-deploying.

---

**Quick links**

- [handle-incident.md](handle-incident.md)  
- [MONITORING_SETUP.md](../active/00-CRITICAL/MONITORING_SETUP.md)
