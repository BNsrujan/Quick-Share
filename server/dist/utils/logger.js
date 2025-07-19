"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStream = exports.logger = void 0;
exports.addRequestContext = addRequestContext;
exports.logMetrics = logMetrics;
exports.getContextLogger = getContextLogger;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure logs directory exists
const logDir = process.env.LOG_DIR || 'logs';
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
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
winston_1.default.addColors(colors);
// Define log format for different environments
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}${info.data ? '\n' + JSON.stringify(info.data, null, 2) : ''}`));
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
// Create logger instance
exports.logger = winston_1.default.createLogger({
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
        new winston_1.default.transports.Console(),
        // Log all levels to combined.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
        // Log errors to error.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false,
});
// Create a stream object for Morgan HTTP logger
exports.logStream = {
    write: (message) => {
        exports.logger.http(message.trim());
    }
};
// Add request context to logs
function addRequestContext(req, info = {}) {
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
function logMetrics(metrics) {
    exports.logger.info('System metrics', {
        metrics,
        timestamp: Date.now(),
    });
}
// Export a function to get logger with context
function getContextLogger(context) {
    return {
        error: (message, meta = {}) => exports.logger.error(message, { ...meta, context }),
        warn: (message, meta = {}) => exports.logger.warn(message, { ...meta, context }),
        info: (message, meta = {}) => exports.logger.info(message, { ...meta, context }),
        http: (message, meta = {}) => exports.logger.http(message, { ...meta, context }),
        debug: (message, meta = {}) => exports.logger.debug(message, { ...meta, context }),
    };
}
