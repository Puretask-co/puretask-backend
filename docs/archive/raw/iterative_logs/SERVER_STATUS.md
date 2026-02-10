# 🚀 Server Status

**Last Updated**: [INSERT DATE]

---

## 📊 **CURRENT STATUS**

### **Backend Server** (Port 4000)
- **Status**: ⏳ Starting in background
- **Command**: `npm run dev`
- **URL**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

### **Frontend Server** (Port 3000)
- **Status**: ⏳ Starting in background
- **Command**: `npm run dev` (in `puretask-frontend` directory)
- **URL**: http://localhost:3000

---

## 🔍 **VERIFY SERVERS**

### **Check Backend**:
```bash
# Health check
curl http://localhost:4000/health

# Or in browser
http://localhost:4000/health
```

### **Check Frontend**:
```bash
# Open in browser
http://localhost:3000
```

---

## 🛠️ **MANUAL START (If Needed)**

### **Backend**:
```bash
cd c:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev
```

### **Frontend**:
```bash
cd c:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev
```

---

## ⚠️ **TROUBLESHOOTING**

### **If servers don't start**:

1. **Check for port conflicts**:
   ```powershell
   Get-NetTCPConnection -LocalPort 4000
   Get-NetTCPConnection -LocalPort 3000
   ```

2. **Check environment variables**:
   - Backend needs `.env` file with database credentials
   - Verify `DATABASE_URL` is set

3. **Check for errors**:
   - Look at terminal output for error messages
   - Check if dependencies are installed (`npm install`)

4. **Kill existing processes** (if needed):
   ```powershell
   # Find Node processes
   Get-Process node
   
   # Kill specific process
   Stop-Process -Id <PID> -Force
   ```

---

## 📝 **NOTES**

- Servers may take 10-30 seconds to fully start
- Backend requires database connection (Neon PostgreSQL)
- Frontend requires backend to be running for API calls
- Both servers run in development mode with hot reload

---

**Servers are starting! Check the URLs above once they're ready.** 🚀
