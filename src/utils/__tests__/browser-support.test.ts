/**
 * Tests for browser-support utilities
 */

import {
  checkBrowserSupport,
  getBrowserSupportMessage,
  withFallback,
  getRTCPeerConnection,
  getIndexedDB,
  isMobileDevice,
  getBrowserInfo,
  isBrowserSupported
} from '../browser-support';

describe('Browser Support Utilities', () => {
  // Save original window properties
  const originalRTCPeerConnection = window.RTCPeerConnection;
  const originalCrypto = window.crypto;
  const originalIndexedDB = window.indexedDB;
  const originalLocalStorage = window.localStorage;
  const originalUserAgent = navigator.userAgent;
  
  // Mock browser features
  beforeEach(() => {
    // Mock RTCPeerConnection
    window.RTCPeerConnection = jest.fn().mockImplementation(() => ({
      createDataChannel: jest.fn().mockReturnValue({}),
      close: jest.fn()
    }));
    
    // Mock crypto
    Object.defineProperty(window, 'crypto', {
      value: {
        subtle: {},
        getRandomValues: jest.fn()
      },
      writable: true
    });
    
    // Mock IndexedDB
    Object.defineProperty(window, 'indexedDB', {
      value: {},
      writable: true
    });
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Mock navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      writable: true
    });
  });
  
  // Restore original window properties
  afterEach(() => {
    window.RTCPeerConnection = originalRTCPeerConnection;
    Object.defineProperty(window, 'crypto', { value: originalCrypto });
    Object.defineProperty(window, 'indexedDB', { value: originalIndexedDB });
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage });
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent });
  });
  
  describe('checkBrowserSupport', () => {
    it('should detect supported features', () => {
      const support = checkBrowserSupport();
      
      expect(support.webrtc).toBe(true);
      expect(support.webrtcDataChannel).toBe(true);
      expect(support.webCrypto).toBe(true);
      expect(support.webCryptoSubtle).toBe(true);
      expect(support.indexedDB).toBe(true);
      expect(support.fullSupport).toBe(true);
      expect(support.missingFeatures).toHaveLength(0);
    });
    
    it('should detect missing WebRTC support', () => {
      window.RTCPeerConnection = undefined as any;
      
      const support = checkBrowserSupport();
      
      expect(support.webrtc).toBe(false);
      expect(support.webrtcDataChannel).toBe(false);
      expect(support.fullSupport).toBe(false);
      expect(support.missingFeatures).toContain('webrtc');
    });
    
    it('should detect missing crypto support', () => {
      Object.defineProperty(window, 'crypto', { value: undefined });
      
      const support = checkBrowserSupport();
      
      expect(support.webCrypto).toBe(false);
      expect(support.webCryptoSubtle).toBe(false);
      expect(support.fullSupport).toBe(false);
      expect(support.missingFeatures).toContain('webCrypto');
    });
    
    it('should detect partial support', () => {
      // Remove localStorage support (important but not critical)
      Object.defineProperty(window, 'localStorage', { value: undefined });
      
      const support = checkBrowserSupport();
      
      expect(support.localStorage).toBe(false);
      expect(support.fullSupport).toBe(false);
      expect(support.partialSupport).toBe(true);
      expect(support.missingFeatures).toContain('localStorage');
    });
  });
  
  describe('getBrowserSupportMessage', () => {
    it('should return full support message when all features are supported', () => {
      const message = getBrowserSupportMessage();
      
      expect(message.message).toContain('fully supports');
      expect(message.recommended).toBe('');
    });
    
    it('should return partial support message when some features are missing', () => {
      // Remove localStorage support
      Object.defineProperty(window, 'localStorage', { value: undefined });
      
      const message = getBrowserSupportMessage();
      
      expect(message.message).toContain('core features');
      expect(message.recommended).toContain('recommend');
    });
    
    it('should return unsupported message when critical features are missing', () => {
      // Remove WebRTC support
      window.RTCPeerConnection = undefined as any;
      
      const message = getBrowserSupportMessage();
      
      expect(message.message).toContain('doesn\'t support');
      expect(message.recommended).toContain('Chrome, Firefox, Safari, or Edge');
    });
  });
  
  describe('withFallback', () => {
    it('should use the provided feature if available', () => {
      const feature = jest.fn();
      const fallback = jest.fn();
      
      const result = withFallback(feature, fallback);
      result();
      
      expect(feature).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });
    
    it('should use the fallback if feature is not available', () => {
      const feature = null;
      const fallback = jest.fn();
      
      const result = withFallback(feature, fallback);
      result();
      
      expect(fallback).toHaveBeenCalled();
    });
  });
  
  describe('getRTCPeerConnection', () => {
    it('should return RTCPeerConnection if available', () => {
      const result = getRTCPeerConnection();
      
      expect(result).toBe(window.RTCPeerConnection);
    });
    
    it('should return null if RTCPeerConnection is not available', () => {
      window.RTCPeerConnection = undefined as any;
      
      const result = getRTCPeerConnection();
      
      expect(result).toBeNull();
    });
  });
  
  describe('getIndexedDB', () => {
    it('should return IndexedDB if available', () => {
      const result = getIndexedDB();
      
      expect(result).toBe(window.indexedDB);
    });
    
    it('should return null if IndexedDB is not available', () => {
      Object.defineProperty(window, 'indexedDB', { value: undefined });
      
      const result = getIndexedDB();
      
      expect(result).toBeNull();
    });
  });
  
  describe('isMobileDevice', () => {
    it('should detect desktop devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      expect(isMobileDevice()).toBe(false);
    });
    
    it('should detect mobile devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      });
      
      expect(isMobileDevice()).toBe(true);
    });
  });
  
  describe('getBrowserInfo', () => {
    it('should detect Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      const info = getBrowserInfo();
      
      expect(info.name).toBe('Chrome');
      expect(info.version).toBe('91.0');
    });
    
    it('should detect Firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      });
      
      const info = getBrowserInfo();
      
      expect(info.name).toBe('Firefox');
      expect(info.version).toBe('89.0');
    });
    
    it('should detect Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
      });
      
      const info = getBrowserInfo();
      
      expect(info.name).toBe('Safari');
      expect(info.version).toBe('14.1');
    });
  });
  
  describe('isBrowserSupported', () => {
    it('should return true for supported browsers', () => {
      expect(isBrowserSupported()).toBe(true);
    });
    
    it('should return false for unsupported browsers', () => {
      // Remove WebRTC support
      window.RTCPeerConnection = undefined as any;
      
      expect(isBrowserSupported()).toBe(false);
    });
  });
});