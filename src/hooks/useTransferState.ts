/**
 * React hook for transfer state management
 * 
 * This hook provides a React-friendly interface to the transfer state service
 * with automatic state updates and lifecycle management.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { TransferStateService, TransferStateEvents } from '../services/transfer-state.service';
import { TransferState, TransferStatus, TransferError } from '../types/transfer';
import { TransferProgress } from '../types/chunk';
import { ConnectionQuality } from '../types/p2p-engine';

export interface UseTransferStateOptions {
  autoCleanup?: boolean;
  persistState?: boolean;
}

export interface TransferStateHook {
  // State management
  transfers: TransferState[];
  activeTransfer: TransferState | null;
  
  // Actions
  createTransfer: (
    file: { name: string; size: number; type: string; hash: string },
    role: 'sender' | 'receiver',
    shareCode?: string
  ) => string;
  updateProgress: (transferId: string, progress: Partial<TransferProgress>) => void;
  updateStatus: (transferId: string, status: TransferStatus, error?: TransferError) => void;
  updateConnectionQuality: (transferId: string, quality: ConnectionQuality) => void;
  updateChunkStatus: (transferId: string, chunkId: number, status: 'completed' | 'failed' | 'in_progress') => void;
  pauseTransfer: (transferId: string) => void;
  resumeTransfer: (transferId: string) => void;
  cancelTransfer: (transferId: string) => void;
  setActiveTransfer: (transferId: string | null) => void;
  
  // Utilities
  getTransfer: (transferId: string) => TransferState | undefined;
  getStatistics: () => {
    activeTransfers: number;
    completedTransfers: number;
    failedTransfers: number;
    totalBytesTransferred: number;
  };
  exportState: (transferId: string) => string | null;
  
  // State
  isLoading: boolean;
  error: TransferError | null;
}

/**
 * Hook for managing transfer state
 * 
 * @param options Configuration options
 * @returns Transfer state hook interface
 */
export function useTransferState(options: UseTransferStateOptions = {}): TransferStateHook {
  const { autoCleanup = true, persistState = true } = options;
  
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TransferError | null>(null);
  
  const serviceRef = useRef<TransferStateService | null>(null);
  
  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new TransferStateService();
      
      // Register event handlers
      const eventHandlers: TransferStateEvents = {
        onStateChange: (state) => {
          setTransfers(prev => {
            const index = prev.findIndex(t => t.id === state.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = state;
              return updated;
            } else {
              return [...prev, state];
            }
          });
        },
        
        onProgressUpdate: (progress) => {
          // Progress updates are handled through onStateChange
        },
        
        onStatusChange: (status, transferId) => {
          // Status changes are handled through onStateChange
        },
        
        onError: (transferError, transferId) => {
          setError(transferError);
        },
        
        onTransferComplete: (transferId) => {
          if (autoCleanup) {
            // Auto-cleanup completed transfers after a delay
            setTimeout(() => {
              if (serviceRef.current) {
                const transfer = serviceRef.current.getTransfer(transferId);
                if (transfer && transfer.status === 'completed') {
                  serviceRef.current.cancelTransfer(transferId);
                  setTransfers(prev => prev.filter(t => t.id !== transferId));
                  
                  if (activeTransferId === transferId) {
                    setActiveTransferId(null);
                  }
                }
              }
            }, 30000); // 30 seconds delay
          }
        },
        
        onTransferPaused: (transferId) => {
          // Handled through onStateChange
        },
        
        onTransferResumed: (transferId) => {
          // Handled through onStateChange
        }
      };
      
      serviceRef.current.registerEventHandlers(eventHandlers);
      
      // Load initial state
      const initialTransfers = serviceRef.current.getAllTransfers();
      setTransfers(initialTransfers);
      setIsLoading(false);
    }
    
    return () => {
      if (serviceRef.current && autoCleanup) {
        serviceRef.current.dispose();
        serviceRef.current = null;
      }
    };
  }, [autoCleanup]);
  
  // Actions
  const createTransfer = useCallback((
    file: { name: string; size: number; type: string; hash: string },
    role: 'sender' | 'receiver',
    shareCode?: string
  ): string => {
    if (!serviceRef.current) {
      throw new Error('Transfer state service not initialized');
    }
    
    const state = serviceRef.current.createTransfer(file, role, shareCode);
    return state.id;
  }, []);
  
  const updateProgress = useCallback((transferId: string, progress: Partial<TransferProgress>) => {
    if (serviceRef.current) {
      serviceRef.current.updateProgress(transferId, progress);
    }
  }, []);
  
  const updateStatus = useCallback((transferId: string, status: TransferStatus, transferError?: TransferError) => {
    if (serviceRef.current) {
      serviceRef.current.updateStatus(transferId, status, transferError);
    }
  }, []);
  
  const updateConnectionQuality = useCallback((transferId: string, quality: ConnectionQuality) => {
    if (serviceRef.current) {
      serviceRef.current.updateConnectionQuality(transferId, quality);
    }
  }, []);
  
  const updateChunkStatus = useCallback((
    transferId: string, 
    chunkId: number, 
    status: 'completed' | 'failed' | 'in_progress'
  ) => {
    if (serviceRef.current) {
      serviceRef.current.updateChunkStatus(transferId, chunkId, status);
    }
  }, []);
  
  const pauseTransfer = useCallback((transferId: string) => {
    if (serviceRef.current) {
      serviceRef.current.pauseTransfer(transferId);
    }
  }, []);
  
  const resumeTransfer = useCallback((transferId: string) => {
    if (serviceRef.current) {
      serviceRef.current.resumeTransfer(transferId);
    }
  }, []);
  
  const cancelTransfer = useCallback((transferId: string) => {
    if (serviceRef.current) {
      serviceRef.current.cancelTransfer(transferId);
      setTransfers(prev => prev.filter(t => t.id !== transferId));
      
      if (activeTransferId === transferId) {
        setActiveTransferId(null);
      }
    }
  }, [activeTransferId]);
  
  const setActiveTransfer = useCallback((transferId: string | null) => {
    setActiveTransferId(transferId);
  }, []);
  
  const getTransfer = useCallback((transferId: string): TransferState | undefined => {
    if (serviceRef.current) {
      return serviceRef.current.getTransfer(transferId);
    }
    return undefined;
  }, []);
  
  const getStatistics = useCallback(() => {
    if (serviceRef.current) {
      return serviceRef.current.getStatistics();
    }
    return {
      activeTransfers: 0,
      completedTransfers: 0,
      failedTransfers: 0,
      totalBytesTransferred: 0
    };
  }, []);
  
  const exportState = useCallback((transferId: string): string | null => {
    if (serviceRef.current) {
      return serviceRef.current.exportState(transferId);
    }
    return null;
  }, []);
  
  // Computed values
  const activeTransfer = activeTransferId ? transfers.find(t => t.id === activeTransferId) || null : null;
  
  return {
    transfers,
    activeTransfer,
    createTransfer,
    updateProgress,
    updateStatus,
    updateConnectionQuality,
    updateChunkStatus,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    setActiveTransfer,
    getTransfer,
    getStatistics,
    exportState,
    isLoading,
    error
  };
}

