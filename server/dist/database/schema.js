"use strict";
/**
 * This file defines the Redis schema for room management
 * Since Redis is a key-value store, we define the key patterns and data structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDEXES = exports.TTL = exports.KEY_PATTERNS = void 0;
// Key patterns
exports.KEY_PATTERNS = {
    ROOM: 'room:{id}',
    ROOM_BY_CODE: 'room:code:{code}',
    RATE_LIMIT: 'rate-limit:{ip}:{endpoint}',
    ACTIVE_ROOMS: 'active-rooms',
    METRICS: 'metrics:{type}',
};
// TTL values in seconds
exports.TTL = {
    ROOM: 24 * 60 * 60, // 24 hours
    ROOM_CODE: 30 * 60, // 30 minutes
    RATE_LIMIT: 15 * 60, // 15 minutes
};
// Index fields for searching
exports.INDEXES = {
    ROOM_BY_STATUS: 'room:index:status',
    ROOM_BY_EXPIRY: 'room:index:expiry',
};
