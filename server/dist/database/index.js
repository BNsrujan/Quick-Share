"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.getRedisClient = getRedisClient;
exports.closeDatabase = closeDatabase;
exports.checkDatabaseHealth = checkDatabaseHealth;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const migrations_1 = require("./migrations");
// Redis client for storing room data and rate limiting
let redisClient = null;
async function initializeDatabase() {
    try {
        // Use Redis for room state and rate limiting
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
        redisClient.on('error', (err) => {
            logger_1.logger.error('Redis client error', { error: err.message });
        });
        redisClient.on('connect', () => {
            logger_1.logger.info('Connected to Redis');
        });
        // Wait for connection
        await redisClient.ping();
        // Run database migrations
        if (process.env.SKIP_MIGRATIONS !== 'true') {
            logger_1.logger.info('Running database migrations...');
            await (0, migrations_1.runMigrations)();
        }
        logger_1.logger.info('Database initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize database', { error });
        throw error;
    }
}
function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
}
async function closeDatabase() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger_1.logger.info('Database connection closed');
    }
}
// Health check function for the database
async function checkDatabaseHealth() {
    try {
        if (!redisClient) {
            return false;
        }
        await redisClient.ping();
        return true;
    }
    catch (error) {
        logger_1.logger.error('Database health check failed', { error });
        return false;
    }
}
