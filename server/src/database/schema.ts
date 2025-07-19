/**
 * This file defines the Redis schema for room management
 * Since Redis is a key-value store, we define the key patterns and data structures
 */

// Room schema
export interface RoomSchema {
  id: string;
  code: string;
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
  status: 'waiting' | 'connected' | 'transferring' | 'completed';
  peers: {
    sender?: {
      id: string;
      connectedAt?: number; // timestamp
    };
    receiver?: {
      id: string;
      connectedAt?: number; // timestamp
    };
  };
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  };
}

// Rate limit schema
export interface RateLimitSchema {
  ip: string;
  endpoint: string;
  count: number;
  resetAt: number; // timestamp
}

// Key patterns
export const KEY_PATTERNS = {
  ROOM: 'room:{id}',
  ROOM_BY_CODE: 'room:code:{code}',
  RATE_LIMIT: 'rate-limit:{ip}:{endpoint}',
  ACTIVE_ROOMS: 'active-rooms',
  METRICS: 'metrics:{type}',
};

// TTL values in seconds
export const TTL = {
  ROOM: 24 * 60 * 60, // 24 hours
  ROOM_CODE: 30 * 60, // 30 minutes
  RATE_LIMIT: 15 * 60, // 15 minutes
};

// Index fields for searching
export const INDEXES = {
  ROOM_BY_STATUS: 'room:index:status',
  ROOM_BY_EXPIRY: 'room:index:expiry',
};