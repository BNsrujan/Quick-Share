/**
 * Client-side Security Audit Service
 * 
 * This service provides privacy-compliant security audit logging for the client-side
 * without compromising user privacy or exposing sensitive data.
 */

// Event types for security audit (must match server-side types)
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
  // Whether this is a high-priority security event
  highPriority?: boolean;
  
  // Custom metadata to include
  metadata?: Record<string, any>;
}

interface SecurityAuditEvent {
  eventType: SecurityEventType;
  timestamp: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

// Constants
const AUDIT_LOG_SIZE = 100; // Maximum number of audit logs to keep in memory
const SESSION_ID_KEY = 'security_session_id';

export class SecurityAuditClientService {
  private static instance: SecurityAuditClientService;
  
  private sessionId: string;
  private auditLogs: SecurityAuditEvent[] = [];
  private eventListeners: Array<(event: SecurityAuditEvent) => void> = [];
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Generate or retrieve session ID
    this.sessionId = this.getOrCreateSessionId();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): SecurityAuditClientService {
    if (!SecurityAuditClientService.instance) {
      SecurityAuditClientService.instance = new SecurityAuditClientService();
    }
    return SecurityAuditClientService.instance;
  }
  
  /**
   * Set up event listeners for security events
   */
  private setupEventListeners(): void {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    // Listen for session events
    window.addEventListener('session:timeout', () => {
      this.logSecurityEvent(SecurityEventType.SESSION_TIMEOUT);
    });
    
    window.addEventListener('session:end', () => {
      this.logSecurityEvent(SecurityEventType.SESSION_ENDED);
    });
    
    // Listen for custom security events
    window.addEventListener('security:key-disposed', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.logSecurityEvent(SecurityEventType.KEY_DISPOSED, { metadata: customEvent.detail });
    });
  }
  
  /**
   * Generate or retrieve a session ID for audit logging
   * 
   * @returns Session ID
   */
  private getOrCreateSessionId(): string {
    // Only run in browser environment with sessionStorage
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return this.generateSessionId();
    }
    
    try {
      // Try to get existing session ID
      const existingId = window.sessionStorage.getItem(SESSION_ID_KEY);
      if (existingId) {
        return existingId;
      }
      
      // Generate new session ID
      const newId = this.generateSessionId();
      window.sessionStorage.setItem(SESSION_ID_KEY, newId);
      return newId;
    } catch (error) {
      // Fail gracefully and generate a new ID
      return this.generateSessionId();
    }
  }
  
  /**
   * Generate a random session ID
   * 
   * @returns Random session ID
   */
  private generateSessionId(): string {
    // Generate a random ID that doesn't contain PII
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    
    return Array.from(randomBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Log a security event with privacy-compliant data
   * 
   * @param eventType Type of security event
   * @param options Additional audit options
   */
  logSecurityEvent(
    eventType: SecurityEventType,
    options: AuditOptions = {}
  ): void {
    // Create event data with minimal information
    const eventData: SecurityAuditEvent = {
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      // Include sanitized metadata
      ...(options.metadata ? { metadata: this.sanitizeMetadata(options.metadata) } : {})
    };
    
    // Add to in-memory audit log with size limit
    this.auditLogs.push(eventData);
    if (this.auditLogs.length > AUDIT_LOG_SIZE) {
      this.auditLogs.shift(); // Remove oldest entry
    }
    
    // Dispatch custom event for monitoring
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(`security:${eventType}`, {
        detail: eventData
      }));
    }
    
    // Notify all registered listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        console.error('Error in security event listener:', error);
      }
    });
    
    // Log to console in development mode only
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Security event: ${eventType}`, eventData);
    }
  }
  
  /**
   * Register a listener for security events
   * 
   * @param listener Function to call when security events occur
   * @returns Function to unregister the listener
   */
  onSecurityEvent(listener: (event: SecurityAuditEvent) => void): () => void {
    this.eventListeners.push(listener);
    
    // Return function to unregister listener
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index !== -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Get recent audit logs
   * 
   * @returns Array of recent security audit events
   */
  getRecentLogs(): SecurityAuditEvent[] {
    return [...this.auditLogs];
  }
  
  /**
   * Clear audit logs
   */
  clearLogs(): void {
    this.auditLogs = [];
  }
  
  /**
   * Sanitize metadata to remove sensitive information
   * 
   * @param metadata Metadata object to sanitize
   * @returns Sanitized metadata
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
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
}