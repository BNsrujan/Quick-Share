/**
 * Transfer state management and persistence service
 * 
 * This service provides centralized state management for file transfers with:
 * - Real-time state updates and progress tracking
 * - Browser storage persistence for pause/resume functionality
 * - State recovery for interrupted transfers
 * - Event-driven architecture for UI updates
 * - Memory-efficient state management
 */

import { TransferState, TransferStatus, TransferError, ErrorType } from '../types/transfer';
import { ChunkManifest, FileMetadata, TransferProgress } from '../types/chunk';
import { ConnectionQuality } from '../types/p2p-engine';

export interface TransferStateUpdate {
  id: string;
  updates: Partial<TransferState>;
  timestamp: number;
}

export interface PersistedTransferState {
  state: TransferState;
  manifest?: ChunkManifest;
  metadata?: FileMetadata;
  timestamp: number;
  version: string;
  recoveryData?: {
    lastChunkId?: number;
    retryCount?: number;
    connectionAttempts?: number;
    lastError?: string;
  };
}

export interface TransferStateEvents {
  onStateChange: (state: TransferState) => void;
  onProgressUpdate: (progress: TransferProgress) => void;
  onStatusChange: (status: TransferStatus, transferId: string) => void;
  onError: (error: TransferError, transferId: string) => void;
  onTransferComplete: (transferId: string) => void;
  onTransferPaused: (transferId: string) => void;
  onTransferResumed: (transferId: string) => void;
}

/**
 * Error thrown when transfer state operations fail
 */
export class TransferStateError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TransferStateError';
  }
}

export class TransferStateService {
  private static readonly STORAGE_KEY_PREFIX = 'quickshare_transfer_';
  private static readonly STATE_VERSION = '1.0.0';
  private static readonly MAX_STORED_TRANSFERS = 10;
  private static readonly STATE_CLEANUP_INTERVAL = 60000; // 1 minute
  private static readonly MAX_STATE_AGE = 24 * 60 * 60 * 1000; // 24 hours

  private activeTransfers = new Map<string, TransferState>();
  private eventHandlers: Partial<TransferStateEvents> = {};
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stateUpdateQueue: TransferStateUpdate[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.startCleanupInterval();
    this.loadPersistedStates();
  }

  /**
   * Create a new transfer state
   * 
   * @param file File metadata
   * @param role Transfer role (sender or receiver)
   * @param shareCode Optional share code for receivers
   * @returns Created transfer state
   */
  createTransfer(
    file: { name: string; size: number; type: string; hash: string },
    role: 'sender' | 'receiver',
    shareCode?: string
  ): TransferState {
    const transferId = this.generateTransferId();
    
    const state: TransferState = {
      id: transferId,
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
    };

    this.activeTransfers.set(transferId, state);
    this.persistState(transferId);
    this.notifyStateChange(state);

    return state;
  }

  /**
   * Get transfer state by ID
   * 
   * @param transferId Transfer identifier
   * @returns Transfer state if found, undefined otherwise
   */
  getTransfer(transferId: string): TransferState | undefined {
    return this.activeTransfers.get(transferId);
  }

