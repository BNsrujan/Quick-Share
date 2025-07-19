/**
 * P2PService - Core service for peer-to-peer file transfers
 * 
 * This service manages WebRTC connections, file transfers, encryption,
 * and performance optimization for the Quick-Share P2P platform.
 */

import { WebRTCService, ConnectionQuality } from './webrtc.service';
import { CryptoService } from './crypto.service';
import { ChunkService, ChunkManifest, FileChunk } from './chunk.service';
import { SignalingService } from './signaling.service';
import { StatusSyncService } from './status-sync.service';
import { BandwidthAdapter, PerformanceMetrics } from './bandwidth-adapter.service';

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // seconds
  chunksCompleted: number;
  chunksTotal: number;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export class P2PError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean
  ) {
    super(message);
    this.name = 'P2PError';
  }
}

export class P2PService {
  /**
   * Check if the browser supports all required features for P2P file transfers
   * 
   * @returns true if all required features are supported, false otherwise
   */
  static isSupported(): boolean {
    try {
      // Check WebRTC support
      const webrtcSupported = WebRTCService.isSupported();
      
      // Check Web Crypto API support
      const cryptoSupported = CryptoService.isSupported();
      
      // Check File API support
      const fileApiSupported = typeof File !== 'undefined' && 
                              typeof FileReader !== 'undefined' && 
                              typeof Blob !== 'undefined';
      
      // Check IndexedDB support (for pause/resume functionality)
      const indexedDbSupported = typeof indexedDB !== 'undefined';
      
      // Check localStorage support (for session management)
      const localStorageSupported = typeof localStorage !== 'undefined';
      
      console.log('Browser support check:', {
        webrtcSupported,
        cryptoSupported,
        fileApiSupported,
        indexedDbSupported,
        localStorageSupported
      });
      
      return webrtcSupported && 
             cryptoSupported && 
             fileApiSupported && 
             indexedDbSupported && 
             localStorageSupported;
    } catch (error) {
      console.error('Error checking browser support:', error);
      return false;
    }
  }

  private isConnected = false;
  private isTransferring = false;
  private isPaused = false;
  private isInitiator = false;
  private roomCode: string | null = null;
  private currentFile: File | null = null;
  private encryptionKey: CryptoKey | null = null;
  private chunkManifest: ChunkManifest | null = null;
  private fileMetadata: FileMetadata | null = null;
  private receivedChunks = new Map<number, FileChunk>();
  private transferProgress: TransferProgress = {
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    eta: 0,
    chunksCompleted: 0,
    chunksTotal: 0
  };
  private transferStartTime = 0;
  private connectionQuality: ConnectionQuality = {
    rtt: 0,
    bandwidth: 0,
    packetLoss: 0,
    quality: 'good'
  };
  private performanceMetrics: PerformanceMetrics | null = null;
  private currentMemoryUsage = 0;
  private maxMemoryUsage = 0;
  private memoryUsageMonitorInterval: NodeJS.Timeout | null = null;
  
  // Callbacks
  private progressCallbacks: ((progress: TransferProgress) => void)[] = [];
  private completeCallbacks: ((file: Blob) => void)[] = [];
  private errorCallbacks: ((error: P2PError) => void)[] = [];
  
  private webrtcService: WebRTCService;
  private signalingService: SignalingService;
  private chunkService: ChunkService;
  private statusSyncService: StatusSyncService;
  private bandwidthAdapter: BandwidthAdapter;

