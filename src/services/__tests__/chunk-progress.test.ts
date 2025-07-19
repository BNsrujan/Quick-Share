/**
 * Unit tests for ChunkService transfer progress tracking
 */

import { ChunkService, ChunkError } from '../chunk.service';
import { ChunkManifest, ChunkStatus, TransferProgress, FileMetadata } from '../../types/chunk';

describe('ChunkService Transfer Progress', () => {
  // Create a sample manifest for testing
  const createTestManifest = (): ChunkManifest => ({
    totalChunks: 5,
    chunkSize: 1024 * 1024, // 1MB
    fileHash: 'test-file-hash',
    totalSize: 5 * 1024 * 1024, // 5MB
    chunks: [
      { id: 0, size: 1024 * 1024, checksum: 'checksum-0', status: ChunkStatus.COMPLETED },
      { id: 1, size: 1024 * 1024, checksum: 'checksum-1', status: ChunkStatus.COMPLETED },
      { id: 2, size: 1024 * 1024, checksum: 'checksum-2', status: ChunkStatus.IN_PROGRESS },
      { id: 3, size: 1024 * 1024, checksum: 'checksum-3', status: ChunkStatus.PENDING },
      { id: 4, size: 1024 * 1024, checksum: 'checksum-4', status: ChunkStatus.FAILED, retries: 2 }
    ]
  });

  describe('updateChunkStatus', () => {
    it('should update chunk status in manifest', () => {
      const manifest = createTestManifest();
      const updatedManifest = ChunkService.updateChunkStatus(manifest, 3, ChunkStatus.IN_PROGRESS);
      
      expect(updatedManifest.chunks[3].status).toBe(ChunkStatus.IN_PROGRESS);
      // Original manifest should not be modified
      expect(manifest.chunks[3].status).toBe(ChunkStatus.PENDING);
    });
    
    it('should throw error for non-existent chunk ID', () => {
      const manifest = createTestManifest();
      expect(() => ChunkService.updateChunkStatus(manifest, 10, ChunkStatus.COMPLETED))
        .toThrow(ChunkError);
    });
  });
  
  describe('incrementChunkRetry', () => {
    it('should increment retry count for a chunk', () => {
      const manifest = createTestManifest();
      const updatedManifest = ChunkService.incrementChunkRetry(manifest, 4);
      
      expect(updatedManifest.chunks[4].retries).toBe(3); // Was 2, now 3
    });
    
    it('should initialize retry count if not present', () => {
      const manifest = createTestManifest();
      // Remove retries from chunk 4
      const modifiedManifest = {
        ...manifest,
        chunks: manifest.chunks.map(chunk => 
          chunk.id === 4 ? { ...chunk, retries: undefined } : chunk
        )
      };
      
      const updatedManifest = ChunkService.incrementChunkRetry(modifiedManifest, 4);
      expect(updatedManifest.chunks[4].retries).toBe(1);
    });
  });
  
  describe('calculateTransferProgress', () => {
    it('should calculate correct transfer progress', () => {
      const manifest = createTestManifest();
      const progress = ChunkService.calculateTransferProgress(manifest);
      
      expect(progress.totalChunks).toBe(5);
      expect(progress.completedChunks).toBe(2);
      expect(progress.inProgressChunks).toBe(1);
      expect(progress.pendingChunks).toBe(1);
      expect(progress.failedChunks).toBe(1);
      expect(progress.bytesTransferred).toBe(2 * 1024 * 1024); // 2MB
      expect(progress.totalBytes).toBe(5 * 1024 * 1024); // 5MB
      expect(progress.percentage).toBe(40); // 2/5 = 40%
    });
    
    it('should calculate transfer speed and ETA when start time is provided', () => {
      const manifest = createTestManifest();
      const startTime = Date.now() - 10000; // 10 seconds ago
      const progress = ChunkService.calculateTransferProgress(manifest, startTime);
      
      expect(progress.transferSpeed).toBeDefined();
      expect(progress.estimatedTimeRemaining).toBeDefined();
      
      // Transfer speed should be around 2MB / 10s = 204.8 KB/s
      expect(progress.transferSpeed).toBeCloseTo(2 * 1024 * 1024 / 10, -2);
      
      // ETA should be around (5MB - 2MB) / (2MB / 10s) = 15s
      expect(progress.estimatedTimeRemaining).toBeCloseTo(15, -1);
    });
    
    it('should handle zero progress correctly', () => {
      const manifest: ChunkManifest = {
        totalChunks: 5,
        chunkSize: 1024 * 1024,
        fileHash: 'test-file-hash',
        totalSize: 5 * 1024 * 1024,
        chunks: Array.from({ length: 5 }, (_, i) => ({
          id: i,
          size: 1024 * 1024,
          checksum: `checksum-${i}`,
          status: ChunkStatus.PENDING
        }))
      };
      
      const progress = ChunkService.calculateTransferProgress(manifest);
      
      expect(progress.completedChunks).toBe(0);
      expect(progress.bytesTransferred).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.transferSpeed).toBeUndefined();
      expect(progress.estimatedTimeRemaining).toBeUndefined();
    });
  });
  
  describe('getNextChunksToTransfer', () => {
    it('should return next chunks to transfer', () => {
      const manifest = createTestManifest();
      const nextChunks = ChunkService.getNextChunksToTransfer(manifest, 3);
      
      // Should include pending chunk (id: 3) and failed chunk (id: 4)
      expect(nextChunks).toContain(3);
      expect(nextChunks).toContain(4);
      expect(nextChunks.length).toBe(2);
    });
    
    it('should respect maximum concurrent limit', () => {
      const manifest = createTestManifest();
      // Already has 1 in progress, max is 2, so should only return 1 more
      const nextChunks = ChunkService.getNextChunksToTransfer(manifest, 2);
      expect(nextChunks.length).toBe(1);
    });
    
    it('should prioritize chunks with fewer retries', () => {
      const manifest: ChunkManifest = {
        totalChunks: 4,
        chunkSize: 1024,
        fileHash: 'hash',
        totalSize: 4 * 1024,
        chunks: [
          { id: 0, size: 1024, checksum: 'c0', status: ChunkStatus.FAILED, retries: 3 },
          { id: 1, size: 1024, checksum: 'c1', status: ChunkStatus.FAILED, retries: 1 },
          { id: 2, size: 1024, checksum: 'c2', status: ChunkStatus.PENDING },
          { id: 3, size: 1024, checksum: 'c3', status: ChunkStatus.FAILED, retries: 2 }
        ]
      };
      
      const nextChunks = ChunkService.getNextChunksToTransfer(manifest, 2);
      
      // Should prioritize pending (id: 2) and failed with fewest retries (id: 1)
      expect(nextChunks).toEqual([2, 1]);
    });
  });
  
  describe('serializeManifest and deserializeManifest', () => {
    it('should serialize and deserialize manifest correctly', () => {
      const manifest = createTestManifest();
      const serialized = ChunkService.serializeManifest(manifest);
      const deserialized = ChunkService.deserializeManifest(serialized);
      
      expect(deserialized).toEqual(manifest);
    });
    
    it('should throw error for invalid serialized data', () => {
      expect(() => ChunkService.deserializeManifest('invalid-json'))
        .toThrow(ChunkError);
    });
    
    it('should throw error for invalid manifest structure', () => {
      const invalidManifest = { totalChunks: 5 }; // Missing required fields
      const serialized = JSON.stringify(invalidManifest);
      
      expect(() => ChunkService.deserializeManifest(serialized))
        .toThrow(ChunkError);
    });
  });
  
  describe('createResumableState and isResumableStateValid', () => {
    const testMetadata: FileMetadata = {
      name: 'test.file',
      size: 5 * 1024 * 1024,
      type: 'application/octet-stream',
      hash: 'file-hash',
      lastModified: Date.now()
    };
    
    it('should create valid resumable state', () => {
      const manifest = createTestManifest();
      const state = ChunkService.createResumableState(manifest, testMetadata);
      
      expect(state.manifest).toEqual(manifest);
      expect(state.metadata).toEqual(testMetadata);
      expect(state.timestamp).toBeDefined();
      expect(typeof state.timestamp).toBe('number');
    });
    
    it('should validate resumable state correctly', () => {
      const manifest = createTestManifest();
      const state = ChunkService.createResumableState(manifest, testMetadata);
      
      expect(ChunkService.isResumableStateValid(state)).toBe(true);
    });
    
    it('should reject expired resumable state', () => {
      const manifest = createTestManifest();
      const state = ChunkService.createResumableState(manifest, testMetadata);
      
      // Set timestamp to 25 hours ago
      state.timestamp = Date.now() - 25 * 60 * 60 * 1000;
      
      expect(ChunkService.isResumableStateValid(state)).toBe(false);
    });
    
    it('should reject invalid resumable state structure', () => {
      const invalidState = { manifest: null, metadata: testMetadata, timestamp: Date.now() };
      expect(ChunkService.isResumableStateValid(invalidState as any)).toBe(false);
    });
  });
  
  describe('findMissingChunks', () => {
    it('should find missing chunks correctly', () => {
      const manifest = createTestManifest();
      const receivedChunks = [0, 1, 3]; // Missing 2 and 4
      
      const missingChunks = ChunkService.findMissingChunks(manifest, receivedChunks);
      
      expect(missingChunks).toEqual([2, 4]);
    });
    
    it('should return all chunks when none received', () => {
      const manifest = createTestManifest();
      const missingChunks = ChunkService.findMissingChunks(manifest, []);
      
      expect(missingChunks).toEqual([0, 1, 2, 3, 4]);
    });
    
    it('should return empty array when all chunks received', () => {
      const manifest = createTestManifest();
      const receivedChunks = [0, 1, 2, 3, 4];
      
      const missingChunks = ChunkService.findMissingChunks(manifest, receivedChunks);
      
      expect(missingChunks).toEqual([]);
    });
  });
});