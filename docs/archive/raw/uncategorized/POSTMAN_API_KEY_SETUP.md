# 🔑 Postman API Key Setup Guide

**Quick guide to get your Postman API key for MCP server authentication**

---

## 📋 Steps to Get Postman API Key

### Step 1: Access API Keys Settings
1. In Postman, click on your **profile icon** (top right)
2. Select **Settings** from the dropdown
3. Navigate to **API Keys** section
   - Or go directly to: https://postman.com/settings/api-keys

### Step 2: Generate API Key
1. Click **Generate API Key** button
2. Give it a name (e.g., "Cursor MCP Integration")
3. Click **Generate**
4. **Copy the API key immediately** - it starts with `PMAK-` and you won't see it again!

### Step 3: Configure in Cursor
The API key needs to be added to Cursor's MCP server configuration.

**Option A: Environment Variable (Recommended)**
```powershell
# Windows PowerShell (Run as Administrator)
[System.Environment]::SetEnvironmentVariable('POSTMAN_API_KEY', 'PMAK-your-key-here', 'User')
```

**Option B: Cursor MCP Config File**
The MCP configuration is typically in:
- Windows: `%APPDATA%\Cursor\User\globalStorage\mcp-settings.json`
- Or check Cursor Settings → Extensions → MCP Servers

Add to config:
```json
{
  "mcpServers": {
    "postman": {
      "apiKey": "PMAK-your-key-here"
    }
  }
}
```

### Step 4: Restart Cursor
After adding the API key, restart Cursor completely for the changes to take effect.

### Step 5: Verify
After restart, the Postman MCP server should authenticate successfully. You can test by trying to use Postman MCP tools.

---

## 🔒 Security Notes

- **Never commit API keys to git**
- Store in environment variables or secure config
- Rotate keys regularly
- Use different keys for dev/prod if needed

---

## ✅ Verification Checklist

- [ ] Postman API key generated
- [ ] API key copied (starts with `PMAK-`)
- [ ] API key added to Cursor MCP configuration
- [ ] Cursor restarted
- [ ] Postman MCP authentication working

---

**Need help?** Let me know once you have the API key and I can help you configure it!

