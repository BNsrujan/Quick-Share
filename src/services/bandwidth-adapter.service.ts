/**
 * Bandwidth adaptation and connection quality monitoring service
 * 
 * This service provides advanced transfer optimizations with:
 * - Real-time bandwidth monitoring and adaptation
 * - Dynamic chunk sizing based on connection quality
 * - Connection quality assessment and reporting
 * - Graceful degradation for slower connections
 * - Performance analytics collection
 */

import { ConnectionQuality } from '../types/p2p-engine';
import { ChunkManifest } from '../types/chunk';

export interface BandwidthStats {
  timestamp: number;
  bytesTransferred: number;
  transferDuration: number;
  bytesPerSecond: number;
  rtt: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'poor';
}

export interface AdaptationConfig {
  minChunkSize: number;
  maxChunkSize: number;
  initialChunkSize: number;
  adaptationInterval: number;
  samplingWindow: number;
  aggressiveness: number;
  minParallelChannels: number;
  maxParallelChannels: number;
}

export interface PerformanceMetrics {
  averageSpeed: number;
  peakSpeed: number;
  lowestSpeed: number;
  averageRtt: number;
  averagePacketLoss: number;
  qualityChanges: number;
  adaptationEvents: number;
  timeInExcellentQuality: number;
  timeInGoodQuality: number;
  timeInPoorQuality: number;
}

export class BandwidthAdapterService {
  private static readonly DEFAULT_CONFIG: AdaptationConfig = {
    minChunkSize: 16 * 1024, // 16KB
    maxChunkSize: 16 * 1024 * 1024, // 16MB
    initialChunkSize: 1024 * 1024, // 1MB
    adaptationInterval: 2000, // 2 seconds
    samplingWindow: 10000, // 10 seconds
    aggressiveness: 1.5, // Adaptation aggressiveness factor
    minParallelChannels: 1,
    maxParallelChannels: 6
  };

  private config: AdaptationConfig;
  private bandwidthSamples: BandwidthStats[] = [];
  private adaptationTimer: NodeJS.Timeout | null = null;
  private currentChunkSize: number;
  private currentChannelCount: number;
  private lastQuality: ConnectionQuality['quality'] = 'good';
  private adaptationEnabled = true;
  private performanceMetrics: PerformanceMetrics = {
    averageSpeed: 0,
    peakSpeed: 0,
    lowestSpeed: Infinity,
    averageRtt: 0,
    averagePacketLoss: 0,
    qualityChanges: 0,
    adaptationEvents: 0,
    timeInExcellentQuality: 0,
    timeInGoodQuality: 0,
    timeInPoorQuality: 0
  };
  private qualityStartTime: Record<string, number> = {
    excellent: 0,
    good: 0,
    poor: 0
  };
  private onChunkSizeChange: ((size: number) => void) | null = null;
  private onChannelCountChange: ((count: number) => void) | null = null;

  constructor(config?: Partial<AdaptationConfig>) {
    this.config = { ...BandwidthAdapterService.DEFAULT_CONFIG, ...config };
    this.currentChunkSize = this.config.initialChunkSize;
    this.currentChannelCount = Math.ceil((this.config.minParallelChannels + this.config.maxParallelChannels) / 2);
    this.qualityStartTime[this.lastQuality] = Date.now();
  }

  /**
   * Start bandwidth adaptation
   */
  startAdaptation(): void {
    this.stopAdaptation();
    
    this.adaptationTimer = setInterval(() => {
      if (this.adaptationEnabled) {
        this.adaptTransferParameters();
      }
    }, this.config.adaptationInterval);
  }

  /**
   * Stop bandwidth adaptation
   */
  stopAdaptation(): void {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
  }

  /**
   * Enable or disable adaptation
   * 
   * @param enabled Whether adaptation should be enabled
   */
  setAdaptationEnabled(enabled: boolean): void {
    this.adaptationEnabled = enabled;
  }

  /**
   * Add a bandwidth sample
   * 
   * @param stats Bandwidth statistics
   */
  addBandwidthSample(stats: Omit<BandwidthStats, 'timestamp'>): void {
    const sample: BandwidthStats = {
      ...stats,
      timestamp: Date.now()
    };

    this.bandwidthSamples.push(sample);
    
    // Update performance metrics
    this.updatePerformanceMetrics(sample);
    
    // Trim old samples outside the sampling window
    this.trimSamples();
  }

