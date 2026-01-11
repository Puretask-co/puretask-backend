// src/lib/cache.ts
// Redis-based caching service for PureTask
// Implements efficient caching strategy with automatic invalidation

import { redis } from './redis';
import { logger } from './logger';

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
  skipCache?: boolean; // Skip cache for this operation
}

/**
 * Cache key patterns for invalidation
 */
export const CacheKeys = {
  // User-related
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_SESSION: (userId: string) => `user:session:${userId}`,
  USER_BALANCE: (userId: string) => `user:balance:${userId}`,
  
  // Cleaner-related
  CLEANER_PROFILE: (cleanerId: string) => `cleaner:profile:${cleanerId}`,
  CLEANER_RATING: (cleanerId: string) => `cleaner:rating:${cleanerId}`,
  CLEANER_AVAILABILITY: (cleanerId: string) => `cleaner:availability:${cleanerId}`,
  CLEANER_REVIEWS: (cleanerId: string, page: number) => `cleaner:reviews:${cleanerId}:${page}`,
  
  // Search-related
  CLEANER_SEARCH: (query: string) => `search:cleaners:${query}`,
  FEATURED_CLEANERS: () => `search:featured`,
  
  // Job-related
  JOB_DETAILS: (jobId: string) => `job:${jobId}`,
  USER_JOBS: (userId: string) => `jobs:user:${userId}`,
  CLEANER_JOBS: (cleanerId: string) => `jobs:cleaner:${cleanerId}`,
  
  // Dashboard-related
  CLIENT_DASHBOARD: (userId: string) => `dashboard:client:${userId}`,
  CLEANER_DASHBOARD: (userId: string) => `dashboard:cleaner:${userId}`,
  ADMIN_STATS: () => `dashboard:admin:stats`,
  
  // Analytics
  ANALYTICS_SUMMARY: (timeRange: string) => `analytics:summary:${timeRange}`,
  TOP_CLEANERS: (timeRange: string) => `analytics:top:cleaners:${timeRange}`,
};

/**
 * Default TTL values (in seconds)
 */
export const DefaultTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
};

/**
 * Redis Caching Service
 */
export class CacheService {
  /**
   * Get value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      logger.debug('cache_hit', { key });
      return parsed as T;
    } catch (error) {
      logger.error('cache_get_error', { 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }
  
  /**
   * Set value in cache
   */
  static async set<T>(
    key: string, 
    value: T, 
    ttl: number = DefaultTTL.MEDIUM
  ): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await redis.setex(key, ttl, data);
      logger.debug('cache_set', { key, ttl });
    } catch (error) {
      logger.error('cache_set_error', { 
        key, 
        error: (error as Error).message 
      });
    }
  }
  
  /**
   * Delete value from cache
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
      logger.debug('cache_delete', { key });
    } catch (error) {
      logger.error('cache_delete_error', { 
        key, 
        error: (error as Error).message 
      });
    }
  }
  
  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('cache_delete_pattern', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('cache_delete_pattern_error', { 
        pattern, 
        error: (error as Error).message 
      });
    }
  }
  
  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('cache_exists_error', { 
        key, 
        error: (error as Error).message 
      });
      return false;
    }
  }
  
  /**
   * Get remaining TTL for a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error('cache_ttl_error', { 
        key, 
        error: (error as Error).message 
      });
      return -1;
    }
  }
  
  /**
   * Increment a numeric value
   */
  static async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      logger.error('cache_increment_error', { 
        key, 
        error: (error as Error).message 
      });
      return 0;
    }
  }
  
  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  static async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = DefaultTTL.MEDIUM
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const fresh = await fetchFn();
    
    // Cache the result
    await this.set(key, fresh, ttl);
    
    return fresh;
  }
}

/**
 * Cache decorator for async functions
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Generate cache key
      const prefix = options.prefix || propertyKey;
      const argsKey = JSON.stringify(args);
      const cacheKey = `${prefix}:${argsKey}`;
      
      // Check if we should skip cache
      if (options.skipCache) {
        return await originalMethod.apply(this, args);
      }
      
      // Try cache
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        logger.debug('cache_decorator_hit', { method: propertyKey });
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache result
      await CacheService.set(
        cacheKey, 
        result, 
        options.ttl || DefaultTTL.MEDIUM
      );
      
      logger.debug('cache_decorator_set', { method: propertyKey });
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Cache invalidation helpers
 */
