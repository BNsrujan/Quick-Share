import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { runMigrations } from './migrations';

// Redis client for storing room data and rate limiting
let redisClient: Redis | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    // Use Redis for room state and rate limiting
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    // Wait for connection
    await redisClient.ping();
    
    // Run database migrations
    if (process.env.SKIP_MIGRATIONS !== 'true') {
      logger.info('Running database migrations...');
      await runMigrations();
    }
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

export async function closeDatabase(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Database connection closed');
  }
}

// Health check function for the database
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!redisClient) {
      return false;
    }
    
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}