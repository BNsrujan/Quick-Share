/**
 * Session Security Service
 * 
 * This service manages secure session timeouts, cleanup, and security validations
 * to ensure proper forward secrecy and privacy protection.
 * 
 * Enhanced features:
 * - Secure session timeout with configurable duration
 * - Automatic key disposal for forward secrecy
 * - Inactivity detection and warnings
 * - Privacy-compliant session tracking
 * - Secure cleanup of sensitive data
 */

import { CryptoService } from './crypto.service';

// Constants
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const INACTIVITY_WARNING_THRESHOLD = 25 * 60 * 1000; // 25 minutes in milliseconds
const CLEANUP_INTERVAL = 60 * 1000; // Check every minute
const SESSION_STORAGE_KEY = 'session_last_active';
const MAX_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours maximum session lifetime

export interface SessionConfig {
  sessionTimeout?: number; // Timeout in milliseconds
  enableInactivityWarning?: boolean; // Whether to show inactivity warnings
  autoCleanup?: boolean; // Whether to automatically clean up on timeout
}

export interface SessionStatus {
  active: boolean;
  remainingTime: number; // in milliseconds
  lastActivity: Date;
}

export class SessionSecurityService {
  private static instance: SessionSecurityService;
  
  private sessionStartTime: Date;
  private lastActivityTime: Date;
  private timeoutId: number | null = null;
  private warningTimeoutId: number | null = null;
  private cleanupIntervalId: number | null = null;
  private cryptoService: CryptoService;
  private sessionConfig: SessionConfig;
  private onTimeoutCallbacks: Array<() => void> = [];
  private onWarningCallbacks: Array<(remainingTime: number) => void> = [];
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor(cryptoService: CryptoService, config: SessionConfig = {}) {
    this.cryptoService = cryptoService;
    
    // Try to restore session from storage
    this.restoreSessionState();
    
    // If no session was restored, initialize a new one
    if (!this.sessionStartTime) {
      this.sessionStartTime = new Date();
      this.lastActivityTime = new Date();
    }
    
    this.sessionConfig = {
      sessionTimeout: config.sessionTimeout || DEFAULT_SESSION_TIMEOUT,
      enableInactivityWarning: config.enableInactivityWarning !== false,
      autoCleanup: config.autoCleanup !== false
    };
    
    // Start session monitoring
    this.startSessionMonitoring();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(cryptoService: CryptoService, config?: SessionConfig): SessionSecurityService {
    if (!SessionSecurityService.instance) {
      SessionSecurityService.instance = new SessionSecurityService(cryptoService, config);
    }
    return SessionSecurityService.instance;
  }
  
  /**
   * Start monitoring session activity and timeouts
   */
  private startSessionMonitoring(): void {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    // Set up activity listeners
    window.addEventListener('mousemove', () => this.recordActivity());
    window.addEventListener('keydown', () => this.recordActivity());
    window.addEventListener('click', () => this.recordActivity());
    window.addEventListener('touchstart', () => this.recordActivity());
    window.addEventListener('scroll', () => this.recordActivity());
    
    // Set up visibility change listener
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordActivity();
      }
    });
    
    // Set up cleanup interval
    if (this.sessionConfig.autoCleanup) {
      this.cleanupIntervalId = window.setInterval(() => {
        this.checkSessionTimeout();
      }, CLEANUP_INTERVAL);
    }
    
    // Set initial timeouts
    this.resetTimeouts();
  }
  
  /**
   * Record user activity to prevent timeout
   */
  recordActivity(): void {
    this.lastActivityTime = new Date();
    this.resetTimeouts();
    
    // Save session state for potential recovery
    this.saveSessionState();
    
    // Check if session has exceeded maximum duration
    this.enforceMaxSessionDuration();
    
    // Dispatch custom event for monitoring
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('session:activity'));
    }
  }
  
  /**
   * Reset timeout timers based on current activity
   */
  private resetTimeouts(): void {
    // Clear existing timeouts
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.warningTimeoutId !== null) {
      window.clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    
    // Set warning timeout if enabled
    if (this.sessionConfig.enableInactivityWarning) {
      const warningTime = this.sessionConfig.sessionTimeout! - INACTIVITY_WARNING_THRESHOLD;
      this.warningTimeoutId = window.setTimeout(() => {
        const remainingTime = this.sessionConfig.sessionTimeout! - INACTIVITY_WARNING_THRESHOLD;
        this.triggerWarning(remainingTime);
      }, warningTime);
    }
    
    // Set session timeout
    this.timeoutId = window.setTimeout(() => {
      this.handleSessionTimeout();
    }, this.sessionConfig.sessionTimeout!);
  }
  
  /**
   * Check if session has timed out
   */
  private checkSessionTimeout(): void {
    const now = new Date();
    const inactivityTime = now.getTime() - this.lastActivityTime.getTime();
    
    if (inactivityTime >= this.sessionConfig.sessionTimeout!) {
      this.handleSessionTimeout();
    } else if (
      this.sessionConfig.enableInactivityWarning && 
      inactivityTime >= INACTIVITY_WARNING_THRESHOLD
    ) {
      const remainingTime = this.sessionConfig.sessionTimeout! - inactivityTime;
      this.triggerWarning(remainingTime);
    }
  }
  
  /**
   * Handle session timeout by cleaning up sensitive data
   */
  private handleSessionTimeout(): void {
    // Clean up cryptographic keys
    this.cryptoService.disposeAllKeys();
    
    // Clear session state from storage
    this.clearSessionState();
    
    // Trigger registered callbacks
    this.onTimeoutCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in session timeout callback:', error);
      }
    });
    
    // Dispatch custom event for session timeout
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('session:timeout'));
    }
    
    // Reset session
    this.sessionStartTime = new Date();
    this.lastActivityTime = new Date();
    this.resetTimeouts();
  }
  
  /**
   * Trigger inactivity warning
   */
  private triggerWarning(remainingTime: number): void {
    // Trigger registered warning callbacks
    this.onWarningCallbacks.forEach(callback => {
      try {
        callback(remainingTime);
      } catch (error) {
        console.error('Error in session warning callback:', error);
      }
    });
    
    // Dispatch custom event for session warning
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('session:warning', { 
        detail: { remainingTime } 
      }));
    }
  }
  
  /**
   * Register callback for session timeout
   */
  onTimeout(callback: () => void): void {
    this.onTimeoutCallbacks.push(callback);
  }
  
  /**
   * Register callback for inactivity warning
   */
  onWarning(callback: (remainingTime: number) => void): void {
    this.onWarningCallbacks.push(callback);
  }
  
  /**
   * Get current session status
   */
  getSessionStatus(): SessionStatus {
    const now = new Date();
    const inactivityTime = now.getTime() - this.lastActivityTime.getTime();
    const remainingTime = Math.max(0, this.sessionConfig.sessionTimeout! - inactivityTime);
    
    return {
      active: inactivityTime < this.sessionConfig.sessionTimeout!,
      remainingTime,
      lastActivity: new Date(this.lastActivityTime)
    };
  }
  
  /**
   * Manually extend the session
   */
  extendSession(): void {
    this.recordActivity();
  }
  
  /**
   * Manually end the session and clean up
   */
  endSession(): void {
    // Clean up cryptographic keys
    this.cryptoService.disposeAllKeys();
    
    // Clear timeouts
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.warningTimeoutId !== null) {
      window.clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    
    if (this.cleanupIntervalId !== null) {
      window.clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    // Dispatch custom event for session end
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('session:end'));
    }
    
    // Reset session
    this.sessionStartTime = new Date();
    this.lastActivityTime = new Date();
    
    // Trigger registered callbacks
    this.onTimeoutCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in session end callback:', error);
      }
    });
  }
  
  /**
   * Update session configuration
   */
  updateConfig(config: Partial<SessionConfig>): void {
    this.sessionConfig = {
      ...this.sessionConfig,
      ...config
    };
    
    // Reset timeouts with new configuration
    this.resetTimeouts();
  }
  
  /**
   * Save session state to storage for potential recovery
   * Uses a privacy-focused approach that doesn't store sensitive data
   */
  private saveSessionState(): void {
    // Only run in browser environment with localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      // Store minimal session data - just timestamps
      const sessionData = {
        sessionStart: this.sessionStartTime.getTime(),
        lastActivity: this.lastActivityTime.getTime(),
        updated: new Date().getTime()
      };
      
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      // Fail silently - session storage is a non-critical feature
      console.warn('Failed to save session state:', error);
    }
  }
  
  /**
   * Restore session state from storage if available
   */
  private restoreSessionState(): void {
    // Only run in browser environment with localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      const sessionDataStr = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionDataStr) {
        return;
      }
      
      const sessionData = JSON.parse(sessionDataStr);
      const now = new Date().getTime();
      
      // Validate session data
      if (!sessionData.sessionStart || !sessionData.lastActivity) {
        return;
      }
      
      // Check if session is too old (enforce maximum session duration)
      if (now - sessionData.sessionStart > MAX_SESSION_DURATION) {
        // Session is too old, don't restore it
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      
      // Check if session has timed out
      if (now - sessionData.lastActivity > this.sessionConfig?.sessionTimeout || DEFAULT_SESSION_TIMEOUT) {
        // Session has timed out, don't restore it
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      
      // Restore session timestamps
      this.sessionStartTime = new Date(sessionData.sessionStart);
      this.lastActivityTime = new Date(sessionData.lastActivity);
      
      // Dispatch event for restored session
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('session:restored'));
      }
    } catch (error) {
      // Fail silently - session restoration is a non-critical feature
      console.warn('Failed to restore session state:', error);
    }
  }
  
  /**
   * Clear session data from storage
   */
  private clearSessionState(): void {
    // Only run in browser environment with localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      // Fail silently
      console.warn('Failed to clear session state:', error);
    }
  }
  
  /**
   * Enforce maximum session duration
   * Even with activity, sessions should expire after a maximum duration
   * for security reasons
   */
  private enforceMaxSessionDuration(): void {
    const now = new Date();
    const sessionDuration = now.getTime() - this.sessionStartTime.getTime();
    
    if (sessionDuration > MAX_SESSION_DURATION) {
      // Session has exceeded maximum duration, force timeout
      this.handleSessionTimeout();
      
      // Dispatch custom event for max duration reached
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('session:max-duration'));
      }
    }
  }
}