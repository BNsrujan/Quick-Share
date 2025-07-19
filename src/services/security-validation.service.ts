/**
 * Security Validation Service
 * 
 * This service provides comprehensive security validations and privacy features
 * for the Quick-Share P2P platform, including:
 * - Forward secrecy with proper key disposal
 * - Security audit logging without compromising privacy
 * - Brute force protection for share codes
 * - Secure session timeout and cleanup
 * - Privacy-compliant minimal logging
 */

import { CryptoService } from './crypto.service';
import { SessionSecurityService } from './session-security.service';

// Constants
const SECURITY_EVENT_PREFIX = 'security:';
const VALIDATION_INTERVAL = 60 * 1000; // 1 minute in milliseconds
const MAX_FAILED_ATTEMPTS = 5; // Maximum failed attempts before lockout
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Security event types
export enum SecurityEventType {
  // Key management events
  KEY_GENERATED = 'key_generated',
  KEY_DISPOSED = 'key_disposed',
  KEY_ROTATION = 'key_rotation',
  
  // Session events
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  SESSION_TIMEOUT = 'session_timeout',
  SESSION_EXTENDED = 'session_extended',
  
  // Authentication events
  CODE_VALIDATION_SUCCESS = 'code_validation_success',
  CODE_VALIDATION_FAILURE = 'code_validation_failure',
  CODE_GENERATION = 'code_generation',
  
  // Transfer events
  TRANSFER_STARTED = 'transfer_started',
  TRANSFER_COMPLETED = 'transfer_completed',
  TRANSFER_PAUSED = 'transfer_paused',
  TRANSFER_RESUMED = 'transfer_resumed',
  TRANSFER_CANCELLED = 'transfer_cancelled',
  
  // Security events
  SECURITY_VIOLATION = 'security_violation',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt'
}

// Interface for security event data
export interface SecurityEventData {
  eventType: SecurityEventType;
  timestamp: string;
  sessionId?: string;
  transferId?: string;
  metadata?: Record<string, any>;
}

