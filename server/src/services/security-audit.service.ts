/**
 * Security Audit Service
 * 
 * This service provides privacy-compliant security audit logging
 * without compromising user privacy or exposing sensitive data.
 */

import { logger } from '../utils/logger';
import crypto from 'crypto';

// Event types for security audit
export enum SecurityEventType {
  // Authentication events
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  
  // Room events
  ROOM_CREATED = 'room_created',
  ROOM_JOINED = 'room_joined',
  ROOM_EXPIRED = 'room_expired',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  BRUTE_FORCE_DETECTED = 'brute_force_detected',
  
  // Key management events
  KEY_GENERATED = 'key_generated',
  KEY_DISPOSED = 'key_disposed',
  
  // Session events
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  SESSION_TIMEOUT = 'session_timeout',
  
  // Security events
  SECURITY_VIOLATION = 'security_violation',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

// Sensitivity levels for data
export enum DataSensitivity {
  PUBLIC = 'public',     // Can be logged fully
  INTERNAL = 'internal', // Can be logged with caution
  PRIVATE = 'private',   // Should be anonymized
  SECRET = 'secret'      // Should never be logged
}

interface AuditOptions {
  // Whether to include the client IP in the log
  includeIp?: boolean;
  
  // Whether this is a high-priority security event
  highPriority?: boolean;
  
  // Custom metadata to include
  metadata?: Record<string, any>;
}

export class SecurityAuditService {
  /**
   * Log a security event with privacy-compliant data handling
   * 
   * @param eventType Type of security event
   * @param userId Anonymous user identifier (or session ID)
   * @param message Description of the event
   * @param options Additional audit options
   */
  static logSecurityEvent(
    eventType: SecurityEventType,
    userId: string,
    message: string,
    options: AuditOptions = {}
  ): void {
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
      logger.warn('Security event', auditLog);
    } else {
      logger.info('Security event', auditLog);
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
  private static anonymizeIdentifier(identifier: string): string {
    // Use a server-side secret to prevent correlation with other systems
    const secret = process.env.ANONYMIZATION_SECRET || 'default-secret-change-in-production';
    
    return crypto
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
  private static hashIpAddress(ip: string): string {
    // Use a different secret for IP hashing
    const secret = process.env.IP_HASH_SECRET || 'ip-secret-change-in-production';
    
    return crypto
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
  private static sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
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
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        // Primitive values are safe to log
        sanitized[key] = value;
      } else if (value === null || value === undefined) {
        // Null/undefined values are safe to log
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        // For arrays, include only the length
        sanitized[key] = `[Array(${value.length})]`;
      } else if (typeof value === 'object') {
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
  private static triggerSecurityAlert(
    eventType: SecurityEventType,
    auditLog: Record<string, any>
  ): void {
    // In a real implementation, this would send alerts to a security monitoring system
    // For now, we'll just log it with a special tag
    logger.error('SECURITY ALERT', {
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
  static shouldLogEvent(eventType: SecurityEventType): boolean {
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
  static async cleanupOldLogs(retentionDays: number = 90): Promise<void> {
    // This would typically be implemented with a scheduled job
    // that archives or deletes logs older than the retention period
    logger.info(`Cleaning up security audit logs older than ${retentionDays} days`);
    
    // In a real implementation, this would interact with the logging system
    // to archive or delete old logs
  }
}