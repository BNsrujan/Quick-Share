import { getRedisClient } from '../database';
import { logger } from '../utils/logger';

// Constants
const RATE_LIMIT_PREFIX = 'ratelimit:';
const DEFAULT_WINDOW = 60; // 1 minute in seconds
const DEFAULT_MAX_REQUESTS = 10;

interface RateLimitOptions {
  windowSeconds?: number;
  maxRequests?: number;
}

export class RateLimitService {
  /**
   * Check if a client has exceeded rate limits
   * Returns true if rate limit is exceeded
   */
  static async isRateLimited(
    clientId: string,
    action: string,
    options: RateLimitOptions = {}
  ): Promise<boolean> {
    const redis = getRedisClient();
    
    const windowSeconds = options.windowSeconds || DEFAULT_WINDOW;
    const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    
    const key = `${RATE_LIMIT_PREFIX}${action}:${clientId}`;
    
    // Get current count
    const count = await redis.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    // Check if rate limit is exceeded
    const isLimited = count > maxRequests;
    
    if (isLimited) {
      logger.warn('Rate limit exceeded', {
        clientId,
        action,
        count,
        maxRequests
      });
    }
    
    return isLimited;
  }

  /**
   * Get remaining requests for a client
   */
  static async getRemainingRequests(
    clientId: string,
    action: string,
    options: RateLimitOptions = {}
  ): Promise<number> {
    const redis = getRedisClient();
    
    const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    const key = `${RATE_LIMIT_PREFIX}${action}:${clientId}`;
    
    // Get current count
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;
    
    // Calculate remaining requests
    return Math.max(0, maxRequests - count);
  }

  /**
   * Reset rate limit for a client
   */
  static async resetRateLimit(
    clientId: string,
    action: string
  ): Promise<void> {
    const redis = getRedisClient();
    const key = `${RATE_LIMIT_PREFIX}${action}:${clientId}`;
    
    await redis.del(key);
  }
}