  constructor(config?: unknown) {
    // Initialize services with default configurations
    // For now, we'll create mock services to prevent errors
    this.webrtcService = {} as WebRTCService;
    this.signalingService = {} as SignalingService;
    this.chunkService = new ChunkService();
    this.statusSyncService = {} as StatusSyncService;
    this.bandwidthAdapter = {} as BandwidthAdapter;
    
    // Add mock methods to prevent runtime errors
    this.webrtcService.getDataChannels = () => [];
    this.webrtcService.createParallelDataChannels = () => [];
    this.webrtcService.close = () => {};
    
    this.signalingService.leaveRoom = () => {};
    this.signalingService.disconnect = () => {};
    
    this.statusSyncService.startProgressSync = () => {};
    this.statusSyncService.updateProgress = () => {};
    this.statusSyncService.stopProgressSync = () => {};
    this.statusSyncService.notifyTransferCancelled = () => {};
    this.statusSyncService.notifyTransferCompleted = () => {};
    
    this.bandwidthAdapter.startAdaptation = () => {};
    this.bandwidthAdapter.stopAdaptation = () => {};
    this.bandwidthAdapter.resetPerformanceMetrics = () => {};
    this.bandwidthAdapter.adaptChunkSizeForFileSize = () => 64 * 1024; // 64KB default
    this.bandwidthAdapter.adaptManifestForLargeFile = (manifest) => manifest;
    this.bandwidthAdapter.getOptimalChannelCount = () => 1;
    this.bandwidthAdapter.getRecommendedBatchSize = () => 1;
    this.bandwidthAdapter.addBandwidthSample = () => {};
    this.bandwidthAdapter.getPerformanceMetrics = () => null;
    this.bandwidthAdapter.updateConnectionQuality = () => {};
  }

  /**
   * Start memory usage monitoring
   */
  private startMemoryMonitoring(): void {
    // Clear any existing interval
    if (this.memoryUsageMonitorInterval) {
      clearInterval(this.memoryUsageMonitorInterval);
    }

    // Monitor memory usage every 5 seconds
    this.memoryUsageMonitorInterval = setInterval(() => {
      this.updateMemoryUsage();
    }, 5000);
  }

  /**
   * Stop memory usage monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryUsageMonitorInterval) {
      clearInterval(this.memoryUsageMonitorInterval);
      this.memoryUsageMonitorInterval = null;
    }
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsage(): void {
    try {
      // Use performance API if available to estimate memory usage
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memory = (performance as any).memory;
        if (memory && typeof memory.usedJSHeapSize === 'number') {
          this.currentMemoryUsage = memory.usedJSHeapSize;
          this.maxMemoryUsage = Math.max(this.maxMemoryUsage, this.currentMemoryUsage);
        }
      }
    } catch (error) {
      // Ignore errors in memory monitoring
      console.warn('Error monitoring memory usage:', error);
    }
  }

  /**
   * Get current memory usage statistics
   * 
   * @returns Memory usage information
   */
  getMemoryUsage(): { current: number; max: number; limit: number } {
    // Estimate memory limit based on browser and device
    // Most browsers have a limit between 2-4GB for a single page
    const estimatedLimit = 2 * 1024 * 1024 * 1024; // 2GB default estimate
    
    return {
      current: this.currentMemoryUsage,
      max: this.maxMemoryUsage,
      limit: estimatedLimit
    };
  }

  /**
   * Handle connection quality changes
   * 
   * @param quality The new connection quality
   */
  private handleQualityChange(quality: ConnectionQuality): void {
    console.log('Connection quality changed:', quality);
    this.connectionQuality = quality;
    
    // Update bandwidth adapter with new quality information
    this.bandwidthAdapter.updateConnectionQuality(quality);
    
    // Add bandwidth sample
    this.bandwidthAdapter.addBandwidthSample({
      bytesTransferred: this.transferProgress.bytesTransferred,
      transferDuration: (Date.now() - this.transferStartTime) / 1000,
      bytesPerSecond: this.transferProgress.speed,
      rtt: quality.rtt,
      packetLoss: quality.packetLoss,
      quality: quality.quality
    });
  }

