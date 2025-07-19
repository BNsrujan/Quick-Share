/**
 * ChunkService - Handles file chunking and reassembly for efficient transfers
 * 
 * This service provides methods for breaking files into chunks, creating manifests,
 * and reassembling files from chunks with memory-efficient processing.
 */

import { CryptoService } from './crypto.service';

export interface ChunkManifest {
  totalChunks: number;
  chunkSize: number;
  fileHash: string;
  totalSize: number;
  chunks: ChunkInfo[];
}

export interface ChunkInfo {
  id: number;
  size: number;
  checksum: string;
  status: ChunkStatus;
  retries: number;
}

export interface FileChunk {
  id: number;
  data: ArrayBuffer;
  size: number;
  checksum: string;
  encrypted: boolean;
  iv?: Uint8Array;
}

export enum ChunkStatus {
  PENDING = 'pending',
  TRANSFERRING = 'transferring',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export class ChunkService {
  /**
   * Create a manifest for a file with memory-efficient processing
   * 
   * @param file The file to create a manifest for
   * @param chunkSize Size of each chunk in bytes
   * @returns Promise resolving to a chunk manifest
   */
  async createManifest(file: File, chunkSize: number): Promise<ChunkManifest> {
    // Calculate total chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // For very large files, we'll calculate the file hash in chunks
    // to avoid loading the entire file into memory
    let fileHash = '';
    
    if (file.size > 1024 * 1024 * 1024) { // > 1GB
      // For large files, use a streaming approach to calculate hash
      fileHash = await this.calculateLargeFileHash(file, chunkSize);
    } else {
      // For smaller files, we can load the entire file
      const fileBuffer = await file.arrayBuffer();
      fileHash = await CryptoService.generateChecksum(fileBuffer);
    }
    
    // Create manifest with empty chunk entries
    const manifest: ChunkManifest = {
      totalChunks,
      chunkSize,
      fileHash,
      totalSize: file.size,
      chunks: []
    };
    
    // For very large files, we'll create chunk entries without loading all chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const size = end - start;
      
      manifest.chunks.push({
        id: i,
        size,
        checksum: '', // We'll calculate checksums on-demand when sending
        status: ChunkStatus.PENDING,
        retries: 0
      });
    }
    
    return manifest;
  }

  /**
   * Calculate hash for a large file without loading it entirely into memory
   * 
   * @param file The file to hash
   * @param chunkSize Size of chunks to process at a time
   * @returns Promise resolving to the file hash
   */
  private async calculateLargeFileHash(file: File, chunkSize: number): Promise<string> {
    // Use a streaming approach with the SubtleCrypto API
    const digestAlgorithm = 'SHA-256';
    const crypto = window.crypto.subtle;
    
    // Create a hash context
    let hashContext = await crypto.digest(digestAlgorithm, new ArrayBuffer(0));
    
    // Process file in chunks
    for (let position = 0; position < file.size; position += chunkSize) {
      const end = Math.min(position + chunkSize, file.size);
      const chunk = await file.slice(position, end).arrayBuffer();
      
      // Update hash with this chunk
      const chunkHash = await crypto.digest(digestAlgorithm, chunk);
      
      // Combine hashes (simplified approach - in production would use a proper hash combining function)
      const combinedBuffer = new Uint8Array(hashContext.byteLength + chunkHash.byteLength);
      combinedBuffer.set(new Uint8Array(hashContext), 0);
      combinedBuffer.set(new Uint8Array(chunkHash), hashContext.byteLength);
      
      // Update hash context
      const newHashContext = await crypto.digest(digestAlgorithm, combinedBuffer);
      hashContext = newHashContext;
    }
    
    // Convert final hash to hex string
    const hashArray = Array.from(new Uint8Array(hashContext));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a single chunk from a file with memory-efficient processing
   * 
   * @param file The file to chunk
   * @param chunkIndex Index of the chunk to create
   * @param chunkSize Size of each chunk in bytes
   * @returns Promise resolving to the created chunk
   */
  async createChunk(file: File, chunkIndex: number, chunkSize: number): Promise<FileChunk> {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    
    // Extract chunk data
    const chunkBlob = file.slice(start, end);
    const chunkData = await chunkBlob.arrayBuffer();
    
    // Generate checksum for the chunk
    const checksum = await CryptoService.generateChecksum(chunkData);
    
    return {
      id: chunkIndex,
      data: chunkData,
      size: chunkData.byteLength,
      checksum,
      encrypted: false
    };
  }

  /**
   * Assemble file from chunks with memory-efficient processing
   * 
   * @param chunks Map of chunks indexed by chunk ID
   * @param manifest Chunk manifest
   * @param options Assembly options
   * @returns Promise resolving to the assembled file as Blob
   */
  async assembleFileMemoryEfficient(
    chunks: Map<number, FileChunk>,
    manifest: ChunkManifest,
    options: {
      type?: string;
      verifyIntegrity?: boolean;
      decryptionKey?: CryptoKey;
    } = {}
  ): Promise<Blob> {
    const { type = 'application/octet-stream', verifyIntegrity = true, decryptionKey } = options;
    
    // For very large files, we'll use a streaming approach with Blob parts
    const blobParts: Blob[] = [];
    let totalAssembled = 0;
    
    // Process chunks in order
    for (let i = 0; i < manifest.totalChunks; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      
      // Decrypt if needed
      let processedData: ArrayBuffer;
      if (chunk.encrypted && decryptionKey && chunk.iv) {
        processedData = await CryptoService.decrypt(chunk.data, decryptionKey, chunk.iv);
      } else {
        processedData = chunk.data;
      }
      
      // Verify integrity if requested
      if (verifyIntegrity && chunk.checksum) {
        const isValid = await CryptoService.verifyChecksum(processedData, chunk.checksum);
        if (!isValid) {
          throw new Error(`Integrity check failed for chunk ${i}`);
        }
      }
      
      // Add to blob parts
      blobParts.push(new Blob([processedData]));
      totalAssembled += processedData.byteLength;
      
      // Free memory by removing the chunk after processing
      chunks.delete(i);
      
      // Allow UI updates between chunks
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Create final blob
    return new Blob(blobParts, { type });
  }
}

export default ChunkService;