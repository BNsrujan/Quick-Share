import { RateLimitService } from '../services/rate-limit.service';
import { getRedisClient } from '../database';

// Mock Redis client
jest.mock('../database', () => {
  const mockRedisClient = {
    incr: jest.fn(),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1)
  };
  
  return {
    getRedisClient: jest.fn().mockReturnValue(mockRedisClient)
  };
});

describe('RateLimitService', () => {
  const mockRedis = getRedisClient() as jest.Mocked<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('isRateLimited', () => {
    it('should return false when under the limit', async () => {
      mockRedis.incr.mockResolvedValueOnce(5); // 5 requests made
      
      const isLimited = await RateLimitService.isRateLimited(
        'test-client',
        'test-action',
        { maxRequests: 10 }
      );
      
      expect(isLimited).toBe(false);
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:test-action:test-client');
    });
    
    it('should return true when over the limit', async () => {
      mockRedis.incr.mockResolvedValueOnce(11); // 11 requests made
      
      const isLimited = await RateLimitService.isRateLimited(
        'test-client',
        'test-action',
        { maxRequests: 10 }
      );
      
      expect(isLimited).toBe(true);
    });
    
    it('should set expiry on first request', async () => {
      mockRedis.incr.mockResolvedValueOnce(1); // First request
      
      await RateLimitService.isRateLimited(
        'test-client',
        'test-action',
        { windowSeconds: 120, maxRequests: 10 }
      );
      
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'ratelimit:test-action:test-client',
        120
      );
    });
    
    it('should not set expiry on subsequent requests', async () => {
      mockRedis.incr.mockResolvedValueOnce(2); // Not first request
      
      await RateLimitService.isRateLimited(
        'test-client',
        'test-action'
      );
      
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });
  
  describe('getRemainingRequests', () => {
    it('should return max requests when no requests made', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const remaining = await RateLimitService.getRemainingRequests(
        'test-client',
        'test-action',
        { maxRequests: 10 }
      );
      
      expect(remaining).toBe(10);
    });
    
    it('should return correct remaining requests', async () => {
      mockRedis.get.mockResolvedValueOnce('4'); // 4 requests made
      
      const remaining = await RateLimitService.getRemainingRequests(
        'test-client',
        'test-action',
        { maxRequests: 10 }
      );
      
      expect(remaining).toBe(6);
    });
    
    it('should return 0 when over the limit', async () => {
      mockRedis.get.mockResolvedValueOnce('15'); // 15 requests made
      
      const remaining = await RateLimitService.getRemainingRequests(
        'test-client',
        'test-action',
        { maxRequests: 10 }
      );
      
      expect(remaining).toBe(0);
    });
  });
  
  describe('resetRateLimit', () => {
    it('should delete the rate limit key', async () => {
      await RateLimitService.resetRateLimit('test-client', 'test-action');
      
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ratelimit:test-action:test-client'
      );
    });
  });
});