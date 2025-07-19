import { getRedisClient } from '../index';
import { logger } from '../../utils/logger';
import { KEY_PATTERNS, TTL } from '../schema';

/**
 * Migration for room management schema
 * Sets up Redis keys, indexes, and initial data structures
 */
export async function up(): Promise<void> {
  const redis = getRedisClient();
  
  try {
    logger.info('Running migration: 001-room-management');
    
    // Create sorted set for active rooms
    await redis.del(KEY_PATTERNS.ACTIVE_ROOMS);
    
    // Set up initial metrics counters
    await redis.set('metrics:active_rooms', '0');
    await redis.set('metrics:connections', '0');
    await redis.set('metrics:transfers_started', '0');
    await redis.set('metrics:transfers_completed', '0');
    
    // Update schema version
    await redis.set('schema:version', '1');
    
    logger.info('Migration 001-room-management completed successfully');
  } catch (error) {
    logger.error('Migration 001-room-management failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  const redis = getRedisClient();
  
  try {
    logger.info('Reverting migration: 001-room-management');
    
    // Remove sorted set for active rooms
    await redis.del(KEY_PATTERNS.ACTIVE_ROOMS);
    
    // Remove metrics counters
    await redis.del('metrics:active_rooms');
    await redis.del('metrics:connections');
    await redis.del('metrics:transfers_started');
    await redis.del('metrics:transfers_completed');
    
    // Reset schema version
    await redis.set('schema:version', '0');
    
    logger.info('Migration 001-room-management reverted successfully');
  } catch (error) {
    logger.error('Failed to revert migration 001-room-management', { error });
    throw error;
  }
}