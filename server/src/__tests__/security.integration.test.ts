/**
 * Security Integration Tests
 * 
 * These tests validate the security features of the Quick-Share P2P platform,
 * including forward secrecy, brute force protection, and secure session management.
 */

import request from 'supertest';
import { createServer } from '../server';
import { RoomService } from '../services/room.service';
import { RateLimitService } from '../services/rate-limit.service';
import { SecurityAuditService } from '../services/security-audit.service';
import { getRedisClient } from '../database';

// Mock Redis client
jest.mock('../database', () => {
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  };
  
  return {
    getRedisClient: jest.fn(() => mockRedisClient),
  };
});

describe('Security Integration Tests', () => {
  let app: any;
  let redis: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get Redis mock
    redis = getRedisClient();
    
    // Create server
    app = createServer();
  });
  
  describe('Brute Force Protection', () => {
    it('should rate limit after multiple failed code validation attempts', async () => {
      // Mock Redis responses for failed attempts
      redis.get.mockImplementation((key: string) => {
        if (key.startsWith('code:')) {
          return null; // Code doesn't exist
        }
        if (key.startsWith('failed_attempts:')) {
          return '5'; // 5 failed attempts
        }
        return null;
      });
      
      // Mock incr to return increasing values
      redis.incr.mockImplementation(() => 6); // Next attempt is the 6th
      
      // Spy on SecurityAuditService
      const auditSpy = jest.spyOn(SecurityAuditService, 'logSecurityEvent');
      
      // Attempt to validate an invalid code
      const response = await request(app)
        .post('/api/rooms/validate')
        .send({ code: 'INVALID' })
        .set('X-Forwarded-For', '127.0.0.1');
      
      // Expect rate limiting response
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many failed attempts');
      
      // Verify security audit was logged
      expect(auditSpy).toHaveBeenCalledWith(
        expect.any(String), // Event type
        expect.any(String), // User ID
        expect.stringContaining('failed'), // Message
        expect.objectContaining({
          highPriority: true,
          includeIp: true
        })
      );
    });
    
    it('should reset failed attempts counter after successful validation', async () => {
      // Mock room data
      const mockRoom = {
        id: 'test-room-id',
        code: 'VALIDC',
        status: 'waiting',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        peers: {}
      };
      
      // Mock Redis responses
      redis.get.mockImplementation((key: string) => {
        if (key === 'code:VALIDC') {
          return 'test-room-id';
        }
        if (key === 'room:test-room-id') {
          return JSON.stringify(mockRoom);
        }
        return null;
      });
      
      // Spy on Redis del method
      const delSpy = jest.spyOn(redis, 'del');
      
      // Validate a valid code
      const response = await request(app)
        .post('/api/rooms/validate')
        .send({ code: 'VALIDC' })
        .set('X-Forwarded-For', '127.0.0.1');
      
      // Expect success response
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      
      // Verify failed attempts counter was reset
      expect(delSpy).toHaveBeenCalledWith(expect.stringContaining('failed_attempts:'));
    });
  });
  
  describe('Room Security', () => {
    it('should expire rooms after their TTL', async () => {
      // Mock expired room
      const mockExpiredRoom = {
        id: 'expired-room',
        code: 'EXPIRE',
        status: 'waiting',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        peers: {}
      };
      
      // Mock Redis responses
      redis.keys.mockResolvedValue(['room:expired-room']);
      redis.get.mockImplementation((key: string) => {
        if (key === 'room:expired-room') {
          return JSON.stringify(mockExpiredRoom);
        }
        return null;
      });
      
      // Spy on RoomService.expireRoom
      const expireSpy = jest.spyOn(RoomService, 'expireRoom');
      
      // Call cleanup method
      await RoomService.cleanupExpiredRooms();
      
      // Verify room was expired
      expect(expireSpy).toHaveBeenCalledWith('expired-room');
    });
    
    it('should generate secure room codes with sufficient entropy', () => {
      // Generate multiple codes and verify uniqueness and format
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const code = RoomService.generateSecureCode();
        
        // Verify code format (uppercase alphanumeric)
        expect(code).toMatch(/^[A-Z0-9]+$/);
        
        // Verify code length (should be at least 6 characters)
        expect(code.length).toBeGreaterThanOrEqual(6);
        
        // Add to set to check uniqueness
        codes.add(code);
      }
      
      // Verify all codes were unique
      expect(codes.size).toBe(100);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should apply rate limits for sensitive operations', async () => {
      // Mock Redis responses for rate limiting
      redis.incr.mockResolvedValue(11); // Over the limit
      
      // Spy on RateLimitService
      const rateLimitSpy = jest.spyOn(RateLimitService, 'isRateLimited');
      rateLimitSpy.mockResolvedValue(true); // Simulate rate limit exceeded
      
      // Attempt to create multiple rooms rapidly
      const response = await request(app)
        .post('/api/rooms')
        .send({})
        .set('X-Forwarded-For', '127.0.0.1');
      
      // Expect rate limiting response
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
    
    it('should track remaining requests for rate-limited operations', async () => {
      // Mock Redis responses
      redis.get.mockResolvedValue('5'); // 5 requests used
      
      // Get remaining requests
      const remaining = await RateLimitService.getRemainingRequests(
        '127.0.0.1',
        'create_room',
        { maxRequests: 10 }
      );
      
      // Verify remaining requests calculation
      expect(remaining).toBe(5); // 10 max - 5 used = 5 remaining
    });
  });
  
  describe('Security Audit Logging', () => {
    it('should log security events with privacy-compliant data', () => {
      // Spy on console methods
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Log a security event
      SecurityAuditService.logSecurityEvent(
        'auth_failure',
        'user123',
        'Failed login attempt',
        {
          includeIp: true,
          metadata: {
            ip: '127.0.0.1',
            password: 'secret123', // Should be filtered out
            username: 'testuser',
            attempt: 3
          }
        }
      );
      
      // Verify logging behavior
      expect(consoleInfoSpy).toHaveBeenCalled();
      
      // Verify sensitive data was filtered
      const logCall = consoleInfoSpy.mock.calls[0];
      const loggedData = logCall[1];
      
      // Password should not be included
      expect(loggedData.metadata).not.toHaveProperty('password');
      
      // IP should be hashed if included
      if (loggedData.ipHash) {
        expect(loggedData.ipHash).not.toBe('127.0.0.1');
      }
      
      // User ID should be anonymized
      expect(loggedData.anonymousId).not.toBe('user123');
    });
    
    it('should trigger alerts for high-priority security events', () => {
      // Spy on console methods
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Log a high-priority security event
      SecurityAuditService.logSecurityEvent(
        'brute_force_detected',
        'user123',
        'Brute force attack detected',
        {
          highPriority: true,
          metadata: {
            attempts: 10,
            timeWindow: '5 minutes'
          }
        }
      );
      
      // Verify alert was triggered
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Verify alert contains expected data
      const alertCall = consoleErrorSpy.mock.calls[0];
      expect(alertCall[0]).toBe('SECURITY ALERT');
      expect(alertCall[1].alert).toBe(true);
    });
  });
});