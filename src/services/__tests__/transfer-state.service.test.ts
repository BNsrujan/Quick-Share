/**
 * Unit tests for TransferStateService
 */

import { TransferStateService, TransferStateError } from '../transfer-state.service';
import { TransferState, TransferStatus, ErrorType } from '../../types/transfer';
import { ConnectionQuality } from '../../types/p2p-engine';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('TransferStateService', () => {
  let service: TransferStateService;
  
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    service = new TransferStateService();
  });
  
  afterEach(() => {
    service.dispose();
  });

  describe('Transfer Creation', () => {
    it('should create a new transfer with correct initial state', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      
      const state = service.createTransfer(file, 'sender');
      
      expect(state.id).toBeDefined();
      expect(state.status).toBe('idle');
      expect(state.file).toEqual(file);
      expect(state.progress.bytesTransferred).toBe(0);
      expect(state.progress.totalBytes).toBe(1024);
      expect(state.progress.percentage).toBe(0);
      expect(state.chunks.total).toBe(0);
      expect(state.chunks.completed).toEqual([]);
      expect(state.chunks.failed).toEqual([]);
      expect(state.chunks.inProgress).toEqual([]);
      expect(state.timestamps.created).toBeInstanceOf(Date);
    });
    
    it('should create transfer with share code for receiver', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      
      const state = service.createTransfer(file, 'receiver', 'SHARE123');
      
      expect(state.connection.peerId).toBe('SHARE123');
    });
    
    it('should persist transfer state to localStorage', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      
      service.createTransfer(file, 'sender');
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const setItemCalls = (localStorageMock.setItem as jest.Mock).mock.calls;
      expect(setItemCalls.some(call => call[0].startsWith('quickshare_transfer_'))).toBe(true);
    });
  });

  describe('Transfer Retrieval', () => {
    it('should retrieve transfer by ID', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      
      const state = service.createTransfer(file, 'sender');
      const retrieved = service.getTransfer(state.id);
      
      expect(retrieved).toEqual(state);
    });
    
    it('should return undefined for non-existent transfer', () => {
      const retrieved = service.getTransfer('non-existent');
      expect(retrieved).toBeUndefined();
    });
    
    it('should get all transfers', () => {
      const file1 = { name: 'test1.txt', size: 1024, type: 'text/plain', hash: 'abc123' };
      const file2 = { name: 'test2.txt', size: 2048, type: 'text/plain', hash: 'def456' };
      
      const state1 = service.createTransfer(file1, 'sender');
      const state2 = service.createTransfer(file2, 'receiver');
      
      const allTransfers = service.getAllTransfers();
      
      expect(allTransfers).toHaveLength(2);
      expect(allTransfers.find(t => t.id === state1.id)).toBeDefined();
      expect(allTransfers.find(t => t.id === state2.id)).toBeDefined();
    });
  });

  describe('Transfer Updates', () => {
    let transferId: string;
    
    beforeEach(() => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      const state = service.createTransfer(file, 'sender');
      transferId = state.id;
    });
    
    it('should update transfer state', () => {
      const updates = {
        status: 'connecting' as TransferStatus,
        progress: {
          bytesTransferred: 512,
          percentage: 50
        }
      };
      
      const updatedState = service.updateTransfer(transferId, updates);
      
      expect(updatedState.status).toBe('connecting');
      expect(updatedState.progress.bytesTransferred).toBe(512);
      expect(updatedState.progress.percentage).toBe(50);
    });
    
    it('should throw error for non-existent transfer', () => {
      expect(() => {
        service.updateTransfer('non-existent', { status: 'connecting' });
      }).toThrow(TransferStateError);
    });
    
    it('should update progress', () => {
      service.updateProgress(transferId, {
        bytesTransferred: 256,
        speed: 1024
      });
      
      const state = service.getTransfer(transferId);
      expect(state?.progress.bytesTransferred).toBe(256);
      expect(state?.progress.speed).toBe(1024);
      expect(state?.progress.percentage).toBe(25); // Auto-calculated
    });
    
    it('should update status with timestamps', () => {
      service.updateStatus(transferId, 'transferring');
      
      const state = service.getTransfer(transferId);
      expect(state?.status).toBe('transferring');
      expect(state?.timestamps.started).toBeInstanceOf(Date);
    });
    
    it('should update connection quality', () => {
      const quality: ConnectionQuality = {
        rtt: 50,
        bandwidth: 1000000,
        packetLoss: 0.1,
        quality: 'excellent'
      };
      
      service.updateConnectionQuality(transferId, quality);
      
      const state = service.getTransfer(transferId);
      expect(state?.connection.quality).toBe('excellent');
    });
    
    it('should update chunk status', () => {
      // First set total chunks
      service.updateTransfer(transferId, {
        chunks: { total: 10, completed: [], failed: [], inProgress: [] }
      });
      
      service.updateChunkStatus(transferId, 0, 'completed');
      service.updateChunkStatus(transferId, 1, 'in_progress');
      service.updateChunkStatus(transferId, 2, 'failed');
      
      const state = service.getTransfer(transferId);
      expect(state?.chunks.completed).toContain(0);
      expect(state?.chunks.inProgress).toContain(1);
      expect(state?.chunks.failed).toContain(2);
    });
  });

  describe('Transfer Control', () => {
    let transferId: string;
    
    beforeEach(() => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      const state = service.createTransfer(file, 'sender');
      transferId = state.id;
    });
    
    it('should pause transfer', () => {
      service.pauseTransfer(transferId);
      
      const state = service.getTransfer(transferId);
      expect(state?.status).toBe('paused');
      expect(state?.timestamps.paused).toBeInstanceOf(Date);
    });
    
    it('should resume paused transfer', () => {
      service.pauseTransfer(transferId);
      service.resumeTransfer(transferId);
      
      const state = service.getTransfer(transferId);
      expect(state?.status).toBe('connecting');
    });
    
    it('should not resume non-paused transfer', () => {
      service.updateStatus(transferId, 'transferring');
      service.resumeTransfer(transferId);
      
      const state = service.getTransfer(transferId);
      expect(state?.status).toBe('transferring'); // Should remain unchanged
    });
    
    it('should cancel transfer', () => {
      service.cancelTransfer(transferId);
      
      const state = service.getTransfer(transferId);
      expect(state).toBeUndefined();
      
      // Should also remove from localStorage
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    let transferId: string;
    let eventHandlers: any;
    
    beforeEach(() => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      const state = service.createTransfer(file, 'sender');
      transferId = state.id;
      
      eventHandlers = {
        onStateChange: jest.fn(),
        onProgressUpdate: jest.fn(),
        onStatusChange: jest.fn(),
        onError: jest.fn(),
        onTransferComplete: jest.fn(),
        onTransferPaused: jest.fn(),
        onTransferResumed: jest.fn()
      };
      
      service.registerEventHandlers(eventHandlers);
    });
    
    it('should trigger status change events', () => {
      service.updateStatus(transferId, 'completed');
      
      expect(eventHandlers.onStatusChange).toHaveBeenCalledWith('completed', transferId);
      expect(eventHandlers.onTransferComplete).toHaveBeenCalledWith(transferId);
    });
    
    it('should trigger pause event', () => {
      service.pauseTransfer(transferId);
      
      expect(eventHandlers.onTransferPaused).toHaveBeenCalledWith(transferId);
    });
    
    it('should trigger resume event', () => {
      service.pauseTransfer(transferId);
      service.resumeTransfer(transferId);
      
      expect(eventHandlers.onTransferResumed).toHaveBeenCalledWith(transferId);
    });
    
    it('should trigger error event', () => {
      const error = {
        type: ErrorType.CONNECTION_FAILED,
        message: 'Connection failed',
        recoverable: true
      };
      
      service.updateStatus(transferId, 'error', error);
      
      expect(eventHandlers.onError).toHaveBeenCalledWith(error, transferId);
    });
    
    it('should trigger progress update events', () => {
      service.updateProgress(transferId, { bytesTransferred: 512 });
      
      expect(eventHandlers.onProgressUpdate).toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should load persisted states on initialization', () => {
      // Setup persisted state in localStorage
      const persistedState = {
        state: {
          id: 'test-transfer',
          status: 'paused',
          file: { name: 'test.txt', size: 1024, type: 'text/plain', hash: 'abc123' },
          progress: { bytesTransferred: 512, totalBytes: 1024, percentage: 50, speed: 0, eta: 0 },
          chunks: { total: 10, completed: [0, 1], failed: [], inProgress: [2] },
          connection: { peerId: '', channels: [], quality: 'good' },
          encryption: { keyId: '', algorithm: 'AES-256-GCM' },
          timestamps: { created: new Date().toISOString() }
        },
        timestamp: Date.now(),
        version: '1.0.0'
      };
      
      localStorageMock.setItem('quickshare_transfer_test-transfer', JSON.stringify(persistedState));
      
      // Create new service instance
      const newService = new TransferStateService();
      
      const loadedTransfer = newService.getTransfer('test-transfer');
      expect(loadedTransfer).toBeDefined();
      expect(loadedTransfer?.status).toBe('paused');
      expect(loadedTransfer?.progress.bytesTransferred).toBe(512);
      
      newService.dispose();
    });
    
    it('should ignore invalid persisted states', () => {
      // Setup invalid persisted state
      localStorageMock.setItem('quickshare_transfer_invalid', 'invalid-json');
      
      // Should not throw error
      const newService = new TransferStateService();
      expect(newService.getAllTransfers()).toHaveLength(0);
      
      newService.dispose();
    });
    
    it('should ignore old persisted states', () => {
      // Setup old persisted state (older than 24 hours)
      const oldState = {
        state: {
          id: 'old-transfer',
          status: 'paused',
          file: { name: 'test.txt', size: 1024, type: 'text/plain', hash: 'abc123' },
          progress: { bytesTransferred: 0, totalBytes: 1024, percentage: 0, speed: 0, eta: 0 },
          chunks: { total: 0, completed: [], failed: [], inProgress: [] },
          connection: { peerId: '', channels: [], quality: 'good' },
          encryption: { keyId: '', algorithm: 'AES-256-GCM' },
          timestamps: { created: new Date().toISOString() }
        },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        version: '1.0.0'
      };
      
      localStorageMock.setItem('quickshare_transfer_old-transfer', JSON.stringify(oldState));
      
      const newService = new TransferStateService();
      expect(newService.getTransfer('old-transfer')).toBeUndefined();
      
      newService.dispose();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Create multiple transfers with different statuses
      const files = [
        { name: 'file1.txt', size: 1024, type: 'text/plain', hash: 'hash1' },
        { name: 'file2.txt', size: 2048, type: 'text/plain', hash: 'hash2' },
        { name: 'file3.txt', size: 4096, type: 'text/plain', hash: 'hash3' },
        { name: 'file4.txt', size: 8192, type: 'text/plain', hash: 'hash4' }
      ];
      
      const transfer1 = service.createTransfer(files[0], 'sender');
      const transfer2 = service.createTransfer(files[1], 'sender');
      const transfer3 = service.createTransfer(files[2], 'sender');
      const transfer4 = service.createTransfer(files[3], 'sender');
      
      service.updateStatus(transfer1.id, 'transferring');
      service.updateStatus(transfer2.id, 'completed');
      service.updateStatus(transfer3.id, 'error');
      service.updateStatus(transfer4.id, 'paused');
      
      service.updateProgress(transfer1.id, { bytesTransferred: 512 });
      service.updateProgress(transfer2.id, { bytesTransferred: 2048 });
      service.updateProgress(transfer4.id, { bytesTransferred: 1024 });
    });
    
    it('should calculate correct statistics', () => {
      const stats = service.getStatistics();
      
      expect(stats.activeTransfers).toBe(2); // transferring + paused
      expect(stats.completedTransfers).toBe(1);
      expect(stats.failedTransfers).toBe(1);
      expect(stats.totalBytesTransferred).toBe(3584); // 512 + 2048 + 1024
    });
  });

  describe('Storage Management', () => {
    it('should check storage availability', () => {
      expect(TransferStateService.isStorageAvailable()).toBe(true);
    });
    
    it('should get storage usage information', () => {
      // Create a transfer to have some storage usage
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      service.createTransfer(file, 'sender');
      
      const usage = service.getStorageUsage();
      
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.available).toBeGreaterThan(0);
      expect(usage.percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Utility Functions', () => {
    it('should export transfer state', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      const state = service.createTransfer(file, 'sender');
      
      const exported = service.exportState(state.id);
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported!);
      expect(parsed.id).toBe(state.id);
    });
    
    it('should return null for non-existent transfer export', () => {
      const exported = service.exportState('non-existent');
      expect(exported).toBeNull();
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should dispose properly', () => {
      const file = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        hash: 'abc123'
      };
      service.createTransfer(file, 'sender');
      
      service.dispose();
      
      expect(service.getAllTransfers()).toHaveLength(0);
    });
  });
});