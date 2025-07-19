"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = require("express-rate-limit");
const uuid_1 = require("uuid");
const socket_1 = require("./socket");
const routes_1 = require("./routes");
const logger_1 = require("./utils/logger");
const database_1 = require("./database");
const metrics_service_1 = require("./services/metrics.service");
async function createServer() {
    // Initialize database connection
    await (0, database_1.initializeDatabase)();
    const app = (0, express_1.default)();
    // Add request ID to each request
    app.use((req, res, next) => {
        req.id = (0, uuid_1.v4)();
        res.setHeader('X-Request-ID', req.id);
        next();
    });
    // Security middleware with enhanced configuration
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'", "wss:", "ws:"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: { policy: "same-origin" },
        crossOriginResourcePolicy: { policy: "same-origin" },
        dnsPrefetchControl: { allow: false },
        expectCt: { maxAge: 86400, enforce: true },
        frameguard: { action: "deny" },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: { permittedPolicies: "none" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xssFilter: true,
    }));
    // CORS configuration
    const corsOptions = {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400, // 24 hours
    };
    app.use((0, cors_1.default)(corsOptions));
    // Request logging with context
    app.use((req, res, next) => {
        const startTime = Date.now();
        // Log request
        logger_1.logger.info(`${req.method} ${req.url}`, (0, logger_1.addRequestContext)(req));
        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
            logger_1.logger[logLevel](`${req.method} ${req.url} ${res.statusCode} ${duration}ms`, (0, logger_1.addRequestContext)(req, {
                statusCode: res.statusCode,
                duration,
                contentLength: res.get('Content-Length'),
            }));
            // Record metrics for errors
            if (res.statusCode >= 400) {
                metrics_service_1.metricsService.recordError(`http_${res.statusCode}`);
            }
        });
        next();
    });
    // Rate limiting with configurable options
    const apiLimiter = (0, express_rate_limit_1.rateLimit)({
        windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000, // Default: 15 minutes
        max: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : 100, // Default: 100 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests, please try again later.',
        handler: (req, res, next, options) => {
            logger_1.logger.warn('Rate limit exceeded', (0, logger_1.addRequestContext)(req));
            metrics_service_1.metricsService.recordError('rate_limit_exceeded');
            res.status(429).json({
                status: 'error',
                message: options.message,
                retryAfter: Math.ceil(options.windowMs / 1000),
            });
        },
    });
    app.use('/api', apiLimiter);
    // Body parsing with size limits
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
    // Setup API routes
    (0, routes_1.setupRoutes)(app);
    // Error handling middleware
    app.use((err, req, res, next) => {
        logger_1.logger.error('Unhandled error', (0, logger_1.addRequestContext)(req, { error: err }));
        metrics_service_1.metricsService.recordError('unhandled_error');
        res.status(err.status || 500).json({
            status: 'error',
            message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        });
    });
    // 404 handler
    app.use((req, res) => {
        logger_1.logger.warn('Route not found', (0, logger_1.addRequestContext)(req));
        res.status(404).json({
            status: 'error',
            message: 'Resource not found',
        });
    });
    // Create server (HTTP or HTTPS based on environment)
    let server;
    // Check if SSL/TLS is enabled
    if (process.env.ENABLE_HTTPS === 'true' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
        try {
            // Read SSL/TLS certificates
            const privateKey = fs_1.default.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
            const certificate = fs_1.default.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
            // Create HTTPS server
            server = https_1.default.createServer({
                key: privateKey,
                cert: certificate,
                // Modern TLS configuration
                minVersion: 'TLSv1.2',
                ciphers: [
                    'ECDHE-ECDSA-AES128-GCM-SHA256',
                    'ECDHE-RSA-AES128-GCM-SHA256',
                    'ECDHE-ECDSA-AES256-GCM-SHA384',
                    'ECDHE-RSA-AES256-GCM-SHA384',
                    'ECDHE-ECDSA-CHACHA20-POLY1305',
                    'ECDHE-RSA-CHACHA20-POLY1305',
                ].join(':'),
                honorCipherOrder: true,
            }, app);
            logger_1.logger.info('Created HTTPS server with TLS');
        }
        catch (error) {
            logger_1.logger.error('Failed to load SSL certificates, falling back to HTTP', { error });
            server = http_1.default.createServer(app);
        }
    }
    else {
        // Create HTTP server
        server = http_1.default.createServer(app);
        logger_1.logger.info('Created HTTP server');
    }
    // Create Socket.IO server with enhanced security
    const io = new socket_io_1.Server(server, {
        cors: corsOptions,
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        connectTimeout: 30000, // 30 seconds
        maxHttpBufferSize: 5e6, // 5MB
        transports: ['websocket', 'polling'],
        allowEIO3: false, // Only allow EIO v4
    });
    // Setup Socket.IO handlers
    (0, socket_1.setupSocketHandlers)(io);
    return { app, httpServer: server, io };
}
