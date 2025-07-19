/**
 * Status synchronization service
 * 
 * This service handles real-time status synchronization between peers
 * using the signaling server's WebSocket connection.
 */

import { SignalingService } from './signaling.service';
import { TransferProgress } from '../types/transfer';

export enum StatusSyncEvent {
  TRANSFER_STARTED = 'transfer_started',
  TRANSFER_PROGRESS = 'transfer_progress',
  TRANSFER_PAUSED = 'transfer_paused',
  TRANSFER_RESUMED = 'transfer_resumed',
  TRANSFER_COMPLETED = 'transfer_completed',
  TRANSFER_CANCELLED = 'transfer_cancelled',
  TRANSFER_ERROR = 'transfer_error',
  FILE_METADATA = 'file_metadata'
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface StatusSyncOptions {
  syncInterval?: number; // Milliseconds between progress sync events
}

/**
 * Service for synchronizing transfer status between peers
 */
export class StatusSyncService {
  private signalingService: SignalingService;
  private syncInterval: number;
  private progressSyncTimer: NodeJS.Timeout | null = null;
  private lastProgress: TransferProgress | null = null;
  private fileMetadata: FileMetadata | null = null;
  
  constructor(signalingService: SignalingService, options: StatusSyncOptions = {}) {
    this.signalingService = signalingService;
    this.syncInterval = options.syncInterval || 1000; // Default to 1 second
  }
  
  /**
   * Start synchronizing transfer progress
   * 
   * @param progress Initial transfer progress
   */
  startProgressSync(progress: TransferProgress): void {
    this.lastProgress = progress;
    
    // Send initial progress
    this.sendProgress(progress);
    
    // Set up interval for regular progress updates
    this.progressSyncTimer = setInterval(() => {
      if (this.lastProgress) {
        this.sendProgress(this.lastProgress);
      }
    }, this.syncInterval);
  }
  
  /**
   * Stop synchronizing transfer progress
   */
  stopProgressSync(): void {
    if (this.progressSyncTimer) {
      clearInterval(this.progressSyncTimer);
      this.progressSyncTimer = null;
    }
  }
  
  /**
   * Update progress data
   * 
   * @param progress Updated transfer progress
   */
  updateProgress(progress: TransferProgress): void {
    this.lastProgress = progress;
    
    // Send progress update immediately if significant change
    if (
      Math.abs(progress.percentage - (this.lastProgress?.percentage || 0)) > 1 ||
      progress.chunksCompleted !== this.lastProgress?.chunksCompleted
    ) {
      this.sendProgress(progress);
    }
  }
  
  /**
   * Send progress update to peer
   * 
   * @param progress Transfer progress to send
   */
  private sendProgress(progress: TransferProgress): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_PROGRESS, { progress });
    }
  }
  
  /**
   * Send file metadata to peer
   * 
   * @param metadata File metadata
   */
  sendFileMetadata(metadata: FileMetadata): void {
    this.fileMetadata = metadata;
    
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.FILE_METADATA, { metadata });
    }
  }
  
  /**
   * Notify transfer started
   */
  notifyTransferStarted(): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_STARTED);
    }
  }
  
  /**
   * Notify transfer paused
   */
  notifyTransferPaused(): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_PAUSED);
    }
  }
  
  /**
   * Notify transfer resumed
   */
  notifyTransferResumed(): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_RESUMED);
    }
  }
  
  /**
   * Notify transfer completed
   */
  notifyTransferCompleted(): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_COMPLETED);
    }
    
    // Stop progress sync when transfer is complete
    this.stopProgressSync();
  }
  
  /**
   * Notify transfer cancelled
   */
  notifyTransferCancelled(): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_CANCELLED);
    }
    
    // Stop progress sync when transfer is cancelled
    this.stopProgressSync();
  }
  
  /**
   * Notify transfer error
   * 
   * @param error Error message
   */
  notifyTransferError(error: string): void {
    if (this.signalingService.isSocketConnected()) {
      this.signalingService.emit(StatusSyncEvent.TRANSFER_ERROR, { error });
    }
    
    // Stop progress sync on error
    this.stopProgressSync();
  }
  
  /**
   * Register event handlers for status sync events
   * 
   * @param handlers Event handlers
   */
  registerEventHandlers(handlers: {
    onTransferStarted?: () => void;
    onTransferProgress?: (progress: TransferProgress) => void;
    onTransferPaused?: () => void;
    onTransferResumed?: () => void;
    onTransferCompleted?: () => void;
    onTransferCancelled?: () => void;
    onTransferError?: (error: string) => void;
    onFileMetadata?: (metadata: FileMetadata) => void;
  }): void {
    // Register event handlers with signaling service
    this.signalingService.on(StatusSyncEvent.TRANSFER_STARTED, () => {
      handlers.onTransferStarted?.();
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_PROGRESS, (data: { progress: TransferProgress }) => {
      handlers.onTransferProgress?.(data.progress);
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_PAUSED, () => {
      handlers.onTransferPaused?.();
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_RESUMED, () => {
      handlers.onTransferResumed?.();
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_COMPLETED, () => {
      handlers.onTransferCompleted?.();
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_CANCELLED, () => {
      handlers.onTransferCancelled?.();
    });
    
    this.signalingService.on(StatusSyncEvent.TRANSFER_ERROR, (data: { error: string }) => {
      handlers.onTransferError?.(data.error);
    });
    
    this.signalingService.on(StatusSyncEvent.FILE_METADATA, (data: { metadata: FileMetadata }) => {
      handlers.onFileMetadata?.(data.metadata);
    });
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopProgressSync();
  }
}