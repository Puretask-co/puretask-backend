# 🗄️ Database Setup Guide

**Date:** 2025-01-11  
**Purpose:** Set up database connection for PureTask backend

---

## Quick Setup Steps

### Step 1: Get Database URL

**Option A: Neon (Recommended - Free Tier)**
1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project
4. Copy the connection string from dashboard
5. Format: `postgresql://user:password@host:port/database?sslmode=require`

**Option B: Existing PostgreSQL**
- Use your existing PostgreSQL connection string
- Format: `postgresql://user:password@host:port/database?sslmode=require`

### Step 2: Configure Environment

1. **Check if .env exists:**
   ```bash
   # Windows PowerShell
   Test-Path .env
   
   # If false, create it
   ```

2. **Create/Edit .env file:**
   ```bash
   # Copy from ENV_EXAMPLE.md or create manually
   ```

3. **Add DATABASE_URL:**
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
   ```

### Step 3: Test Connection

```bash
node scripts/test-db-connection.js
```

**Expected Output:**
```
✅ Database connection successful!
✅ Found X tables
✅ Found X views
✅ Found X functions
🎉 All tests passed! Database is ready to use.
```

---

## Troubleshooting

### Error: "Missing required environment variable: DATABASE_URL"
**Solution:** Create `.env` file with `DATABASE_URL` set

### Error: "ENOTFOUND" or "ECONNRESET"
**Solution:** 
- Check DATABASE_URL is correct
- Verify database hostname is reachable
- For Neon: Ensure database is active (not paused)

### Error: "password authentication failed"
**Solution:**
- Check username and password in connection string
- Verify credentials are correct

### Error: "database does not exist"
**Solution:**
- Check database name in connection string
- Create database if needed

---

## Next Steps After Connection Works

1. **Verify Migrations:**
   ```bash
   npm run migrate:verify
   ```

2. **Run Migrations (if needed):**
   ```bash
   npm run migrate:fix-payouts-fk
   ```

3. **Run Tests:**
   ```bash
   npm run test:smoke
   ```

---

## Security Notes

- ✅ `.env` is in `.gitignore` - won't be committed
- ⚠️ Never commit DATABASE_URL to version control
- ⚠️ Use different databases for dev/staging/production
- ⚠️ Rotate database passwords regularly

---

## Quick Reference

**Test Connection:**
```bash
node scripts/test-db-connection.js
```

**Verify Migrations:**
```bash
npm run migrate:verify
```

**Run Specific Migration:**
```bash
npm run migrate:fix-payouts-fk
```

