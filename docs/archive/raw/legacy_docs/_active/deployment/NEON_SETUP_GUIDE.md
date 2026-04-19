# 🦄 Neon Database Setup Guide

**Purpose:** Neon-specific configuration and best practices for PureTask backend

---

## ✅ Already Configured (No Changes Needed)

Your codebase already has Neon-optimized settings:

1. **Connection Pool Sizes:**
   - Test environment: 5 connections (good for Neon free tier)
   - Production: 20 connections (Neon free tier supports up to 100)
   - Located in `src/db/client.ts`

2. **Connection Timeouts:**
   - Test: 15 seconds (Neon can be slower on cold starts)
   - Production: 10 seconds
   - Located in `src/db/client.ts`

3. **SSL/TLS:**
   - Handled automatically via connection string (`?sslmode=require`)
   - No explicit SSL configuration needed

---

## 🔧 Required Configuration

### 1. Connection String Format

Your `DATABASE_URL` should include SSL mode:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

**Important:** Neon **requires** SSL. The `?sslmode=require` parameter ensures connections use TLS.

### 2. Connection Pooler (Recommended for Production)

Neon offers a connection pooler that's better for serverless/serverless-like environments. Use it for:
- Production deployments
- Serverless functions
- High-connection scenarios

**Format:**
```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/database?sslmode=require
```

The `-pooler` suffix in the hostname enables Neon's built-in connection pooling.

**When to use:**
- ✅ Production deployments
- ✅ Serverless functions
- ⚠️ Development: Can use either (direct or pooler)

**Current setup:** Your code uses `pg` Pool which also provides connection pooling, so the direct connection should work fine for development.

---

## 🚀 Neon-Specific Optimizations

### Optional: Use Neon Connection Pooler

If you want to use Neon's built-in pooler (recommended for production), update your connection string:

1. **Get Pooler Connection String from Neon Console:**
   - Go to your Neon project
   - Navigate to "Connection Details"
   - Select "Pooled connection" tab
   - Copy the connection string

2. **Update `.env`:**
   ```env
   DATABASE_URL=postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
   ```

### Connection Pool Settings

Your current settings are already optimized:

```typescript
// src/db/client.ts (already configured)
max: isTestEnv ? 5 : 20,  // ✅ Good for Neon free tier
connectionTimeoutMillis: isTestEnv ? 15000 : 10000,  // ✅ Handles Neon cold starts
```

**Neon Free Tier Limits:**
- Max connections: 100
- Current setting: 20 (well within limit) ✅
- Test setting: 5 (very safe) ✅

---

## 📋 Migration Execution

Migrations work the same with Neon. The `scripts/run-migration.js` script already:
- ✅ Validates connection string format
- ✅ Sets appropriate timeouts
- ✅ Handles SSL via connection string

**No changes needed** - just ensure your `DATABASE_URL` has `?sslmode=require`.

---

## 🧪 Testing with Neon

### Test Environment Settings

Already optimized in `src/db/client.ts`:

```typescript
const isTestEnv = process.env.RUNNING_TESTS === 'true' || 
                  process.env.NODE_ENV === 'test' ||
                  process.env.VITEST === 'true';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: isTestEnv ? 5 : 20,  // ✅ Fewer connections for tests
  connectionTimeoutMillis: isTestEnv ? 15000 : 10000,  // ✅ Longer timeout
});
```

**Why these settings:**
- Fewer connections: Tests often run in parallel, Neon free tier limits help prevent exhaustion
- Longer timeout: Neon databases can have cold starts (especially free tier), 15s timeout prevents flaky tests

---

## ⚠️ Neon-Specific Considerations

### 1. Database Pausing (Free Tier)

Neon free tier databases pause after inactivity. Your connection pool handles this by:
- Reconnecting on idle timeout
- `allowExitOnIdle: true` lets the process exit cleanly

**If database is paused:**
- First connection will take longer (database wake-up)
- Subsequent connections will be fast
- No code changes needed - handled automatically

### 2. Cold Starts

Neon databases may have cold starts (especially free tier):
- First query after pause: 1-3 seconds
- Your 15s test timeout handles this ✅
- Production should use Neon's connection pooler to minimize impact

### 3. Connection Limits

**Free Tier:**
- Max 100 concurrent connections
- Your settings (5 test, 20 prod) are well within limits ✅

**If you hit limits:**
- Reduce `max` pool size
- Use Neon's connection pooler (reduces connection count)

---

## 🔒 Security Checklist

✅ **Already configured:**
- SSL/TLS via `?sslmode=require` in connection string
- Password in connection string (never committed to git)
- Connection pool limits prevent resource exhaustion

✅ **Best Practices:**
- Use different databases for dev/staging/production
- Rotate database passwords regularly
- Use Neon's IP allowlisting for production (if available)

---

## 📝 Quick Reference

### Connection String Template

```env
# Direct connection (development)
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/database?sslmode=require

# Pooled connection (production recommended)
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/database?sslmode=require
```

### Test Connection

```bash
node scripts/test-db-connection.js
```

### Run Migrations

```bash
# Single migration
npm run migrate:run DB/migrations/hardening/901_stripe_events_processed.sql

# All hardening migrations
for file in DB/migrations/hardening/*.sql; do
  npm run migrate:run "$file"
done
```

---

## 🎯 Summary

**You're all set!** Your codebase is already optimized for Neon:

✅ Connection pool sizes appropriate for Neon free tier  
✅ Timeouts handle Neon cold starts  
✅ SSL/TLS handled via connection string  
✅ No code changes required  

**Only requirement:**
- Ensure your `DATABASE_URL` includes `?sslmode=require`
- Consider using Neon's connection pooler for production

---

## 🆘 Troubleshooting

### "Connection timeout" errors
- **Solution:** Check if database is paused in Neon Console, resume if needed
- **Solution:** Increase timeout in `src/db/client.ts` (already set to 15s for tests)

### "Too many connections" errors
- **Solution:** Reduce `max` pool size in `src/db/client.ts`
- **Solution:** Use Neon's connection pooler (reduces connection count)

### "SSL required" errors
- **Solution:** Ensure `DATABASE_URL` has `?sslmode=require`
- **Solution:** Check Neon Console for correct connection string

### Slow first connection
- **Normal:** Neon free tier databases pause after inactivity
- **Impact:** First connection takes 1-3 seconds (wake-up time)
- **Code:** Already handles this with 15s test timeout ✅

---

**Last Updated:** 2025-01-12

