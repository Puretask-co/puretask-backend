# Fix: Add workflow_dispatch to audit-autofix.yml

**Issue:** Workflow cannot be manually dispatched because it lacks `workflow_dispatch` trigger  
**Repository:** `PURETASK/puretask-clean-with-confidence`  
**File:** `.github/workflows/audit-autofix.yml`

---

## Current Problem

```
Error: Workflow does not have 'workflow_dispatch' trigger
```

## Solution

Add `workflow_dispatch` to the workflow's `on:` section.

### Required Change

The workflow file `.github/workflows/audit-autofix.yml` needs to include:

```yaml
name: Audit Auto-Fix & Triage
on:
  workflow_dispatch:  # ← ADD THIS
  push:
    branches: [main]
  # ... other triggers
```

### Step-by-Step Fix

**Option 1: Using GitHub CLI (if you have write access)**

```powershell
# Clone the repo temporarily
cd $env:TEMP
git clone https://github.com/PURETASK/puretask-clean-with-confidence.git
cd puretask-clean-with-confidence

# Edit the file (or use your editor)
# Add workflow_dispatch: to the on: section

# Commit and push
git add .github/workflows/audit-autofix.yml
git commit -m "Add workflow_dispatch trigger to audit workflow"
git push origin main
```

**Option 2: Using GitHub UI**

1. Go to: https://github.com/PURETASK/puretask-clean-with-confidence/blob/main/.github/workflows/audit-autofix.yml
2. Click "Edit" (pencil icon)
3. Add `workflow_dispatch:` under the `on:` section
4. Commit directly to main (or create PR)

**Option 3: Create PR (recommended for team review)**

1. Create a new branch
2. Edit the workflow file
3. Create PR
4. Merge after review

---

## Expected Result

After the fix:

1. ✅ Workflow will appear in "Actions" → "Run workflow" dropdown
2. ✅ Can dispatch via CLI: `gh workflow run audit-autofix.yml`
3. ✅ Manual triggering will work

---

## Verification

After making the change, verify:

```powershell
# Should succeed now
gh workflow run audit-autofix.yml --repo PURETASK/puretask-clean-with-confidence --ref main
```

---

*This fix is required before the audit workflow can be manually dispatched.*