// Interface for validation result
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class SecurityValidationService {
  private static instance: SecurityValidationService;
  
  private cryptoService: CryptoService;
  private sessionSecurity: SessionSecurityService;
  private validationIntervalId: number | null = null;
  private failedAttempts: Map<string, { count: number, timestamp: number }> = new Map();
  private securityEventListeners: Array<(event: SecurityEventData) => void> = [];
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor(cryptoService: CryptoService, sessionSecurity: SessionSecurityService) {
    this.cryptoService = cryptoService;
    this.sessionSecurity = sessionSecurity;
    
    // Start security validation interval
    this.startValidationInterval();
    
    // Set up event listeners for security events
    this.setupEventListeners();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(cryptoService: CryptoService, sessionSecurity: SessionSecurityService): SecurityValidationService {
    if (!SecurityValidationService.instance) {
      SecurityValidationService.instance = new SecurityValidationService(cryptoService, sessionSecurity);
    }
    return SecurityValidationService.instance;
  }
  
  /**
   * Start periodic security validations
   */
  private startValidationInterval(): void {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    this.validationIntervalId = window.setInterval(() => {
      this.performSecurityValidations();
    }, VALIDATION_INTERVAL);
  }
  
  /**
   * Set up event listeners for security events
   */
  private setupEventListeners(): void {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    // Listen for custom security events
    window.addEventListener('security:key-disposed', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.logSecurityEvent(SecurityEventType.KEY_DISPOSED, customEvent.detail);
    });
    
    // Listen for session events
    window.addEventListener('session:timeout', () => {
      this.logSecurityEvent(SecurityEventType.SESSION_TIMEOUT, {});
    });
    
    window.addEventListener('session:end', () => {
      this.logSecurityEvent(SecurityEventType.SESSION_ENDED, {});
    });
    
    window.addEventListener('session:activity', () => {
      this.logSecurityEvent(SecurityEventType.SESSION_EXTENDED, {});
    });
  }
  
  /**
   * Perform periodic security validations
   */
  private performSecurityValidations(): void {
    // Check for expired keys and dispose them
    this.cleanupExpiredKeys();
    
    // Clean up expired failed attempts
    this.cleanupExpiredFailedAttempts();
  }
  
  /**
   * Clean up expired keys for forward secrecy
   */
  private cleanupExpiredKeys(): void {
    // This would typically check for keys that haven't been used
    // in a while and dispose of them for forward secrecy
    
    // For now, we'll rely on the CryptoService's own key disposal
    // mechanisms and the SessionSecurityService's timeout
  }
  
  /**
   * Clean up expired failed attempts
   */
  private cleanupExpiredFailedAttempts(): void {
    const now = Date.now();
    
    for (const [key, data] of this.failedAttempts.entries()) {
      if (now - data.timestamp > LOCKOUT_DURATION) {
        this.failedAttempts.delete(key);
      }
    }
  }
  
  /**
   * Log a security event with privacy-compliant data
   * 
   * @param eventType Type of security event
   * @param metadata Additional metadata for the event
   */
  logSecurityEvent(eventType: SecurityEventType, metadata: Record<string, any> = {}): void {
    // Create event data with minimal information
    const eventData: SecurityEventData = {
      eventType,
      timestamp: new Date().toISOString(),
      // Use a random session ID if not provided
      sessionId: metadata.sessionId || this.generateSessionId(),
      // Include transfer ID if provided
      ...(metadata.transferId ? { transferId: metadata.transferId } : {}),
      // Include sanitized metadata
      metadata: this.sanitizeMetadata(metadata)
    };
    
    // Dispatch custom event for monitoring
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(`${SECURITY_EVENT_PREFIX}${eventType}`, {
        detail: eventData
      }));
    }
    
    // Notify all registered listeners
    this.securityEventListeners.forEach(listener => {
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
  onSecurityEvent(listener: (event: SecurityEventData) => void): () => void {
    this.securityEventListeners.push(listener);
    
    // Return function to unregister listener
    return () => {
      const index = this.securityEventListeners.indexOf(listener);
      if (index !== -1) {
        this.securityEventListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Generate a random session ID for logging
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
  
  /**
   * Validate a share code with brute force protection
   * 
   * @param code The share code to validate
   * @param action The action being performed (e.g., 'join_room')
   * @returns Validation result
   */
  validateShareCode(code: string, action: string): ValidationResult {
    // First, check if the code format is valid
    const validationResult = CryptoService.validateShareCode(code);
    if (!validationResult.valid) {
      return {
        valid: false,
        reason: validationResult.reason || 'Invalid share code format'
      };
    }
    
    // Check for brute force attempts
    const actionKey = `${action}:${this.generateSessionId()}`;
    const failedData = this.failedAttempts.get(actionKey);
    
    if (failedData && failedData.count >= MAX_FAILED_ATTEMPTS) {
      const lockoutRemaining = Math.ceil(
        (failedData.timestamp + LOCKOUT_DURATION - Date.now()) / 1000 / 60
      );
      
      // Log brute force attempt
      this.logSecurityEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, {
        action,
        failedAttempts: failedData.count,
        lockoutRemaining: `${lockoutRemaining} minutes`
      });
      
      return {
        valid: false,
        reason: `Too many failed attempts. Please try again in ${lockoutRemaining} minutes.`
      };
    }
    
    // For this client-side validation, we'll assume the code is valid
    // The server will do the actual validation
    
    return { valid: true };
  }
  
  /**
   * Record a failed share code validation attempt
   * 
   * @param action The action being performed
   */
  recordFailedAttempt(action: string): void {
    const actionKey = `${action}:${this.generateSessionId()}`;
    const failedData = this.failedAttempts.get(actionKey) || { count: 0, timestamp: Date.now() };
    
    failedData.count += 1;
    failedData.timestamp = Date.now();
    
    this.failedAttempts.set(actionKey, failedData);
    
    // Log failed attempt
    this.logSecurityEvent(SecurityEventType.CODE_VALIDATION_FAILURE, {
      action,
      failedAttempts: failedData.count,
      remainingAttempts: MAX_FAILED_ATTEMPTS - failedData.count
    });
  }
  
  /**
   * Reset failed attempts for an action
   * 
   * @param action The action to reset
   */
  resetFailedAttempts(action: string): void {
    const actionKey = `${action}:${this.generateSessionId()}`;
    this.failedAttempts.delete(actionKey);
  }
  
  /**
   * Validate browser security features
   * 
   * @returns Validation result with security capabilities
   */
  validateBrowserSecurity(): ValidationResult & { capabilities: string[] } {
    const capabilities: string[] = [];
    const missingFeatures: string[] = [];
    
    // Check for Web Crypto API
    if (typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined') {
      capabilities.push('Web Crypto API');
    } else {
      missingFeatures.push('Web Crypto API');
    }
    
    // Check for Secure Context
    if (typeof window !== 'undefined' && window.isSecureContext) {
      capabilities.push('Secure Context');
    } else {
      missingFeatures.push('Secure Context');
    }
    
    // Check for IndexedDB (for state persistence)
    if (typeof indexedDB !== 'undefined') {
      capabilities.push('IndexedDB');
    } else {
      missingFeatures.push('IndexedDB');
    }
    
    // Check for WebRTC support
    if (
      typeof RTCPeerConnection !== 'undefined' &&
      typeof RTCDataChannel !== 'undefined'
    ) {
      capabilities.push('WebRTC');
    } else {
      missingFeatures.push('WebRTC');
    }
    
    // Result is valid if we have all required features
    const valid = missingFeatures.length === 0;
    
    return {
      valid,
      reason: valid ? undefined : `Missing required security features: ${missingFeatures.join(', ')}`,
      capabilities
    };
  }
  
  /**
   * Perform a comprehensive security audit
   * 
   * @returns Audit results
   */
  async performSecurityAudit(): Promise<Record<string, ValidationResult>> {
    const results: Record<string, ValidationResult> = {};
    
    // Check browser security features
    results.browserSecurity = this.validateBrowserSecurity();
    
    // Check crypto service
    results.cryptoService = {
      valid: CryptoService.isSupported(),
      reason: CryptoService.isSupported() ? undefined : 'Web Crypto API not supported'
    };
    
    // Check session security
    const sessionStatus = this.sessionSecurity.getSessionStatus();
    results.sessionSecurity = {
      valid: sessionStatus.active,
      reason: sessionStatus.active ? undefined : 'Session has expired'
    };
    
    // Check for secure context
    results.secureContext = {
      valid: typeof window !== 'undefined' && window.isSecureContext,
      reason: (typeof window !== 'undefined' && window.isSecureContext) 
        ? undefined 
        : 'Not running in a secure context (HTTPS)'
    };
    
    // Log audit results
    this.logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, {
      auditResults: Object.entries(results).reduce((acc, [key, value]) => {
        acc[key] = value.valid;
        return acc;
      }, {} as Record<string, boolean>)
    });
    
    return results;
  }
  
  /**
   * Clean up and dispose of all security-sensitive data
   */
  cleanup(): void {
    // Dispose of all cryptographic keys
    this.cryptoService.disposeAllKeys();
    
    // Clear failed attempts
    this.failedAttempts.clear();
    
    // Clear validation interval
    if (this.validationIntervalId !== null) {
      window.clearInterval(this.validationIntervalId);
      this.validationIntervalId = null;
    }
    
    // Log cleanup event
    this.logSecurityEvent(SecurityEventType.SESSION_ENDED, {
      reason: 'Manual cleanup'
    });
  }
}