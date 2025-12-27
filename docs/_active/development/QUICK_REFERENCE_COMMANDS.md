# PureTask Runbook - Quick Reference Commands

**Purpose:** Copy/paste commands for executing the PureTask runbook tasks  
**Last Updated:** January 2025

---

## 🔐 Authentication

```powershell
# Check authentication status
gh auth status

# Login if needed
gh auth login
```

---

## 📋 Workflow Management

### List Workflows
```powershell
gh workflow list --repo PURETASK/puretask-clean-with-confidence
```

### Dispatch Workflow (after fix)
```powershell
gh workflow run audit-autofix.yml --repo PURETASK/puretask-clean-with-confidence --ref main
```

### List Recent Runs
```powershell
gh run list --workflow "audit-autofix.yml" --repo PURETASK/puretask-clean-with-confidence --limit 10
```

### Download Artifacts
```powershell
# First, create directory
mkdir audit-results
cd audit-results

# Download (replace <run-id> with actual ID)
gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence
```

### View Run Logs
```powershell
gh run view <run-id> --repo PURETASK/puretask-clean-with-confidence --log
```

---

## 🔧 Workflow Fix (Frontend Repository)

**Required Fix:** Add `workflow_dispatch:` to `.github/workflows/audit-autofix.yml`

**Change:**
```yaml
on:
  workflow_dispatch:  # ← ADD THIS LINE
  push:
    branches: [main]
```

**After fix:**
```powershell
# Commit and push in frontend repo
cd ../puretask-clean-with-confidence
git add .github/workflows/audit-autofix.yml
git commit -m "Add workflow_dispatch trigger to audit workflow"
git push origin main
```

---

## 📧 Email System Testing

### Test Communication Payload Validation

```typescript
import { createCommunicationPayload } from "../lib/communicationValidation";
import { env } from "../config/env";

const payload = createCommunicationPayload({
  templateKey: "email.client.job_booked",
  templateId: env.SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED,
  to_email: "test@example.com",
  channel: "email",
  dynamic_data: {
    clientName: "Test User",
    jobAddress: "123 Test St",
    scheduledStartTime: "Jan 16, 10:00 AM",
    creditAmount: 100,
    jobId: "test-job-123",
  },
});
```

---

## 📚 Documentation

### View Email Registry
```powershell
cat docs/email-registry.md
```

### View n8n Workflow Spec
```powershell
cat docs/n8n-universal-sender-workflow-spec.md
```

### View Workflow Fix Instructions
```powershell
cat docs/WORKFLOW_FIX_AUDIT_AUTOFIX.md
```

### View Execution Summary
```powershell
cat docs/RUNBOOK_EXECUTION_SUMMARY.md
```

---

## ✅ Verification Commands

### Check TypeScript Compilation
```powershell
npm run build
```

### Check Linting
```powershell
npm run lint  # If lint script exists
```

### Verify Environment Variables
```typescript
// In Node/TypeScript
import { env } from "./src/config/env";
console.log(env.SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED);
```

---

## 🚀 Complete Workflow (After Fix)

```powershell
# 1. Authenticate
gh auth status

# 2. Dispatch workflow
gh workflow run audit-autofix.yml --repo PURETASK/puretask-clean-with-confidence --ref main

# 3. Wait 30 seconds, then check runs
Start-Sleep -Seconds 30
gh run list --workflow "audit-autofix.yml" --repo PURETASK/puretask-clean-with-confidence --limit 5

# 4. Get run ID and download artifacts
# (Copy run ID from output above)
gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence

# 5. View results
cat audit.json
cat triage.json
```

---

## 📝 Troubleshooting

### "Workflow not found"
```powershell
# Verify workflow exists
gh workflow list --repo PURETASK/puretask-clean-with-confidence

# Use exact filename (not display name)
gh workflow run audit-autofix.yml --repo PURETASK/puretask-clean-with-confidence --ref main
```

### "Permission denied"
```powershell
# Check repo access
gh repo view PURETASK/puretask-clean-with-confidence

# Verify authentication
gh auth status
```

### "No artifacts"
```powershell
# Check run logs for errors
gh run view <run-id> --repo PURETASK/puretask-clean-with-confidence --log

# Verify workflow completed successfully
gh run list --workflow "audit-autofix.yml" --repo PURETASK/puretask-clean-with-confidence --status success --limit 5
```

---

*Quick reference for PureTask runbook execution*

