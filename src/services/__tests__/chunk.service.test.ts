/**
 * Unit tests for ChunkService
 */

import { ChunkService, ChunkError, ChunkingOptions, AssemblyOptions } from '../chunk.service';
import { CryptoService } from '../crypto.service';
import { FileChunk, ChunkManifest, FileMetadata } from '../../types/chunk';

// Mock CryptoService
jest.mock('../crypto.service', () => {
  const mockEncrypt = jest.fn().mockImplementation(async (data) => {
    // Mock encryption that just returns the original data with an IV
    return {
      encryptedData: data,
      iv: new Uint8Array(12).fill(1)
    };
  });
  
  const mockDecrypt = jest.fn().mockImplementation(async (data) => {
    // Mock decryption that just returns the original data
    return data;
  });
  
  const MockCryptoService = jest.fn().mockImplementation(() => {
    return {
      encrypt: mockEncrypt,
      decrypt: mockDecrypt
    };
  });
  
  // Add static methods to the constructor function
  MockCryptoService.generateChecksum = jest.fn().mockImplementation(async (data) => {
    // Simple mock implementation that returns a fixed checksum
    return 'mock-checksum-' + data.byteLength;
  });
  
  MockCryptoService.verifyChecksum = jest.fn().mockImplementation(async (data, checksum) => {
    // Mock implementation that verifies against our mock checksum format
    return checksum === 'mock-checksum-' + data.byteLength;
  });
  
  return {
    __esModule: true,
    CryptoService: MockCryptoService
  };
});