  /**
   * Update connection quality
   * 
   * @param quality Connection quality information
   */
  updateConnectionQuality(quality: ConnectionQuality): void {
    // Track quality change
    if (quality.quality !== this.lastQuality) {
      // Update time spent in previous quality
      const now = Date.now();
      const timeInPreviousQuality = now - this.qualityStartTime[this.lastQuality];
      
      switch (this.lastQuality) {
        case 'excellent':
          this.performanceMetrics.timeInExcellentQuality += timeInPreviousQuality;
          break;
        case 'good':
          this.performanceMetrics.timeInGoodQuality += timeInPreviousQuality;
          break;
        case 'poor':
          this.performanceMetrics.timeInPoorQuality += timeInPreviousQuality;
          break;
      }
      
      // Reset timer for new quality
      this.qualityStartTime[quality.quality] = now;
      this.lastQuality = quality.quality;
      this.performanceMetrics.qualityChanges++;
      
      // Immediately adapt parameters on quality change
      if (this.adaptationEnabled) {
        this.adaptTransferParameters();
      }
    }
  }

  /**
   * Get optimal chunk size based on current conditions
   * 
   * @returns Optimal chunk size in bytes
   */
  getOptimalChunkSize(): number {
    return this.currentChunkSize;
  }

  /**
   * Get optimal number of parallel channels
   * 
   * @returns Optimal number of parallel channels
   */
  getOptimalChannelCount(): number {
    return this.currentChannelCount;
  }

  /**
   * Get current performance metrics
   * 
   * @returns Performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Update time in current quality before returning metrics
    const now = Date.now();
    const timeInCurrentQuality = now - this.qualityStartTime[this.lastQuality];
    
    const metrics = { ...this.performanceMetrics };
    
    switch (this.lastQuality) {
      case 'excellent':
        metrics.timeInExcellentQuality += timeInCurrentQuality;
        break;
      case 'good':
        metrics.timeInGoodQuality += timeInCurrentQuality;
        break;
      case 'poor':
        metrics.timeInPoorQuality += timeInCurrentQuality;
        break;
    }
    
    return metrics;
  }

  /**
   * Register callback for chunk size changes
   * 
   * @param callback Function to call when chunk size changes
   */
  onOptimalChunkSizeChange(callback: (size: number) => void): void {
    this.onChunkSizeChange = callback;
  }

  /**
   * Register callback for channel count changes
   * 
   * @param callback Function to call when channel count changes
   */
  onOptimalChannelCountChange(callback: (count: number) => void): void {
    this.onChannelCountChange = callback;
  }

  /**
   * Adapt chunk size for a specific file size
   * 
   * @param fileSize Size of the file in bytes
   * @returns Adapted chunk size in bytes
   */
  adaptChunkSizeForFileSize(fileSize: number): number {
    // Base chunk size on file size and current connection quality
    let baseSize: number;
    
    if (fileSize < 10 * 1024 * 1024) { // < 10MB
      baseSize = 256 * 1024; // 256KB
    } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
      baseSize = 1024 * 1024; // 1MB
    } else if (fileSize < 1024 * 1024 * 1024) { // < 1GB
      baseSize = 2 * 1024 * 1024; // 2MB
    } else {
      baseSize = 5 * 1024 * 1024; // 5MB
    }
    
    // Adjust based on connection quality
    switch (this.lastQuality) {
      case 'excellent':
        baseSize *= 2;
        break;
      case 'good':
        // Keep base size
        break;
      case 'poor':
        baseSize = Math.max(this.config.minChunkSize, baseSize / 2);
        break;
    }
    
