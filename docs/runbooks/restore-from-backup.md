# Runbook: Restore from Backup

**When to use:** Data loss, bad migration, corruption, or need to revert to a known-good point in time.

**Who can do it:** Anyone with Neon project access and Railway/env access. Confirm with product owner before restoring production.

---

## 1. Confirm need to restore

- [ ] Issue is confirmed (data loss, wrong migration, corruption).
- [ ] Product/team owner agrees to restore.
- [ ] Note current `DATABASE_URL` (you will point app to recovery branch or leave as-is after restore).

---

## 2. Open the full procedure

- **Full doc:** [BACKUP_RESTORE_PROCEDURE.md](../active/01-HIGH/BACKUP_RESTORE_PROCEDURE.md)  
- **Recovery steps:** [DATABASE_RECOVERY.md](../active/01-HIGH/DATABASE_RECOVERY.md)

---

## 3. Restore using Neon (recommended)

1. **Neon Console** → Your project → **Backups** (or **Branches**).
2. Choose restore point (latest backup or point-in-time).
3. **Create branch** from that point (e.g. name: `recovery-YYYY-MM-DD`).
4. Copy the new branch’s **connection string**.
5. **Point the app to the recovery DB:**
   - **Railway:** Service → Variables → set `DATABASE_URL` to the recovery branch URL → Redeploy (or restart).
   - **Local:** Set `DATABASE_URL` in `.env` and restart the app.
6. **Verify schema:**  
   `npm run migrate:status`  
   (Optional: run any pending migrations on the recovery branch if you use the migration runner.)
7. **Smoke-check:** Login, open one job, trigger one payment (or key flows). Check logs for errors.
8. **Notify** team and update status page if needed.

---

## 4. If you restored in place (same DB)

- If you used Neon “restore” in place or reverted to a branch that is already production:
  - No `DATABASE_URL` change needed.
  - Still run step 6–7 (verify + smoke-check) and notify.

---

## 5. After restore

- [ ] Document what was restored and why (incident note or postmortem).
- [ ] If a bad migration caused the issue, fix or revert that migration before running `migrate:up` again.

---

**Quick links**

- [BACKUP_RESTORE_PROCEDURE.md](../active/01-HIGH/BACKUP_RESTORE_PROCEDURE.md)  
- [DATABASE_RECOVERY.md](../active/01-HIGH/DATABASE_RECOVERY.md)
