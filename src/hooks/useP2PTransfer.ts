/**
 * React hook for P2P file transfers
 * 
 * This hook provides a complete interface for P2P file transfers,
 * integrating the P2P service with React state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { P2PService } from '../services';
import { TransferProgress, TransferError } from '../types/transfer';
import { ConnectionQuality } from '../types/p2p-engine';

export interface P2PEngineConfig {
  chunkSize?: number;
  maxParallelChannels?: number;
  connectionTimeout?: number;
  retryAttempts?: number;
  iceServers?: RTCIceServer[];
}

export interface P2PTransferState {
  status: 'idle' | 'connecting' | 'connected' | 'transferring' | 'paused' | 'completed' | 'error';
  shareCode: string | null;
  progress: TransferProgress | null;
  error: TransferError | null;
  connectionQuality: ConnectionQuality | null;
  isInitiator: boolean;
  receivedBlob?: Blob;
  fileMetadata?: {
    name: string;
    size: number;
    type: string;
  };
}

export interface UseP2PTransferOptions {
  config?: Partial<P2PEngineConfig>;
  autoConnect?: boolean;
}

export interface UseP2PTransferReturn {
  state: P2PTransferState;
  actions: {
    createRoom: (file: File) => Promise<string>;
    joinRoom: (code: string) => Promise<void>;
    startTransfer: () => Promise<void>;
    pauseTransfer: () => void;
    resumeTransfer: () => Promise<void>;
    cancelTransfer: () => void;
    disconnect: () => void;
  };
  isSupported: boolean;
}

const DEFAULT_CONFIG: P2PEngineConfig = {
  chunkSize: 64 * 1024, // 64KB chunks
  maxParallelChannels: 4,
  connectionTimeout: 30000, // 30 seconds
  retryAttempts: 3,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

/**
 * Hook for P2P file transfers
 */
export function useP2PTransfer(options: UseP2PTransferOptions = {}): UseP2PTransferReturn {
  const { config = {}, autoConnect = false } = options;
  
  const [state, setState] = useState<P2PTransferState>({
    status: 'idle',
    shareCode: null,
    progress: null,
    error: null,
    connectionQuality: null,
    isInitiator: false
  });

  const p2pServiceRef = useRef<P2PService | null>(null);
  const currentFileRef = useRef<File | null>(null);

  // Initialize P2P service
  useEffect(() => {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    p2pServiceRef.current = new P2PService(finalConfig);

    // Register event handlers
    p2pServiceRef.current.onProgress((progress) => {
      setState(prev => ({ ...prev, progress }));
    });

    p2pServiceRef.current.onComplete((file) => {
      // Store the received blob and update status
      setState(prev => ({ 
        ...prev, 
        status: 'completed',
        receivedBlob: file,
        fileMetadata: {
          name: currentFileRef.current?.name || 'received-file',
          size: file.size,
          type: file.type || 'application/octet-stream'
        }
      }));
    });

    p2pServiceRef.current.onError((error) => {
      setState(prev => ({ ...prev, status: 'error', error }));
    });

    return () => {
      if (p2pServiceRef.current) {
        p2pServiceRef.current.disconnect();
      }
    };
  }, [config]);

  // Create room for sending files
  const createRoom = useCallback(async (file: File): Promise<string> => {
    if (!p2pServiceRef.current) {
      throw new Error('P2P service not initialized');
    }

    try {
      setState(prev => ({ ...prev, status: 'connecting', error: null, isInitiator: true }));
      currentFileRef.current = file;
      
      const shareCode = await p2pServiceRef.current.createRoom(file);
      
      setState(prev => ({ 
        ...prev, 
        status: 'connected', 
        shareCode,
        progress: {
          bytesTransferred: 0,
          totalBytes: file.size,
          percentage: 0,
          speed: 0,
          eta: 0,
          chunksCompleted: 0,
          chunksTotal: 0
        }
      }));
      
      return shareCode;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error as TransferError 
      }));
      throw error;
    }
  }, []);

  // Join room for receiving files
  const joinRoom = useCallback(async (code: string): Promise<void> => {
    if (!p2pServiceRef.current) {
      throw new Error('P2P service not initialized');
    }

    try {
      setState(prev => ({ ...prev, status: 'connecting', error: null, isInitiator: false }));
      
      await p2pServiceRef.current.joinRoom(code);
      
      setState(prev => ({ 
        ...prev, 
        status: 'connected', 
        shareCode: code 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error as TransferError 
      }));
      throw error;
    }
  }, []);

  // Start file transfer
  const startTransfer = useCallback(async (): Promise<void> => {
    if (!p2pServiceRef.current) {
      throw new Error('P2P service not initialized');
    }

    try {
      setState(prev => ({ ...prev, status: 'transferring', error: null }));
      await p2pServiceRef.current.startTransfer();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error as TransferError 
      }));
      throw error;
    }
  }, []);

  // Pause transfer
  const pauseTransfer = useCallback((): void => {
    if (p2pServiceRef.current && state.status === 'transferring') {
      p2pServiceRef.current.pauseTransfer();
      setState(prev => ({ ...prev, status: 'paused' }));
    }
  }, [state.status]);

  // Resume transfer
  const resumeTransfer = useCallback(async (): Promise<void> => {
    if (!p2pServiceRef.current) {
      throw new Error('P2P service not initialized');
    }

    try {
      setState(prev => ({ ...prev, status: 'transferring', error: null }));
      await p2pServiceRef.current.resumeTransfer();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error as TransferError 
      }));
      throw error;
    }
  }, []);

  // Cancel transfer
  const cancelTransfer = useCallback((): void => {
    if (p2pServiceRef.current) {
      p2pServiceRef.current.cancelTransfer();
      setState(prev => ({ 
        ...prev, 
        status: 'idle', 
        progress: null, 
        error: null 
      }));
    }
  }, []);

  // Disconnect
  const disconnect = useCallback((): void => {
    if (p2pServiceRef.current) {
      p2pServiceRef.current.disconnect();
      setState({
        status: 'idle',
        shareCode: null,
        progress: null,
        error: null,
        connectionQuality: null,
        isInitiator: false
      });
    }
  }, []);

  // Check if P2P is supported
  const isSupported = P2PService.isSupported();

  return {
    state,
    actions: {
      createRoom,
      joinRoom,
      startTransfer,
      pauseTransfer,
      resumeTransfer,
      cancelTransfer,
      disconnect
    },
    isSupported
  };
}

/**
 * Utility function to download a file
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}