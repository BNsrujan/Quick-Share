/**
 * File chunking and assembly types
 */

export interface FileChunk {
  id: number;
  data: ArrayBuffer;
  size: number;
  checksum: string;
  encrypted: boolean;
  iv?: Uint8Array; // Initialization vector for encryption
}

export interface ChunkManifest {
  totalChunks: number;
  chunkSize: number;
  fileHash: string;
  totalSize: number;
  chunks: {
    id: number;
    size: number;
    checksum: string;
    status?: ChunkStatus;
    retries?: number;
  }[];
}

export enum ChunkStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface TransferProgress {
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  inProgressChunks: number;
  pendingChunks: number;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  transferSpeed?: number; // bytes per second
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  hash: string;
  lastModified: number;
}