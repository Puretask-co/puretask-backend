# 🐛 Debug Setup Guide - Starting the Server

Complete guide to start the PureTask backend server and debug it in VS Code/Cursor.

---

## 📋 Prerequisites

1. **Node.js** (>=20.0.0) - Check with: `node --version`
2. **npm** - Comes with Node.js
3. **Database** - Neon PostgreSQL (free tier available)

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```powershell
npm install
```

### Step 2: Set Up Environment Variables

Create a `.env` file in the project root:

```powershell
# Copy from ENV_TEMPLATE.md or create manually
New-Item -Path .env -ItemType File
```

**Minimum required variables for development:**

```env
# Database (Required)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# JWT Secret (Required - generate a random one)
JWT_SECRET=your-secret-key-here-minimum-32-characters-long

# Server Port (Optional - defaults to 4000)
PORT=4000

# Node Environment (Optional - defaults to development)
NODE_ENV=development
```

**Generate JWT_SECRET:**

```powershell
# PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get DATABASE_URL:**

1. Go to https://console.neon.tech
2. Create/select your database
3. Copy the connection string
4. Add `?sslmode=require` at the end

### Step 3: Start the Development Server

```powershell
npm run dev
```

**Expected output:**
```
🚀 PureTask Backend running on port 4000
```

### Step 4: Test the Server

Open your browser or use curl:

```powershell
# PowerShell
Invoke-WebRequest -Uri http://localhost:4000/health

# Or visit in browser
# http://localhost:4000/health
```

**Expected response:**
```json
{
  "ok": true,
  "status": "ok",
  "service": "puretask-backend",
  "timestamp": "2025-01-XX..."
}
```

---

## 🐛 VS Code / Cursor Debugging Setup

### Step 1: Update Launch Configuration

The `.vscode/launch.json` file currently has a Chrome configuration. Let's add Node.js debugging:

**File: `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug: PureTask Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug: Current TypeScript File",
      "program": "${file}",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Process",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Step 2: Start Debugging

1. **Set breakpoints** in your TypeScript files (click left margin in VS Code/Cursor)
2. **Press F5** or click "Run and Debug" → "Debug: PureTask Backend"
3. **Server will start** with debugger attached
4. **Breakpoints will hit** when code executes

### Step 3: Debug Features

- **Breakpoints**: Click left margin to set breakpoints
- **Step Over (F10)**: Execute current line
- **Step Into (F11)**: Step into function calls
- **Step Out (Shift+F11)**: Step out of current function
- **Continue (F5)**: Resume execution
- **Watch**: Add variables to watch panel
- **Call Stack**: See function call hierarchy
- **Variables**: Inspect local/global variables

---

## 🔧 Alternative Debugging Methods

### Method 1: Using ts-node-dev with Debug Flag

Modify `package.json` dev script:

```json
"dev": "ts-node-dev --respawn --transpile-only --inspect src/index.ts"
```

Then attach debugger (see "Attach to Process" config above).

### Method 2: Using Node Inspector

```powershell
node --inspect -r ts-node/register src/index.ts
```

Then attach debugger in VS Code (port 9229).

### Method 3: Console Logging (Quick Debug)

Add logs throughout your code:

```typescript
import { logger } from "./lib/logger";

logger.info("debug_point", {
  userId: req.user?.id,
  jobId: job.id,
  status: job.status,
});
```

---

## 📝 Common Development Tasks

### Start Server in Development Mode

```powershell
npm run dev
```

**Features:**
- ✅ Auto-reload on file changes
- ✅ TypeScript compilation on-the-fly
- ✅ Better error messages
- ✅ Source maps for debugging

### Build for Production

```powershell
npm run build
```

Creates compiled JavaScript in `dist/` folder.

### Run Production Server

```powershell
npm start
```

Uses compiled code from `dist/`.

### Run Tests

```powershell
# All tests
npm test

# Watch mode
npm run test:watch

# Smoke tests only
npm run test:smoke

# Integration tests only
npm run test:integration
```

---

## 🔍 Debugging Specific Issues

### Database Connection Issues

```powershell
# Test database connection
node scripts/test-db-connection.js
```

### Environment Variables Not Loading

1. Check `.env` file exists in project root
2. Verify variable names match `src/config/env.ts`
3. Restart server after changing `.env`

### Port Already in Use

```powershell
# Windows - Find process using port 4000
netstat -ano | findstr :4000

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env
PORT=4001
```

### TypeScript Compilation Errors

```powershell
# Check for type errors
npm run typecheck
```

---

## 📚 Environment Variables Reference

See `docs/ENV_TEMPLATE.md` for complete list of environment variables.

**Minimum for development:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens

**Recommended for full functionality:**
- `STRIPE_SECRET_KEY` - For payment processing
- `SENDGRID_API_KEY` - For emails
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - For SMS
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` - For event-based notifications

---

## 🎯 Debugging Workflow Example

### Example: Debugging a Job Creation Endpoint

1. **Set breakpoint** in `src/routes/jobs.ts` at the `POST /jobs` handler
2. **Start debugger** (F5)
3. **Make request:**
   ```powershell
   Invoke-RestMethod -Uri http://localhost:4000/jobs `
     -Method POST `
     -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer YOUR_TOKEN"} `
     -Body '{"serviceType":"basic","address":"123 Main St","scheduledTime":"2025-01-15T10:00:00Z"}'
   ```
4. **Breakpoint hits** - inspect `req.body`, `req.user`, etc.
5. **Step through code** to see execution flow
6. **Inspect variables** in debug panel
7. **Continue execution** (F5) to see response

---

## 💡 Tips & Tricks

### Hot Reload

`ts-node-dev` automatically reloads on file changes. You don't need to restart the server after code changes.

### Source Maps

Source maps are enabled by default, so you can debug TypeScript directly (no need to debug compiled JS).

### Logging

Use the logger for debugging:

```typescript
import { logger } from "./lib/logger";

// Info logs
logger.info("user_action", { userId, action: "create_job" });

// Error logs
logger.error("operation_failed", { error: err.message, stack: err.stack });

// Debug logs (only in development)
if (env.NODE_ENV === "development") {
  logger.info("debug_data", { someData: "value" });
}
```

### API Testing

Use tools like:
- **Postman** - For manual API testing
- **Thunder Client** (VS Code extension) - API testing in editor
- **curl** / **Invoke-WebRequest** - Command line testing

---

## 🚨 Troubleshooting

### "Cannot find module" errors

```powershell
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Debugger not attaching

1. Check port 9229 is not in use
2. Verify launch.json configuration
3. Try "Attach to Process" instead of "Launch"

### Breakpoints not hitting

1. Verify source maps are enabled
2. Check TypeScript compiles without errors
3. Ensure you're setting breakpoints in `.ts` files, not `.js` files

---

## ✅ Quick Checklist

- [ ] Node.js >= 20 installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with `DATABASE_URL` and `JWT_SECRET`
- [ ] Database connection tested
- [ ] Server starts with `npm run dev`
- [ ] Health endpoint responds at `http://localhost:4000/health`
- [ ] Debug configuration added to `.vscode/launch.json`
- [ ] Breakpoints work when debugging

---

*Debug Setup Guide - January 2025*

