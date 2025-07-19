/**
 * Browser feature detection and support utilities
 * 
 * This module provides functions to detect browser support for required features
 * and provides fallback mechanisms when possible.
 */

export interface BrowserFeatureSupport {
  webrtc: boolean;
  webrtcDataChannel: boolean;
  webCrypto: boolean;
  webCryptoSubtle: boolean;
  indexedDB: boolean;
  fileSystem: boolean;
  serviceWorker: boolean;
  webWorker: boolean;
  localStorage: boolean;
  mediaDevices: boolean;
  fullSupport: boolean;
  partialSupport: boolean;
  missingFeatures: string[];
}

/**
 * Check if the browser supports all required features
 * 
 * @returns Object with support status for each feature
 */
export function checkBrowserSupport(): BrowserFeatureSupport {
  const support: BrowserFeatureSupport = {
    webrtc: false,
    webrtcDataChannel: false,
    webCrypto: false,
    webCryptoSubtle: false,
    indexedDB: false,
    fileSystem: false,
    serviceWorker: false,
    webWorker: false,
    localStorage: false,
    mediaDevices: false,
    fullSupport: false,
    partialSupport: false,
    missingFeatures: []
  };
  
  // Check WebRTC support
  support.webrtc = !!(
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection
  );
  
  // Check WebRTC DataChannel support
  if (support.webrtc) {
    try {
      const pc = new RTCPeerConnection();
      const dc = pc.createDataChannel('test');
      support.webrtcDataChannel = !!dc;
      pc.close();
    } catch (e) {
      support.webrtcDataChannel = false;
    }
  }
  
  // Check Web Crypto API support
  support.webCrypto = !!(window.crypto);
  support.webCryptoSubtle = !!(window.crypto && window.crypto.subtle);
  
  // Check IndexedDB support
  support.indexedDB = !!(
    window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB ||
    window.msIndexedDB
  );
  
  // Check File System API support
  support.fileSystem = !!(window.File && window.FileReader && window.FileList && window.Blob);
  
  // Check Service Worker support
  support.serviceWorker = 'serviceWorker' in navigator;
  
  // Check Web Worker support
  support.webWorker = !!window.Worker;
  
  // Check localStorage support
  try {
    const testKey = 'quickshare_test';
    localStorage.setItem(testKey, testKey);
    support.localStorage = localStorage.getItem(testKey) === testKey;
    localStorage.removeItem(testKey);
  } catch (e) {
    support.localStorage = false;
  }
  
  // Check MediaDevices support (for potential future use with camera/QR code scanning)
  support.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  
  // Determine overall support
  const criticalFeatures = ['webrtc', 'webrtcDataChannel', 'webCrypto', 'webCryptoSubtle', 'fileSystem'];
  const importantFeatures = ['localStorage', 'indexedDB'];
  
  // Check for missing critical features
  const missingCritical = criticalFeatures.filter(feature => !support[feature as keyof BrowserFeatureSupport]);
  const missingImportant = importantFeatures.filter(feature => !support[feature as keyof BrowserFeatureSupport]);
  
  support.missingFeatures = [...missingCritical, ...missingImportant];
  support.fullSupport = missingCritical.length === 0 && missingImportant.length === 0;
  support.partialSupport = missingCritical.length === 0 && missingImportant.length > 0;
  
  return support;
}

/**
 * Get a user-friendly message about browser support
 * 
 * @returns Object with support message and recommended browsers
 */
export function getBrowserSupportMessage(): { message: string; recommended: string } {
  const support = checkBrowserSupport();
  
  if (support.fullSupport) {
    return {
      message: "Your browser fully supports all features required for secure P2P file transfers.",
      recommended: ""
    };
  } else if (support.partialSupport) {
    return {
      message: "Your browser supports the core features needed for P2P file transfers, but some features like pause/resume may not work properly.",
      recommended: "For the best experience, we recommend using the latest version of Chrome, Firefox, Safari, or Edge."
    };
  } else {
    return {
      message: `Your browser doesn't support some critical features needed for P2P file transfers: ${support.missingFeatures.join(', ')}.`,
      recommended: "Please use the latest version of Chrome, Firefox, Safari, or Edge."
    };
  }
}

/**
 * Check if the browser supports a specific feature with fallback
 * 
 * @param feature Feature to check
 * @param fallback Fallback function to use if feature is not supported
 * @returns Function that uses the native feature or fallback
 */
export function withFallback<T extends Function>(feature: T | null | undefined, fallback: T): T {
  return feature || fallback;
}

/**
 * Get RTCPeerConnection constructor with vendor prefixes
 * 
 * @returns RTCPeerConnection constructor or null if not supported
 */
export function getRTCPeerConnection(): typeof RTCPeerConnection | null {
  return window.RTCPeerConnection || 
         (window as any).webkitRTCPeerConnection || 
         (window as any).mozRTCPeerConnection || 
         null;
}

/**
 * Get IndexedDB with vendor prefixes
 * 
 * @returns IndexedDB object or null if not supported
 */
export function getIndexedDB(): IDBFactory | null {
  return window.indexedDB || 
         (window as any).mozIndexedDB || 
         (window as any).webkitIndexedDB || 
         (window as any).msIndexedDB || 
         null;
}

/**
 * Check if the browser is running on a mobile device
 * 
 * @returns True if running on a mobile device, false otherwise
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get browser name and version
 * 
 * @returns Object with browser name and version
 */
export function getBrowserInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "Unknown";
  
  // Chrome
  if (/Chrome/.test(ua) && !/Chromium|Edge|Edg/.test(ua)) {
    name = "Chrome";
    version = ua.match(/Chrome\/(\d+\.\d+)/)![1];
  }
  // Firefox
  else if (/Firefox/.test(ua)) {
    name = "Firefox";
    version = ua.match(/Firefox\/(\d+\.\d+)/)![1];
  }
  // Safari
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    name = "Safari";
    version = ua.match(/Version\/(\d+\.\d+)/)![1];
  }
  // Edge (Chromium)
  else if (/Edg/.test(ua)) {
    name = "Edge";
    version = ua.match(/Edg\/(\d+\.\d+)/)![1];
  }
  // Edge (Legacy)
  else if (/Edge/.test(ua)) {
    name = "Edge (Legacy)";
    version = ua.match(/Edge\/(\d+\.\d+)/)![1];
  }
  // IE
  else if (/Trident/.test(ua)) {
    name = "Internet Explorer";
    version = ua.match(/rv:(\d+\.\d+)/)![1];
  }
  
  return { name, version };
}

/**
 * Check if the browser is supported for P2P file transfers
 * 
 * @returns True if the browser is supported, false otherwise
 */
export function isBrowserSupported(): boolean {
  const support = checkBrowserSupport();
  return support.fullSupport || support.partialSupport;
}