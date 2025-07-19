"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const metrics_service_1 = require("../services/metrics.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Basic health check endpoint (public)
router.get('/', async (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Detailed health check endpoint (protected)
router.get('/detailed', async (req, res) => {
    try {
        // Check Redis connection
        const redis = (0, database_1.getRedisClient)();
        const redisStatus = await redis.ping().then(() => 'ok').catch(err => {
            logger_1.logger.error('Redis health check failed', { error: err });
            return 'error';
        });
        // Get system health
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            uptime: uptime,
            services: {
                redis: redisStatus
            },
            system: {
                memory: {
                    rss: memoryUsage.rss,
                    heapTotal: memoryUsage.heapTotal,
                    heapUsed: memoryUsage.heapUsed,
                    external: memoryUsage.external,
                    memoryUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Health check failed', { error });
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
// Metrics endpoint (protected)
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await metrics_service_1.metricsService.getCurrentMetrics();
        res.status(200).json(metrics);
    }
    catch (error) {
        logger_1.logger.error('Failed to get metrics', { error });
        res.status(500).json({
            status: 'error',
            message: 'Failed to get metrics'
        });
    }
});
exports.default = router;
