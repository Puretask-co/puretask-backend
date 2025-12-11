# 🔧 MCP Servers Fix Guide - Quick Reference

**Quick fixes for MCP server issues**

---

## 🚀 Quick Fix: Postman MCP Server

### Get API Key
1. Visit: https://postman.com/settings/api-keys
2. Click **Generate API Key**
3. Copy the key (starts with `PMAK-`)

### Configure in Cursor
**Option A: Environment Variable**
```bash
# Windows PowerShell
[System.Environment]::SetEnvironmentVariable('POSTMAN_API_KEY', 'PMAK-your-key-here', 'User')
```

**Option B: Cursor Settings**
- Open Cursor Settings
- Navigate to MCP Servers → Postman
- Add API key in configuration

### Test
After configuration, restart Cursor and test:
```typescript
mcp_Postman_getAuthenticatedUser()
```

---

## 🚀 Quick Fix: Railway MCP Server

### Install Railway CLI
```bash
# Option 1: npm
npm install -g @railway/cli

# Option 2: PowerShell (Windows)
iwr https://railway.app/install.sh | iex
```

### Login
```bash
railway login
```

### Test
```bash
railway --version
railway status
```

---

## ✅ Browser MCP Server

**Status:** ✅ Working - No action needed

---

## 📝 Verification Checklist

- [ ] Postman API key obtained
- [ ] Postman API key configured in Cursor
- [ ] Postman authentication test passes
- [ ] Railway CLI installed (if needed)
- [ ] Railway login successful (if needed)
- [ ] All MCP servers tested and working

---

**Estimated Total Time:** 10-20 minutes

