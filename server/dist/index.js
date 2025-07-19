"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const server_1 = require("./server");
const logger_1 = require("./utils/logger");
const database_1 = require("./database");
const metrics_service_1 = require("./services/metrics.service");
// Load environment variables
dotenv_1.default.config();
const PORT = process.env.PORT || 3001;
async function startServer() {
    try {
        const { httpServer } = await (0, server_1.createServer)();
        // Start metrics collection if enabled
        if (process.env.ENABLE_METRICS !== 'false') {
            metrics_service_1.metricsService.startCollection();
        }
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`Server running on port ${PORT}`);
        });
        // Handle graceful shutdown
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                logger_1.logger.info(`Received ${signal}, shutting down gracefully`);
                // Stop metrics collection
                metrics_service_1.metricsService.stopCollection();
                // Close database connections
                await (0, database_1.closeDatabase)();
                // Close HTTP server
                httpServer.close(() => {
                    logger_1.logger.info('HTTP server closed');
                    process.exit(0);
                });
                // Force exit after timeout
                setTimeout(() => {
                    logger_1.logger.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 10000);
            });
        });
        // Handle uncaught exceptions and unhandled rejections
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught exception', { error });
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled rejection', { reason, promise });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', { error });
        process.exit(1);
    }
}
startServer();
