import { getRedisClient } from '../database';
import { logger, logMetrics } from '../utils/logger';

// Metrics collection interval in milliseconds
const METRICS_INTERVAL = process.env.METRICS_INTERVAL ? parseInt(process.env.METRICS_INTERVAL, 10) : 60000; // Default: 1 minute

// Metrics retention period in seconds
const METRICS_RETENTION = process.env.METRICS_RETENTION ? parseInt(process.env.METRICS_RETENTION, 10) : 86400 * 7; // Default: 7 days

// Metrics keys in Redis
const METRICS_KEYS = {
  ACTIVE_ROOMS: 'metrics:active_rooms',
  CONNECTIONS: 'metrics:connections',
  TRANSFERS_STARTED: 'metrics:transfers_started',
  TRANSFERS_COMPLETED: 'metrics:transfers_completed',
  ERRORS: 'metrics:errors',
  SYSTEM: 'metrics:system',
};

// Metrics collection service
class MetricsService {
  private intervalId: NodeJS.Timeout | null = null;
  private isCollecting = false;

  // Start metrics collection
  public startCollection(): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.collectMetrics(); // Collect immediately on start

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, METRICS_INTERVAL);

    logger.info('Metrics collection started', { interval: METRICS_INTERVAL });
  }

  // Stop metrics collection
  public stopCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isCollecting = false;
    logger.info('Metrics collection stopped');
  }

  // Collect and store metrics
  private async collectMetrics(): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Get active rooms count
      const activeRooms = await redis.keys('room:*').then(keys => keys.length);
      
      // Get system metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Create metrics object
      const metrics = {
        timestamp,
        activeRooms,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: process.uptime(),
      };
      
      // Store metrics in Redis with expiration
      const metricsKey = `${METRICS_KEYS.SYSTEM}:${timestamp}`;
      await redis.setex(metricsKey, METRICS_RETENTION, JSON.stringify(metrics));
      
      // Log metrics for monitoring
      logMetrics(metrics);
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
    }
  }

  // Record room creation
  public async recordRoomCreation(roomId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Increment active rooms counter
      await redis.incr(METRICS_KEYS.ACTIVE_ROOMS);
      
      // Record event with timestamp
      await redis.zadd(`${METRICS_KEYS.ACTIVE_ROOMS}:history`, timestamp, roomId);
      
      // Set expiration for history
      await redis.expire(`${METRICS_KEYS.ACTIVE_ROOMS}:history`, METRICS_RETENTION);
    } catch (error) {
      logger.error('Failed to record room creation', { error, roomId });
    }
  }

  // Record room deletion
  public async recordRoomDeletion(roomId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      
      // Decrement active rooms counter
      await redis.decr(METRICS_KEYS.ACTIVE_ROOMS);
      
      // Remove from history
      await redis.zrem(`${METRICS_KEYS.ACTIVE_ROOMS}:history`, roomId);
    } catch (error) {
      logger.error('Failed to record room deletion', { error, roomId });
    }
  }

  // Record connection event
  public async recordConnection(): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Increment connections counter
      await redis.incr(METRICS_KEYS.CONNECTIONS);
      
      // Record event with timestamp
      await redis.zadd(`${METRICS_KEYS.CONNECTIONS}:history`, timestamp, timestamp.toString());
      
      // Set expiration for history
      await redis.expire(`${METRICS_KEYS.CONNECTIONS}:history`, METRICS_RETENTION);
    } catch (error) {
      logger.error('Failed to record connection', { error });
    }
  }

  // Record transfer started
  public async recordTransferStarted(roomId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Increment transfers started counter
      await redis.incr(METRICS_KEYS.TRANSFERS_STARTED);
      
      // Record event with timestamp
      await redis.zadd(`${METRICS_KEYS.TRANSFERS_STARTED}:history`, timestamp, roomId);
      
      // Set expiration for history
      await redis.expire(`${METRICS_KEYS.TRANSFERS_STARTED}:history`, METRICS_RETENTION);
    } catch (error) {
      logger.error('Failed to record transfer started', { error, roomId });
    }
  }

  // Record transfer completed
  public async recordTransferCompleted(roomId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Increment transfers completed counter
      await redis.incr(METRICS_KEYS.TRANSFERS_COMPLETED);
      
      // Record event with timestamp
      await redis.zadd(`${METRICS_KEYS.TRANSFERS_COMPLETED}:history`, timestamp, roomId);
      
      // Set expiration for history
      await redis.expire(`${METRICS_KEYS.TRANSFERS_COMPLETED}:history`, METRICS_RETENTION);
    } catch (error) {
      logger.error('Failed to record transfer completed', { error, roomId });
    }
  }

  // Record error
  public async recordError(errorType: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = Date.now();
      
      // Increment error counter for this type
      await redis.hincrby(METRICS_KEYS.ERRORS, errorType, 1);
      
      // Record event with timestamp
      await redis.zadd(`${METRICS_KEYS.ERRORS}:${errorType}:history`, timestamp, timestamp.toString());
      
      // Set expiration for history
      await redis.expire(`${METRICS_KEYS.ERRORS}:${errorType}:history`, METRICS_RETENTION);
      await redis.expire(METRICS_KEYS.ERRORS, METRICS_RETENTION);
    } catch (error) {
      logger.error('Failed to record error', { error, errorType });
    }
  }

  // Get current metrics
  public async getCurrentMetrics(): Promise<any> {
    try {
      const redis = getRedisClient();
      
      // Get active rooms count
      const activeRooms = await redis.get(METRICS_KEYS.ACTIVE_ROOMS).then(val => parseInt(val || '0', 10));
      
      // Get connections count
      const connections = await redis.get(METRICS_KEYS.CONNECTIONS).then(val => parseInt(val || '0', 10));
      
      // Get transfers counts
      const transfersStarted = await redis.get(METRICS_KEYS.TRANSFERS_STARTED).then(val => parseInt(val || '0', 10));
      const transfersCompleted = await redis.get(METRICS_KEYS.TRANSFERS_COMPLETED).then(val => parseInt(val || '0', 10));
      
      // Get error counts
      const errors = await redis.hgetall(METRICS_KEYS.ERRORS);
      
      // Get system metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        timestamp: Date.now(),
        activeRooms,
        connections,
        transfers: {
          started: transfersStarted,
          completed: transfersCompleted,
          success_rate: transfersStarted > 0 ? (transfersCompleted / transfersStarted) * 100 : 100,
        },
        errors,
        system: {
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          uptime: process.uptime(),
        }
      };
    } catch (error) {
      logger.error('Failed to get current metrics', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();