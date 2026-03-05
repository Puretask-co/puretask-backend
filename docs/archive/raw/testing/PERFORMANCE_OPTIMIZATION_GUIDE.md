# ⚡ PERFORMANCE OPTIMIZATION GUIDE - PureTask Platform

**Date:** Saturday, January 11, 2026  
**Status:** Optimization Framework Created  
**Current Performance:** Good | Target: Excellent

---

## 📊 CURRENT PERFORMANCE BASELINE

### Backend API:
- Average Response Time: ~233ms
- Health Endpoint: 44ms
- Auth Endpoints: 102-337ms
- Database Query Time: ~706ms (ready check)

### Frontend:
- Initial Load: Not yet benchmarked
- Time to Interactive: Not yet benchmarked
- Bundle Size: Not yet analyzed

**Target Metrics:**
- API Response: < 200ms (p95)
- Page Load: < 2s
- Time to Interactive: < 3s

---

## 🎯 OPTIMIZATION PRIORITIES

### Priority 1: Database Query Optimization ⚡
### Priority 2: Caching Strategy 💾
### Priority 3: Frontend Performance 🚀
### Priority 4: CDN & Asset Optimization 🌐
### Priority 5: Load Testing & Monitoring 📊

---

## 1️⃣ DATABASE QUERY OPTIMIZATION

### 1.1 Add Database Indexes

**Missing Indexes to Add:**

```sql
-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role_rating ON users(role, rating DESC, verified_badge);

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_cleaner_id ON jobs(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_client_status ON jobs(client_id, status);

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read ON messages(receiver_id, read_at);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
```

**Create Migration File:**
```bash
# File: DB/migrations/030_performance_indexes.sql
```

### 1.2 Query Optimization Checklist

**Common N+1 Problems:**
- [ ] User queries loading related jobs
- [ ] Job queries loading cleaner/client data
- [ ] Message queries loading user data

**Solutions:**
```typescript
// Before: N+1 problem
const jobs = await query('SELECT * FROM jobs WHERE client_id = $1', [clientId]);
for (const job of jobs) {
  const cleaner = await query('SELECT * FROM users WHERE id = $1', [job.cleaner_id]);
}

// After: JOIN query
const jobs = await query(`
  SELECT 
    j.*,
    u.full_name as cleaner_name,
    u.avatar_url as cleaner_avatar
  FROM jobs j
  LEFT JOIN users u ON j.cleaner_id = u.id
  WHERE j.client_id = $1
`, [clientId]);
```

### 1.3 Database Connection Pooling

**Current Status:** ✅ Implemented via pg.Pool

**Verify Configuration:**
```typescript
// src/db/client.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Recommendations:**
- Max connections: 20-50 (based on load)
- Idle timeout: 30s
- Connection timeout: 2s

---

## 2️⃣ CACHING STRATEGY

### 2.1 Redis Caching Implementation

**Current Status:** Redis configured but underutilized

**Cache Strategy:**

```typescript
// src/lib/cache.ts (NEW FILE TO CREATE)
import { redis } from './redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private static defaultTTL = 300; // 5 minutes
  
  static async get<T>(key: string, prefix = ''): Promise<T | null> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const data = await redis.get(fullKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
      const ttl = options.ttl || this.defaultTTL;
      await redis.setex(fullKey, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  static async del(key: string, prefix = ''): Promise<void> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      await redis.del(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  static async flush(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }
}

// Cache decorator for functions
export function cache(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
      
      // Try cache first
      const cached = await CacheService.get(cacheKey, options.prefix);
      if (cached) return cached;
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Store in cache
      await CacheService.set(cacheKey, result, options);
      
      return result;
    };
    
    return descriptor;
  };
}
```

### 2.2 What to Cache

**High Priority (Immediate):**
1. ✅ User sessions (already cached via JWT)
2. Cleaner profiles (read-heavy)
3. Cleaner search results (15 min TTL)
4. User ratings/reviews (10 min TTL)
5. Featured cleaners list (30 min TTL)

**Medium Priority:**
6. Job statistics (5 min TTL)
7. Dashboard analytics (10 min TTL)
8. System settings (60 min TTL)

**Low Priority:**
9. Static content (1 hour TTL)
10. Email templates (1 hour TTL)

### 2.3 Cache Implementation Example

```typescript
// src/services/cleanerService.ts
import { CacheService } from '../lib/cache';

