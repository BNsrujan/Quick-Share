/**
 * Core transfer state and progress tracking types
 */

export interface TransferState {
  id: string;
  status: 'idle' | 'connecting' | 'transferring' | 'paused' | 'completed' | 'error';
  file: {
    name: string;
    size: number;
    type: string;
    hash: string;
  };
  progress: {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
    speed: number; // bytes per second
    eta: number; // seconds
  };
  chunks: {
    total: number;
    completed: number[];
    failed: number[];
    inProgress: number[];
  };
  connection: {
    peerId: string;
    channels: RTCDataChannel[];
    quality: 'excellent' | 'good' | 'poor';
  };
  encryption: {
    keyId: string;
    algorithm: 'AES-256-GCM';
  };
  timestamps: {
    created: Date;
    started?: Date;
    paused?: Date;
    completed?: Date;
  };
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  eta: number;
}

export type TransferStatus = TransferState['status'];

export enum ErrorType {
  CONNECTION_FAILED = 'connection_failed',
  TRANSFER_INTERRUPTED = 'transfer_interrupted',
  ENCRYPTION_ERROR = 'encryption_error',
  INVALID_CODE = 'invalid_code',
  FILE_TOO_LARGE = 'file_too_large',
  BROWSER_UNSUPPORTED = 'browser_unsupported',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout'
}

export interface TransferError {
  type: ErrorType;
  message: string;
  recoverable: boolean;
  retryAfter?: number;
  details?: any;
}