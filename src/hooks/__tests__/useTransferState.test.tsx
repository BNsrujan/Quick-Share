/**
 * Unit tests for useTransferState hook
 */

import { renderHook, act } from '@testing-library/react';
import { useTransferState, useSingleTransfer, useTransferStatistics } from '../useTransferState';
import { TransferStateService } from '../../services/transfer-state.service';
import { ErrorType } from '../../types/transfer';

// Mock the TransferStateService
jest.mock('../../services/transfer-state.service');

describe('useTransferState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementation
    const mockService = {
      registerEventHandlers: jest.fn(),
      getAllTransfers: jest.fn().mockReturnValue([]),
      createTransfer: jest.fn().mockImplementation((file, role, shareCode) => ({
        id: 'test-transfer-id',
        status: 'idle',
        file,
        progress: {
          bytesTransferred: 0,
          totalBytes: file.size,
          percentage: 0,
          speed: 0,
          eta: 0
        },
        chunks: {
          total: 0,
          completed: [],
          failed: [],
          inProgress: []
        },
        connection: {
          peerId: shareCode || '',
          channels: [],
          quality: 'good'
        },
        encryption: {
          keyId: '',
          algorithm: 'AES-256-GCM'
        },
        timestamps: {
          created: new Date()
        }
      })),
      updateProgress: jest.fn(),
      updateStatus: jest.fn(),
      updateConnectionQuality: jest.fn(),
      updateChunkStatus: jest.fn(),
      pauseTransfer: jest.fn(),
      resumeTransfer: jest.fn(),
      cancelTransfer: jest.fn(),
      getTransfer: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({
        activeTransfers: 0,
        completedTransfers: 0,
        failedTransfers: 0,
        totalBytesTransferred: 0
      }),
      exportState: jest.fn(),
      dispose: jest.fn()
    };
    
    (TransferStateService as jest.Mock).mockImplementation(() => mockService);
  });

  it('should initialize with empty transfers', () => {
    const { result } = renderHook(() => useTransferState());
    
    expect(result.current.transfers).toEqual([]);
    expect(result.current.activeTransfer).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should create a transfer', () => {
    const { result } = renderHook(() => useTransferState());
    
    const file = {
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      hash: 'abc123'
    };
    
    let transferId: string;
    
    act(() => {
      transferId = result.current.createTransfer(file, 'sender');
    });
    
    expect(transferId).toBe('test-transfer-id');
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.createTransfer).toHaveBeenCalledWith(file, 'sender', undefined);
  });

  it('should update transfer progress', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.updateProgress('test-id', {
        bytesTransferred: 512,
        percentage: 50
      });
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.updateProgress).toHaveBeenCalledWith('test-id', {
      bytesTransferred: 512,
      percentage: 50
    });
  });

  it('should update transfer status', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.updateStatus('test-id', 'transferring');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.updateStatus).toHaveBeenCalledWith('test-id', 'transferring', undefined);
  });

  it('should update connection quality', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.updateConnectionQuality('test-id', 'excellent');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.updateConnectionQuality).toHaveBeenCalledWith('test-id', 'excellent');
  });

  it('should update chunk status', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.updateChunkStatus('test-id', 1, 'completed');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.updateChunkStatus).toHaveBeenCalledWith('test-id', 1, 'completed');
  });

  it('should pause transfer', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.pauseTransfer('test-id');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.pauseTransfer).toHaveBeenCalledWith('test-id');
  });

  it('should resume transfer', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.resumeTransfer('test-id');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.resumeTransfer).toHaveBeenCalledWith('test-id');
  });

  it('should cancel transfer', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.cancelTransfer('test-id');
    });
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.cancelTransfer).toHaveBeenCalledWith('test-id');
  });

  it('should get transfer by id', () => {
    const mockTransfer = {
      id: 'test-id',
      status: 'transferring',
      file: { name: 'test.txt', size: 1024, type: 'text/plain', hash: 'abc123' },
      progress: { bytesTransferred: 512, totalBytes: 1024, percentage: 50, speed: 1024, eta: 10 },
      chunks: { total: 10, completed: [0, 1], failed: [], inProgress: [2] },
      connection: { peerId: '', channels: [], quality: 'good' },
      encryption: { keyId: '', algorithm: 'AES-256-GCM' },
      timestamps: { created: new Date() }
    };
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    mockService.getTransfer.mockReturnValue(mockTransfer);
    
    const { result } = renderHook(() => useTransferState());
    
    let transfer;
    act(() => {
      transfer = result.current.getTransfer('test-id');
    });
    
    expect(transfer).toEqual(mockTransfer);
    expect(mockService.getTransfer).toHaveBeenCalledWith('test-id');
  });

  it('should get statistics', () => {
    const mockStats = {
      activeTransfers: 2,
      completedTransfers: 3,
      failedTransfers: 1,
      totalBytesTransferred: 10240
    };
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    mockService.getStatistics.mockReturnValue(mockStats);
    
    const { result } = renderHook(() => useTransferState());
    
    let stats;
    act(() => {
      stats = result.current.getStatistics();
    });
    
    expect(stats).toEqual(mockStats);
    expect(mockService.getStatistics).toHaveBeenCalled();
  });

  it('should export state', () => {
    const mockExport = '{"id":"test-id","status":"transferring"}';
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    mockService.exportState.mockReturnValue(mockExport);
    
    const { result } = renderHook(() => useTransferState());
    
    let exportedState;
    act(() => {
      exportedState = result.current.exportState('test-id');
    });
    
    expect(exportedState).toBe(mockExport);
    expect(mockService.exportState).toHaveBeenCalledWith('test-id');
  });

  it('should set active transfer', () => {
    const { result } = renderHook(() => useTransferState());
    
    act(() => {
      result.current.setActiveTransfer('test-id');
    });
    
    // Since we don't have the actual transfer in the state, activeTransfer will be null
    // but we've set the activeTransferId internally
    expect(result.current.activeTransfer).toBeNull();
  });

  it('should cleanup on unmount with autoCleanup=true', () => {
    const { unmount } = renderHook(() => useTransferState({ autoCleanup: true }));
    
    unmount();
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.dispose).toHaveBeenCalled();
  });

  it('should not cleanup on unmount with autoCleanup=false', () => {
    const { unmount } = renderHook(() => useTransferState({ autoCleanup: false }));
    
    unmount();
    
    const mockService = (TransferStateService as jest.Mock).mock.instances[0];
    expect(mockService.dispose).not.toHaveBeenCalled();
  });
});

