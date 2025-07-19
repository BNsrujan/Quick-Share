/**
 * Unit tests for WebRTCService
 */

import { WebRTCService, WebRTCConfig, WebRTCError, DataChannelConfig } from '../webrtc.service';
import { ConnectionQuality } from '../../types/p2p-engine';
import { ErrorType } from '../../types/transfer';

// Mock RTCPeerConnection and related classes
class MockRTCPeerConnection {
  connectionState = 'new';
  iceConnectionState = 'new';
  signalingState = 'stable';
  remoteDescription = null;
  localDescription = null;
  
  onicecandidate = null;
  onconnectionstatechange = null;
  oniceconnectionstatechange = null;
  onsignalingstatechange = null;
  onnegotiationneeded = null;
  ondatachannel = null;
  
  dataChannels = [];
  
  constructor(config) {
    // Store config if needed
  }
  
  createDataChannel(label, options) {
    const channel = new MockRTCDataChannel(label, options);
    this.dataChannels.push(channel);
    return channel;
  }
  
  async createOffer() {
    return { type: 'offer', sdp: 'mock-sdp' };
  }
  
  async createAnswer() {
    return { type: 'answer', sdp: 'mock-sdp' };
  }
  
  async setLocalDescription(desc) {
    this.localDescription = desc;
    return Promise.resolve();
  }
  
  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    return Promise.resolve();
  }
  
  async addIceCandidate(candidate) {
    return Promise.resolve();
  }
  
  async getStats() {
    return new Map([
      ['transport', {
        type: 'transport',
        roundTripTime: 0.05 // 50ms
      }],
      ['outbound-rtp', {
        type: 'outbound-rtp',
        bytesSent: 1000,
        packetsSent: 100,
        packetsLost: 2
      }]
    ]);
  }
  
  close() {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.signalingState = 'closed';
    
    // Close all data channels
    this.dataChannels.forEach(channel => channel.close());
  }
  
  // Helper to simulate events
  simulateConnectionStateChange(state) {
    this.connectionState = state;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }
  
  simulateIceConnectionStateChange(state) {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
  }
  
  simulateSignalingStateChange(state) {
    this.signalingState = state;
    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }
  }
  
  simulateNegotiationNeeded() {
    if (this.onnegotiationneeded) {
      this.onnegotiationneeded();
    }
  }
  
  simulateIceCandidate(candidate) {
    if (this.onicecandidate) {
      this.onicecandidate({ candidate });
    }
  }
  
  simulateDataChannel(channel) {
    if (this.ondatachannel) {
      this.ondatachannel({ channel });
    }
  }
}

class MockRTCDataChannel {
  label;
  id;
  readyState = 'connecting';
  
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  
  constructor(label, options = {}) {
    this.label = label;
    this.id = options.id || 0;
  }
  
  send(data) {
    // Mock send
  }
  
  close() {
    this.readyState = 'closed';
    if (this.onclose) {
      this.onclose();
    }
  }
  
  // Helper to simulate events
  simulateOpen() {
    this.readyState = 'open';
    if (this.onopen) {
      this.onopen();
    }
  }
  
  simulateError(error) {
    if (this.onerror) {
      this.onerror({ error });
    }
  }
  
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }
}

// Mock global objects
global.RTCPeerConnection = MockRTCPeerConnection;
global.RTCSessionDescription = function(init) { return init; };
global.RTCIceCandidate = function(init) { return init; };
global.RTCDataChannel = MockRTCDataChannel;

