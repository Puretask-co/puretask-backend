# Troubleshooting

**What it is:** Known issues and fixes (startup, DB, webhooks, performance).  
**What it does:** Reduces time-to-fix for common problems.  
**How we use it:** Check when something fails; add new issues as we find them.

---

## Common Issues and Solutions

## Server Won't Start

### Symptoms
- Application fails to start
- Port already in use error
- Environment variable errors

### Solutions

**Port Already in Use**:
```bash
# Find process using port
lsof -i :4000
# Or on Windows
netstat -ano | findstr :4000

# Kill process
kill -9 <PID>
# Or on Windows
taskkill /PID <PID> /F
```

**Environment Variable Missing**:
```bash
# Check .env file exists
test -f .env

# Verify required variables
npm run typecheck  # Will show validation errors
```

**Database Connection Failed**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

## Database Connection Issues

### Symptoms
- Connection timeout errors
- "Connection refused" errors
- SSL errors

### Solutions

**Connection Timeout**:
- Check database server status
- Verify DATABASE_URL is correct
- Check network connectivity
- Review firewall rules

**SSL Errors**:
- Ensure `?sslmode=require` in DATABASE_URL
- Check SSL certificate validity
- Verify database supports SSL

**Connection Pool Exhausted**:
- Reduce connection pool size
- Check for connection leaks
- Scale database if needed

## Authentication Issues

### Symptoms
- "Invalid token" errors
- Users logged out unexpectedly
- Token expiration issues

### Solutions

**Invalid Token**:
- Check token expiration (`JWT_EXPIRES_IN`)
- Verify `JWT_SECRET` matches
- Check token format (Bearer token)

**Users Logged Out**:
- Check token expiration
- Verify token version matches user
- Check for token invalidation

**Token Not Working**:
- Verify Authorization header format: `Bearer <token>`
- Check token is not expired
- Verify user still exists

## Rate Limiting Issues

### Symptoms
- Getting 429 errors unexpectedly
- Rate limits not working
- False positives

### Solutions

**Too Many 429 Errors**:
- Check rate limit thresholds
- Review IP detection (proxy headers)
- Consider user-based limiting

**Rate Limits Not Working**:
- Verify rate limiting middleware is applied
- Check Redis connection (if using)
- Review rate limit configuration

**False Positives**:
- Increase rate limit thresholds
- Review IP detection logic
- Check for shared IP addresses

## Performance Issues

### Symptoms
- Slow response times
- High CPU usage
- High memory usage
- Timeout errors

### Solutions

**Slow Response Times**:
- Check database query performance
- Review slow query logs
- Add database indexes
- Optimize code paths

**High CPU Usage**:
- Profile application code
- Check for infinite loops
- Review worker processes
- Scale horizontally

**High Memory Usage**:
- Check for memory leaks
- Review connection pools
- Check cache sizes
- Restart application periodically

**Timeout Errors**:
- Increase timeout values
- Optimize slow operations
- Add request timeouts
- Review external API calls

## Error Tracking Issues

### Symptoms
- Errors not appearing in Sentry
- Missing error context
- Too many errors

### Solutions

**Errors Not in Sentry**:
- Verify `SENTRY_DSN` is set
- Check Sentry initialization logs
- Verify error is being caught
- Check Sentry project settings

**Missing Context**:
- Verify request context middleware
- Check user authentication
- Review error logging code
- Verify Sentry configuration

## Redis Issues

### Symptoms
- Rate limiting falls back to memory
- Redis connection errors
- Performance degradation

### Solutions

**Redis Not Connecting**:
- Verify `REDIS_URL` is correct
- Check Redis server status
- Review network connectivity
- Check Redis logs

**Fallback to Memory**:
- Check Redis connection status
- Review Redis logs
- Verify `USE_REDIS_RATE_LIMITING` is set
- Check Redis server resources

## Deployment Issues

### Symptoms
- Deployment fails
- Application won't start after deploy
- Rollback needed

### Solutions

**Deployment Fails**:
- Check build errors
- Verify environment variables
- Review deployment logs
- Check database migrations

**Application Won't Start**:
- Check application logs
- Verify environment variables
- Test database connection
- Review recent changes

**Need to Rollback**:
- Stop current version
- Restore previous version
- Restart application
- Verify functionality

## Getting Help

### Check Logs
```bash
# Application logs
tail -f logs/app.log

# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f api
```

### Check Status
```bash
# Health check
curl http://localhost:4000/health

# Readiness check
curl http://localhost:4000/health/ready

# Status dashboard
curl http://localhost:4000/status
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Or set log level
LOG_LEVEL=debug npm start
```

## Neon: Foreign Key Constraint "cannot be implemented" (SQLSTATE 42804)

### Symptoms
- Migrations 043–056 fail with `ERROR: foreign key constraint "xxx_cleaner_id_fkey" cannot be implemented (SQLSTATE 42804)`
- Happens when pasting gamification migrations into Neon SQL Editor

### Cause
The canonical schema uses `users.id TEXT`. Some Neon setups (e.g. Neon Auth, custom init) use `users.id UUID`. Foreign keys require exact type match: `cleaner_id TEXT` cannot reference `users(id)` when `users.id` is UUID.

### Verify Your users.id Type
Run in Neon SQL Editor:
```sql
SELECT data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';
```
- Result `text` → Use standard migrations; they should work.
- Result `uuid` → Use the gamification bundle with UUID variants. See `DB/gamification_schema_neon_part1.json` and update `cleaner_id TEXT` → `cleaner_id UUID` (and `created_by`/`updated_by`/`actor_admin_user_id` in 051) in any migration referencing `users(id)`.

### Quick Fix for Neon with users.id UUID

**Option A: Generate UUID bundle (recommended)**

```bash
node scripts/generate-neon-uuid-bundle.js --output DB/neon/gamification_uuid.sql
```

Then paste `DB/neon/gamification_uuid.sql` into Neon SQL Editor (run after your base schema). The bundle has all user-ref columns as UUID and no `BEGIN`/`COMMIT`.

**Option B: Manual edits**

When running migrations 043–056 on Neon where `users.id` is UUID, replace all `cleaner_id TEXT` with `cleaner_id UUID` (and `created_by`/`updated_by`/`actor_admin_user_id` in 051). Remove `BEGIN;`/`COMMIT;` to avoid rollback issues.

## Prevention

### Regular Maintenance
- Monitor error rates daily
- Review performance metrics weekly
- Update dependencies monthly
- Test recovery procedures quarterly

### Best Practices
- Always test in staging first
- Monitor during deployments
- Keep backups current
- Document all changes