export async function getCleanerProfile(cleanerId: string) {
  const cacheKey = `cleaner:profile:${cleanerId}`;
  
  // Try cache first
  const cached = await CacheService.get(cacheKey, 'profiles');
  if (cached) return cached;
  
  // Query database
  const result = await query(
    'SELECT * FROM users WHERE id = $1 AND role = $2',
    [cleanerId, 'cleaner']
  );
  
  if (result.rows[0]) {
    // Cache for 10 minutes
    await CacheService.set(cacheKey, result.rows[0], {
      ttl: 600,
      prefix: 'profiles'
    });
  }
  
  return result.rows[0];
}

export async function updateCleanerProfile(cleanerId: string, data: any) {
  // Update database
  const result = await query(/* update query */);
  
  // Invalidate cache
  await CacheService.del(`cleaner:profile:${cleanerId}`, 'profiles');
  await CacheService.flush('search:cleaners:*'); // Invalidate search results
  
  return result;
}
```

### 2.4 Cache Invalidation Strategy

**When to Invalidate:**
- User profile updated → Invalidate user cache
- Cleaner rating changed → Invalidate cleaner cache + search results
- Job status changed → Invalidate job cache + user dashboard
- Payment completed → Invalidate balance cache

---

## 3️⃣ FRONTEND PERFORMANCE

### 3.1 Next.js Optimization

**Image Optimization:**
```typescript
// Use Next.js Image component everywhere
import Image from 'next/image';

<Image
  src="/cleaner-avatar.jpg"
  alt="Cleaner"
  width={100}
  height={100}
  loading="lazy"
  quality={85}
/>
```

**Code Splitting:**
```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const ChatWindow = dynamic(() => import('@/components/features/messaging/ChatWindow'), {
  loading: () => <Loading />,
  ssr: false // Disable SSR for client-only components
});
```

### 3.2 Bundle Size Optimization

**Analyze Bundle:**
```bash
cd puretask-frontend
npm run build
npm run analyze # (if configured)
```

**Optimization Techniques:**
1. Tree-shaking (automatic with Webpack/Turbopack)
2. Remove unused dependencies
3. Use lighter alternatives:
   - `date-fns` instead of `moment.js`
   - `lucide-react` instead of full icon libraries
4. Lazy load routes

### 3.3 React Query Optimization

**Stale-While-Revalidate:**
```typescript
// src/lib/queryClient.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

**Prefetch Critical Data:**
```typescript
// Prefetch cleaners on homepage
queryClient.prefetchQuery(['cleaners', { limit: 10 }], () =>
  cleanerService.search({ limit: 10 })
);
```

### 3.4 Rendering Optimization

**Memoization:**
```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive components
export const CleanerCard = memo(({ cleaner }) => {
  // Component logic
});

// Memoize expensive calculations
const sortedCleaners = useMemo(() => {
  return cleaners.sort((a, b) => b.rating - a.rating);
}, [cleaners]);

// Memoize callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

---

## 4️⃣ CDN & ASSET OPTIMIZATION

### 4.1 Image Compression

**Tools:**
- TinyPNG (https://tinypng.com)
- ImageOptim (Mac)
- Squoosh (Web)

**Automated Compression:**
```bash
# Install sharp for server-side compression
npm install sharp

