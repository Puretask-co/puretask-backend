# 🔧 Database Connection Troubleshooting

**Issue:** All tests failing with `ECONNRESET` - database connection timeouts

---

## ✅ Fixes Applied

### 1. Enhanced Test Setup with Retry Logic
- Added exponential backoff retry (5 attempts)
- Tests won't fail immediately if DB is temporarily unavailable
- Better error messages with retry attempts

### 2. Improved Connection Pool Settings
- Added connection timeout (10 seconds)
- Added idle timeout (30 seconds)
- Increased max connections (20)
- Better connection lifecycle management

---

## 🔍 Troubleshooting Steps

### Step 1: Check Database URL
```powershell
# Check if .env file exists and has DATABASE_URL
if (Test-Path .env) {
    Get-Content .env | Select-String "DATABASE_URL"
}
```

### Step 2: Test Database Connection
```powershell
node scripts/test-db-connection.js
```

### Step 3: Check Neon Database Status
1. Go to Neon Console: https://console.neon.tech
2. Check if database is **active** (not paused)
3. If paused, click "Resume" to activate

### Step 4: Verify Connection String Format
Your `DATABASE_URL` should look like:
```
postgresql://user:password@host/database?sslmode=require
```

### Step 5: Check Network/Firewall
- Ensure you can reach Neon's servers
- Check if corporate firewall is blocking connections
- Try from a different network

---

## 🚨 Common Issues

### Issue: Database is Paused
**Solution:** Resume database in Neon Console

### Issue: Too Many Connections
**Solution:** 
- Close other database connections
- Reduce `max` pool size in `src/db/client.ts`

### Issue: Network Timeout
**Solution:**
- Check internet connection
- Try increasing `connectionTimeoutMillis` in pool config
- Use Neon's connection pooler (add `-pooler` to connection string)

### Issue: Invalid Connection String
**Solution:**
- Regenerate connection string in Neon Console
- Ensure `.env` file has correct `DATABASE_URL`
- Restart terminal/IDE after changing `.env`

---

## 💡 Quick Fixes

### Use Connection Pooler (Recommended for Neon)
If your connection string doesn't have `-pooler`, add it:
```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
```

### Increase Timeouts
Edit `src/db/client.ts`:
```typescript
connectionTimeoutMillis: 20000, // Increase to 20 seconds
```

### Skip Database Tests Temporarily
If you need to test other parts:
```powershell
# Run only non-database tests
npm test -- --grep "health"
```

---

## 📊 Current Status

- ✅ Test setup: Enhanced with retries
- ✅ Connection pool: Improved settings
- ⚠️ Database connection: Failing (needs investigation)

**Next Steps:**
1. Check Neon Console - is database active?
2. Verify DATABASE_URL in `.env`
3. Test connection manually: `node scripts/test-db-connection.js`
4. If still failing, check network/firewall

---

**Note:** The code fixes are in place. The issue is likely:
- Database is paused in Neon
- Network connectivity issue
- Invalid connection string