/**
 * Hook for managing a single transfer
 * 
 * @param transferId Transfer identifier
 * @returns Single transfer state and actions
 */
export function useSingleTransfer(transferId: string | null) {
  const {
    getTransfer,
    updateProgress,
    updateStatus,
    updateConnectionQuality,
    updateChunkStatus,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    exportState
  } = useTransferState();
  
  const [transfer, setTransfer] = useState<TransferState | null>(null);
  
  useEffect(() => {
    if (transferId) {
      const currentTransfer = getTransfer(transferId);
      setTransfer(currentTransfer || null);
    } else {
      setTransfer(null);
    }
  }, [transferId, getTransfer]);
  
  const actions = {
    updateProgress: useCallback((progress: Partial<TransferProgress>) => {
      if (transferId) {
        updateProgress(transferId, progress);
      }
    }, [transferId, updateProgress]),
    
    updateStatus: useCallback((status: TransferStatus, error?: TransferError) => {
      if (transferId) {
        updateStatus(transferId, status, error);
      }
    }, [transferId, updateStatus]),
    
    updateConnectionQuality: useCallback((quality: ConnectionQuality) => {
      if (transferId) {
        updateConnectionQuality(transferId, quality);
      }
    }, [transferId, updateConnectionQuality]),
    
    updateChunkStatus: useCallback((chunkId: number, status: 'completed' | 'failed' | 'in_progress') => {
      if (transferId) {
        updateChunkStatus(transferId, chunkId, status);
      }
    }, [transferId, updateChunkStatus]),
    
    pause: useCallback(() => {
      if (transferId) {
        pauseTransfer(transferId);
      }
    }, [transferId, pauseTransfer]),
    
    resume: useCallback(() => {
      if (transferId) {
        resumeTransfer(transferId);
      }
    }, [transferId, resumeTransfer]),
    
    cancel: useCallback(() => {
      if (transferId) {
        cancelTransfer(transferId);
      }
    }, [transferId, cancelTransfer]),
    
    exportState: useCallback(() => {
      if (transferId) {
        return exportState(transferId);
      }
      return null;
    }, [transferId, exportState])
  };
  
  return {
    transfer,
    ...actions
  };
}

/**
 * Hook for transfer statistics and monitoring
 * 
 * @returns Transfer statistics and monitoring data
 */
export function useTransferStatistics() {
  const { getStatistics, transfers } = useTransferState();
  const [stats, setStats] = useState(getStatistics());
  
  useEffect(() => {
    const updateStats = () => {
      setStats(getStatistics());
    };
    
    // Update stats when transfers change
    updateStats();
    
    // Set up periodic updates
    const interval = setInterval(updateStats, 1000);
    
    return () => clearInterval(interval);
  }, [transfers, getStatistics]);
  
  return stats;
}