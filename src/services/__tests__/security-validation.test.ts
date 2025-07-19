/**
 * Security Validation Service Tests
 * 
 * These tests validate the client-side security features of the Quick-Share P2P platform,
 * including forward secrecy, brute force protection, and secure session management.
 */

import { CryptoService } from '../crypto.service';
import { SessionSecurityService } from '../session-security.service';
import { SecurityValidationService, SecurityEventType } from '../security-validation.service';

// Mock dependencies
jest.mock('../crypto.service');
jest.mock('../session-security.service');

describe('SecurityValidationService', () => {
  let securityValidationService: SecurityValidationService;
  let cryptoService: jest.Mocked<CryptoService>;
  let sessionSecurity: jest.Mocked<SessionSecurityService>;
  
  // Mock window and event listeners
  const originalWindow = global.window;
  const mockAddEventListener = jest.fn();
  const mockDispatchEvent = jest.fn();
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window object
    global.window = {
      ...originalWindow,
      addEventListener: mockAddEventListener,
      dispatchEvent: mockDispatchEvent,
      isSecureContext: true
    } as any;
    
    // Create mocked instances
    cryptoService = new CryptoService() as jest.Mocked<CryptoService>;
    sessionSecurity = {
      getSessionStatus: jest.fn().mockReturnValue({
        active: true,
        remainingTime: 1000000,
        lastActivity: new Date()
      })
    } as unknown as jest.Mocked<SessionSecurityService>;
    
    // Mock static methods
    (CryptoService.isSupported as jest.Mock).mockReturnValue(true);
    (CryptoService.validateShareCode as jest.Mock).mockReturnValue({ valid: true, entropy: 100 });
    
    // Create service instance
    securityValidationService = SecurityValidationService.getInstance(cryptoService, sessionSecurity);
  });
  
  afterEach(() => {
    // Restore window object
    global.window = originalWindow;
    
    // Clear any intervals
    jest.useRealTimers();
  });
  
  describe('Security Event Logging', () => {
    it('should log security events with sanitized metadata', () => {
      // Set up event listener
      const listener = jest.fn();
      securityValidationService.onSecurityEvent(listener);
      
      // Log a security event with sensitive data
      securityValidationService.logSecurityEvent(SecurityEventType.KEY_GENERATED, {
        keyId: 'secret-key-123',
        password: 'super-secret',
        algorithm: 'AES-256-GCM',
        user: { name: 'Test User', email: 'test@example.com' }
      });
      
      // Verify event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalled();
      
      // Verify listener was called
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        eventType: SecurityEventType.KEY_GENERATED,
        timestamp: expect.any(String),
        sessionId: expect.any(String)
      }));
      
      // Verify sensitive data was sanitized
      const eventData = listener.mock.calls[0][0];
      expect(eventData.metadata).not.toHaveProperty('password');
      expect(eventData.metadata).toHaveProperty('algorithm', 'AES-256-GCM');
      expect(eventData.metadata.user).toMatch(/\[Object with keys:/);
    });
    
    it('should allow unregistering event listeners', () => {
      // Set up event listener
      const listener = jest.fn();
      const unregister = securityValidationService.onSecurityEvent(listener);
      
      // Unregister the listener
      unregister();
      
      // Log a security event
      securityValidationService.logSecurityEvent(SecurityEventType.KEY_GENERATED, {});
      
      // Verify listener was not called
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('Share Code Validation', () => {
    it('should validate share codes with brute force protection', () => {
      // Mock CryptoService.validateShareCode to return valid
      (CryptoService.validateShareCode as jest.Mock).mockReturnValue({ valid: true, entropy: 100 });
      
      // Validate a share code
      const result = securityValidationService.validateShareCode('VALIDCODE', 'join_room');
      
      // Verify result
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid share codes', () => {
      // Mock CryptoService.validateShareCode to return invalid
      (CryptoService.validateShareCode as jest.Mock).mockReturnValue({ 
        valid: false, 
        entropy: 40,
        reason: 'Insufficient entropy (40.00 bits)'
      });
      
      // Validate an invalid share code
      const result = securityValidationService.validateShareCode('SHORT', 'join_room');
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Insufficient entropy');
    });
    
    it('should detect and block brute force attempts', () => {
      // Record multiple failed attempts
      for (let i = 0; i < 5; i++) {
        securityValidationService.recordFailedAttempt('join_room');
      }
      
      // Try to validate after too many failed attempts
      const result = securityValidationService.validateShareCode('VALIDCODE', 'join_room');
      
      // Verify result shows lockout
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Too many failed attempts');
    });
    
    it('should reset failed attempts counter', () => {
      // Record failed attempts
      securityValidationService.recordFailedAttempt('join_room');
      securityValidationService.recordFailedAttempt('join_room');
      
      // Reset failed attempts
      securityValidationService.resetFailedAttempts('join_room');
      
      // Validate after reset
      const result = securityValidationService.validateShareCode('VALIDCODE', 'join_room');
      
      // Verify validation succeeds
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Browser Security Validation', () => {
    it('should validate browser security features', () => {
      // Set up secure browser environment
      global.window = {
        ...originalWindow,
        isSecureContext: true
      } as any;
      
      global.crypto = {
        subtle: {} as SubtleCrypto,
        getRandomValues: () => new Uint8Array(8)
      } as Crypto;
      
      global.RTCPeerConnection = class {} as any;
      global.RTCDataChannel = class {} as any;
      global.indexedDB = {} as IDBFactory;
      
      // Validate browser security
      const result = securityValidationService.validateBrowserSecurity();
      
      // Verify result
      expect(result.valid).toBe(true);
      expect(result.capabilities).toContain('Web Crypto API');
      expect(result.capabilities).toContain('Secure Context');
      expect(result.capabilities).toContain('WebRTC');
      expect(result.capabilities).toContain('IndexedDB');
    });
    
    it('should detect missing security features', () => {
      // Set up insecure browser environment
      global.window = {
        ...originalWindow,
        isSecureContext: false
      } as any;
      
      global.crypto = undefined as any;
      global.RTCPeerConnection = undefined as any;
      global.indexedDB = undefined as any;
      
      // Validate browser security
      const result = securityValidationService.validateBrowserSecurity();
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing required security features');
      expect(result.capabilities).toHaveLength(0);
    });
  });
  
  describe('Security Audit', () => {
    it('should perform comprehensive security audit', async () => {
      // Mock dependencies
      (CryptoService.isSupported as jest.Mock).mockReturnValue(true);
      sessionSecurity.getSessionStatus.mockReturnValue({
        active: true,
        remainingTime: 1000000,
        lastActivity: new Date()
      });
      
      // Set up secure browser environment
      global.window = {
        ...originalWindow,
        isSecureContext: true,
        dispatchEvent: mockDispatchEvent
      } as any;
      
      // Perform security audit
      const results = await securityValidationService.performSecurityAudit();
      
      // Verify audit results
      expect(results.browserSecurity.valid).toBeDefined();
      expect(results.cryptoService.valid).toBe(true);
      expect(results.sessionSecurity.valid).toBe(true);
      expect(results.secureContext.valid).toBeDefined();
      
      // Verify security event was logged
      expect(mockDispatchEvent).toHaveBeenCalled();
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up all security-sensitive data', () => {
      // Set up interval spy
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      // Perform cleanup
      securityValidationService.cleanup();
      
      // Verify crypto keys were disposed
      expect(cryptoService.disposeAllKeys).toHaveBeenCalled();
      
      // Verify intervals were cleared
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      // Verify security event was logged
      expect(mockDispatchEvent).toHaveBeenCalled();
    });
  });
});