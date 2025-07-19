/**
 * Tests for error types and utilities
 */

import { ErrorType, TransferError } from '../transfer';
import {
  ExtendedErrorType,
  ERROR_TYPE_MAPPING,
  EXTENDED_ERROR_MESSAGES,
  EXTENDED_ERROR_RECOVERY,
  createError,
  getRecoverySuggestion,
  isRetryableError,
  getRetryDelay
} from '../error';

describe('Error Types and Utilities', () => {
  describe('ERROR_TYPE_MAPPING', () => {
    it('should map all extended error types to base error types', () => {
      // Check that all extended error types are mapped
      Object.values(ExtendedErrorType).forEach(type => {
        expect(ERROR_TYPE_MAPPING[type]).toBeDefined();
        expect(Object.values(ErrorType)).toContain(ERROR_TYPE_MAPPING[type]);
      });
    });
  });
  
  describe('EXTENDED_ERROR_MESSAGES', () => {
    it('should have messages for all extended error types', () => {
      Object.values(ExtendedErrorType).forEach(type => {
        expect(EXTENDED_ERROR_MESSAGES[type]).toBeDefined();
        expect(typeof EXTENDED_ERROR_MESSAGES[type]).toBe('string');
        expect(EXTENDED_ERROR_MESSAGES[type].length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('EXTENDED_ERROR_RECOVERY', () => {
    it('should have recovery suggestions for all extended error types', () => {
      Object.values(ExtendedErrorType).forEach(type => {
        expect(EXTENDED_ERROR_RECOVERY[type]).toBeDefined();
        expect(typeof EXTENDED_ERROR_RECOVERY[type]).toBe('string');
        expect(EXTENDED_ERROR_RECOVERY[type].length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('createError', () => {
    it('should create a transfer error from an extended error type', () => {
      const error = createError(ExtendedErrorType.ICE_CONNECTION_FAILED);
      
      expect(error.type).toBe(ErrorType.CONNECTION_FAILED);
      expect(error.message).toBe(EXTENDED_ERROR_MESSAGES[ExtendedErrorType.ICE_CONNECTION_FAILED]);
      expect(error.recoverable).toBe(true);
      expect(error.details).toBeDefined();
      expect(error.details.extendedType).toBe(ExtendedErrorType.ICE_CONNECTION_FAILED);
      expect(error.details.recovery).toBe(EXTENDED_ERROR_RECOVERY[ExtendedErrorType.ICE_CONNECTION_FAILED]);
    });
    
    it('should include additional details', () => {
      const details = { code: 123, timestamp: Date.now() };
      const error = createError(ExtendedErrorType.DECRYPTION_FAILED, details);
      
      expect(error.details.code).toBe(details.code);
      expect(error.details.timestamp).toBe(details.timestamp);
    });
    
    it('should set recoverable flag correctly', () => {
      // Recoverable error
      expect(createError(ExtendedErrorType.PEER_DISCONNECTED).recoverable).toBe(true);
      
      // Non-recoverable error
      expect(createError(ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED).recoverable).toBe(false);
    });
  });
  
  describe('getRecoverySuggestion', () => {
    it('should get recovery suggestion for extended error type', () => {
      const suggestion = getRecoverySuggestion(ExtendedErrorType.ICE_CONNECTION_FAILED);
      
      expect(suggestion).toBe(EXTENDED_ERROR_RECOVERY[ExtendedErrorType.ICE_CONNECTION_FAILED]);
    });
    
    it('should get recovery suggestion for transfer error with extended type', () => {
      const error = createError(ExtendedErrorType.DECRYPTION_FAILED);
      const suggestion = getRecoverySuggestion(error);
      
      expect(suggestion).toBe(EXTENDED_ERROR_RECOVERY[ExtendedErrorType.DECRYPTION_FAILED]);
    });
    
    it('should get recovery suggestion for base error type', () => {
      const error: TransferError = {
        type: ErrorType.TIMEOUT,
        message: 'Connection timed out',
        recoverable: false
      };
      
      const suggestion = getRecoverySuggestion(error);
      
      expect(suggestion).toContain('timed out');
    });
  });
  
  describe('isRetryableError', () => {
    it('should identify retryable extended error types', () => {
      expect(isRetryableError(ExtendedErrorType.PEER_DISCONNECTED)).toBe(true);
      expect(isRetryableError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE)).toBe(true);
      expect(isRetryableError(ExtendedErrorType.FILE_READ_ERROR)).toBe(true);
      
      expect(isRetryableError(ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED)).toBe(false);
      expect(isRetryableError(ExtendedErrorType.INVALID_INPUT)).toBe(false);
    });
    
    it('should identify retryable transfer errors', () => {
      const retryableError = createError(ExtendedErrorType.PEER_DISCONNECTED);
      const nonRetryableError = createError(ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED);
      
      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });
  });
  
  describe('getRetryDelay', () => {
    it('should use exponential backoff', () => {
      const delay0 = getRetryDelay(ExtendedErrorType.PEER_DISCONNECTED, 0);
      const delay1 = getRetryDelay(ExtendedErrorType.PEER_DISCONNECTED, 1);
      const delay2 = getRetryDelay(ExtendedErrorType.PEER_DISCONNECTED, 2);
      
      // Allow for jitter
      expect(delay0).toBeGreaterThanOrEqual(800); // 1000 * 2^0 = 1000, minus up to 20% jitter
      expect(delay0).toBeLessThanOrEqual(1200); // 1000 * 2^0 = 1000, plus up to 20% jitter
      
      expect(delay1).toBeGreaterThanOrEqual(1600); // 1000 * 2^1 = 2000, minus up to 20% jitter
      expect(delay1).toBeLessThanOrEqual(2400); // 1000 * 2^1 = 2000, plus up to 20% jitter
      
      expect(delay2).toBeGreaterThanOrEqual(3200); // 1000 * 2^2 = 4000, minus up to 20% jitter
      expect(delay2).toBeLessThanOrEqual(4800); // 1000 * 2^2 = 4000, plus up to 20% jitter
    });
    
    it('should respect maximum delay', () => {
      const delay10 = getRetryDelay(ExtendedErrorType.PEER_DISCONNECTED, 10);
      
      // Maximum delay is 30000ms
      expect(delay10).toBeLessThanOrEqual(36000); // 30000 + 20% jitter
    });
  });
});