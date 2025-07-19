/**
 * Jest setup file for testing environment configuration
 */

import '@testing-library/jest-dom';

// Mock Web Crypto API
const mockWebCrypto = {
  subtle: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn(),
    deriveBits: jest.fn(),
    deriveKey: jest.fn(),
    importKey: jest.fn(),
    exportKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    digest: jest.fn(),
  },
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

// Mock WebRTC APIs
const mockRTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  addIceCandidate: jest.fn(),
  createDataChannel: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

const mockRTCDataChannel = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 'open',
}));

// Set up global mocks
Object.defineProperty(global, 'crypto', {
  value: mockWebCrypto,
  writable: true,
});

Object.defineProperty(global, 'RTCPeerConnection', {
  value: mockRTCPeerConnection,
  writable: true,
});

Object.defineProperty(global, 'RTCDataChannel', {
  value: mockRTCDataChannel,
  writable: true,
});

// Mock File API
Object.defineProperty(global, 'File', {
  value: class MockFile {
    name: string;
    size: number;
    type: string;
    lastModified: number;

    constructor(chunks: any[], filename: string, options: any = {}) {
      this.name = filename;
      this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  },
  writable: true,
});

// Mock Blob API
Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    size: number;
    type: string;

    constructor(chunks: any[] = [], options: any = {}) {
      this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      this.type = options.type || '';
    }
  },
  writable: true,
});

// Mock URL.createObjectURL
Object.defineProperty(global.URL, 'createObjectURL', {
  value: jest.fn(() => 'mock-object-url'),
  writable: true,
});

Object.defineProperty(global.URL, 'revokeObjectURL', {
  value: jest.fn(),
  writable: true,
});