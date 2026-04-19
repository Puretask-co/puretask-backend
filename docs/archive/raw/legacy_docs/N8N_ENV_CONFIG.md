# ============================================
# ðŸ”— n8n Integration (Complete Setup)
# ============================================

# n8n MCP Server URL (for AI integration)
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http

# n8n API Key (for programmatic workflow triggering)
N8N_API_KEY=your-n8n-api-key-here

# n8n Webhook Secret (for HMAC signature verification)
# This secret is used to verify that webhook requests actually come from your n8n instance
N8N_WEBHOOK_SECRET=your-webhook-secret-here

# n8n Webhook URL (for event-based notifications)
N8N_WEBHOOK_URL=https://puretask.app.n8n.cloud/webhook/universal-sender

# Enable event-based notifications via n8n
USE_EVENT_BASED_NOTIFICATIONS=true
