"use strict";
/**
 * Security Audit Service
 *
 * This service provides privacy-compliant security audit logging
 * without compromising user privacy or exposing sensitive data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAuditService = exports.DataSensitivity = exports.SecurityEventType = void 0;
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
// Event types for security audit
var SecurityEventType;
(function (SecurityEventType) {
    // Authentication events
    SecurityEventType["AUTH_SUCCESS"] = "auth_success";
    SecurityEventType["AUTH_FAILURE"] = "auth_failure";
    // Room events
    SecurityEventType["ROOM_CREATED"] = "room_created";
    SecurityEventType["ROOM_JOINED"] = "room_joined";
    SecurityEventType["ROOM_EXPIRED"] = "room_expired";
    // Rate limiting events
    SecurityEventType["RATE_LIMIT_EXCEEDED"] = "rate_limit_exceeded";
    SecurityEventType["BRUTE_FORCE_DETECTED"] = "brute_force_detected";
    // Key management events
    SecurityEventType["KEY_GENERATED"] = "key_generated";
    SecurityEventType["KEY_DISPOSED"] = "key_disposed";
    // Session events
    SecurityEventType["SESSION_STARTED"] = "session_started";
    SecurityEventType["SESSION_ENDED"] = "session_ended";
    SecurityEventType["SESSION_TIMEOUT"] = "session_timeout";
    // Security events
    SecurityEventType["SECURITY_VIOLATION"] = "security_violation";
    SecurityEventType["SUSPICIOUS_ACTIVITY"] = "suspicious_activity";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
// Sensitivity levels for data
var DataSensitivity;
(function (DataSensitivity) {
    DataSensitivity["PUBLIC"] = "public";
    DataSensitivity["INTERNAL"] = "internal";
    DataSensitivity["PRIVATE"] = "private";
    DataSensitivity["SECRET"] = "secret"; // Should never be logged
})(DataSensitivity || (exports.DataSensitivity = DataSensitivity = {}));
class SecurityAuditService {
    /**
     * Log a security event with privacy-compliant data handling
     *
     * @param eventType Type of security event
     * @param userId Anonymous user identifier (or session ID)
     * @param message Description of the event
     * @param options Additional audit options
     */
    static logSecurityEvent(eventType, userId, message, options = {}) {
        // Create anonymized user identifier if not provided
        const anonymousId = userId || 'anonymous';
        // Create audit log entry with minimal data
        const auditLog = {
            eventType,
            timestamp: new Date().toISOString(),
            anonymousId: this.anonymizeIdentifier(anonymousId),
            message,
            // Only include IP if explicitly requested and allowed by config
            ...(options.includeIp && process.env.LOG_IP_ADDRESSES === 'true'
                ? { ipHash: options.metadata?.ip ? this.hashIpAddress(options.metadata.ip) : undefined }
                : {}),
            // Include safe metadata
            ...(options.metadata ? { metadata: this.sanitizeMetadata(options.metadata) } : {})
        };
        // Log at appropriate level based on event type and priority
        if (options.highPriority) {
            logger_1.logger.warn('Security event', auditLog);
        }
        else {
            logger_1.logger.info('Security event', auditLog);
        }
        // For high-priority security events, we might want to trigger alerts
        if (options.highPriority && process.env.ENABLE_SECURITY_ALERTS === 'true') {
            this.triggerSecurityAlert(eventType, auditLog);
        }
    }
    /**
     * Anonymize an identifier by hashing it with a server-side secret
     *
     * @param identifier The identifier to anonymize
     * @returns Anonymized identifier
     */
    static anonymizeIdentifier(identifier) {
        // Use a server-side secret to prevent correlation with other systems
        const secret = process.env.ANONYMIZATION_SECRET || 'default-secret-change-in-production';
        return crypto_1.default
            .createHmac('sha256', secret)
            .update(identifier)
            .digest('hex')
            .substring(0, 16); // Use only first 16 chars for brevity
    }
    /**
     * Hash an IP address for privacy-compliant logging
     *
     * @param ip IP address to hash
     * @returns Hashed IP address
     */
    static hashIpAddress(ip) {
        // Use a different secret for IP hashing
        const secret = process.env.IP_HASH_SECRET || 'ip-secret-change-in-production';
        return crypto_1.default
            .createHmac('sha256', secret)
            .update(ip)
            .digest('hex')
            .substring(0, 10); // Use only first 10 chars
    }
    /**
     * Sanitize metadata to remove sensitive information
     *
     * @param metadata Metadata object to sanitize
     * @returns Sanitized metadata
     */
    static sanitizeMetadata(metadata) {
        const sanitized = {};
        // Define sensitive keys that should never be logged
        const sensitiveKeys = [
            'password', 'token', 'secret', 'key', 'auth',
            'credential', 'credit', 'card', 'ssn', 'social',
            'file', 'content', 'data', 'payload'
        ];
        // Copy only safe metadata
        for (const [key, value] of Object.entries(metadata)) {
            // Skip if key contains sensitive information
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                continue;
            }
            // Handle different types of values
            if (typeof value === 'string') {
                // For string values, check if they might contain sensitive data
                if (value.length > 100) {
                    // Long strings might contain sensitive data, truncate them
                    sanitized[key] = value.substring(0, 20) + '... [truncated]';
                }
                else {
                    sanitized[key] = value;
                }
            }
            else if (typeof value === 'number' || typeof value === 'boolean') {
                // Primitive values are safe to log
                sanitized[key] = value;
            }
            else if (value === null || value === undefined) {
                // Null/undefined values are safe to log
                sanitized[key] = value;
            }
            else if (Array.isArray(value)) {
                // For arrays, include only the length
                sanitized[key] = `[Array(${value.length})]`;
            }
            else if (typeof value === 'object') {
                // For objects, include only the keys (not values)
                sanitized[key] = `[Object with keys: ${Object.keys(value).join(', ')}]`;
            }
        }
        return sanitized;
    }
    /**
     * Trigger a security alert for high-priority events
     *
     * @param eventType Type of security event
     * @param auditLog The audit log entry
     */
    static triggerSecurityAlert(eventType, auditLog) {
        // In a real implementation, this would send alerts to a security monitoring system
        // For now, we'll just log it with a special tag
        logger_1.logger.error('SECURITY ALERT', {
            ...auditLog,
            alert: true,
            alertTimestamp: new Date().toISOString()
        });
        // Additional alert mechanisms could be implemented here
        // e.g., sending emails, Slack notifications, etc.
    }
    /**
     * Determine if an event should be logged based on privacy settings
     *
     * @param eventType Type of security event
     * @returns Whether the event should be logged
     */
    static shouldLogEvent(eventType) {
        // Check if security audit logging is enabled
        if (process.env.SECURITY_AUDIT_ENABLED !== 'true') {
            return false;
        }
        // Get minimum log level from environment
        const minLogLevel = process.env.SECURITY_AUDIT_LEVEL || 'standard';
        // Define event types that should only be logged at high detail level
        const highDetailEvents = [
            SecurityEventType.SESSION_STARTED,
            SecurityEventType.SESSION_ENDED
        ];
        // If minimum level is 'minimal', only log critical security events
        if (minLogLevel === 'minimal') {
            return ![
                ...highDetailEvents,
                SecurityEventType.ROOM_CREATED,
                SecurityEventType.ROOM_JOINED,
                SecurityEventType.ROOM_EXPIRED
            ].includes(eventType);
        }
        // If minimum level is 'standard', log all except high detail events
        if (minLogLevel === 'standard') {
            return !highDetailEvents.includes(eventType);
        }
        // If minimum level is 'detailed', log everything
        return true;
    }
    /**
     * Clean up old security audit logs
     *
     * @param retentionDays Number of days to retain logs
     */
    static async cleanupOldLogs(retentionDays = 90) {
        // This would typically be implemented with a scheduled job
        // that archives or deletes logs older than the retention period
        logger_1.logger.info(`Cleaning up security audit logs older than ${retentionDays} days`);
        // In a real implementation, this would interact with the logging system
        // to archive or delete old logs
    }
}
exports.SecurityAuditService = SecurityAuditService;
