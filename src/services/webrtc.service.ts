/**
 * WebRTC connection management service
 * 
 * This service provides a wrapper around WebRTC functionality for establishing
 * peer-to-peer connections and managing data channels for file transfers.
 * 
 * Key features:
 * - Peer connection management with ICE server configuration
 * - Multiple data channel support for parallel transfers
 * - ICE candidate handling and negotiation
 * - Connection state monitoring and event propagation
 * - Automatic reconnection with exponential backoff
 * - Connection quality monitoring and adaptation
 * - Error handling and recovery strategies
 * 
 * Usage:
 * ```typescript
 * // Create WebRTC service
 * const webrtcService = new WebRTCService({
 *   iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
 *   maxRetryAttempts: 3,
 *   initialRetryDelay: 1000,
 *   maxRetryDelay: 10000,
 *   connectionTimeout: 30000,
 *   maxDataChannels: 6
 * });
 * 
 * // Register event handlers
 * webrtcService.registerEvents({
 *   onConnectionStateChange: (state) => console.log(`Connection state: ${state}`),
 *   onDataChannel: (channel) => console.log(`New data channel: ${channel.label}`),
 *   onError: (error) => console.error(`WebRTC error: ${error.message}`)
 * });
 * 
 * // Initialize as sender or receiver
 * webrtcService.initializeAsInitiator(); // For sender
 * // OR
 * webrtcService.initializeAsReceiver(); // For receiver
 * 
 * // Create data channels for file transfer
 * const channels = webrtcService.createParallelDataChannels('file-transfer', 3);
 * ```
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API|MDN WebRTC API}
 */

import { ConnectionQuality } from '../types/p2p-engine';
import { ErrorType, TransferError } from '../types/transfer';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  maxRetryAttempts: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
  connectionTimeout: number;
  maxDataChannels: number;
}

export interface DataChannelConfig {
  id?: number;
  label: string;
  ordered?: boolean;
  maxRetransmits?: number;
  maxPacketLifeTime?: number;
  priority?: RTCPriorityType;
}

export interface WebRTCStats {
  rtt: number;
  bandwidth: number;
  packetLoss: number;
  timestamp: number;
}

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export type DataChannelState = 'connecting' | 'open' | 'closing' | 'closed';

export type SignalingState = 'stable' | 'have-local-offer' | 'have-remote-offer' | 'have-local-pranswer' | 'have-remote-pranswer' | 'closed';

export interface WebRTCEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onDataChannel: (channel: RTCDataChannel) => void;
  onIceCandidate: (candidate: RTCIceCandidate | null) => void;
  onNegotiationNeeded: () => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onSignalingStateChange: (state: SignalingState) => void;
  onError: (error: TransferError) => void;
  onQualityChange: (quality: ConnectionQuality) => void;
}

/**
 * Error thrown when WebRTC operations fail
 */
export class WebRTCError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WebRTCError';
  }
}