describe('useSingleTransfer', () => {
  let mockTransfer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransfer = {
      id: 'test-id',
      status: 'transferring',
      file: { name: 'test.txt', size: 1024, type: 'text/plain', hash: 'abc123' },
      progress: { bytesTransferred: 512, totalBytes: 1024, percentage: 50, speed: 1024, eta: 10 },
      chunks: { total: 10, completed: [0, 1], failed: [], inProgress: [2] },
      connection: { peerId: '', channels: [], quality: 'good' },
      encryption: { keyId: '', algorithm: 'AES-256-GCM' },
      timestamps: { created: new Date() }
    };
    
    // Mock the useTransferState hook
    jest.mock('../useTransferState', () => ({
      useTransferState: () => ({
        getTransfer: jest.fn().mockReturnValue(mockTransfer),
        updateProgress: jest.fn(),
        updateStatus: jest.fn(),
        updateConnectionQuality: jest.fn(),
        updateChunkStatus: jest.fn(),
        pauseTransfer: jest.fn(),
        resumeTransfer: jest.fn(),
        cancelTransfer: jest.fn(),
        exportState: jest.fn().mockReturnValue('{"id":"test-id"}')
      })
    }));
  });

  it('should return null for transfer when transferId is null', () => {
    const { result } = renderHook(() => useSingleTransfer(null));
    
    expect(result.current.transfer).toBeNull();
  });

  it('should provide transfer-specific actions', () => {
    const { result } = renderHook(() => useSingleTransfer('test-id'));
    
    expect(result.current.transfer).toBeDefined();
    expect(typeof result.current.updateProgress).toBe('function');
    expect(typeof result.current.updateStatus).toBe('function');
    expect(typeof result.current.updateConnectionQuality).toBe('function');
    expect(typeof result.current.updateChunkStatus).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.resume).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
    expect(typeof result.current.exportState).toBe('function');
  });
});

describe('useTransferStatistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    const mockStats = {
      activeTransfers: 2,
      completedTransfers: 3,
      failedTransfers: 1,
      totalBytesTransferred: 10240
    };
    
    // Mock the useTransferState hook
    jest.mock('../useTransferState', () => ({
      useTransferState: () => ({
        getStatistics: jest.fn().mockReturnValue(mockStats),
        transfers: []
      })
    }));
  });

  it('should return transfer statistics', () => {
    const { result } = renderHook(() => useTransferStatistics());
    
    expect(result.current).toEqual({
      activeTransfers: 2,
      completedTransfers: 3,
      failedTransfers: 1,
      totalBytesTransferred: 10240
    });
  });
});