export class CacheInvalidation {
  /**
   * Invalidate user-related caches
   */
  static async invalidateUser(userId: string): Promise<void> {
    await Promise.all([
      CacheService.del(CacheKeys.USER_PROFILE(userId)),
      CacheService.del(CacheKeys.USER_SESSION(userId)),
      CacheService.del(CacheKeys.USER_BALANCE(userId)),
      CacheService.del(CacheKeys.USER_JOBS(userId)),
      CacheService.del(CacheKeys.CLIENT_DASHBOARD(userId)),
      CacheService.del(CacheKeys.CLEANER_DASHBOARD(userId)),
    ]);
  }
  
  /**
   * Invalidate cleaner-related caches
   */
  static async invalidateCleaner(cleanerId: string): Promise<void> {
    await Promise.all([
      CacheService.del(CacheKeys.CLEANER_PROFILE(cleanerId)),
      CacheService.del(CacheKeys.CLEANER_RATING(cleanerId)),
      CacheService.del(CacheKeys.CLEANER_AVAILABILITY(cleanerId)),
      CacheService.delPattern(CacheKeys.CLEANER_REVIEWS(cleanerId, '*')),
      CacheService.del(CacheKeys.CLEANER_JOBS(cleanerId)),
      CacheService.delPattern('search:cleaners:*'), // Invalidate all searches
      CacheService.del(CacheKeys.FEATURED_CLEANERS()),
    ]);
  }
  
  /**
   * Invalidate job-related caches
   */
  static async invalidateJob(jobId: string, clientId?: string, cleanerId?: string): Promise<void> {
    const promises = [
      CacheService.del(CacheKeys.JOB_DETAILS(jobId)),
    ];
    
    if (clientId) {
      promises.push(CacheService.del(CacheKeys.USER_JOBS(clientId)));
      promises.push(CacheService.del(CacheKeys.CLIENT_DASHBOARD(clientId)));
    }
    
    if (cleanerId) {
      promises.push(CacheService.del(CacheKeys.CLEANER_JOBS(cleanerId)));
      promises.push(CacheService.del(CacheKeys.CLEANER_DASHBOARD(cleanerId)));
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Invalidate search caches
   */
  static async invalidateSearch(): Promise<void> {
    await Promise.all([
      CacheService.delPattern('search:cleaners:*'),
      CacheService.del(CacheKeys.FEATURED_CLEANERS()),
    ]);
  }
  
  /**
   * Invalidate dashboard caches
   */
  static async invalidateDashboards(): Promise<void> {
    await Promise.all([
      CacheService.delPattern('dashboard:*'),
      CacheService.del(CacheKeys.ADMIN_STATS()),
    ]);
  }
  
  /**
   * Invalidate analytics caches
   */
  static async invalidateAnalytics(): Promise<void> {
    await CacheService.delPattern('analytics:*');
  }
}

/**
 * Cache warming - preload frequently accessed data
 */
export class CacheWarming {
  /**
   * Warm featured cleaners cache
   */
  static async warmFeaturedCleaners(fetchFn: () => Promise<any>): Promise<void> {
    try {
      const data = await fetchFn();
      await CacheService.set(
        CacheKeys.FEATURED_CLEANERS(), 
        data, 
        DefaultTTL.LONG
      );
      logger.info('cache_warm_featured_cleaners', { count: data.length });
    } catch (error) {
      logger.error('cache_warm_error', { 
        type: 'featured_cleaners',
        error: (error as Error).message 
      });
    }
  }
  
  /**
   * Warm admin stats cache
   */
  static async warmAdminStats(fetchFn: () => Promise<any>): Promise<void> {
    try {
      const data = await fetchFn();
      await CacheService.set(
        CacheKeys.ADMIN_STATS(), 
        data, 
        DefaultTTL.SHORT
      );
      logger.info('cache_warm_admin_stats');
    } catch (error) {
      logger.error('cache_warm_error', { 
        type: 'admin_stats',
        error: (error as Error).message 
      });
    }
  }
}

export default CacheService;

