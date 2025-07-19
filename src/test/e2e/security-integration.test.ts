/**
 * Security Integration Tests
 * 
 * These end-to-end tests validate the security features of the Quick-Share P2P platform,
 * including forward secrecy, brute force protection, and secure session management.
 */

import { test, expect, Page } from '@playwright/test';
import { CryptoService } from '../../services/crypto.service';

// Test constants
const TEST_TIMEOUT = 60000; // 60 seconds

test.describe('Security Integration Tests', () => {
  // Setup for each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should implement forward secrecy with proper key disposal', async ({ page }) => {
    // This test verifies that encryption keys are properly disposed after use
    
    // Create a function to check for active keys in the application
    const getActiveKeyCount = async (page: Page): Promise<number> => {
      return await page.evaluate(() => {
        // Access the CryptoService instance from the window object
        const cryptoService = (window as any).__testHelpers?.getCryptoService();
        return cryptoService ? cryptoService.getActiveKeyCount() : -1;
      });
    };
    
    // Expose test helpers
    await page.evaluate(() => {
      // Create a crypto service instance for testing
      const cryptoService = new (window as any).QuickShare.CryptoService();
      
      // Store it in a test helpers object
      (window as any).__testHelpers = {
        getCryptoService: () => cryptoService,
        async generateAndDisposeKeys(count: number) {
          const keys = [];
          // Generate keys
          for (let i = 0; i < count; i++) {
            const { keyId } = await cryptoService.generateKey();
            keys.push(keyId);
          }
          // Return key count before disposal
          const beforeCount = cryptoService.getActiveKeyCount();
          
          // Dispose keys
          for (const keyId of keys) {
            cryptoService.disposeKey(keyId);
          }
          
          // Return key count after disposal
          const afterCount = cryptoService.getActiveKeyCount();
          
          return { beforeCount, afterCount, keys };
        }
      };
    });
    
    // Generate and dispose keys
    const result = await page.evaluate(() => {
      return (window as any).__testHelpers.generateAndDisposeKeys(5);
    });
    
    // Verify keys were properly generated and disposed
    expect(result.beforeCount).toBe(5);
    expect(result.afterCount).toBe(0);
    
    // Verify memory usage is cleaned up
    const memoryUsage = await page.evaluate(() => {
      const cryptoService = (window as any).__testHelpers.getCryptoService();
      return cryptoService.getKeyMemoryUsage();
    });
    
    expect(memoryUsage).toBe(0);
  });

  test('should implement secure session timeout and cleanup', async ({ page }) => {
    // This test verifies that sessions are properly timed out and cleaned up
    
    // Expose test helpers
    await page.evaluate(() => {
      // Import required services
      const { CryptoService, SessionSecurityService } = (window as any).QuickShare;
      
      // Create instances for testing
      const cryptoService = new CryptoService();
      
      // Create session with short timeout for testing
      const sessionSecurity = SessionSecurityService.getInstance(cryptoService, {
        sessionTimeout: 2000, // 2 seconds
        enableInactivityWarning: true,
        autoCleanup: true
      });
      
      // Store in test helpers
      (window as any).__testHelpers = {
        cryptoService,
        sessionSecurity,
        // Generate a key to track
        async generateTestKey() {
          const { keyId } = await cryptoService.generateKey();
          return keyId;
        },
        // Check if key exists after timeout
        async checkKeyExists(keyId: string) {
          return !!cryptoService.getKey(keyId);
        },
        // Get session status
        getSessionStatus() {
          return sessionSecurity.getSessionStatus();
        }
      };
    });
    
    // Generate a test key
    const keyId = await page.evaluate(() => {
      return (window as any).__testHelpers.generateTestKey();
    });
    
    // Verify key exists initially
    const keyExistsBefore = await page.evaluate((id) => {
      return (window as any).__testHelpers.checkKeyExists(id);
    }, keyId);
    
    expect(keyExistsBefore).toBe(true);
    
    // Wait for session timeout (3 seconds to be safe)
    await page.waitForTimeout(3000);
    
    // Verify key was disposed after timeout
    const keyExistsAfter = await page.evaluate((id) => {
      return (window as any).__testHelpers.checkKeyExists(id);
    }, keyId);
    
    expect(keyExistsAfter).toBe(false);
    
    // Verify session was reset
    const sessionStatus = await page.evaluate(() => {
      return (window as any).__testHelpers.getSessionStatus();
    });
    
    // Session should be active again (reset after timeout)
    expect(sessionStatus.active).toBe(true);
  }, { timeout: TEST_TIMEOUT });

  test('should implement brute force protection for share codes', async ({ page }) => {
    // This test verifies that brute force protection is implemented for share codes
    
    // Expose test helpers
    await page.evaluate(() => {
      // Import required services
      const { SecurityValidationService, CryptoService, SessionSecurityService } = (window as any).QuickShare;
      
      // Create instances for testing
      const cryptoService = new CryptoService();
      const sessionSecurity = SessionSecurityService.getInstance(cryptoService);
      const securityValidation = SecurityValidationService.getInstance(cryptoService, sessionSecurity);
      
      // Store in test helpers
      (window as any).__testHelpers = {
        securityValidation,
        // Simulate multiple failed attempts
        simulateFailedAttempts(action: string, count: number) {
          for (let i = 0; i < count; i++) {
            securityValidation.recordFailedAttempt(action);
          }
        },
        // Try to validate after failed attempts
        validateShareCode(code: string, action: string) {
          return securityValidation.validateShareCode(code, action);
        },
        // Reset failed attempts
        resetFailedAttempts(action: string) {
          securityValidation.resetFailedAttempts(action);
        }
      };
    });
    
    // Simulate multiple failed attempts
    await page.evaluate(() => {
      (window as any).__testHelpers.simulateFailedAttempts('join_room', 5);
    });
    
    // Try to validate a code after too many failed attempts
    const validationResult = await page.evaluate(() => {
      return (window as any).__testHelpers.validateShareCode('VALIDCODE', 'join_room');
    });
    
    // Verify brute force protection was triggered
    expect(validationResult.valid).toBe(false);
    expect(validationResult.reason).toContain('Too many failed attempts');
    
    // Reset failed attempts
    await page.evaluate(() => {
      (window as any).__testHelpers.resetFailedAttempts('join_room');
    });
    
    // Verify validation works after reset
    const validationAfterReset = await page.evaluate(() => {
      return (window as any).__testHelpers.validateShareCode('VALIDCODE', 'join_room');
    });
    
    expect(validationAfterReset.valid).toBe(true);
  });

  test('should implement privacy-compliant security audit logging', async ({ page }) => {
    // This test verifies that security audit logging is privacy-compliant
    
    // Expose test helpers
    await page.evaluate(() => {
      // Import required services
      const { SecurityAuditClientService, SecurityEventType } = (window as any).QuickShare;
      
      // Create instance for testing
      const securityAudit = SecurityAuditClientService.getInstance();
      
      // Store in test helpers
      (window as any).__testHelpers = {
        securityAudit,
        // Log a test event with sensitive data
        logTestEvent() {
          securityAudit.logSecurityEvent(SecurityEventType.KEY_GENERATED, {
            metadata: {
              keyId: 'secret-key-123',
              password: 'super-secret-password',
              creditCard: '4111-1111-1111-1111',
              user: { name: 'Test User', email: 'test@example.com' },
              algorithm: 'AES-256-GCM',
              timestamp: new Date().toISOString()
            }
          });
          
          // Return the most recent log
          return securityAudit.getRecentLogs()[securityAudit.getRecentLogs().length - 1];
        }
      };
    });
    
    // Log a test event with sensitive data
    const logEvent = await page.evaluate(() => {
      return (window as any).__testHelpers.logTestEvent();
    });
    
    // Verify sensitive data was sanitized
    expect(logEvent.eventType).toBe('key_generated');
    expect(logEvent.sessionId).toBeDefined();
    expect(logEvent.timestamp).toBeDefined();
    
    // Sensitive data should be removed or sanitized
    expect(logEvent.metadata).not.toHaveProperty('password');
    expect(logEvent.metadata).not.toHaveProperty('creditCard');
    expect(logEvent.metadata.user).toMatch(/\[Object with keys:/);
    
    // Non-sensitive data should be preserved
    expect(logEvent.metadata).toHaveProperty('algorithm', 'AES-256-GCM');
    expect(logEvent.metadata).toHaveProperty('timestamp');
  });

  test('should validate browser security features', async ({ page }) => {
    // This test verifies that the application validates browser security features
    
    // Expose test helpers
    await page.evaluate(() => {
      // Import required services
      const { SecurityValidationService, CryptoService, SessionSecurityService } = (window as any).QuickShare;
      
      // Create instances for testing
      const cryptoService = new CryptoService();
      const sessionSecurity = SessionSecurityService.getInstance(cryptoService);
      const securityValidation = SecurityValidationService.getInstance(cryptoService, sessionSecurity);
      
      // Store in test helpers
      (window as any).__testHelpers = {
        securityValidation,
        // Validate browser security
        validateBrowserSecurity() {
          return securityValidation.validateBrowserSecurity();
        },
        // Perform security audit
        performSecurityAudit() {
          return securityValidation.performSecurityAudit();
        }
      };
    });
    
    // Validate browser security
    const securityValidation = await page.evaluate(() => {
      return (window as any).__testHelpers.validateBrowserSecurity();
    });
    
    // Verify browser security validation
    expect(securityValidation.valid).toBeDefined();
    expect(securityValidation.capabilities).toBeDefined();
    
    // Perform security audit
    const auditResults = await page.evaluate(() => {
      return (window as any).__testHelpers.performSecurityAudit();
    });
    
    // Verify audit results
    expect(auditResults.browserSecurity).toBeDefined();
    expect(auditResults.cryptoService).toBeDefined();
    expect(auditResults.sessionSecurity).toBeDefined();
    expect(auditResults.secureContext).toBeDefined();
  });
});