# Create image optimization script
# scripts/optimize-images.js
```

### 4.2 WebP Conversion

```bash
# Convert all images to WebP
for file in public/images/*.{jpg,png}; do
  cwebp "$file" -o "${file%.*}.webp"
done
```

**Usage:**
```html
<picture>
  <source srcset="/image.webp" type="image/webp">
  <img src="/image.jpg" alt="Fallback">
</picture>
```

### 4.3 CDN Configuration

**Options:**
1. **Vercel (Included)** - Automatic with Vercel deployment
2. **Cloudflare** - Free CDN + caching
3. **AWS CloudFront** - Enterprise option

**Cloudflare Setup:**
1. Sign up at cloudflare.com
2. Add domain
3. Update DNS
4. Enable caching rules
5. Configure cache TTL

---

## 5️⃣ LOAD TESTING & MONITORING

### 5.1 Load Testing with k6

**Test Script Location:** `puretask-frontend/tests/performance/comprehensive-load-test.js`

**Run Load Tests:**
```bash
cd puretask-frontend
k6 run tests/performance/comprehensive-load-test.js
```

**Test Scenarios:**
1. Browse cleaners (200 users)
2. Register/Login (50 users)
3. Create booking (30 users)
4. Search (100 users)

**Success Criteria:**
- p95 response time < 500ms
- p99 response time < 1000ms
- Error rate < 1%
- Throughput > 100 req/sec

### 5.2 Database Performance Monitoring

**Neon Dashboard:**
- Query analytics
- Slow query log
- Connection stats
- Storage usage

**Enable Query Logging:**
```typescript
// src/db/client.ts
pool.on('connect', (client) => {
  const originalQuery = client.query;
  client.query = function(...args) {
    const start = Date.now();
    const result = originalQuery.apply(client, args);
    const duration = Date.now() - start;
    
    if (duration > 100) { // Log slow queries
      logger.warn('slow_query', {
        duration,
        query: args[0],
        params: args[1]
      });
    }
    
    return result;
  };
});
```

### 5.3 Real User Monitoring (RUM)

**Implement Web Vitals:**
```typescript
// src/lib/vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}
```

**Track in Analytics:**
```typescript
// src/app/layout.tsx
useEffect(() => {
  reportWebVitals((metric) => {
    // Send to analytics
    gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
    });
  });
}, []);
```

---

## 📊 PERFORMANCE CHECKLIST

### Database Optimization:
- [ ] Add indexes for all foreign keys
- [ ] Add indexes for commonly queried fields
- [ ] Optimize JOIN queries
- [ ] Implement connection pooling
- [ ] Monitor slow queries
- [ ] Run EXPLAIN ANALYZE on complex queries

### Caching:
- [ ] Implement Redis caching service
- [ ] Cache cleaner profiles
- [ ] Cache search results
- [ ] Cache user sessions
- [ ] Cache dashboard data
- [ ] Implement cache invalidation

### Frontend:
- [ ] Optimize images (WebP, compression)
- [ ] Implement lazy loading
- [ ] Code splitting for routes
- [ ] Memoize expensive components
- [ ] Optimize React Query settings
- [ ] Remove unused dependencies
- [ ] Minimize bundle size

### CDN & Assets:
- [ ] Set up CDN (Cloudflare/Vercel)
- [ ] Configure caching headers
- [ ] Compress static assets
- [ ] Use modern image formats
- [ ] Enable Gzip/Brotli compression

### Monitoring:
- [ ] Run k6 load tests
- [ ] Set up performance monitoring
- [ ] Track Web Vitals
- [ ] Monitor API response times
- [ ] Set up alerting for performance degradation

---

## 🎯 PERFORMANCE GOALS

### Short-term (This Week):
- API response time < 200ms (p95)
- Zero N+1 queries
- Basic caching implemented

### Medium-term (This Month):
- Page load time < 2s
- Full Redis caching
- CDN configured
- All images optimized

### Long-term (This Quarter):
- API response time < 100ms (p95)
- 99.9% uptime
- Global CDN coverage
- Real-time performance monitoring

---

## 📈 EXPECTED IMPROVEMENTS

### After Database Optimization:
- 40-60% faster queries
- Reduced database load
- Better scalability

### After Caching:
- 70-90% faster read operations
- Reduced database queries
- Lower server costs

### After Frontend Optimization:
- 30-50% faster page loads
- Better user experience
- Higher conversion rates

### After CDN:
- 50-80% faster static asset delivery
- Global performance improvement
- Reduced bandwidth costs

---

## 🚀 QUICK WINS (Do First)

1. **Add Database Indexes** (30 min) - Biggest impact
2. **Implement Basic Caching** (1 hour) - High ROI
3. **Optimize Images** (30 min) - Easy win
4. **Enable Gzip** (5 min) - Already done via Express

---

## 📝 NOTES

- Performance is an ongoing process
- Monitor metrics regularly
- Optimize based on real data, not assumptions
- Don't premature optimize
- Focus on user-facing performance first

---

*Performance optimization guide created on January 11, 2026*

**Next Steps:** Implement database indexes, then caching layer, then run load tests.

