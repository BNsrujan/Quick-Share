import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { setupSocketHandlers } from './socket';
import { setupRoutes } from './routes';
import { logger, addRequestContext } from './utils/logger';
import { initializeDatabase } from './database';
import { metricsService } from './services/metrics.service';

export async function createServer() {
  // Initialize database connection
  await initializeDatabase();
  
  const app = express();
  
  // Add request ID to each request
  app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });
  
  // Security middleware with enhanced configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://chart.googleapis.com"],
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
  app.use(cors(corsOptions));
  
  // Request logging with context
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    logger.info(`${req.method} ${req.url}`, addRequestContext(req));
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel](`${req.method} ${req.url} ${res.statusCode} ${duration}ms`, addRequestContext(req, {
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('Content-Length'),
      }));
      
      // Record metrics for errors
      if (res.statusCode >= 400) {
        metricsService.recordError(`http_${res.statusCode}`);
      }
    });
    
    next();
  });
  
  // Rate limiting with configurable options
  const apiLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000, // Default: 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : 100, // Default: 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', addRequestContext(req));
      metricsService.recordError('rate_limit_exceeded');
      res.status(429).json({
        status: 'error',
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
  
  app.use('/api', apiLimiter);
  
  // Body parsing with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Setup API routes
  setupRoutes(app);
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', addRequestContext(req, { error: err }));
    metricsService.recordError('unhandled_error');
    
    res.status(err.status || 500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    logger.warn('Route not found', addRequestContext(req));
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
      const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
      const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
      
      // Create HTTPS server
      server = https.createServer({
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
      
      logger.info('Created HTTPS server with TLS');
    } catch (error) {
      logger.error('Failed to load SSL certificates, falling back to HTTP', { error });
      server = http.createServer(app);
    }
  } else {
    // Create HTTP server
    server = http.createServer(app);
    logger.info('Created HTTP server');
  }
  
  // Create Socket.IO server with enhanced security
  const io = new SocketIOServer(server, {
    cors: corsOptions,
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    connectTimeout: 30000, // 30 seconds
    maxHttpBufferSize: 5e6, // 5MB
    transports: ['websocket', 'polling'],
    allowEIO3: false, // Only allow EIO v4
  });
  
  // Setup Socket.IO handlers
  setupSocketHandlers(io);
  
  return { app, httpServer: server, io };
}