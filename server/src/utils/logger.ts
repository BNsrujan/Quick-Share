import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define log format for different environments
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}${
      info.data ? '\n' + JSON.stringify(info.data, null, 2) : ''
    }`
  )
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  levels,
  format: isProduction ? productionFormat : developmentFormat,
  defaultMeta: { 
    service: 'signaling-server',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Always log to console
    new winston.transports.Console(),
    
    // Log all levels to combined.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // Log errors to error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logger
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

// Add request context to logs
export function addRequestContext(req: any, info: any = {}) {
  return {
    ...info,
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// Log metrics
export function logMetrics(metrics: Record<string, any>) {
  logger.info('System metrics', { 
    metrics,
    timestamp: Date.now(),
  });
}

// Export a function to get logger with context
export function getContextLogger(context: string) {
  return {
    error: (message: string, meta: any = {}) => logger.error(message, { ...meta, context }),
    warn: (message: string, meta: any = {}) => logger.warn(message, { ...meta, context }),
    info: (message: string, meta: any = {}) => logger.info(message, { ...meta, context }),
    http: (message: string, meta: any = {}) => logger.http(message, { ...meta, context }),
    debug: (message: string, meta: any = {}) => logger.debug(message, { ...meta, context }),
  };
}