describe('ChunkService', () => {
  // Mock File object
  const createMockFile = (size: number, type = 'application/octet-stream'): File => {
    const buffer = new ArrayBuffer(size);
    const blob = new Blob([buffer], { type });
    return new File([blob], 'test-file.dat', { type });
  };
  
  // Mock CryptoKey
  const mockCryptoKey = {} as CryptoKey;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock File.arrayBuffer
    File.prototype.arrayBuffer = jest.fn().mockImplementation(function() {
      return Promise.resolve(new ArrayBuffer(this.size));
    });
    
    // Mock Blob.arrayBuffer
    Blob.prototype.arrayBuffer = jest.fn().mockImplementation(function() {
      return Promise.resolve(new ArrayBuffer(this.size));
    });
  });
  
  describe('getOptimalChunkSize', () => {
    it('should return small chunk size for files < 10MB', () => {
      const size = ChunkService.getOptimalChunkSize(5 * 1024 * 1024);
      expect(size).toBe(256 * 1024);
    });
    
    it('should return medium chunk size for files 10MB-100MB', () => {
      const size = ChunkService.getOptimalChunkSize(50 * 1024 * 1024);
      expect(size).toBe(1024 * 1024);
    });
    
    it('should return large chunk size for files 100MB-1GB', () => {
      const size = ChunkService.getOptimalChunkSize(500 * 1024 * 1024);
      expect(size).toBe(2 * 1024 * 1024);
    });
    
    it('should return xlarge chunk size for files > 1GB', () => {
      const size = ChunkService.getOptimalChunkSize(2 * 1024 * 1024 * 1024);
      expect(size).toBe(5 * 1024 * 1024);
    });
  });
  
  describe('chunkFile', () => {
    it('should split a file into chunks', async () => {
      const file = createMockFile(10 * 1024 * 1024); // 10MB file
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      const result = await ChunkService.chunkFile(file, { chunkSize });
      
      expect(result.manifest.totalChunks).toBe(10);
      expect(result.chunks.length).toBe(10);
      expect(result.manifest.chunkSize).toBe(chunkSize);
      expect(CryptoService.generateChecksum).toHaveBeenCalledTimes(11); // File + 10 chunks
    });
    
    it('should handle files that are not evenly divisible by chunk size', async () => {
      const file = createMockFile(3.5 * 1024 * 1024); // 3.5MB file
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      const result = await ChunkService.chunkFile(file, { chunkSize });
      
      expect(result.manifest.totalChunks).toBe(4);
      expect(result.chunks.length).toBe(4);
      expect(result.chunks[3].size).toBe(0.5 * 1024 * 1024);
    });
    
    it('should encrypt chunks when requested', async () => {
      const file = createMockFile(3 * 1024 * 1024); // 3MB file
      const options: ChunkingOptions = {
        chunkSize: 1024 * 1024,
        encrypted: true,
        encryptionKey: mockCryptoKey
      };
      
      const result = await ChunkService.chunkFile(file, options);
      
      expect(result.chunks.every(chunk => chunk.encrypted)).toBe(true);
      expect(result.chunks.every(chunk => chunk.iv !== undefined)).toBe(true);
      expect(CryptoService.prototype.encrypt).toHaveBeenCalledTimes(3);
    });
    
    it('should throw error if encryption is requested without a key', async () => {
      const file = createMockFile(1024 * 1024);
      const options: ChunkingOptions = {
        encrypted: true
      };
      
      await expect(ChunkService.chunkFile(file, options)).rejects.toThrow(ChunkError);
    });
    
    it('should throw error for invalid chunk size', async () => {
      const file = createMockFile(1024 * 1024);
      
      // Too small
      await expect(ChunkService.chunkFile(file, { chunkSize: 1024 })).rejects.toThrow(ChunkError);
      
      // Too large
      await expect(ChunkService.chunkFile(file, { chunkSize: 100 * 1024 * 1024 })).rejects.toThrow(ChunkError);
    });
    
    it('should skip checksums when requested', async () => {
      const file = createMockFile(3 * 1024 * 1024);
      const options: ChunkingOptions = {
        chunkSize: 1024 * 1024,
        generateChecksums: false
      };
      
      const result = await ChunkService.chunkFile(file, options);
      
      expect(result.manifest.fileHash).toBe('');
      expect(result.manifest.chunks.every(chunk => chunk.checksum === '')).toBe(true);
      expect(CryptoService.generateChecksum).not.toHaveBeenCalled();
    });
  });
  
  describe('assembleFile', () => {
    // Create mock chunks and manifest
    const createMockChunks = (count: number, size: number, encrypted = false): FileChunk[] => {
      return Array.from({ length: count }, (_, i) => {
        const data = new ArrayBuffer(size);
        return {
          id: i,
          data,
          size,
          checksum: `mock-checksum-${size}`,
          encrypted,
          iv: encrypted ? new Uint8Array(12).fill(1) : undefined
        };
      });
    };
    
    const createMockManifest = (totalChunks: number, chunkSize: number): ChunkManifest => {
      return {
        totalChunks,
        chunkSize,
        fileHash: 'mock-file-hash',
        chunks: Array.from({ length: totalChunks }, (_, i) => ({
          id: i,
          size: chunkSize,
          checksum: `mock-checksum-${chunkSize}`
        }))
      };
    };
    
    const mockMetadata: FileMetadata = {
      name: 'test-file.dat',
      size: 3 * 1024 * 1024,
      type: 'application/octet-stream',
      hash: 'mock-file-hash',
      lastModified: Date.now()
    };
    
    it('should reassemble chunks into a file', async () => {
      const chunks = createMockChunks(3, 1024 * 1024);
      const manifest = createMockManifest(3, 1024 * 1024);
      
      const result = await ChunkService.assembleFile(chunks, manifest, mockMetadata);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBe(3 * 1024 * 1024);
      expect(result.type).toBe(mockMetadata.type);
    });
    
    it('should decrypt chunks when requested', async () => {
      const chunks = createMockChunks(3, 1024 * 1024, true);
      const manifest = createMockManifest(3, 1024 * 1024);
      const options: AssemblyOptions = {
        decryptChunks: true,
        decryptionKey: mockCryptoKey
      };
      
      const result = await ChunkService.assembleFile(chunks, manifest, mockMetadata, options);
      
      expect(result).toBeInstanceOf(Blob);
      expect(CryptoService.prototype.decrypt).toHaveBeenCalledTimes(3);
    });
    
    it('should throw error if decryption is requested without a key', async () => {
      const chunks = createMockChunks(3, 1024 * 1024, true);
      const manifest = createMockManifest(3, 1024 * 1024);
      const options: AssemblyOptions = {
        decryptChunks: true
      };
      
      await expect(ChunkService.assembleFile(chunks, manifest, mockMetadata, options)).rejects.toThrow(ChunkError);
    });
    
    it('should throw error if chunk count doesn\'t match manifest', async () => {
      const chunks = createMockChunks(2, 1024 * 1024);
      const manifest = createMockManifest(3, 1024 * 1024);
      
      await expect(ChunkService.assembleFile(chunks, manifest, mockMetadata)).rejects.toThrow(ChunkError);
    });
    
    it('should verify chunk integrity when requested', async () => {
      const chunks = createMockChunks(3, 1024 * 1024);
      const manifest = createMockManifest(3, 1024 * 1024);
      
      // Mock verifyChecksum to fail for one chunk
      (CryptoService.verifyChecksum as jest.Mock).mockImplementationOnce(() => Promise.resolve(false));
      
      await expect(ChunkService.assembleFile(chunks, manifest, mockMetadata, { verifyIntegrity: true }))
        .rejects.toThrow(/Integrity check failed/);
    });
    
    it('should skip integrity verification when requested', async () => {
      const chunks = createMockChunks(3, 1024 * 1024);
      const manifest = createMockManifest(3, 1024 * 1024);
      
      // Even though verification would fail, we're skipping it
      (CryptoService.verifyChecksum as jest.Mock).mockImplementation(() => Promise.resolve(false));
      
      const result = await ChunkService.assembleFile(chunks, manifest, mockMetadata, { verifyIntegrity: false });
      
      expect(result).toBeInstanceOf(Blob);
      expect(CryptoService.verifyChecksum).not.toHaveBeenCalled();
    });
  });
  
  describe('createFileMetadata', () => {
    it('should create metadata from a File object', async () => {
      const file = new File([new ArrayBuffer(1024)], 'test.txt', {
        type: 'text/plain',
        lastModified: 1625097600000
      });
      
      const metadata = await ChunkService.createFileMetadata(file);
      
      expect(metadata.name).toBe('test.txt');
      expect(metadata.size).toBe(1024);
      expect(metadata.type).toBe('text/plain');
      expect(metadata.lastModified).toBe(1625097600000);
      expect(metadata.hash).toBeDefined();
    });
    
    it('should use default MIME type if not specified', async () => {
      const file = new File([new ArrayBuffer(1024)], 'test.bin');
      
      const metadata = await ChunkService.createFileMetadata(file);
      
      expect(metadata.type).toBe('application/octet-stream');
    });
  });
  
  describe('processChunk', () => {
    it('should encrypt a chunk', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: 'mock-checksum',
        encrypted: false
      };
      
      const result = await ChunkService.processChunk(chunk, mockCryptoKey, true);
      
      expect(result.encrypted).toBe(true);
      expect(result.iv).toBeDefined();
      expect(CryptoService.prototype.encrypt).toHaveBeenCalledWith(chunk.data, mockCryptoKey);
    });
    
    it('should decrypt a chunk', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: 'mock-checksum',
        encrypted: true,
        iv: new Uint8Array(12)
      };
      
      const result = await ChunkService.processChunk(chunk, mockCryptoKey, false);
      
      expect(result.encrypted).toBe(false);
      expect(result.iv).toBeUndefined();
      expect(CryptoService.prototype.decrypt).toHaveBeenCalledWith(chunk.data, mockCryptoKey, chunk.iv);
    });
    
    it('should throw error when trying to decrypt a chunk without IV', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: 'mock-checksum',
        encrypted: true
      };
      
      await expect(ChunkService.processChunk(chunk, mockCryptoKey, false)).rejects.toThrow(ChunkError);
    });
  });
  
  describe('verifyChunkIntegrity', () => {
    it('should verify chunk integrity using checksum', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: 'mock-checksum-1024',
        encrypted: false
      };
      
      const isValid = await ChunkService.verifyChunkIntegrity(chunk);
      
      expect(isValid).toBe(true);
      expect(CryptoService.verifyChecksum).toHaveBeenCalledWith(chunk.data, chunk.checksum);
    });
    
    it('should return true if no checksum is provided', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: '',
        encrypted: false
      };
      
      const isValid = await ChunkService.verifyChunkIntegrity(chunk);
      
      expect(isValid).toBe(true);
      expect(CryptoService.verifyChecksum).not.toHaveBeenCalled();
    });
    
    it('should return false if checksum verification fails', async () => {
      const chunk: FileChunk = {
        id: 0,
        data: new ArrayBuffer(1024),
        size: 1024,
        checksum: 'invalid-checksum',
        encrypted: false
      };
      
      (CryptoService.verifyChecksum as jest.Mock).mockImplementationOnce(() => Promise.resolve(false));
      
      const isValid = await ChunkService.verifyChunkIntegrity(chunk);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('streamFileInChunks', () => {
    it('should stream a file in chunks', async () => {
      const file = createMockFile(3.5 * 1024 * 1024);
      const chunkSize = 1024 * 1024;
      const onChunk = jest.fn().mockImplementation(() => Promise.resolve());
      
      await ChunkService.streamFileInChunks(file, chunkSize, onChunk);
      
      expect(onChunk).toHaveBeenCalledTimes(4);
      expect(onChunk.mock.calls[0][0].id).toBe(0);
      expect(onChunk.mock.calls[1][0].id).toBe(1);
      expect(onChunk.mock.calls[2][0].id).toBe(2);
      expect(onChunk.mock.calls[3][0].id).toBe(3);
    });
  });
  
  describe('calculateTotalSize', () => {
    it('should calculate total size of chunks', () => {
      const chunks: FileChunk[] = [
        { id: 0, data: new ArrayBuffer(1000), size: 1000, checksum: '', encrypted: false },
        { id: 1, data: new ArrayBuffer(2000), size: 2000, checksum: '', encrypted: false },
        { id: 2, data: new ArrayBuffer(3000), size: 3000, checksum: '', encrypted: false }
      ];
      
      const totalSize = ChunkService.calculateTotalSize(chunks);
      
      expect(totalSize).toBe(6000);
    });
  });
  
  describe('validateManifest', () => {
    it('should validate a valid manifest', () => {
      const manifest: ChunkManifest = {
        totalChunks: 3,
        chunkSize: 1024,
        fileHash: 'hash',
        chunks: [
          { id: 0, size: 1024, checksum: 'check1' },
          { id: 1, size: 1024, checksum: 'check2' },
          { id: 2, size: 1024, checksum: 'check3' }
        ]
      };
      
      expect(ChunkService.validateManifest(manifest)).toBe(true);
    });
    
    it('should reject manifest with missing fields', () => {
      const manifest = {
        totalChunks: 3,
        // Missing chunkSize
        fileHash: 'hash',
        chunks: []
      } as unknown as ChunkManifest;
      
      expect(ChunkService.validateManifest(manifest)).toBe(false);
    });
    
    it('should reject manifest with chunk count mismatch', () => {
      const manifest: ChunkManifest = {
        totalChunks: 3,
        chunkSize: 1024,
        fileHash: 'hash',
        chunks: [
          { id: 0, size: 1024, checksum: 'check1' },
          { id: 1, size: 1024, checksum: 'check2' }
          // Missing one chunk
        ]
      };
      
      expect(ChunkService.validateManifest(manifest)).toBe(false);
    });
    
    it('should reject manifest with invalid chunk entries', () => {
      const manifest: ChunkManifest = {
        totalChunks: 2,
        chunkSize: 1024,
        fileHash: 'hash',
        chunks: [
          { id: 0, size: 1024, checksum: 'check1' },
          { id: 1, size: 'invalid' as unknown as number, checksum: 'check2' }
        ]
      };
      
      expect(ChunkService.validateManifest(manifest)).toBe(false);
    });
  });
});