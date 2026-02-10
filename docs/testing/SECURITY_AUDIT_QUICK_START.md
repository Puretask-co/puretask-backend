# Security Audit Quick Start

## Automated Steps (Run These Commands)

### Step 1: Authenticate GitHub CLI (Interactive - You Need to Run This)
```powershell
gh auth login
```
- Choose: GitHub.com
- Choose: HTTPS
- Choose: Login with a web browser
- Follow the prompts

### Step 2: Dispatch Workflow (I Can Run This After Step 1)
After authentication, run:
```powershell
gh workflow run "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --ref main
```

### Step 3: Download Results (After Workflow Completes)
```powershell
# List recent runs to get the run ID
gh run list --workflow "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --limit 5

# Download artifacts (replace <run-id> with actual ID)
gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence
```

---

## Or Use the Automation Script

After authenticating, you can use the provided script:
```powershell
.\scripts\run-security-audit.ps1
```

---

## What I Cannot Automate

- **GitHub CLI Authentication** - Requires interactive login (browser/web flow)
- **PAT Entry** - For security, tokens should be entered manually

---

## Alternative: Use GitHub UI (No CLI Needed)

1. Go to: https://github.com/PURETASK/puretask-clean-with-confidence/actions
2. Find "Audit Auto-Fix & Triage" workflow
3. Click "Run workflow" → Select branch → Run workflow
4. Wait for completion, then download artifacts from the run page

