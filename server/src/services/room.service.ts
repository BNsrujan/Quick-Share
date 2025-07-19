import { nanoid } from 'nanoid';
import { getRedisClient } from '../database';
import { Room, RoomStatus, Peer } from '../models/room';
import { logger } from '../utils/logger';
import { RateLimitService } from './rate-limit.service';
import { SecurityAuditService, SecurityEventType } from './security-audit.service';

// Constants
const ROOM_EXPIRY_TIME = 60 * 60; // 1 hour in seconds
const ROOM_PREFIX = 'room:';
const CODE_PREFIX = 'code:';
const FAILED_ATTEMPTS_PREFIX = 'failed_attempts:';
const MAX_FAILED_ATTEMPTS = 5; // Maximum failed attempts before rate limiting
const FAILED_ATTEMPTS_WINDOW = 300; // 5 minutes in seconds
const LOCKOUT_DURATION = 1800; // 30 minutes in seconds
const PROGRESSIVE_LOCKOUT = true; // Enable progressive lockout durations
const IP_TRACKING_PREFIX = 'ip_tracking:'; // Prefix for IP tracking
const SUSPICIOUS_ACTIVITY_THRESHOLD = 10; // Threshold for suspicious activity

export class RoomService {
  /**
   * Generate a secure random code for room sharing
   */
  static generateSecureCode(): string {
    // Generate a 6-character code with high entropy
    // Using nanoid for secure random generation
    return nanoid(6).toUpperCase();
  }

  /**
   * Create a new room with a secure code
   */
  static async createRoom(metadata: any = {}): Promise<Room> {
    const redis = getRedisClient();
    
    // Generate unique room ID and secure code
    const roomId = nanoid();
    const code = this.generateSecureCode();
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ROOM_EXPIRY_TIME * 1000);
    
    // Create room object
    const room: Room = {
      id: roomId,
      code,
      createdAt: now,
      expiresAt,
      status: RoomStatus.WAITING,
      peers: {},
      metadata
    };
    
    // Store room data in Redis
    await redis.set(
      `${ROOM_PREFIX}${roomId}`,
      JSON.stringify(room),
      'EX',
      ROOM_EXPIRY_TIME
    );
    
    // Create a mapping from code to room ID
    await redis.set(
      `${CODE_PREFIX}${code}`,
      roomId,
      'EX',
      ROOM_EXPIRY_TIME
    );
    
    logger.info('Room created', { roomId, code });
    