    // Ensure within configured limits
    return Math.max(
      this.config.minChunkSize,
      Math.min(this.config.maxChunkSize, baseSize)
    );
  }

  /**
   * Adapt manifest for large file transfer
   * 
   * @param manifest Original chunk manifest
   * @param maxMemoryUsage Maximum memory usage in bytes
   * @returns Adapted manifest with optimized chunk sizes
   */
  adaptManifestForLargeFile(manifest: ChunkManifest, maxMemoryUsage: number = 100 * 1024 * 1024): ChunkManifest {
    // For very large files, we need to ensure we don't use too much memory
    // by having too many chunks in memory at once
    
    const totalSize = manifest.totalSize || manifest.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    // If file is small enough, no adaptation needed
    if (totalSize <= maxMemoryUsage) {
      return manifest;
    }
    
    // Calculate optimal chunk size to stay within memory limits
    // while maintaining reasonable number of chunks
    const optimalChunkCount = Math.ceil(totalSize / this.currentChunkSize);
    const memoryPerChunk = maxMemoryUsage / this.currentChannelCount;
    const maxChunkSize = Math.min(this.config.maxChunkSize, memoryPerChunk);
    
    // Create adapted manifest
    return {
      ...manifest,
      chunkSize: maxChunkSize,
      totalChunks: Math.ceil(totalSize / maxChunkSize),
      chunks: manifest.chunks.map((chunk, index) => ({
        ...chunk,
        size: Math.min(maxChunkSize, chunk.size)
      }))
    };
  }

  /**
   * Get recommended transfer batch size
   * 
   * @returns Number of chunks to process in a batch
   */
  getRecommendedBatchSize(): number {
    // Adjust batch size based on connection quality
    switch (this.lastQuality) {
      case 'excellent':
        return 10;
      case 'good':
        return 5;
      case 'poor':
        return 2;
      default:
        return 3;
    }
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      averageSpeed: 0,
      peakSpeed: 0,
      lowestSpeed: Infinity,
      averageRtt: 0,
      averagePacketLoss: 0,
      qualityChanges: 0,
      adaptationEvents: 0,
      timeInExcellentQuality: 0,
      timeInGoodQuality: 0,
      timeInPoorQuality: 0
    };
    
    const now = Date.now();
    this.qualityStartTime = {
      excellent: now,
      good: now,
      poor: now
    };
    this.qualityStartTime[this.lastQuality] = now;
  }

  /**
   * Trim old samples outside the sampling window
   */
  private trimSamples(): void {
    const cutoffTime = Date.now() - this.config.samplingWindow;
    this.bandwidthSamples = this.bandwidthSamples.filter(sample => sample.timestamp >= cutoffTime);
  }

  /**
   * Update performance metrics with new sample
   * 
   * @param sample New bandwidth sample
   */
  private updatePerformanceMetrics(sample: BandwidthStats): void {
    // Update speed metrics
    this.performanceMetrics.peakSpeed = Math.max(this.performanceMetrics.peakSpeed, sample.bytesPerSecond);
    
    if (sample.bytesPerSecond > 0) {
      this.performanceMetrics.lowestSpeed = Math.min(this.performanceMetrics.lowestSpeed, sample.bytesPerSecond);
    }
    
    // Update average metrics
    const sampleCount = this.bandwidthSamples.length;
    
    if (sampleCount > 0) {
      const totalSpeed = this.bandwidthSamples.reduce((sum, s) => sum + s.bytesPerSecond, 0);
      const totalRtt = this.bandwidthSamples.reduce((sum, s) => sum + s.rtt, 0);
      const totalPacketLoss = this.bandwidthSamples.reduce((sum, s) => sum + s.packetLoss, 0);
      
      this.performanceMetrics.averageSpeed = totalSpeed / sampleCount;
      this.performanceMetrics.averageRtt = totalRtt / sampleCount;
      this.performanceMetrics.averagePacketLoss = totalPacketLoss / sampleCount;
    }
  }

  /**
   * Adapt transfer parameters based on current conditions
   */
  private adaptTransferParameters(): void {
    if (this.bandwidthSamples.length === 0) {
      return;
    }
    
    this.performanceMetrics.adaptationEvents++;
    
    // Calculate average bandwidth from recent samples
    const recentSamples = this.bandwidthSamples.slice(-5);
    const avgBandwidth = recentSamples.reduce((sum, s) => sum + s.bytesPerSecond, 0) / recentSamples.length;
    const avgRtt = recentSamples.reduce((sum, s) => sum + s.rtt, 0) / recentSamples.length;
    const avgPacketLoss = recentSamples.reduce((sum, s) => sum + s.packetLoss, 0) / recentSamples.length;
    
    // Adapt chunk size based on bandwidth and RTT
    let newChunkSize = this.currentChunkSize;
    let newChannelCount = this.currentChannelCount;
    
    switch (this.lastQuality) {
      case 'excellent':
        // Increase chunk size and channel count
        newChunkSize = Math.min(this.config.maxChunkSize, this.currentChunkSize * 1.2);
        newChannelCount = Math.min(this.config.maxParallelChannels, this.currentChannelCount + 1);
        break;
        
      case 'good':
        // Slightly adjust chunk size based on trend
        if (avgBandwidth > 1000000 && avgRtt < 100) { // > 1MB/s and < 100ms
          newChunkSize = Math.min(this.config.maxChunkSize, this.currentChunkSize * 1.1);
        } else if (avgBandwidth < 500000 || avgRtt > 200) { // < 500KB/s or > 200ms
          newChunkSize = Math.max(this.config.minChunkSize, this.currentChunkSize * 0.9);
        }
        break;
        
      case 'poor':
        // Reduce chunk size and channel count
        newChunkSize = Math.max(this.config.minChunkSize, this.currentChunkSize * 0.7);
        newChannelCount = Math.max(this.config.minParallelChannels, this.currentChannelCount - 1);
        break;
    }
    
    // Apply changes if significant
    if (Math.abs(newChunkSize - this.currentChunkSize) / this.currentChunkSize > 0.1) {
      this.currentChunkSize = Math.round(newChunkSize);
      if (this.onChunkSizeChange) {
        this.onChunkSizeChange(this.currentChunkSize);
      }
    }
    
    if (newChannelCount !== this.currentChannelCount) {
      this.currentChannelCount = newChannelCount;
      if (this.onChannelCountChange) {
        this.onChannelCountChange(this.currentChannelCount);
      }
    }
  }
}