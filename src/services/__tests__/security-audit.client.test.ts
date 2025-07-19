/**
 * Client-side Security Audit Service Tests
 * 
 * These tests validate the client-side security audit logging functionality
 * of the Quick-Share P2P platform.
 */

import { SecurityAuditClientService, SecurityEventType } from '../security-audit.client';

describe('SecurityAuditClientService', () => {
  let securityAuditService: SecurityAuditClientService;
  
  // Mock window and event listeners
  const originalWindow = global.window;
  const mockAddEventListener = jest.fn();
  const mockDispatchEvent = jest.fn();
  const mockSessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window object
    global.window = {
      ...originalWindow,
      addEventListener: mockAddEventListener,
      dispatchEvent: mockDispatchEvent,
      sessionStorage: mockSessionStorage
    } as any;
    
    // Mock crypto.getRandomValues
    global.crypto = {
      ...global.crypto,
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = i;
        }
        return array;
      }
    } as Crypto;
    
    // Create service instance
    securityAuditService = SecurityAuditClientService.getInstance();
  });
  
  afterEach(() => {
    // Restore window object
    global.window = originalWindow;
  });
  
  describe('Initialization', () => {
    it('should create a singleton instance', () => {
      // Get another instance
      const anotherInstance = SecurityAuditClientService.getInstance();
      
      // Verify it's the same instance
      expect(anotherInstance).toBe(securityAuditService);
    });
    
    it('should set up event listeners', () => {
      // Verify event listeners were set up
      expect(mockAddEventListener).toHaveBeenCalledWith('session:timeout', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('session:end', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('security:key-disposed', expect.any(Function));
    });
    
    it('should generate or retrieve session ID', () => {
      // Mock sessionStorage.getItem to return null (no existing ID)
      mockSessionStorage.getItem.mockReturnValue(null);
      
      // Create new instance to trigger session ID generation
      SecurityAuditClientService.getInstance();
      
      // Verify sessionStorage.setItem was called with a new ID
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should use existing session ID if available', () => {
      // Mock sessionStorage.getItem to return an existing ID
      mockSessionStorage.getItem.mockReturnValue('existing-session-id');
      
      // Create new instance
      const service = SecurityAuditClientService.getInstance();
      
      // Log an event to capture the session ID
      const listener = jest.fn();
      service.onSecurityEvent(listener);
      service.logSecurityEvent(SecurityEventType.SESSION_STARTED);
      
      // Verify the existing ID was used
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'existing-session-id'
      }));
    });
  });
  
  describe('Security Event Logging', () => {
    it('should log security events with sanitized metadata', () => {
      // Set up event listener
      const listener = jest.fn();
      securityAuditService.onSecurityEvent(listener);
      
      // Log a security event with sensitive data
      securityAuditService.logSecurityEvent(SecurityEventType.KEY_GENERATED, {
        metadata: {
          keyId: 'secret-key-123',
          password: 'super-secret',
          algorithm: 'AES-256-GCM',
          user: { name: 'Test User', email: 'test@example.com' }
        }
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
      const unregister = securityAuditService.onSecurityEvent(listener);
      
      // Unregister the listener
      unregister();
      
      // Log a security event
      securityAuditService.logSecurityEvent(SecurityEventType.KEY_GENERATED);
      
      // Verify listener was not called
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should maintain a limited log history', () => {
      // Log multiple events
      for (let i = 0; i < 110; i++) {
        securityAuditService.logSecurityEvent(SecurityEventType.SESSION_STARTED);
      }
      
      // Get recent logs
      const logs = securityAuditService.getRecentLogs();
      
      // Verify log size is limited
      expect(logs.length).toBeLessThanOrEqual(100);
    });
    
    it('should clear logs when requested', () => {
      // Log some events
      securityAuditService.logSecurityEvent(SecurityEventType.SESSION_STARTED);
      securityAuditService.logSecurityEvent(SecurityEventType.KEY_GENERATED);
      
      // Clear logs
      securityAuditService.clearLogs();
      
      // Verify logs are cleared
      expect(securityAuditService.getRecentLogs()).toHaveLength(0);
    });
  });
  
  describe('Event Handling', () => {
    it('should log session timeout events', () => {
      // Set up event listener
      const listener = jest.fn();
      securityAuditService.onSecurityEvent(listener);
      
      // Simulate session timeout event
      const sessionTimeoutHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'session:timeout'
      )[1];
      
      sessionTimeoutHandler();
      
      // Verify event was logged
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        eventType: SecurityEventType.SESSION_TIMEOUT
      }));
    });
    
    it('should log session end events', () => {
      // Set up event listener
      const listener = jest.fn();
      securityAuditService.onSecurityEvent(listener);
      
      // Simulate session end event
      const sessionEndHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'session:end'
      )[1];
      
      sessionEndHandler();
      
      // Verify event was logged
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        eventType: SecurityEventType.SESSION_ENDED
      }));
    });
    
    it('should log key disposed events', () => {
      // Set up event listener
      const listener = jest.fn();
      securityAuditService.onSecurityEvent(listener);
      
      // Simulate key disposed event
      const keyDisposedHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'security:key-disposed'
      )[1];
      
      keyDisposedHandler({ detail: { keyId: 'test-key' } });
      
      // Verify event was logged
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        eventType: SecurityEventType.KEY_DISPOSED
      }));
    });
  });
});