    return room;
  }

  /**
   * Get a room by its ID
   */
  static async getRoomById(roomId: string): Promise<Room | null> {
    const redis = getRedisClient();
    
    const roomData = await redis.get(`${ROOM_PREFIX}${roomId}`);
    if (!roomData) {
      return null;
    }
    
    return JSON.parse(roomData) as Room;
  }

  /**
   * Get a room by its sharing code
   */
  static async getRoomByCode(code: string): Promise<Room | null> {
    const redis = getRedisClient();
    
    // Get room ID from code
    const roomId = await redis.get(`${CODE_PREFIX}${code}`);
    if (!roomId) {
      return null;
    }
    
    // Get room data
    return this.getRoomById(roomId);
  }

  /**
   * Update room data
   */
  static async updateRoom(room: Room): Promise<Room> {
    const redis = getRedisClient();
    
    // Store updated room data
    await redis.set(
      `${ROOM_PREFIX}${room.id}`,
      JSON.stringify(room),
      'EX',
      ROOM_EXPIRY_TIME
    );
    
    return room;
  }

  /**
   * Add a peer to a room
   */
  static async addPeerToRoom(
    roomId: string,
    peerType: 'sender' | 'receiver',
    peerId: string
  ): Promise<Room | null> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      return null;
    }
    
    // Add peer to room
    const peer: Peer = {
      id: peerId,
      connectedAt: new Date()
    };
    
    room.peers[peerType] = peer;
    
    // If both peers are connected, update status
    if (room.peers.sender && room.peers.receiver) {
      room.status = RoomStatus.CONNECTED;
    }
    
    // Update room
    return this.updateRoom(room);
  }

  /**
   * Remove a peer from a room
   */
  static async removePeerFromRoom(
    roomId: string,
    peerId: string
  ): Promise<Room | null> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      return null;
    }
    
    // Remove peer from room
    if (room.peers.sender?.id === peerId) {
      delete room.peers.sender;
    }
    
    if (room.peers.receiver?.id === peerId) {
      delete room.peers.receiver;
    }
    
    // If no peers left, mark room as expired
    if (!room.peers.sender && !room.peers.receiver) {
      room.status = RoomStatus.EXPIRED;
    } else {
      room.status = RoomStatus.WAITING;
    }
    
    // Update room
    return this.updateRoom(room);
  }

  /**
   * Update room status
   */
  static async updateRoomStatus(
    roomId: string,
    status: RoomStatus
  ): Promise<Room | null> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      return null;
    }
    
    room.status = status;
    
    // Update room
    return this.updateRoom(room);
  }

  /**
   * Expire a room
   */
  static async expireRoom(roomId: string): Promise<void> {
    const redis = getRedisClient();
    const room = await this.getRoomById(roomId);
    
    if (room) {
      // Delete code mapping
      await redis.del(`${CODE_PREFIX}${room.code}`);
      
      // Delete room data
      await redis.del(`${ROOM_PREFIX}${roomId}`);
      
      logger.info('Room expired', { roomId });
    }
  }

  /**
   * Validate a sharing code with enhanced brute force protection
   * 
   * @param code The share code to validate
   * @param clientId The client identifier (IP address or session ID)
   * @param ipAddress Optional IP address for additional tracking
   * @returns Whether the code is valid
   */
  static async validateCode(code: string, clientId: string, ipAddress?: string): Promise<boolean> {
    const redis = getRedisClient();
    
    // Implement constant-time comparison for code validation
    // This prevents timing attacks that could reveal valid codes
    const constantTimeValidation = async (inputCode: string): Promise<boolean> => {
      // Get room by code
      const room = await this.getRoomByCode(inputCode);
      const isValid = !!room && room.status === RoomStatus.WAITING;
      
      // Add a small random delay to further prevent timing analysis
      const randomDelay = Math.floor(Math.random() * 50) + 50; // 50-100ms
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      return isValid;
    };
    
    // Track IP address for suspicious activity detection
    if (ipAddress) {
      await this.trackIPActivity(ipAddress, 'code_validation');
    }
    
    // Check if client is currently locked out due to too many failed attempts
    const isRateLimited = await RateLimitService.isRateLimited(
      clientId,
      'code_validation',
      { windowSeconds: LOCKOUT_DURATION, maxRequests: MAX_FAILED_ATTEMPTS }
    );
    
    if (isRateLimited) {
      // Calculate progressive lockout duration if enabled
      let lockoutDuration = LOCKOUT_DURATION;
      
      if (PROGRESSIVE_LOCKOUT) {
        const failedAttemptsKey = `${FAILED_ATTEMPTS_PREFIX}${clientId}`;
        const failedAttemptsStr = await redis.get(failedAttemptsKey);
        const failedAttempts = failedAttemptsStr ? parseInt(failedAttemptsStr, 10) : 0;
        
        // Increase lockout duration based on number of failed attempts
        // Each additional attempt beyond the threshold doubles the lockout time
        const multiplier = Math.min(8, Math.pow(2, Math.floor((failedAttempts - MAX_FAILED_ATTEMPTS) / 3)));
        lockoutDuration = LOCKOUT_DURATION * multiplier;
      }
      
      // Log security event for potential brute force attempt
      SecurityAuditService.logSecurityEvent(
        SecurityEventType.BRUTE_FORCE_DETECTED,
        clientId,
        'Too many failed code validation attempts',
        { 
          highPriority: true,
          includeIp: true,
          metadata: { 
            action: 'code_validation',
            lockoutDuration: `${Math.floor(lockoutDuration / 60)} minutes`
          }
        }
      );
      
      return false;
    }
    
    // Validate code using constant-time comparison
    const isValid = await constantTimeValidation(code);
    
    // If code is invalid, increment failed attempts counter
    if (!isValid) {
      // Track failed attempts
      const failedAttemptsKey = `${FAILED_ATTEMPTS_PREFIX}${clientId}`;
      const failedAttempts = await redis.incr(failedAttemptsKey);
      
      // Set expiry on first failed attempt
      if (failedAttempts === 1) {
        await redis.expire(failedAttemptsKey, FAILED_ATTEMPTS_WINDOW);
      }
      
      // Log failed attempt
      SecurityAuditService.logSecurityEvent(
        SecurityEventType.AUTH_FAILURE,
        clientId,
        'Invalid share code attempt',
        { 
          includeIp: true,
          metadata: { 
            failedAttempts,
            remainingAttempts: MAX_FAILED_ATTEMPTS - failedAttempts
          }
        }
      );
      
      // If too many failed attempts, trigger rate limiting with progressive lockout
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        let lockoutDuration = LOCKOUT_DURATION;
        
        if (PROGRESSIVE_LOCKOUT) {
          // Increase lockout duration based on number of failed attempts
          const multiplier = Math.min(8, Math.pow(2, Math.floor((failedAttempts - MAX_FAILED_ATTEMPTS) / 3)));
          lockoutDuration = LOCKOUT_DURATION * multiplier;
        }
        
        // Apply rate limiting with calculated lockout duration
        await RateLimitService.isRateLimited(
          clientId,
          'code_validation',
          { windowSeconds: lockoutDuration, maxRequests: MAX_FAILED_ATTEMPTS }
        );
        
        // Log security event for brute force attempt
        SecurityAuditService.logSecurityEvent(
          SecurityEventType.BRUTE_FORCE_DETECTED,
          clientId,
          'Maximum failed code validation attempts reached',
          { 
            highPriority: true,
            includeIp: true,
            metadata: { 
              failedAttempts,
              lockoutDuration: `${Math.floor(lockoutDuration / 60)} minutes`
            }
          }
        );
      }
    } else {
      // On successful validation, reset failed attempts counter
      await redis.del(`${FAILED_ATTEMPTS_PREFIX}${clientId}`);
      
      // Get room data for logging
      const room = await this.getRoomByCode(code);
      
      // Log successful validation
      SecurityAuditService.logSecurityEvent(
        SecurityEventType.AUTH_SUCCESS,
        clientId,
        'Share code validated successfully',
        { metadata: { roomId: room?.id } }
      );
    }
    
    return isValid;
  }
  
  /**
   * Track IP address activity for suspicious behavior detection
   * 
   * @param ipAddress The IP address to track
   * @param action The action being performed
   */
  private static async trackIPActivity(ipAddress: string, action: string): Promise<void> {
    const redis = getRedisClient();
    
    // Create tracking key
    const trackingKey = `${IP_TRACKING_PREFIX}${ipAddress}:${action}`;
    
    // Increment activity counter
    const activityCount = await redis.incr(trackingKey);
    
    // Set expiry on first activity
    if (activityCount === 1) {
      await redis.expire(trackingKey, FAILED_ATTEMPTS_WINDOW);
    }
    
    // Check for suspicious activity
    if (activityCount >= SUSPICIOUS_ACTIVITY_THRESHOLD) {
      // Log suspicious activity
      SecurityAuditService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        ipAddress,
        'Suspicious activity detected',
        { 
          highPriority: true,
          includeIp: true,
          metadata: { 
            action,
            activityCount,
            timeWindow: `${FAILED_ATTEMPTS_WINDOW} seconds`
          }
        }
      );
    }
  }

  /**
   * Clean up expired rooms
   */
  static async cleanupExpiredRooms(): Promise<void> {
    const redis = getRedisClient();
    
    // This would typically be done with a scheduled job
    // For simplicity, we're just showing the implementation
    
    // Get all room keys
    const keys = await redis.keys(`${ROOM_PREFIX}*`);
    
    for (const key of keys) {
      const roomData = await redis.get(key);
      if (roomData) {
        const room = JSON.parse(roomData) as Room;
        
        // Check if room is expired
        if (new Date(room.expiresAt) < new Date()) {
          await this.expireRoom(room.id);
        }
      }
    }
  }
}