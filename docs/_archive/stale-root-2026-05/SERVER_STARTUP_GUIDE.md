# 🚀 Server Startup Guide

## ✅ **STATUS**

Both servers have been started in separate PowerShell windows.

---

## 📍 **SERVER LOCATIONS**

### **Backend Server**
- **URL**: http://localhost:4000
- **Health Check**: http://localhost:4000/health
- **Window**: Look for a PowerShell window titled "Backend Server Starting..."

### **Frontend Server**
- **URL**: http://localhost:3000
- **Window**: Look for a PowerShell window titled "Frontend Server Starting..."

---

## 🔍 **VERIFY SERVERS ARE RUNNING**

### **Option 1: Check PowerShell Windows**
- Look for two PowerShell windows that opened
- Check for any error messages in red
- Look for "Server listening on port..." messages

### **Option 2: Check in Browser**
- **Backend**: http://localhost:4000/health
- **Frontend**: http://localhost:3000

### **Option 3: Check Ports**
```powershell
Get-NetTCPConnection -LocalPort 4000,3000
```

---

## ⚠️ **TROUBLESHOOTING**

### **If Backend Won't Start:**

1. **Check the PowerShell window** for error messages
2. **Common issues**:
   - Missing `.env` file → Create one with database credentials
   - Database connection error → Check `DATABASE_URL` in `.env`
   - Port 4000 already in use → Kill the process using port 4000

3. **Kill process on port 4000**:
   ```powershell
   $process = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
   if ($process) { Stop-Process -Id $process.OwningProcess -Force }
   ```

### **If Frontend Won't Start:**

1. **Check the PowerShell window** for error messages
2. **Common issues**:
   - Missing dependencies → Run `npm install` in frontend directory
   - Port 3000 already in use → Kill the process using port 3000
   - Backend not running → Frontend needs backend to be running

3. **Kill process on port 3000**:
   ```powershell
   $process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
   if ($process) { Stop-Process -Id $process.OwningProcess -Force }
   ```

---

## 🛠️ **MANUAL START (If Needed)**

### **Backend**:
```powershell
cd c:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev
```

### **Frontend**:
```powershell
cd c:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev
```

---

## 📝 **NOTES**

- ✅ **Fixed**: Installed missing `uuid` dependency
- ⏳ **Servers**: Starting in separate windows (check those windows for logs)
- 🔄 **Hot Reload**: Both servers support hot reload (auto-restart on file changes)
- ⚠️ **Database**: Backend requires Neon PostgreSQL connection (check `.env`)

---

**Check the PowerShell windows for server status and any errors!** 🚀
