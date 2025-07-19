import dotenv from 'dotenv';
import { createServer } from './server';
import { logger } from './utils/logger';
import { closeDatabase } from './database';
import { metricsService } from './services/metrics.service';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    const { httpServer } = await createServer();
    
    // Start metrics collection if enabled
    if (process.env.ENABLE_METRICS !== 'false') {
      metricsService.startCollection();
    }
    
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Handle graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        
        // Stop metrics collection
        metricsService.stopCollection();
        
        // Close database connections
        await closeDatabase();
        
        // Close HTTP server
        httpServer.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });
        
        // Force exit after timeout
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      });
    });
    
    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();