/**
 * WebRTC mocks for testing
 * 
 * This module provides mock implementations of WebRTC APIs for testing
 */

import { Page } from '@playwright/test';

/**
 * Setup mock WebRTC for testing
 * 
 * This function injects mock implementations of WebRTC APIs into the page
 * to allow testing without actual WebRTC connections
 */
export async function setupMockWebRTC(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Store original implementations
    const originalRTCPeerConnection = window.RTCPeerConnection;
    const originalRTCSessionDescription = window.RTCSessionDescription;
    const originalRTCIceCandidate = window.RTCIceCandidate;
    
    // Mock data channel for file transfer
    class MockDataChannel extends EventTarget {
      label: string;
      readyState: RTCDataChannelState = 'connecting';
      bufferedAmount = 0;
      bufferedAmountLowThreshold = 0;
      maxRetransmits: number | null = null;
      ordered = true;
      protocol = '';
      negotiated = false;
      id: number | null = null;
      binaryType: RTCBinaryType = 'arraybuffer';
      
      constructor(label: string) {
        super();
        this.label = label;
        
        // Simulate connection after a short delay
        setTimeout(() => {
          this.readyState = 'open';
          this.dispatchEvent(new Event('open'));
        }, 100);
      }
      
      close(): void {
        this.readyState = 'closed';
        this.dispatchEvent(new Event('close'));
      }
      
      send(data: string | Blob | ArrayBuffer | ArrayBufferView): void {
        // Simulate sending data
        setTimeout(() => {
          // Find the peer connection that owns this channel
          const peerConnection = mockPeerConnections.find(pc => 
            pc.dataChannels.some(dc => dc === this)
          );
          
          if (peerConnection) {
            // Find the remote peer connection
            const remotePeerConnection = mockPeerConnections.find(pc => 
              pc !== peerConnection
            );
            
            if (remotePeerConnection) {
              // Find or create a matching data channel on the remote peer
              let remoteChannel = remotePeerConnection.dataChannels.find(dc => 
                dc.label === this.label
              );
              
              if (!remoteChannel) {
                remoteChannel = new MockDataChannel(this.label);
                remotePeerConnection.dataChannels.push(remoteChannel);
                remotePeerConnection.dispatchEvent(new CustomEvent('datachannel', {
                  detail: { channel: remoteChannel }
                }));
              }
              
              // Dispatch message event on remote channel
              remoteChannel.dispatchEvent(new MessageEvent('message', {
                data: data
              }));
            }
          }
        }, 50);
      }
    }
    
    // Track mock peer connections
    const mockPeerConnections: Array<MockRTCPeerConnection> = [];
    
    // Mock RTCPeerConnection
    class MockRTCPeerConnection extends EventTarget implements RTCPeerConnection {
      localDescription: RTCSessionDescription | null = null;
      remoteDescription: RTCSessionDescription | null = null;
      signalingState: RTCSignalingState = 'stable';
      iceGatheringState: RTCIceGatheringState = 'new';
      iceConnectionState: RTCIceConnectionState = 'new';
      connectionState: RTCPeerConnectionState = 'new';
      canTrickleIceCandidates: boolean | null = true;
      dataChannels: MockDataChannel[] = [];
      
      constructor(configuration?: RTCConfiguration) {
        super();
        mockPeerConnections.push(this);
        
        // Simulate connection establishment after a short delay
        setTimeout(() => {
          this.iceConnectionState = 'checking';
          this.connectionState = 'connecting';
          this.dispatchEvent(new Event('iceconnectionstatechange'));
          this.dispatchEvent(new Event('connectionstatechange'));
          
          setTimeout(() => {
            this.iceConnectionState = 'connected';
            this.connectionState = 'connected';
            this.dispatchEvent(new Event('iceconnectionstatechange'));
            this.dispatchEvent(new Event('connectionstatechange'));
          }, 200);
        }, 100);
      }
      
      createOffer(): Promise<RTCSessionDescriptionInit> {
        return Promise.resolve({
          type: 'offer',
          sdp: 'mock-sdp-offer'
        });
      }
      
      createAnswer(): Promise<RTCSessionDescriptionInit> {
        return Promise.resolve({
          type: 'answer',
          sdp: 'mock-sdp-answer'
        });
      }
      
      setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
        this.localDescription = description ? new originalRTCSessionDescription(description) : null;
        return Promise.resolve();
      }
      
      setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
        this.remoteDescription = new originalRTCSessionDescription(description);
        
        // If this is an offer, create a data channel for the remote peer
        if (description.type === 'offer') {
          // Find the remote peer connection
          const remotePeerConnection = mockPeerConnections.find(pc => 
            pc !== this
          );
          
          if (remotePeerConnection) {
            // Create a data channel on the remote peer
            const remoteChannel = new MockDataChannel('file-transfer');
            remotePeerConnection.dataChannels.push(remoteChannel);
            
            // Dispatch datachannel event on remote peer
            setTimeout(() => {
              remotePeerConnection.dispatchEvent(new CustomEvent('datachannel', {
                detail: { channel: remoteChannel }
              }));
            }, 100);
          }
        }
        
        return Promise.resolve();
      }
      
      addIceCandidate(candidate?: RTCIceCandidateInit): Promise<void> {
        return Promise.resolve();
      }
      
      restartIce(): void {
        // No-op
      }
      
      getConfiguration(): RTCConfiguration {
        return {};
      }
      
      setConfiguration(configuration?: RTCConfiguration): void {
        // No-op
      }
      
      close(): void {
        this.signalingState = 'closed';
        this.iceConnectionState = 'closed';
        this.connectionState = 'closed';
        
        this.dispatchEvent(new Event('signalingstatechange'));
        this.dispatchEvent(new Event('iceconnectionstatechange'));
        this.dispatchEvent(new Event('connectionstatechange'));
        
        // Close all data channels
        this.dataChannels.forEach(channel => channel.close());
        
        // Remove from mock peer connections
        const index = mockPeerConnections.indexOf(this);
        if (index !== -1) {
          mockPeerConnections.splice(index, 1);
        }
      }
      
      createDataChannel(label: string): RTCDataChannel {
        const channel = new MockDataChannel(label);
        this.dataChannels.push(channel);
        return channel as unknown as RTCDataChannel;
      }
      
      // Implement required methods with no-op implementations
      getStats(): Promise<RTCStatsReport> {
        return Promise.resolve({} as RTCStatsReport);
      }
      
      getTransceivers(): RTCRtpTransceiver[] {
        return [];
      }
      
      getSenders(): RTCRtpSender[] {
        return [];
      }
      
      getReceivers(): RTCRtpReceiver[] {
        return [];
      }
      
      addTrack(): RTCRtpSender {
        return {} as RTCRtpSender;
      }
      
      removeTrack(): void {
        // No-op
      }
      
      addTransceiver(): RTCRtpTransceiver {
        return {} as RTCRtpTransceiver;
      }
      
      // Event handlers
      onconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      ondatachannel: ((this: RTCPeerConnection, ev: RTCDataChannelEvent) => any) | null = null;
      onicecandidate: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any) | null = null;
      onicecandidateerror: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      oniceconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      onicegatheringstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      onnegotiationneeded: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      onsignalingstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
      ontrack: ((this: RTCPeerConnection, ev: RTCTrackEvent) => any) | null = null;
      
      // Handle events
      addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        if (type === 'datachannel') {
          super.addEventListener('datachannel', (e: Event) => {
            const customEvent = e as CustomEvent;
            const channel = customEvent.detail.channel;
            
            listener.call(this, {
              type: 'datachannel',
              channel: channel
            } as RTCDataChannelEvent);
          }, options);
        } else {
          super.addEventListener(type, listener, options);
        }
      }
      
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
        super.removeEventListener(type, listener, options);
      }
      
      dispatchEvent(event: Event): boolean {
        if (event.type === 'datachannel' && this.ondatachannel) {
          const customEvent = event as CustomEvent;
          this.ondatachannel({
            type: 'datachannel',
            channel: customEvent.detail.channel
          } as RTCDataChannelEvent);
        }
        
        return super.dispatchEvent(event);
      }
    }
    
    // Replace global WebRTC objects with mocks
    window.RTCPeerConnection = MockRTCPeerConnection as any;
  });
}