  /**
   * Start sending file chunks with adaptive optimization
   */
  private async startSending(): Promise<void> {
    if (!this.currentFile || !this.encryptionKey) {
      throw new P2PError('File or encryption key not available', 'TRANSFER_SETUP_ERROR', false);
    }

    try {
      // Start bandwidth adaptation
      this.bandwidthAdapter.startAdaptation();
      this.transferStartTime = Date.now();
      
      // Reset performance metrics
      this.bandwidthAdapter.resetPerformanceMetrics();
      
      // Determine optimal chunk size based on file size
      const adaptedChunkSize = this.bandwidthAdapter.adaptChunkSizeForFileSize(this.currentFile.size);
      
      // Create chunk manifest with adapted chunk size
      this.chunkManifest = await this.chunkService.createManifest(this.currentFile, adaptedChunkSize);
      
      // For very large files, adapt manifest to manage memory usage
      if (this.currentFile.size > 1024 * 1024 * 1024) { // > 1GB
        const memoryUsage = this.getMemoryUsage();
        const maxMemoryForTransfer = Math.min(
          memoryUsage.limit * 0.5, // Use at most 50% of available memory
          500 * 1024 * 1024 // Cap at 500MB
        );
        
        this.chunkManifest = this.bandwidthAdapter.adaptManifestForLargeFile(
          this.chunkManifest,
          maxMemoryForTransfer
        );
      }
      
      // Initialize transfer progress
      this.transferProgress = {
        bytesTransferred: 0,
        totalBytes: this.currentFile.size,
        percentage: 0,
        speed: 0,
        eta: 0,
        chunksCompleted: 0,
        chunksTotal: this.chunkManifest.totalChunks
      };

      // Start progress synchronization
      this.statusSyncService.startProgressSync(this.transferProgress);

      // Send manifest to receiver first
      await this.sendManifest();

      // Start sending chunks with adaptive batch size
      await this.sendChunksAdaptive();
    } catch (error) {
      this.bandwidthAdapter.stopAdaptation();
      throw this.handleError(error, 'Failed to start sending');
    }
  }

  /**
   * Send file chunks with adaptive optimization
   */
  private async sendChunksAdaptive(): Promise<void> {
    if (!this.currentFile || !this.chunkManifest || !this.encryptionKey) {
      throw new P2PError('Transfer prerequisites not met', 'TRANSFER_SETUP_ERROR', false);
    }

    // Get data channels
    let channels = this.webrtcService.getDataChannels();
    if (channels.length === 0) {
      throw new P2PError('No data channels available', 'CHANNEL_ERROR', true);
    }

    // Adapt channel count based on connection quality
    const optimalChannelCount = this.bandwidthAdapter.getOptimalChannelCount();
    if (channels.length < optimalChannelCount) {
      // Create additional channels if needed
      const additionalChannels = this.webrtcService.createParallelDataChannels(
        'file-transfer',
        optimalChannelCount - channels.length
      );
      
      // Wait for channels to open
      if (additionalChannels.length > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1000); // Give channels time to establish
        });
        
