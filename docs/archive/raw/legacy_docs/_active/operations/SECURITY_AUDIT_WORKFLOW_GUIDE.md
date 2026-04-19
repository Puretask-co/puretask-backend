# Security Audit Workflow Guide

**Purpose:** Run security audit for `puretask-clean-with-confidence` frontend repository  
**Workflow:** "Audit Auto-Fix & Triage"  
**Repository:** `PURETASK/puretask-clean-with-confidence`

---

## 🎯 Quick Start Options

You have 3 options to run the security audit. Choose the one that works best for your setup.

---

## Option 1: GitHub CLI (Recommended) ⭐

**Prerequisites:**
- GitHub CLI installed
- Authenticated with `gh auth login`

### Install GitHub CLI (if needed)

**Windows (PowerShell):**
```powershell
# Using winget
winget install --id GitHub.cli

# Or using Chocolatey
choco install gh

# Or download from: https://cli.github.com/
```

**After installation:**
```powershell
# Authenticate
gh auth login

# Follow the prompts to authenticate
```

### Run the Workflow

**Dispatch the workflow:**
```powershell
gh workflow run "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --ref main
```

**Check recent runs (find the run ID):**
```powershell
gh run list --workflow "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --limit 5
```

**Download artifacts from a run (replace `<run-id>` with the ID from the list):**
```powershell
gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence
```

**View logs for a run:**
```powershell
gh run view <run-id> --repo PURETASK/puretask-clean-with-confidence --log
```

**Example:**
```powershell
# 1. Dispatch workflow
gh workflow run "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --ref main

# 2. Wait a moment, then check runs
gh run list --workflow "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --limit 5

# Output will show something like:
# 1234567890  Audit Auto-Fix & Triage  main  queued  2025-01-21T10:00:00Z

# 3. Download artifacts (use the run ID from step 2)
gh run download 1234567890 --repo PURETASK/puretask-clean-with-confidence

# 4. View logs
gh run view 1234567890 --repo PURETASK/puretask-clean-with-confidence --log
```

---

## Option 2: Using curl with Personal Access Token

**⚠️ Security Note:** Never paste a PAT into chat. Create a PAT with scope `repo` + `workflow` and short expiration (24-72h).

### Create Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: "Security Audit Workflow" (or similar)
4. Expiration: 24-72 hours
5. Scopes: Check `repo` and `workflow`
6. Generate token
7. **Copy token immediately** (you won't see it again)

### Run the Workflow

**PowerShell (secure input):**
```powershell
# Secure token input
$token = Read-Host -AsSecureString "Enter GitHub PAT"
$pat = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

# Dispatch workflow
Invoke-RestMethod `
  -Uri "https://api.github.com/repos/PURETASK/puretask-clean-with-confidence/actions/workflows/audit-autofix.yml/dispatches" `
  -Method POST `
  -Headers @{
    Authorization = "Bearer $pat"
    Accept = "application/vnd.github+json"
  } `
  -Body (ConvertTo-Json @{ref = "main"})
```

**Bash/curl:**
```bash
# Set PAT (replace with your token)
export PAT="ghp_xxx..."

# Dispatch workflow
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $PAT" \
  https://api.github.com/repos/PURETASK/puretask-clean-with-confidence/actions/workflows/audit-autofix.yml/dispatches \
  -d '{"ref":"main"}'
```

**After dispatch:**
- Go to: https://github.com/PURETASK/puretask-clean-with-confidence/actions
- Find the "Audit Auto-Fix & Triage" workflow run
- Download artifacts from the run page
- Or use GitHub CLI to download: `gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence`

---

## Option 3: Run Audit Locally

**Prerequisites:**
- Node.js and npm installed
- Access to `puretask-clean-with-confidence` repository

### Setup

**1. Navigate to frontend repository:**
```powershell
# If repo is in same parent directory
cd ..\puretask-clean-with-confidence

# Or clone if needed
git clone https://github.com/PURETASK/puretask-clean-with-confidence.git
cd puretask-clean-with-confidence
```

**2. Install dependencies:**
```powershell
npm ci
```

**3. Run audit:**
```powershell
# Generate audit JSON
npm audit --json > audit.json

# If triage script exists, run it
node triage-audit.js audit.json --output triage.json
```

**4. Review results:**
- Open `audit.json` to see full audit results
- Open `triage.json` (if generated) for triaged findings
- Share `triage.json` content for automated remediation

---

## 📋 Workflow Details

### What the Workflow Does

1. **Runs npm audit** on the frontend repository
2. **Generates audit.json** with all security findings
3. **Triages findings** (categorizes by severity)
4. **Creates triage.json** with prioritized issues
5. **Uploads artifacts** for download

### Expected Output

**Artifacts:**
- `audit.json` - Full npm audit output
- `triage.json` - Triaged and prioritized findings

**triage.json Structure:**
```json
{
  "critical": [...],
  "high": [...],
  "moderate": [...],
  "low": [...],
  "summary": {
    "total": 42,
    "critical": 2,
    "high": 5,
    "moderate": 10,
    "low": 25
  }
}
```

---

## 🔍 After Running the Workflow

### Step 1: Download Artifacts

**Using GitHub CLI:**
```powershell
# List recent runs
gh run list --workflow "Audit Auto-Fix & Triage" --repo PURETASK/puretask-clean-with-confidence --limit 5

# Download artifacts (replace <run-id>)
gh run download <run-id> --repo PURETASK/puretask-clean-with-confidence
```

**Using GitHub UI:**
1. Go to: https://github.com/PURETASK/puretask-clean-with-confidence/actions
2. Click on the workflow run
3. Scroll to "Artifacts" section
4. Download `audit-results` artifact

### Step 2: Review Results

**Open `triage.json` and look for:**
- Critical vulnerabilities (fix immediately)
- High vulnerabilities (fix soon)
- Moderate/Low (fix when convenient)

### Step 3: Share Results

**Option A: Share triage.json content**
- Open `triage.json`
- Copy contents
- Share for automated remediation

**Option B: Upload files**
- Upload `audit.json` and `triage.json`
- Request automated triage and remediation

---

## 🚨 Troubleshooting

### GitHub CLI Not Found

**Install GitHub CLI:**
```powershell
# Using winget
winget install --id GitHub.cli

# Or download installer
# https://cli.github.com/
```

### Not Authenticated

**Authenticate:**
```powershell
gh auth login
```

### Workflow Not Found

**Check workflow name:**
- Go to: https://github.com/PURETASK/puretask-clean-with-confidence/actions
- Look for workflow named "Audit Auto-Fix & Triage"
- Verify exact name (case-sensitive)

### Permission Denied

**Check permissions:**
- Ensure you have write access to repository
- Verify PAT has `repo` and `workflow` scopes
- Check organization permissions

### Node/npm Not Found

**Install Node.js:**
- Download from: https://nodejs.org/
- Or use: `winget install OpenJS.NodeJS`

---

## ✅ Quick Checklist

- [ ] Choose option (1, 2, or 3)
- [ ] Install prerequisites if needed
- [ ] Run workflow dispatch command
- [ ] Wait for workflow to complete
- [ ] Download artifacts
- [ ] Review `triage.json`
- [ ] Share results for remediation

---

## 📚 Related Resources

- **GitHub CLI Docs:** https://cli.github.com/manual/
- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **npm audit Docs:** https://docs.npmjs.com/cli/v8/commands/npm-audit
- **PAT Creation:** https://github.com/settings/tokens

---

**After running the workflow, share the `triage.json` content or say "I ran it" and I'll help triage the results!**

---

*Last Updated: January 2025*