  /**
   * Get all active transfers
   * 
   * @returns Array of all active transfer states
   */
  getAllTransfers(): TransferState[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * Update transfer state
   * 
   * @param transferId Transfer identifier
   * @param updates Partial state updates
   * @returns Updated transfer state
   */
  updateTransfer(transferId: string, updates: Partial<TransferState>): TransferState {
    const currentState = this.activeTransfers.get(transferId);
    
    if (!currentState) {
      throw new TransferStateError(
        `Transfer with ID ${transferId} not found`,
        'TRANSFER_NOT_FOUND'
      );
    }

    // Create updated state with deep merge
    const updatedState: TransferState = {
      ...currentState,
      ...updates,
      progress: { ...currentState.progress, ...updates.progress },
      chunks: { ...currentState.chunks, ...updates.chunks },
      connection: { ...currentState.connection, ...updates.connection },
      encryption: { ...currentState.encryption, ...updates.encryption },
      timestamps: { ...currentState.timestamps, ...updates.timestamps }
    };

    this.activeTransfers.set(transferId, updatedState);
    
    // Queue state update for processing
    this.queueStateUpdate({
      id: transferId,
      updates,
      timestamp: Date.now()
    });

    return updatedState;
  }

  /**
   * Update transfer progress
   * 
   * @param transferId Transfer identifier
   * @param progress Progress information
   */
  updateProgress(transferId: string, progress: Partial<TransferProgress>): void {
    const currentState = this.activeTransfers.get(transferId);
    
    if (!currentState) {
      return;
    }

    const updatedProgress = { ...currentState.progress, ...progress };
    
    // Calculate percentage if not provided
    if (updatedProgress.totalBytes > 0 && !progress.percentage) {
      updatedProgress.percentage = Math.round(
        (updatedProgress.bytesTransferred / updatedProgress.totalBytes) * 100
      );
    }

    this.updateTransfer(transferId, { progress: updatedProgress });
    
    // Notify progress update
    if (this.eventHandlers.onProgressUpdate) {
      this.eventHandlers.onProgressUpdate(updatedProgress);
    }
  }

  /**
   * Update transfer status
   * 
   * @param transferId Transfer identifier
   * @param status New transfer status
   * @param error Optional error information
   */
  updateStatus(transferId: string, status: TransferStatus, error?: TransferError): void {
    const currentState = this.activeTransfers.get(transferId);
    
    if (!currentState) {
      return;
    }

    const updates: Partial<TransferState> = { status };
    
    // Update timestamps based on status
    switch (status) {
      case 'connecting':
      case 'transferring':
        if (!currentState.timestamps.started) {
          updates.timestamps = { ...currentState.timestamps, started: new Date() };
        }
        break;
      case 'paused':
        updates.timestamps = { ...currentState.timestamps, paused: new Date() };
        break;
      case 'completed':
        updates.timestamps = { ...currentState.timestamps, completed: new Date() };
        break;
    }

    this.updateTransfer(transferId, updates);
    
    // Notify status change
    if (this.eventHandlers.onStatusChange) {
      this.eventHandlers.onStatusChange(status, transferId);
    }

    // Handle specific status events
    switch (status) {
      case 'completed':
        if (this.eventHandlers.onTransferComplete) {
          this.eventHandlers.onTransferComplete(transferId);
        }
        break;
      case 'paused':
        if (this.eventHandlers.onTransferPaused) {
          this.eventHandlers.onTransferPaused(transferId);
        }
        break;
      case 'error':
        if (error && this.eventHandlers.onError) {
          this.eventHandlers.onError(error, transferId);
        }
        break;
    }
  }

  /**
   * Update connection quality
   * 
   * @param transferId Transfer identifier
   * @param quality Connection quality information
   */
  updateConnectionQuality(transferId: string, quality: ConnectionQuality): void {
    this.updateTransfer(transferId, {
      connection: {
        ...this.activeTransfers.get(transferId)?.connection,
        quality: quality.quality
      } as any
    });
  }

  /**
   * Update chunk progress
   * 
   * @param transferId Transfer identifier
   * @param chunkId Chunk identifier
   * @param status Chunk status
   */
  updateChunkStatus(transferId: string, chunkId: number, status: 'completed' | 'failed' | 'in_progress'): void {
    const currentState = this.activeTransfers.get(transferId);
    
    if (!currentState) {
      return;
    }

    const chunks = { ...currentState.chunks };
    
    // Remove chunk from all status arrays
    chunks.completed = chunks.completed.filter(id => id !== chunkId);
    chunks.failed = chunks.failed.filter(id => id !== chunkId);
    chunks.inProgress = chunks.inProgress.filter(id => id !== chunkId);
    
    // Add to appropriate status array
    switch (status) {
      case 'completed':
        chunks.completed.push(chunkId);
        break;
      case 'failed':
        chunks.failed.push(chunkId);
        break;
      case 'in_progress':
        chunks.inProgress.push(chunkId);
        break;
    }

    this.updateTransfer(transferId, { chunks });
  }

  /**
   * Pause a transfer
   * 
   * @param transferId Transfer identifier
   */
  pauseTransfer(transferId: string): void {
    this.updateStatus(transferId, 'paused');
  }

  /**
   * Resume a transfer
   * 
   * @param transferId Transfer identifier
   */
  resumeTransfer(transferId: string): void {
    const currentState = this.activeTransfers.get(transferId);
    
    if (!currentState || currentState.status !== 'paused') {
      return;
    }

    this.updateStatus(transferId, 'connecting');
    
    // Update recovery data to track resume attempts
    const storageKey = `${TransferStateService.STORAGE_KEY_PREFIX}${transferId}`;
    try {
      const serialized = localStorage.getItem(storageKey);
      if (serialized) {
        const persistedState: PersistedTransferState = JSON.parse(serialized);
        const recoveryData = persistedState.recoveryData || {};
        
        this.persistState(transferId, {
          recoveryData: {
            ...recoveryData,
            connectionAttempts: (recoveryData.connectionAttempts || 0) + 1,
            lastChunkId: currentState.chunks.completed.length > 0 ? 
              Math.max(...currentState.chunks.completed) : undefined
          }
        });
      }
    } catch (error) {
      console.warn('Failed to update recovery data:', error);
    }
    
    if (this.eventHandlers.onTransferResumed) {
      this.eventHandlers.onTransferResumed(transferId);
    }
  }

  /**
   * Cancel and remove a transfer
   * 
   * @param transferId Transfer identifier
   */
  cancelTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);
    this.removePersistedState(transferId);
  }

  /**
   * Persist transfer state to browser storage
   * 
   * @param transferId Transfer identifier
   * @param additionalData Optional additional data to persist with the state
   */
  private persistState(transferId: string, additionalData?: { 
    manifest?: ChunkManifest;
    metadata?: FileMetadata;
    recoveryData?: PersistedTransferState['recoveryData'];
  }): void {
    const state = this.activeTransfers.get(transferId);
    
    if (!state) {
      return;
    }

    try {
      // Get existing persisted state if available
      const storageKey = `${TransferStateService.STORAGE_KEY_PREFIX}${transferId}`;
      let existingData: Partial<PersistedTransferState> = {};
      
      try {
        const existingJson = localStorage.getItem(storageKey);
        if (existingJson) {
          existingData = JSON.parse(existingJson);
        }
      } catch (e) {
        // Ignore parsing errors for existing data
      }
      
      const persistedState: PersistedTransferState = {
        state,
        timestamp: Date.now(),
        version: TransferStateService.STATE_VERSION,
        // Preserve existing data if not provided in additionalData
        manifest: additionalData?.manifest || existingData.manifest,
        metadata: additionalData?.metadata || existingData.metadata,
        recoveryData: additionalData?.recoveryData || existingData.recoveryData
      };

      localStorage.setItem(storageKey, JSON.stringify(persistedState));
      
      // Cleanup old states if we exceed the limit
      this.cleanupOldStates();
    } catch (error) {
      console.warn('Failed to persist transfer state:', error);
    }
  }

  /**
   * Load persisted states from browser storage
   */
  private loadPersistedStates(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(TransferStateService.STORAGE_KEY_PREFIX)
      );

      for (const key of keys) {
        try {
          const serialized = localStorage.getItem(key);
          if (!serialized) continue;

          const persistedState: PersistedTransferState = JSON.parse(serialized);
          
          // Validate state version and age
          if (this.isValidPersistedState(persistedState)) {
            // Convert timestamps back to Date objects
            const state = this.deserializeState(persistedState.state);
            this.activeTransfers.set(state.id, state);
          } else {
            // Remove invalid or old state
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.warn(`Failed to load persisted state from ${key}:`, error);
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted states:', error);
    }
  }

  /**
   * Remove persisted state from storage
   * 
   * @param transferId Transfer identifier
   */
  private removePersistedState(transferId: string): void {
    const storageKey = `${TransferStateService.STORAGE_KEY_PREFIX}${transferId}`;
    localStorage.removeItem(storageKey);
  }

  /**
   * Validate persisted state
   * 
   * @param persistedState Persisted state to validate
   * @returns True if state is valid, false otherwise
   */
  private isValidPersistedState(persistedState: PersistedTransferState): boolean {
    // Check version compatibility
    if (persistedState.version !== TransferStateService.STATE_VERSION) {
      return false;
    }

    // Check age
    const age = Date.now() - persistedState.timestamp;
    if (age > TransferStateService.MAX_STATE_AGE) {
      return false;
    }

    // Check required fields
    if (!persistedState.state || !persistedState.state.id) {
      return false;
    }

    return true;
  }

  /**
   * Deserialize state from storage format
   * 
   * @param serializedState Serialized state
   * @returns Deserialized transfer state
   */
  private deserializeState(serializedState: TransferState): TransferState {
    return {
      ...serializedState,
      timestamps: {
        created: new Date(serializedState.timestamps.created),
        started: serializedState.timestamps.started ? new Date(serializedState.timestamps.started) : undefined,
        paused: serializedState.timestamps.paused ? new Date(serializedState.timestamps.paused) : undefined,
        completed: serializedState.timestamps.completed ? new Date(serializedState.timestamps.completed) : undefined
      }
    };
  }

  /**
   * Queue state update for batch processing
   * 
   * @param update State update to queue
   */
  private queueStateUpdate(update: TransferStateUpdate): void {
    this.stateUpdateQueue.push(update);
    
    if (!this.isProcessingQueue) {
      this.processStateUpdateQueue();
    }
  }

  /**
   * Process queued state updates
   */
  private async processStateUpdateQueue(): Promise<void> {
    if (this.isProcessingQueue || this.stateUpdateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.stateUpdateQueue.length > 0) {
        const update = this.stateUpdateQueue.shift()!;
        
        // Persist state
        this.persistState(update.id);
        
        // Notify state change
        const state = this.activeTransfers.get(update.id);
        if (state) {
          this.notifyStateChange(state);
        }
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Notify state change to event handlers
   * 
   * @param state Updated transfer state
   */
  private notifyStateChange(state: TransferState): void {
    if (this.eventHandlers.onStateChange) {
      this.eventHandlers.onStateChange(state);
    }
  }

  /**
   * Generate unique transfer ID
   * 
   * @returns Unique transfer identifier
   */
  private generateTransferId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `transfer_${timestamp}_${random}`;
  }

  /**
   * Start cleanup interval for old states
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldStates();
    }, TransferStateService.STATE_CLEANUP_INTERVAL);
  }

  /**
   * Cleanup old persisted states
   */
  private cleanupOldStates(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(TransferStateService.STORAGE_KEY_PREFIX)
      );

      // Sort by timestamp (newest first)
      const stateEntries = keys.map(key => {
        try {
          const serialized = localStorage.getItem(key);
          if (!serialized) return null;
          
          const persistedState: PersistedTransferState = JSON.parse(serialized);
          return { key, timestamp: persistedState.timestamp };
        } catch {
          return { key, timestamp: 0 }; // Mark for deletion
        }
      }).filter(entry => entry !== null) as { key: string; timestamp: number }[];

      stateEntries.sort((a, b) => b.timestamp - a.timestamp);

      // Remove states beyond the limit
      const statesToRemove = stateEntries.slice(TransferStateService.MAX_STORED_TRANSFERS);
      
      // Remove old states
      const now = Date.now();
      for (const entry of stateEntries) {
        const age = now - entry.timestamp;
        if (age > TransferStateService.MAX_STATE_AGE || statesToRemove.includes(entry)) {
          localStorage.removeItem(entry.key);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old states:', error);
    }
  }

  /**
   * Register event handlers
   * 
   * @param handlers Event handlers to register
   */
  registerEventHandlers(handlers: Partial<TransferStateEvents>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Unregister event handlers
   */
  unregisterEventHandlers(): void {
    this.eventHandlers = {};
  }

  /**
   * Get transfer statistics
   * 
   * @returns Transfer statistics
   */
  getStatistics(): {
    activeTransfers: number;
    completedTransfers: number;
    failedTransfers: number;
    totalBytesTransferred: number;
  } {
    const transfers = Array.from(this.activeTransfers.values());
    
    return {
      activeTransfers: transfers.filter(t => 
        ['connecting', 'transferring', 'paused'].includes(t.status)
      ).length,
      completedTransfers: transfers.filter(t => t.status === 'completed').length,
      failedTransfers: transfers.filter(t => t.status === 'error').length,
      totalBytesTransferred: transfers.reduce((total, t) => 
        total + t.progress.bytesTransferred, 0
      )
    };
  }

  /**
   * Export transfer state for debugging
   * 
   * @param transferId Transfer identifier
   * @returns Serialized transfer state
   */
  exportState(transferId: string): string | null {
    const state = this.activeTransfers.get(transferId);
    
    if (!state) {
      return null;
    }

    try {
      return JSON.stringify(state, null, 2);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if browser storage is available
   * 
   * @returns True if storage is available, false otherwise
   */
  static isStorageAvailable(): boolean {
    try {
      const testKey = 'quickshare_storage_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage information
   * 
   * @returns Storage usage statistics
   */
  getStorageUsage(): { used: number; available: number; percentage: number } {
    try {
      // Estimate storage usage
      let used = 0;
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(TransferStateService.STORAGE_KEY_PREFIX)
      );

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }

      // Rough estimate of available storage (5MB typical limit)
      const available = 5 * 1024 * 1024; // 5MB in bytes
      const percentage = (used / available) * 100;

      return { used, available, percentage };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Cleanup and dispose of the service
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.activeTransfers.clear();
    this.eventHandlers = {};
    this.stateUpdateQueue = [];
  }
}