/**
 * WebRTC service for managing peer connections and data channels
 */
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private iceCandidates: RTCIceCandidate[] = [];
  private connectionState: ConnectionState = 'new';
  private retryCount = 0;
  private retryTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private lastStats: WebRTCStats | null = null;
  private events: Partial<WebRTCEvents> = {};
  private isInitiator = false;
  private pendingCandidates: RTCIceCandidate[] = [];
  private qualityCheckInterval: NodeJS.Timeout | null = null;

  constructor(private config: WebRTCConfig) {}

  /**
   * Check if WebRTC is supported in the current browser
   * 
   * This method performs a basic check to determine if the browser supports
   * the core WebRTC APIs needed for P2P file transfers.
   * 
   * @returns {boolean} True if WebRTC is supported, false otherwise
   * @example
   * if (WebRTCService.isSupported()) {
   *   // Initialize WebRTC functionality
   * } else {
   *   // Show fallback or error message
   * }
   */
  static isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined' && 
           typeof RTCDataChannel !== 'undefined';
  }

  /**
   * Initialize a new peer connection as the initiator (sender)
   * 
   * The initiator is responsible for creating the offer and data channels.
   * This should be called by the peer that wants to send files.
   * 
   * @example
   * // Initialize as the file sender
   * webrtcService.initializeAsInitiator();
   * // Create data channels for file transfer
   * const channels = webrtcService.createParallelDataChannels('file-transfer', 3);
   * // Create and send offer through signaling server
   * const offer = await webrtcService.createOffer();
   */
  initializeAsInitiator(): void {
    this.isInitiator = true;
    this.initialize();
  }

  /**
   * Initialize a new peer connection as the receiver
   * 
   * The receiver waits for an offer and answers it.
   * This should be called by the peer that wants to receive files.
   * 
   * @example
   * // Initialize as the file receiver
   * webrtcService.initializeAsReceiver();
   * // Register event handler for incoming data channels
   * webrtcService.registerEvents({
   *   onDataChannel: (channel) => {
   *     channel.onmessage = (event) => {
   *       // Handle incoming file chunks
   *     };
   *   }
   * });
   * // Handle offer when received through signaling server
   * const answer = await webrtcService.handleOffer(receivedOffer);
   */
  initializeAsReceiver(): void {
    this.isInitiator = false;
    this.initialize();
  }

  /**
   * Initialize the peer connection with configuration
   */
  private initialize(): void {
    // Close any existing connection
    this.close();

    try {
      // Create new peer connection with ICE servers
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection timeout
      this.startConnectionTimeout();

      this.connectionState = 'new';
    } catch (error) {
      this.handleError(new WebRTCError(
        `Failed to initialize peer connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INITIALIZATION_FAILED'
      ));
    }
  }

  /**
   * Set up event handlers for the peer connection
   */
  private setupEventHandlers(): void {
    if (!this.peerConnection) return;

    // ICE candidate events
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidates.push(event.candidate);
        if (this.events.onIceCandidate) {
          this.events.onIceCandidate(event.candidate);
        }
      } else if (this.events.onIceCandidate) {
        // Null candidate means end of candidates
        this.events.onIceCandidate(null);
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.connectionState as ConnectionState;
      this.connectionState = state;
      
      if (this.events.onConnectionStateChange) {
        this.events.onConnectionStateChange(state);
      }

      // Handle connection state changes
      switch (state) {
        case 'connected':
          this.clearConnectionTimeout();
          this.retryCount = 0;
          this.startQualityMonitoring();
          break;
        case 'disconnected':
          this.handleDisconnection();
          break;
        case 'failed':
          this.handleConnectionFailure();
          break;
        case 'closed':
          this.stopQualityMonitoring();
          break;
      }
    };

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.iceConnectionState;
      
      if (this.events.onIceConnectionStateChange) {
        this.events.onIceConnectionStateChange(state);
      }

      // Additional handling for ICE connection states
      switch (state) {
        case 'failed':
          this.handleIceFailure();
          break;
      }
    };

    // Signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.signalingState as SignalingState;
      
      if (this.events.onSignalingStateChange) {
        this.events.onSignalingStateChange(state);
      }
    };

    // Negotiation needed
    this.peerConnection.onnegotiationneeded = () => {
      if (this.events.onNegotiationNeeded) {
        this.events.onNegotiationNeeded();
      }
    };

    // Remote data channel
    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
      
      if (this.events.onDataChannel) {
        this.events.onDataChannel(event.channel);
      }
    };
  }

  /**
   * Create a data channel with the given configuration
   * 
   * @param config Configuration for the data channel
   * @returns The created data channel
   */
  createDataChannel(config: DataChannelConfig): RTCDataChannel | null {
    if (!this.peerConnection || this.connectionState === 'closed') {
      this.handleError(new WebRTCError(
        'Cannot create data channel: peer connection is not initialized or closed',
        'INVALID_STATE'
      ));
      return null;
    }

    try {
      // Check if we've reached the maximum number of channels
      if (this.dataChannels.size >= this.config.maxDataChannels) {
        this.handleError(new WebRTCError(
          `Maximum number of data channels (${this.config.maxDataChannels}) reached`,
          'MAX_CHANNELS_REACHED'
        ));
        return null;
      }

      // Create the data channel with configuration
      const channel = this.peerConnection.createDataChannel(config.label, {
        ordered: config.ordered ?? true,
        maxRetransmits: config.maxRetransmits,
        maxPacketLifeTime: config.maxPacketLifeTime,
        priority: config.priority ?? 'high',
        id: config.id
      });

      // Set up event handlers for the channel
      this.setupDataChannel(channel);

      return channel;
    } catch (error) {
      this.handleError(new WebRTCError(
        `Failed to create data channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CHANNEL_CREATION_FAILED'
      ));
      return null;
    }
  }

  /**
   * Create multiple data channels for parallel transfers
   * 
   * @param baseLabel Base label for the channels
   * @param count Number of channels to create
   * @returns Array of created data channels
   */
  createParallelDataChannels(baseLabel: string, count: number): RTCDataChannel[] {
    const channels: RTCDataChannel[] = [];
    const actualCount = Math.min(count, this.config.maxDataChannels);

    for (let i = 0; i < actualCount; i++) {
      const channel = this.createDataChannel({
        label: `${baseLabel}-${i}`,
        ordered: true,
        id: i
      });

      if (channel) {
        channels.push(channel);
      }
    }

    return channels;
  }

  /**
   * Set up event handlers for a data channel
   * 
   * @param channel The data channel to set up
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    // Store the channel
    this.dataChannels.set(channel.label, channel);

    // Set up event handlers
    channel.onopen = () => {
      // Channel is ready for use
      console.log(`Data channel ${channel.label} opened`);
    };

    channel.onclose = () => {
      console.log(`Data channel ${channel.label} closed`);
    };

    channel.onerror = (event) => {
      const error = event as RTCErrorEvent;
      this.handleError(new WebRTCError(
        `Data channel error (${channel.label}): ${error.error?.message || 'Unknown error'}`,
        'DATA_CHANNEL_ERROR'
      ));
    };
  }

  /**
   * Create an offer to initiate a connection
   * 
   * @returns Promise resolving to the created offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new WebRTCError('Cannot create offer: peer connection not initialized', 'NOT_INITIALIZED');
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      throw new WebRTCError(
        `Failed to create offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OFFER_CREATION_FAILED'
      );
    }
  }

  /**
   * Handle a received offer
   * 
   * @param offer The received offer
   * @returns Promise resolving to the created answer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new WebRTCError('Cannot handle offer: peer connection not initialized', 'NOT_INITIALIZED');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Apply any pending ICE candidates
      this.applyPendingCandidates();
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      throw new WebRTCError(
        `Failed to handle offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OFFER_HANDLING_FAILED'
      );
    }
  }

  /**
   * Handle a received answer
   * 
   * @param answer The received answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new WebRTCError('Cannot handle answer: peer connection not initialized', 'NOT_INITIALIZED');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Apply any pending ICE candidates
      this.applyPendingCandidates();
    } catch (error) {
      throw new WebRTCError(
        `Failed to handle answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANSWER_HANDLING_FAILED'
      );
    }
  }

  /**
   * Add a received ICE candidate
   * 
   * @param candidate The ICE candidate to add
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      // Store candidate for later if connection isn't ready
      this.pendingCandidates.push(candidate as RTCIceCandidate);
      return;
    }

    // If we don't have a remote description yet, store the candidate for later
    if (!this.peerConnection.remoteDescription) {
      this.pendingCandidates.push(candidate as RTCIceCandidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      throw new WebRTCError(
        `Failed to add ICE candidate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ICE_CANDIDATE_FAILED'
      );
    }
  }

  /**
   * Apply any pending ICE candidates
   */
  private async applyPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to apply pending ICE candidate:', error);
      }
    }
  }

  /**
   * Get all data channels
   * 
   * @returns Array of all data channels
   */
  getDataChannels(): RTCDataChannel[] {
    return Array.from(this.dataChannels.values());
  }

  /**
   * Get a specific data channel by label
   * 
   * @param label The label of the data channel
   * @returns The data channel if found, null otherwise
   */
  getDataChannel(label: string): RTCDataChannel | null {
    return this.dataChannels.get(label) || null;
  }

  /**
   * Get the current connection state
   * 
   * @returns The current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get the current ICE connection state
   * 
   * @returns The current ICE connection state
   */
  getIceConnectionState(): RTCIceConnectionState | null {
    return this.peerConnection?.iceConnectionState || null;
  }

  /**
   * Get the current signaling state
   * 
   * @returns The current signaling state
   */
  getSignalingState(): SignalingState | null {
    return (this.peerConnection?.signalingState as SignalingState) || null;
  }

  /**
   * Register event handlers
   * 
   * @param events The event handlers to register
   */
  registerEvents(events: Partial<WebRTCEvents>): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Start monitoring connection quality
   */
  private startQualityMonitoring(): void {
    this.stopQualityMonitoring();

    // Start collecting stats periodically
    this.qualityCheckInterval = setInterval(() => {
      this.collectConnectionStats();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Stop monitoring connection quality
   */
  private stopQualityMonitoring(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
  }

  /**
   * Collect connection statistics
   */
  private async collectConnectionStats(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();
      
      let rtt = 0;
      let bandwidth = 0;
      let packetLoss = 0;
      let validStats = false;

      stats.forEach(report => {
        if (report.type === 'transport') {
          if ('roundTripTime' in report) {
            rtt = report.roundTripTime as number * 1000; // Convert to ms
            validStats = true;
          }
        } else if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
          if ('bytesReceived' in report || 'bytesSent' in report) {
            const bytes = (report.bytesReceived as number || 0) + (report.bytesSent as number || 0);
            const now = Date.now();
            
            if (this.lastStats && now > this.lastStats.timestamp) {
              const timeDiff = (now - this.lastStats.timestamp) / 1000; // seconds
              bandwidth = (bytes - (this.lastStats.bandwidth || 0)) / timeDiff;
              validStats = true;
            }
          }
          
          if ('packetsLost' in report && 'totalPackets' in report) {
            const totalPackets = (report.totalPackets as number) || 
                               ((report.packetsReceived as number || 0) + (report.packetsLost as number || 0));
            
            if (totalPackets > 0) {
              packetLoss = ((report.packetsLost as number) || 0) / totalPackets * 100;
              validStats = true;
            }
          }
        }
      });

      if (validStats) {
        const quality = this.calculateConnectionQuality(rtt, bandwidth, packetLoss);
        
        this.lastStats = {
          rtt,
          bandwidth,
          packetLoss,
          timestamp: Date.now()
        };

        if (this.events.onQualityChange) {
          this.events.onQualityChange(quality);
        }
      }
    } catch (error) {
      console.error('Failed to collect connection stats:', error);
    }
  }

  /**
   * Calculate connection quality based on stats
   * 
   * @param rtt Round trip time in ms
   * @param bandwidth Bandwidth in bytes/sec
   * @param packetLoss Packet loss percentage
   * @returns Connection quality assessment
   */
  private calculateConnectionQuality(
    rtt: number,
    bandwidth: number,
    packetLoss: number
  ): ConnectionQuality {
    // Define thresholds for quality assessment
    const RTT_EXCELLENT = 100; // ms
    const RTT_GOOD = 300; // ms
    const BANDWIDTH_EXCELLENT = 1000000; // ~1 MB/s
    const BANDWIDTH_GOOD = 300000; // ~300 KB/s
    const PACKET_LOSS_EXCELLENT = 1; // %
    const PACKET_LOSS_GOOD = 5; // %

    // Calculate quality score (0-100)
    let qualityScore = 100;

    // RTT affects score (lower is better)
    if (rtt > RTT_GOOD) {
      qualityScore -= 40;
    } else if (rtt > RTT_EXCELLENT) {
      qualityScore -= 20;
    }

    // Bandwidth affects score (higher is better)
    if (bandwidth < BANDWIDTH_GOOD) {
      qualityScore -= 40;
    } else if (bandwidth < BANDWIDTH_EXCELLENT) {
      qualityScore -= 20;
    }

    // Packet loss affects score (lower is better)
    if (packetLoss > PACKET_LOSS_GOOD) {
      qualityScore -= 40;
    } else if (packetLoss > PACKET_LOSS_EXCELLENT) {
      qualityScore -= 20;
    }

    // Determine quality category
    let quality: ConnectionQuality['quality'];
    if (qualityScore >= 80) {
      quality = 'excellent';
    } else if (qualityScore >= 40) {
      quality = 'good';
    } else {
      quality = 'poor';
    }

    return {
      rtt,
      bandwidth,
      packetLoss,
      quality
    };
  }

  /**
   * Handle disconnection with reconnection attempt
   */
  private handleDisconnection(): void {
    if (this.retryCount >= this.config.maxRetryAttempts) {
      this.handleError(new WebRTCError(
        `Connection failed after ${this.retryCount} retry attempts`,
        'MAX_RETRIES_EXCEEDED'
      ));
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialRetryDelay * Math.pow(2, this.retryCount),
      this.config.maxRetryDelay
    );

    // Schedule reconnection attempt
    this.retryTimeout = setTimeout(() => {
      this.retryCount++;
      this.reconnect();
    }, delay);
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    this.handleError(new WebRTCError(
      'WebRTC connection failed',
      'CONNECTION_FAILED'
    ));
  }

  /**
   * Handle ICE connection failure
   */
  private handleIceFailure(): void {
    this.handleError(new WebRTCError(
      'ICE connection failed',
      'ICE_FAILED'
    ));
  }

  /**
   * Start connection timeout
   */
  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();

    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState !== 'connected') {
        this.handleError(new WebRTCError(
          'Connection timed out',
          'CONNECTION_TIMEOUT'
        ));
      }
    }, this.config.connectionTimeout);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private reconnect(): void {
    console.log(`Attempting to reconnect (attempt ${this.retryCount})`);
    
    // Re-initialize the connection
    this.initialize();
    
    // Notify that reconnection is needed
    if (this.events.onNegotiationNeeded) {
      this.events.onNegotiationNeeded();
    }
  }

  /**
   * Handle WebRTC errors
   * 
   * @param error The error to handle
   */
  private handleError(error: WebRTCError): void {
    console.error('WebRTC error:', error);

    // Map WebRTC errors to transfer errors
    const transferError: TransferError = {
      type: ErrorType.CONNECTION_FAILED,
      message: error.message,
      recoverable: this.retryCount < this.config.maxRetryAttempts,
      retryAfter: this.retryCount < this.config.maxRetryAttempts ? 
        this.config.initialRetryDelay * Math.pow(2, this.retryCount) : 
        undefined,
      details: {
        code: error.code,
        retryCount: this.retryCount,
        maxRetries: this.config.maxRetryAttempts
      }
    };

    // Notify listeners
    if (this.events.onError) {
      this.events.onError(transferError);
    }
  }

  /**
   * Close the connection and clean up resources
   */
  close(): void {
    // Clear timeouts
    this.clearConnectionTimeout();
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    // Stop quality monitoring
    this.stopQualityMonitoring();

    // Close all data channels
    this.dataChannels.forEach(channel => {
      try {
        channel.close();
      } catch (error) {
        console.error('Error closing data channel:', error);
      }
    });
    this.dataChannels.clear();

    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (error) {
        console.error('Error closing peer connection:', error);
      }
      this.peerConnection = null;
    }

    // Reset state
    this.connectionState = 'closed';
    this.iceCandidates = [];
    this.pendingCandidates = [];
    this.lastStats = null;
  }

  /**
   * Get the optimal number of data channels based on connection quality
   * 
   * @param quality Current connection quality
   * @returns Optimal number of data channels
   */
  getOptimalChannelCount(quality: ConnectionQuality): number {
    switch (quality.quality) {
      case 'excellent':
        return Math.min(this.config.maxDataChannels, 6);
      case 'good':
        return Math.min(this.config.maxDataChannels, 3);
      case 'poor':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Check if the browser supports WebRTC with required features
   * 
   * @returns Object with support status and details
   */
  static checkBrowserSupport(): { supported: boolean; details: Record<string, boolean> } {
    const details = {
      rtcPeerConnection: typeof RTCPeerConnection !== 'undefined',
      rtcDataChannel: typeof RTCDataChannel !== 'undefined',
      rtcSessionDescription: typeof RTCSessionDescription !== 'undefined',
      rtcIceCandidate: typeof RTCIceCandidate !== 'undefined',
      mediaDevices: typeof navigator !== 'undefined' && 
                   typeof navigator.mediaDevices !== 'undefined',
      getStats: typeof RTCPeerConnection !== 'undefined' && 
                typeof RTCPeerConnection.prototype.getStats === 'function'
    };

    const supported = details.rtcPeerConnection && 
                     details.rtcDataChannel && 
                     details.rtcSessionDescription && 
                     details.rtcIceCandidate;

    return { supported, details };
  }
}