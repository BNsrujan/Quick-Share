/**
 * P2P Engine interface and related types
 */

import { TransferProgress, TransferError } from './transfer';
import { FileMetadata } from './chunk';

export interface P2PEngine {
  // Connection management
  createRoom(file: File): Promise<string>; // Returns share code
  joinRoom(code: string): Promise<void>;
  disconnect(): void;

  // Transfer control
  startTransfer(): Promise<void>;
  pauseTransfer(): void;
  resumeTransfer(): Promise<void>;
  cancelTransfer(): void;

  // Event handlers
  onProgress: (callback: (progress: TransferProgress) => void) => void;
  onComplete: (callback: (file: Blob) => void) => void;
  onError: (callback: (error: TransferError) => void) => void;
}

export interface P2PEngineConfig {
  chunkSize: number;
  maxParallelChannels: number;
  connectionTimeout: number;
  retryAttempts: number;
  iceServers: RTCIceServer[];
}

export interface ConnectionQuality {
  rtt: number; // Round trip time in ms
  bandwidth: number; // Estimated bandwidth in bytes/sec
  packetLoss: number; // Packet loss percentage
  quality: 'excellent' | 'good' | 'poor';
}