describe('WebRTCService', () => {
  let webrtcService: WebRTCService;
  let defaultConfig: WebRTCConfig;
  
  beforeEach(() => {
    // Reset mocks and timers
    jest.useFakeTimers();
    
    // Default configuration for tests
    defaultConfig = {
      iceServers: [{ urls: 'stun:stun.example.org' }],
      maxRetryAttempts: 3,
      initialRetryDelay: 1000,
      maxRetryDelay: 10000,
      connectionTimeout: 30000,
      maxDataChannels: 6
    };
    
    // Create fresh instance for each test
    webrtcService = new WebRTCService(defaultConfig);
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    it('should initialize as initiator', () => {
      const initSpy = jest.spyOn(webrtcService as any, 'initialize');
      
      webrtcService.initializeAsInitiator();
      
      expect(initSpy).toHaveBeenCalled();
      expect((webrtcService as any).isInitiator).toBe(true);
    });
    
    it('should initialize as receiver', () => {
      const initSpy = jest.spyOn(webrtcService as any, 'initialize');
      
      webrtcService.initializeAsReceiver();
      
      expect(initSpy).toHaveBeenCalled();
      expect((webrtcService as any).isInitiator).toBe(false);
    });
    
    it('should set up event handlers during initialization', () => {
      const setupSpy = jest.spyOn(webrtcService as any, 'setupEventHandlers');
      
      webrtcService.initializeAsInitiator();
      
      expect(setupSpy).toHaveBeenCalled();
    });
    
    it('should start connection timeout during initialization', () => {
      const timeoutSpy = jest.spyOn(webrtcService as any, 'startConnectionTimeout');
      
      webrtcService.initializeAsInitiator();
      
      expect(timeoutSpy).toHaveBeenCalled();
    });
  });
  
  describe('data channel management', () => {
    beforeEach(() => {
      webrtcService.initializeAsInitiator();
    });
    
    it('should create a data channel with default options', () => {
      const channel = webrtcService.createDataChannel({ label: 'test-channel' });
      
      expect(channel).toBeDefined();
      expect(channel?.label).toBe('test-channel');
    });
    
    it('should create a data channel with custom options', () => {
      const config: DataChannelConfig = {
        label: 'custom-channel',
        ordered: false,
        maxRetransmits: 3,
        priority: 'medium'
      };
      
      const channel = webrtcService.createDataChannel(config);
      
      expect(channel).toBeDefined();
      expect(channel?.label).toBe('custom-channel');
    });
    
    it('should create multiple parallel data channels', () => {
      const channels = webrtcService.createParallelDataChannels('transfer', 3);
      
      expect(channels.length).toBe(3);
      expect(channels[0].label).toBe('transfer-0');
      expect(channels[1].label).toBe('transfer-1');
      expect(channels[2].label).toBe('transfer-2');
    });
    
    it('should limit parallel channels to maxDataChannels', () => {
      const channels = webrtcService.createParallelDataChannels('transfer', 10);
      
      expect(channels.length).toBe(defaultConfig.maxDataChannels);
    });
    
    it('should retrieve data channels by label', () => {
      const channel = webrtcService.createDataChannel({ label: 'test-channel' });
      
      const retrieved = webrtcService.getDataChannel('test-channel');
      
      expect(retrieved).toBe(channel);
    });
    
    it('should return null for non-existent data channel', () => {
      const retrieved = webrtcService.getDataChannel('non-existent');
      
      expect(retrieved).toBeNull();
    });
    
    it('should get all data channels', () => {
      webrtcService.createDataChannel({ label: 'channel-1' });
      webrtcService.createDataChannel({ label: 'channel-2' });
      
      const channels = webrtcService.getDataChannels();
      
      expect(channels.length).toBe(2);
      expect(channels[0].label).toBe('channel-1');
      expect(channels[1].label).toBe('channel-2');
    });
  });
  
  describe('connection management', () => {
    beforeEach(() => {
      webrtcService.initializeAsInitiator();
    });
    
    it('should create an offer', async () => {
      const offer = await webrtcService.createOffer();
      
      expect(offer).toBeDefined();
      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBe('mock-sdp');
    });
    
    it('should handle an offer and create an answer', async () => {
      const offer = { type: 'offer', sdp: 'mock-offer-sdp' };
      
      const answer = await webrtcService.handleOffer(offer);
      
      expect(answer).toBeDefined();
      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBe('mock-sdp');
    });
    
    it('should handle an answer', async () => {
      const answer = { type: 'answer', sdp: 'mock-answer-sdp' };
      
      await expect(webrtcService.handleAnswer(answer)).resolves.not.toThrow();
    });
    
    it('should add an ICE candidate', async () => {
      const candidate = { candidate: 'mock-candidate', sdpMLineIndex: 0, sdpMid: '0' };
      
      await expect(webrtcService.addIceCandidate(candidate)).resolves.not.toThrow();
    });
    
    it('should store pending candidates when remote description is not set', async () => {
      const candidate = { candidate: 'mock-candidate', sdpMLineIndex: 0, sdpMid: '0' };
      
      await webrtcService.addIceCandidate(candidate);
      
      expect((webrtcService as any).pendingCandidates.length).toBe(1);
    });
    
    it('should apply pending candidates when remote description is set', async () => {
      const candidate = { candidate: 'mock-candidate', sdpMLineIndex: 0, sdpMid: '0' };
      
      // Add a candidate before remote description is set
      await webrtcService.addIceCandidate(candidate);
      expect((webrtcService as any).pendingCandidates.length).toBe(1);
      
      // Set remote description via handleOffer
      const offer = { type: 'offer', sdp: 'mock-offer-sdp' };
      await webrtcService.handleOffer(offer);
      
      // Pending candidates should be applied
      expect((webrtcService as any).pendingCandidates.length).toBe(0);
    });
    
    it('should close the connection and clean up resources', () => {
      webrtcService.createDataChannel({ label: 'test-channel' });
      
      webrtcService.close();
      
      expect(webrtcService.getConnectionState()).toBe('closed');
      expect(webrtcService.getDataChannels().length).toBe(0);
    });
  });
  
  describe('event handling', () => {
    let eventHandlers;
    
    beforeEach(() => {
      eventHandlers = {
        onConnectionStateChange: jest.fn(),
        onDataChannel: jest.fn(),
        onIceCandidate: jest.fn(),
        onNegotiationNeeded: jest.fn(),
        onIceConnectionStateChange: jest.fn(),
        onSignalingStateChange: jest.fn(),
        onError: jest.fn(),
        onQualityChange: jest.fn()
      };
      
      webrtcService.registerEvents(eventHandlers);
      webrtcService.initializeAsInitiator();
    });
    
    it('should trigger connection state change events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('connected');
      
      expect(eventHandlers.onConnectionStateChange).toHaveBeenCalledWith('connected');
    });
    
    it('should trigger ICE connection state change events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateIceConnectionStateChange('checking');
      
      expect(eventHandlers.onIceConnectionStateChange).toHaveBeenCalledWith('checking');
    });
    
    it('should trigger signaling state change events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateSignalingStateChange('have-local-offer');
      
      expect(eventHandlers.onSignalingStateChange).toHaveBeenCalledWith('have-local-offer');
    });
    
    it('should trigger negotiation needed events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateNegotiationNeeded();
      
      expect(eventHandlers.onNegotiationNeeded).toHaveBeenCalled();
    });
    
    it('should trigger ICE candidate events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      const candidate = { candidate: 'mock-candidate', sdpMLineIndex: 0, sdpMid: '0' };
      
      peerConnection.simulateIceCandidate(candidate);
      
      expect(eventHandlers.onIceCandidate).toHaveBeenCalledWith(candidate);
    });
    
    it('should trigger data channel events', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      const channel = new MockRTCDataChannel('remote-channel');
      
      peerConnection.simulateDataChannel(channel);
      
      expect(eventHandlers.onDataChannel).toHaveBeenCalledWith(channel);
    });
    
    it('should handle connection failures', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('failed');
      
      expect(eventHandlers.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.CONNECTION_FAILED,
        recoverable: true
      }));
    });
    
    it('should handle ICE failures', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateIceConnectionStateChange('failed');
      
      expect(eventHandlers.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.CONNECTION_FAILED,
        recoverable: true
      }));
    });
    
    it('should handle connection timeout', () => {
      // Advance timers to trigger timeout
      jest.advanceTimersByTime(defaultConfig.connectionTimeout + 100);
      
      expect(eventHandlers.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.CONNECTION_FAILED,
        message: expect.stringContaining('timed out')
      }));
    });
    
    it('should clear connection timeout when connected', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('connected');
      
      // Advance timers past timeout
      jest.advanceTimersByTime(defaultConfig.connectionTimeout + 100);
      
      // Error should not be called since we're connected
      expect(eventHandlers.onError).not.toHaveBeenCalled();
    });
  });
  
  describe('reconnection logic', () => {
    beforeEach(() => {
      webrtcService.initializeAsInitiator();
    });
    
    it('should attempt reconnection on disconnection', () => {
      const reconnectSpy = jest.spyOn(webrtcService as any, 'reconnect');
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('disconnected');
      
      // Advance timer to trigger reconnect
      jest.advanceTimersByTime(defaultConfig.initialRetryDelay + 100);
      
      expect(reconnectSpy).toHaveBeenCalled();
      expect((webrtcService as any).retryCount).toBe(1);
    });
    
    it('should use exponential backoff for reconnection attempts', () => {
      // Set retryCount to 1 to simulate a second attempt
      (webrtcService as any).retryCount = 1;
      
      const reconnectSpy = jest.spyOn(webrtcService as any, 'reconnect');
      const peerConnection = (webrtcService as any).peerConnection;
      
      // Trigger disconnection
      peerConnection.simulateConnectionStateChange('disconnected');
      
      // First delay should not be enough (2^1 * initialDelay = 2000ms)
      jest.advanceTimersByTime(defaultConfig.initialRetryDelay);
      expect(reconnectSpy).not.toHaveBeenCalled();
      
      // After the full exponential delay, reconnect should be called
      jest.advanceTimersByTime(defaultConfig.initialRetryDelay);
      expect(reconnectSpy).toHaveBeenCalled();
    });
    
    it('should stop retrying after max attempts', () => {
      const eventHandlers = {
        onError: jest.fn()
      };
      webrtcService.registerEvents(eventHandlers);
      
      const peerConnection = (webrtcService as any).peerConnection;
      
      // Set retry count to max
      (webrtcService as any).retryCount = defaultConfig.maxRetryAttempts;
      
      peerConnection.simulateConnectionStateChange('disconnected');
      
      expect(eventHandlers.onError).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.CONNECTION_FAILED,
        recoverable: false,
        message: expect.stringContaining('retry attempts')
      }));
    });
    
    it('should reset retry count on successful connection', () => {
      const peerConnection = (webrtcService as any).peerConnection;
      
      // Set retry count
      (webrtcService as any).retryCount = 2;
      
      peerConnection.simulateConnectionStateChange('connected');
      
      expect((webrtcService as any).retryCount).toBe(0);
    });
  });
  
  describe('connection quality monitoring', () => {
    beforeEach(() => {
      webrtcService.initializeAsInitiator();
    });
    
    it('should start quality monitoring when connected', () => {
      const startQualitySpy = jest.spyOn(webrtcService as any, 'startQualityMonitoring');
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('connected');
      
      expect(startQualitySpy).toHaveBeenCalled();
    });
    
    it('should stop quality monitoring when closed', () => {
      const stopQualitySpy = jest.spyOn(webrtcService as any, 'stopQualityMonitoring');
      const peerConnection = (webrtcService as any).peerConnection;
      
      peerConnection.simulateConnectionStateChange('closed');
      
      expect(stopQualitySpy).toHaveBeenCalled();
    });
    
    it('should calculate connection quality based on stats', () => {
      const quality = (webrtcService as any).calculateConnectionQuality(100, 500000, 2);
      
      expect(quality.quality).toBe('good');
    });
    
    it('should determine optimal channel count based on quality', () => {
      const excellentQuality: ConnectionQuality = { rtt: 50, bandwidth: 2000000, packetLoss: 0.5, quality: 'excellent' };
      const goodQuality: ConnectionQuality = { rtt: 200, bandwidth: 500000, packetLoss: 3, quality: 'good' };
      const poorQuality: ConnectionQuality = { rtt: 500, bandwidth: 100000, packetLoss: 10, quality: 'poor' };
      
      expect(webrtcService.getOptimalChannelCount(excellentQuality)).toBe(6);
      expect(webrtcService.getOptimalChannelCount(goodQuality)).toBe(3);
      expect(webrtcService.getOptimalChannelCount(poorQuality)).toBe(1);
    });
  });
  
  describe('browser support detection', () => {
    it('should detect WebRTC support', () => {
      const support = WebRTCService.checkBrowserSupport();
      
      expect(support.supported).toBe(true);
      expect(support.details.rtcPeerConnection).toBe(true);
      expect(support.details.rtcDataChannel).toBe(true);
    });
    
    it('should handle missing WebRTC support', () => {
      // Temporarily remove RTCPeerConnection
      const originalRTCPeerConnection = global.RTCPeerConnection;
      global.RTCPeerConnection = undefined as any;
      
      const support = WebRTCService.checkBrowserSupport();
      
      expect(support.supported).toBe(false);
      expect(support.details.rtcPeerConnection).toBe(false);
      
      // Restore RTCPeerConnection
      global.RTCPeerConnection = originalRTCPeerConnection;
    });
  });
});