"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Basic health check endpoint
router.get('/', async (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Detailed health check with component status
router.get('/detailed', async (req, res) => {
    try {
        // Check Redis connection
        const redisClient = (0, database_1.getRedisClient)();
        const redisStatus = await redisClient.ping().then(() => 'ok').catch(err => {
            logger_1.logger.error('Redis health check failed', { error: err.message });
            return 'error';
        });
        // Get system info
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        res.status(200).json({
            status: redisStatus === 'ok' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: uptime,
            components: {
                redis: {
                    status: redisStatus,
                },
                server: {
                    status: 'ok',
                }
            },
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Health check failed', { error });
        res.status(500).json({
            status: 'error',
            error: 'Internal server error during health check'
        });
    }
});
// Metrics endpoint for monitoring systems
router.get('/metrics', async (req, res) => {
    try {
        // Get active rooms count from Redis
        const redisClient = (0, database_1.getRedisClient)();
        const activeRoomsCount = await redisClient.keys('room:*').then(keys => keys.length);
        // Get system metrics
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        res.status(200).json({
            activeRooms: activeRoomsCount,
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
            timestamp: Date.now(),
        });
    }
    catch (error) {
        logger_1.logger.error('Metrics endpoint failed', { error });
        res.status(500).json({
            status: 'error',
            error: 'Internal server error while retrieving metrics'
        });
    }
});
exports.default = router;