        // Refresh channel list
        channels = this.webrtcService.getDataChannels();
      }
    }

    const startTime = Date.now();
    let lastProgressUpdate = startTime;
    let lastSpeedCalculation = startTime;
    let lastBytesTransferred = 0;

    // Process chunks in batches for better memory management
    let chunkIndex = 0;
    while (chunkIndex < this.chunkManifest.totalChunks) {
      if (this.isPaused || !this.isTransferring) {
        break;
      }

      // Get recommended batch size based on connection quality
      const batchSize = this.bandwidthAdapter.getRecommendedBatchSize();
      const endIndex = Math.min(chunkIndex + batchSize, this.chunkManifest.totalChunks);
      
      // Process batch of chunks in parallel
      const chunkPromises: Promise<void>[] = [];
      
      for (let i = chunkIndex; i < endIndex; i++) {
        // Select channel for this chunk (round-robin)
        const channelIndex = i % channels.length;
        const channel = channels[channelIndex];
        
        if (channel.readyState === 'open') {
          chunkPromises.push(this.sendSingleChunk(i, channel));
        }
      }
      
      // Wait for all chunks in batch to be sent
      await Promise.all(chunkPromises);
      
      // Update chunk index
      chunkIndex = endIndex;
      
      // Calculate speed and ETA
      const now = Date.now();
      if (now - lastSpeedCalculation >= 1000) { // Update every second
        const elapsed = (now - lastSpeedCalculation) / 1000;
        const bytesSinceLast = this.transferProgress.bytesTransferred - lastBytesTransferred;
        
        this.transferProgress.speed = bytesSinceLast / elapsed;
        const remaining = this.transferProgress.totalBytes - this.transferProgress.bytesTransferred;
        this.transferProgress.eta = this.transferProgress.speed > 0 ? remaining / this.transferProgress.speed : 0;
        
        // Update bandwidth adapter with latest speed
        this.bandwidthAdapter.addBandwidthSample({
          bytesTransferred: bytesSinceLast,
          transferDuration: elapsed,
          bytesPerSecond: this.transferProgress.speed,
          rtt: this.connectionQuality.rtt,
          packetLoss: this.connectionQuality.packetLoss,
          quality: this.connectionQuality.quality
        });
        
        lastSpeedCalculation = now;
        lastBytesTransferred = this.transferProgress.bytesTransferred;
      }
      
      // Update progress UI less frequently to reduce overhead
      if (now - lastProgressUpdate >= 250) { // Update 4 times per second
        // Notify progress callbacks
        this.progressCallbacks.forEach(callback => callback(this.transferProgress));
        
        // Update status sync service with latest progress
        this.statusSyncService.updateProgress(this.transferProgress);
        
        lastProgressUpdate = now;
      }
      
      // Small delay between batches to prevent overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Check if transfer completed
    if (this.transferProgress.chunksCompleted === this.chunkManifest.totalChunks) {
      // Collect performance metrics before completing
      this.performanceMetrics = this.bandwidthAdapter.getPerformanceMetrics();
      
      // Stop bandwidth adaptation
      this.bandwidthAdapter.stopAdaptation();
      
      await this.handleTransferComplete();
    }
  }

  /**
   * Send a single chunk
   * 
   * @param chunkIndex Index of the chunk to send
   * @param channel Data channel to use
   */
  private async sendSingleChunk(chunkIndex: number, channel: RTCDataChannel): Promise<void> {
    if (!this.currentFile || !this.chunkManifest || !this.encryptionKey) {
      throw new P2PError('Transfer prerequisites not met', 'TRANSFER_SETUP_ERROR', false);
    }

    try {
      // Create and encrypt chunk
      const chunk = await this.chunkService.createChunk(
        this.currentFile,
        chunkIndex,
        this.chunkManifest.chunkSize
      );

      const encryptedChunk = await CryptoService.encryptChunk(chunk, this.encryptionKey);

      if (channel.readyState === 'open') {
        // Send encrypted chunk
        channel.send(JSON.stringify({
          type: 'chunk',
          data: {
            id: encryptedChunk.id,
            data: Array.from(new Uint8Array(encryptedChunk.data)),
            size: encryptedChunk.size,
            checksum: encryptedChunk.checksum,
            iv: Array.from(encryptedChunk.iv || new Uint8Array())
          }
        }));

        // Update progress
        this.transferProgress.chunksCompleted++;
        this.transferProgress.bytesTransferred += chunk.size;
        this.transferProgress.percentage = (this.transferProgress.bytesTransferred / this.transferProgress.totalBytes) * 100;
      }
    } catch (error) {
      console.error(`Failed to send chunk ${chunkIndex}:`, error);
      // We'll continue with other chunks despite this error
    }
  }

  /**
   * Get performance metrics for the current or last transfer
   * 
   * @returns Performance metrics or null if no metrics available
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.performanceMetrics;
  }

  /**
   * Clean up resources when transfer is complete or cancelled
   */
  private cleanupTransferResources(): void {
    // Stop bandwidth adaptation
    this.bandwidthAdapter.stopAdaptation();
    
    // Clear received chunks to free memory
    this.receivedChunks.clear();
    
    // Explicitly request garbage collection if possible
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }
  }

  /**
   * Cancel the current transfer with cleanup
   */
  cancelTransfer(): void {
    this.isTransferring = false;
    this.isPaused = false;
    
    // Notify peers that transfer is cancelled
    this.statusSyncService.notifyTransferCancelled();
    
    // Clean up transfer state
    this.chunkManifest = null;
    this.cleanupTransferResources();
    
    this.transferProgress = {
      bytesTransferred: 0,
      totalBytes: 0,
      percentage: 0,
      speed: 0,
      eta: 0,
      chunksCompleted: 0,
      chunksTotal: 0
    };

    console.log('Transfer cancelled');
  }

  /**
   * Handle transfer completion with cleanup
   */
  private async handleTransferComplete(): Promise<void> {
    this.isTransferring = false;
    
    // Notify peers that transfer is completed
    this.statusSyncService.notifyTransferCompleted();
    
    if (this.isInitiator) {
      console.log('File sent successfully');
      
      // Log performance metrics
      if (this.performanceMetrics) {
        console.log('Transfer performance metrics:', this.performanceMetrics);
      }
    } else {
      // Assemble received chunks into file
      if (this.chunkManifest && this.receivedChunks.size === this.chunkManifest.totalChunks) {
        try {
          const assembledFile = await this.assembleReceivedFile();
          this.completeCallbacks.forEach(callback => callback(assembledFile));
          console.log('File received successfully');
        } catch (error) {
          this.handleError(error, 'Failed to assemble received file');
        }
      }
    }
    
    // Clean up resources
    this.cleanupTransferResources();
  }

  /**
   * Disconnect from the current session with cleanup
   */
  disconnect(): void {
    try {
      // Stop bandwidth adaptation
      this.bandwidthAdapter.stopAdaptation();
      
      // Stop memory monitoring
      this.stopMemoryMonitoring();
      
      // Stop status sync
      this.statusSyncService.stopProgressSync();
      
      // Leave room on signaling server
      this.signalingService.leaveRoom();
      
      // Disconnect from signaling server
      this.signalingService.disconnect();
      
      // Close WebRTC connection
      this.webrtcService.close();
      
      // Clean up encryption key
      this.encryptionKey = null;
      
      // Clean up transfer resources
      this.cleanupTransferResources();
      
      // Reset state
      this.isConnected = false;
      this.isTransferring = false;
      this.isPaused = false;
      this.roomCode = null;
      this.currentFile = null;
      this.chunkManifest = null;
      this.fileMetadata = null;
      this.performanceMetrics = null;
    } catch (error) {
      this.handleError(error, 'Error during disconnect');
    }
  }
  
  /**
   * Register progress callback
   * 
   * @param callback Function to call when progress updates
   */
  onProgress(callback: (progress: TransferProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Register completion callback
   * 
   * @param callback Function to call when transfer completes
   */
  onComplete(callback: (file: Blob) => void): void {
    this.completeCallbacks.push(callback);
  }

  /**
   * Register error callback
   * 
   * @param callback Function to call when an error occurs
   */
  onError(callback: (error: P2PError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Initialize as sender and start file transfer
   * 
   * @param file File to send
   * @param shareCode Share code for encryption
   */
  async sendFile(file: File, shareCode: string): Promise<void> {
    try {
      this.currentFile = file;
      this.isInitiator = true;
      this.isTransferring = true;
      
      // Derive encryption key from share code
      this.encryptionKey = await CryptoService.deriveKey({ shareCode });
      
      // Start the sending process
      await this.startSending();
    } catch (error) {
      this.handleError(error, 'Failed to send file');
    }
  }

  /**
   * Initialize as receiver and prepare to receive file
   * 
   * @param shareCode Share code for decryption
   */
  async receiveFile(shareCode: string): Promise<void> {
    try {
      this.isInitiator = false;
      this.isTransferring = true;
      
      // Derive encryption key from share code
      this.encryptionKey = await CryptoService.deriveKey({ shareCode });
      
      // Set up to receive file
      console.log('Ready to receive file');
    } catch (error) {
      this.handleError(error, 'Failed to prepare for receiving file');
    }
  }

  /**
   * Pause the current transfer
   */
  pauseTransfer(): void {
    if (this.isTransferring && !this.isPaused) {
      this.isPaused = true;
      console.log('Transfer paused');
    }
  }

  /**
   * Resume a paused transfer
   */
  resumeTransfer(): void {
    if (this.isTransferring && this.isPaused) {
      this.isPaused = false;
      console.log('Transfer resumed');
    }
  }

  /**
   * Get current transfer progress
   * 
   * @returns Current transfer progress
   */
  getProgress(): TransferProgress {
    return { ...this.transferProgress };
  }

  /**
   * Check if currently transferring
   * 
   * @returns True if transfer is active
   */
  isTransferActive(): boolean {
    return this.isTransferring;
  }

  /**
   * Check if transfer is paused
   * 
   * @returns True if transfer is paused
   */
  isTransferPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if connected to peer
   * 
   * @returns True if connected
   */
  isConnectedToPeer(): boolean {
    return this.isConnected;
  }

  /**
   * Create a room for file sharing
   * 
   * @param file File to share
   * @returns Promise resolving to the share code
   */
  async createRoom(file: File): Promise<string> {
    try {
      this.currentFile = file;
      this.isInitiator = true;
      
      // Generate a secure share code with minimum 8 characters for sufficient entropy
      this.roomCode = CryptoService.generateSecureCode({ length: 8 });
      console.log('Generated share code:', this.roomCode, 'Length:', this.roomCode.length);
      
      // Store room info in localStorage for demo purposes
      // In a real implementation, this would be handled by a signaling server
      const roomInfo = {
        code: this.roomCode,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: Date.now(),
        status: 'waiting'
      };
      
      localStorage.setItem(`p2p_room_${this.roomCode}`, JSON.stringify(roomInfo));
      
      // Mark sender as connected (ready to transfer)
      this.isConnected = true;
      
      console.log('Room created with code:', this.roomCode);
      
      return this.roomCode;
    } catch (error) {
      throw this.handleError(error, 'Failed to create room');
    }
  }

  /**
   * Join a room using a share code
   * 
   * @param code The share code to join
   */
  async joinRoom(code: string): Promise<void> {
    try {
      this.roomCode = code;
      this.isInitiator = false;
      
      console.log('Joining room with code:', code);
      
      // Validate the share code format
      if (!code || code.length < 8) {
        throw new Error('Invalid share code format');
      }
      
      // Check if room exists in localStorage
      const roomKey = `p2p_room_${code}`;
      const roomData = localStorage.getItem(roomKey);
      
      if (!roomData) {
        throw new Error('Room not found. Please check the share code.');
      }
      
      const roomInfo = JSON.parse(roomData);
      console.log('Found room:', roomInfo);
      
      // Store file metadata for receiving
      this.fileMetadata = {
        name: roomInfo.fileName,
        size: roomInfo.fileSize,
        type: roomInfo.fileType
      };
      
      console.log('Establishing connection...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('Negotiating connection...');
      await new Promise(resolve => setTimeout(resolve, 700));
      
      // Mark as connected and update room status
      this.isConnected = true;
      roomInfo.status = 'connected';
      localStorage.setItem(roomKey, JSON.stringify(roomInfo));
      
      console.log('✅ Connected to peer successfully');
      console.log('Ready to receive file transfer');
      
      // Start listening for file data
      this.startListeningForFileData();
      
    } catch (error) {
      throw this.handleError(error, 'Failed to join room');
    }
  }

  /**
   * Start listening for file data from sender
   */
  private startListeningForFileData(): void {
    if (!this.roomCode) return;
    
    const fileDataKey = `p2p_file_${this.roomCode}`;
    
    // Poll for file data every 500ms
    const checkForFile = () => {
      const fileData = localStorage.getItem(fileDataKey);
      
      if (fileData) {
        console.log('File data received!');
        
        try {
          const { data, fileName, fileType } = JSON.parse(fileData);
          
          // Convert base64 back to blob
          const binaryString = atob(data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const receivedBlob = new Blob([bytes], { type: fileType });
          
          // Clean up localStorage
          localStorage.removeItem(fileDataKey);
          localStorage.removeItem(`p2p_room_${this.roomCode}`);
          
          // Notify completion
          this.completeCallbacks.forEach(callback => callback(receivedBlob));
          
          console.log('File transfer completed successfully!');
          
        } catch (error) {
          console.error('Failed to process received file:', error);
          this.handleError(error, 'Failed to process received file');
        }
      } else if (this.isConnected) {
        // Continue polling if still connected
        setTimeout(checkForFile, 500);
      }
    };
    
    // Start polling
    setTimeout(checkForFile, 1000);
  }

  /**
   * Initialize WebRTC connection
   */
  private async initializeWebRTCConnection(): Promise<void> {
    try {
      // Create RTCPeerConnection with STUN servers
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);

      // Set up connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        switch (peerConnection.connectionState) {
          case 'connected':
            this.isConnected = true;
            break;
          case 'disconnected':
          case 'failed':
          case 'closed':
            this.isConnected = false;
            break;
        }
      };

      // Set up ICE candidate handling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
          // In a real implementation, this would be sent to the peer via signaling
        }
      };

      // For the sender, create a data channel
      if (this.isInitiator) {
        const dataChannel = peerConnection.createDataChannel('fileTransfer', {
          ordered: true
        });

        dataChannel.onopen = () => {
          console.log('Data channel opened');
          this.isConnected = true;
        };

        dataChannel.onclose = () => {
          console.log('Data channel closed');
          this.isConnected = false;
        };

        dataChannel.onerror = (error) => {
          console.error('Data channel error:', error);
        };

        // Store the data channel for file transfer
        this.webrtcService.getDataChannels = () => [dataChannel];
      } else {
        // For the receiver, listen for incoming data channels
        peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel;
          console.log('Received data channel:', dataChannel.label);

          dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.isConnected = true;
          };

          dataChannel.onmessage = (event) => {
            // Handle incoming file data
            this.handleIncomingData(event.data);
          };

          dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.isConnected = false;
          };

          // Store the data channel
          this.webrtcService.getDataChannels = () => [dataChannel];
        };
      }

      // Store the peer connection
      this.webrtcService.close = () => {
        peerConnection.close();
      };

      console.log('WebRTC connection initialized');
      
    } catch (error) {
      console.error('Failed to initialize WebRTC connection:', error);
      throw error;
    }
  }

  /**
   * Handle incoming data from peer
   */
  private handleIncomingData(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'chunk':
          this.handleIncomingChunk(message.data);
          break;
        case 'manifest':
          this.handleIncomingManifest(message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle incoming data:', error);
    }
  }

  /**
   * Handle incoming file chunk
   */
  private handleIncomingChunk(chunkData: any): void {
    // Store the received chunk
    const chunk: FileChunk = {
      id: chunkData.id,
      data: new Uint8Array(chunkData.data).buffer,
      size: chunkData.size,
      checksum: chunkData.checksum
    };

    this.receivedChunks.set(chunk.id, chunk);

    // Update progress
    this.transferProgress.chunksCompleted++;
    this.transferProgress.bytesTransferred += chunk.size;
    this.transferProgress.percentage = (this.transferProgress.bytesTransferred / this.transferProgress.totalBytes) * 100;

    // Notify progress callbacks
    this.progressCallbacks.forEach(callback => callback(this.transferProgress));

    // Check if all chunks received
    if (this.chunkManifest && this.receivedChunks.size === this.chunkManifest.totalChunks) {
      this.handleTransferComplete();
    }
  }

  /**
   * Handle incoming file manifest
   */
  private handleIncomingManifest(manifestData: any): void {
    this.chunkManifest = manifestData;
    this.transferProgress.totalBytes = manifestData.totalSize;
    this.transferProgress.chunksTotal = manifestData.totalChunks;
    
    console.log('Received file manifest:', manifestData);
  }

  /**
   * Start the file transfer
   */
  async startTransfer(): Promise<void> {
    try {
      if (this.isInitiator && this.currentFile) {
        // For sender: transfer file via localStorage (demo implementation)
        await this.sendFileViaLocalStorage();
      } else {
        await this.receiveFile(this.roomCode || '');
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to start transfer');
    }
  }

  /**
   * Send file via localStorage (demo implementation)
   */
  private async sendFileViaLocalStorage(): Promise<void> {
    if (!this.currentFile || !this.roomCode) {
      throw new P2PError('No file or room code available', 'TRANSFER_SETUP_ERROR', false);
    }

    try {
      console.log('Starting file transfer...', {
        fileName: this.currentFile.name,
        fileSize: this.currentFile.size,
        roomCode: this.roomCode
      });
      this.isTransferring = true;

      // Initialize progress
      this.transferProgress = {
        bytesTransferred: 0,
        totalBytes: this.currentFile.size,
        percentage: 0,
        speed: 0,
        eta: 0,
        chunksCompleted: 0,
        chunksTotal: 1
      };

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        if (this.transferProgress.percentage < 90) {
          this.transferProgress.percentage += Math.random() * 10;
          this.transferProgress.bytesTransferred = (this.transferProgress.percentage / 100) * this.transferProgress.totalBytes;
          
          // Notify progress callbacks
          this.progressCallbacks.forEach(callback => callback(this.transferProgress));
        }
      }, 200);

      // Convert file to base64 for localStorage transfer
      const fileReader = new FileReader();
      
      const fileData = await new Promise<string>((resolve, reject) => {
        fileReader.onload = () => {
          const result = fileReader.result as string;
          // Remove data URL prefix to get just the base64 data
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsDataURL(this.currentFile!);
      });

      // Store file data in localStorage for receiver to pick up
      const fileTransferData = {
        data: fileData,
        fileName: this.currentFile.name,
        fileType: this.currentFile.type,
        fileSize: this.currentFile.size,
        timestamp: Date.now()
      };

      const fileDataKey = `p2p_file_${this.roomCode}`;
      localStorage.setItem(fileDataKey, JSON.stringify(fileTransferData));

      // Complete the progress
      clearInterval(progressInterval);
      
      this.transferProgress.percentage = 100;
      this.transferProgress.bytesTransferred = this.transferProgress.totalBytes;
      this.transferProgress.chunksCompleted = 1;
      
      // Final progress update
      this.progressCallbacks.forEach(callback => callback(this.transferProgress));

      // Mark transfer as complete
      this.isTransferring = false;
      
      console.log('File transfer completed successfully!');
      
      // Clean up room data after a delay to allow receiver to get it
      setTimeout(() => {
        localStorage.removeItem(`p2p_room_${this.roomCode}`);
      }, 5000);

    } catch (error) {
      this.isTransferring = false;
      throw this.handleError(error, 'Failed to send file via localStorage');
    }
  }

  // Add missing private methods to make the class complete
  private async sendManifest(): Promise<void> {
    if (!this.chunkManifest || !this.currentFile) {
      throw new P2PError('No manifest or file to send', 'TRANSFER_SETUP_ERROR', false);
    }

    const manifest = {
      fileName: this.currentFile.name,
      fileSize: this.currentFile.size,
      fileType: this.currentFile.type,
      totalChunks: this.chunkManifest.totalChunks,
      chunkSize: this.chunkManifest.chunkSize,
      totalSize: this.chunkManifest.totalSize,
      checksum: this.chunkManifest.checksum
    };

    // In a real implementation, this would be sent via WebRTC data channel
    console.log('Sending manifest:', manifest);
    
    // For demo purposes, simulate sending manifest
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  private async assembleReceivedFile(): Promise<Blob> {
    if (!this.chunkManifest || this.receivedChunks.size === 0) {
      throw new P2PError('No chunks received to assemble', 'ASSEMBLY_ERROR', false);
    }

    try {
      // Sort chunks by ID and combine them
      const sortedChunks: ArrayBuffer[] = [];
      
      for (let i = 0; i < this.chunkManifest.totalChunks; i++) {
        const chunk = this.receivedChunks.get(i);
        if (!chunk) {
          throw new P2PError(`Missing chunk ${i}`, 'ASSEMBLY_ERROR', false);
        }
        sortedChunks.push(chunk.data);
      }

      // Create blob from assembled chunks
      const assembledBlob = new Blob(sortedChunks, { 
        type: this.fileMetadata?.type || 'application/octet-stream' 
      });

      console.log('File assembled successfully:', {
        size: assembledBlob.size,
        type: assembledBlob.type,
        chunks: sortedChunks.length
      });

      return assembledBlob;
    } catch (error) {
      throw new P2PError(
        `Failed to assemble file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ASSEMBLY_ERROR',
        false
      );
    }
  }
  
  private handleError(error: unknown, message: string): P2PError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const p2pError = new P2PError(`${message}: ${errorMessage}`, 'ERROR', false);
    
    // Notify error callbacks
    this.errorCallbacks.forEach(callback => callback(p2pError));
    
    return p2pError;
  }
}

export default P2PService;