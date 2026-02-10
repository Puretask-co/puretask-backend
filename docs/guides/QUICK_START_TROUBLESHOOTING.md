# Quick Start Troubleshooting

## Issue: `npm` command not found in VS Code/Cursor terminal

**Problem:** VS Code/Cursor terminal shows "npm: command not found" but Node.js is installed.

**Solution:**

### Option 1: Refresh Terminal (Easiest)

1. **Close the terminal** in VS Code/Cursor (click the trash icon)
2. **Open a new terminal:**
   - Press `` Ctrl+` `` (backtick) 
   - Or go to: Terminal → New Terminal
3. **Try again:**
   ```powershell
   npm run dev
   ```

### Option 2: Restart VS Code/Cursor

1. **Close VS Code/Cursor completely**
2. **Reopen** the project
3. **Open a new terminal** and try:
   ```powershell
   npm run dev
   ```

### Option 3: Use Full Path (Temporary Fix)

If refresh doesn't work, use the full path:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### Option 4: Use the Debugger (Recommended)

Instead of using the terminal, use VS Code's debugger:

1. **Set a breakpoint** (optional - click left margin of any `.ts` file)
2. **Press F5** or click "Run and Debug" → "Debug: PureTask Backend"
3. **Server will start automatically** with debugging enabled

This bypasses the terminal PATH issue entirely!

---

## Verify Setup

After refreshing, verify npm works:

```powershell
npm --version
# Should show: 11.6.2

node --version  
# Should show: v24.12.0
```

---

## Start Server

Once npm works, start the server:

```powershell
npm run dev
```

Expected output:
```
🚀 PureTask Backend running on port 4000
```

Then test it:
- Visit: http://localhost:4000/health
- Or use: `Invoke-WebRequest -Uri http://localhost:4000/health`

