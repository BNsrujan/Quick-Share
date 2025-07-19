/**
 * Signaling service for WebSocket communication with the signaling server
 * 
 * This service handles the WebSocket connection to the signaling server
 * and provides methods for room management and WebRTC signaling.
 */

import { io, Socket } from 'socket.io-client';
import { TransferError, ErrorType } from '../types/transfer';
import { ExtendedErrorType, createError } from '../types/error';

// Socket event types (matching server-side events)
export enum SocketEvents {
  // Room events
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  ROOM_ERROR = 'room_error',
  
  // WebRTC signaling events
  SEND_OFFER = 'send_offer',
  RECEIVE_OFFER = 'receive_offer',
  SEND_ANSWER = 'send_answer',
  RECEIVE_ANSWER = 'receive_answer',
  SEND_ICE_CANDIDATE = 'send_ice_candidate',
  RECEIVE_ICE_CANDIDATE = 'receive_ice_candidate',
  
  // Transfer status events
  TRANSFER_STARTED = 'transfer_started',
  TRANSFER_PROGRESS = 'transfer_progress',
  TRANSFER_PAUSED = 'transfer_paused',
  TRANSFER_RESUMED = 'transfer_resumed',
  TRANSFER_COMPLETED = 'transfer_completed',
  TRANSFER_CANCELLED = 'transfer_cancelled',
  TRANSFER_ERROR = 'transfer_error',
  
  // Peer events
  PEER_JOINED = 'peer_joined',
  PEER_LEFT = 'peer_left'
}

export interface SignalingConfig {
  serverUrl: string;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
}

export interface RoomJoinedData {
  roomId: string;
  status: string;
}

export interface PeerJoinedData {
  peerId: string;
  role: 'sender' | 'receiver';
}

export interface WebRTCSignalingData {
  peerId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface SignalingEvents {
  onRoomJoined?: (data: RoomJoinedData) => void;
  onRoomLeft?: (data: { roomId: string }) => void;
  onRoomError?: (error: string) => void;
  onPeerJoined?: (data: PeerJoinedData) => void;
  onPeerLeft?: (data: { peerId: string }) => void;
  onOfferReceived?: (data: WebRTCSignalingData) => void;
  onAnswerReceived?: (data: WebRTCSignalingData) => void;
  onIceCandidateReceived?: (data: WebRTCSignalingData) => void;
  onTransferStarted?: () => void;
  onTransferCompleted?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: TransferError) => void;
}

/**
 * Signaling service for WebSocket communication
 */
export class SignalingService {
  private socket: Socket | null = null;
  private config: SignalingConfig;
  private events: SignalingEvents = {};
  private peerId: string;
  private currentRoomId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private customEventHandlers: Map<string, Function[]> = new Map();

  constructor(config: SignalingConfig) {
    this.config = config;
    this.peerId = this.generatePeerId();
  }

  /**
   * Connect to the signaling server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.serverUrl, {
          auth: {
            peerId: this.peerId
          },
          timeout: this.config.timeout,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          transports: ['websocket', 'polling']
        });

        // Connection event handlers
        this.socket.on('connect', () => {
          console.log('Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.events.onConnected?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from signaling server:', reason);
          this.isConnected = false;
          this.events.onDisconnected?.();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          this.reconnectAttempts++;
          
          const transferError = createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE, {
            originalError: error,
            attempts: this.reconnectAttempts
          });
          
          this.events.onError?.(transferError);
          
          if (this.reconnectAttempts >= this.config.reconnectionAttempts) {
            reject(transferError);
          }
        });

        // Room event handlers
        this.socket.on(SocketEvents.ROOM_JOINED, (data: RoomJoinedData) => {
          console.log('Room joined:', data);
          this.currentRoomId = data.roomId;
          this.events.onRoomJoined?.(data);
        });

        this.socket.on(SocketEvents.ROOM_LEFT, (data: { roomId: string }) => {
          console.log('Room left:', data);
          this.currentRoomId = null;
          this.events.onRoomLeft?.(data);
        });

        this.socket.on(SocketEvents.ROOM_ERROR, (data: { error: string }) => {
          console.error('Room error:', data.error);
          this.events.onRoomError?.(data.error);
        });

        // Peer event handlers
        this.socket.on(SocketEvents.PEER_JOINED, (data: PeerJoinedData) => {
          console.log('Peer joined:', data);
          this.events.onPeerJoined?.(data);
        });

        this.socket.on(SocketEvents.PEER_LEFT, (data: { peerId: string }) => {
          console.log('Peer left:', data);
          this.events.onPeerLeft?.(data);
        });

        // WebRTC signaling event handlers
        this.socket.on(SocketEvents.RECEIVE_OFFER, (data: WebRTCSignalingData) => {
          console.log('Offer received:', data);
          this.events.onOfferReceived?.(data);
        });

        this.socket.on(SocketEvents.RECEIVE_ANSWER, (data: WebRTCSignalingData) => {
          console.log('Answer received:', data);
          this.events.onAnswerReceived?.(data);
        });

        this.socket.on(SocketEvents.RECEIVE_ICE_CANDIDATE, (data: WebRTCSignalingData) => {
          console.log('ICE candidate received:', data);
          this.events.onIceCandidateReceived?.(data);
        });

        // Transfer status event handlers
        this.socket.on(SocketEvents.TRANSFER_STARTED, () => {
          console.log('Transfer started');
          this.events.onTransferStarted?.();
        });

        this.socket.on(SocketEvents.TRANSFER_COMPLETED, () => {
          console.log('Transfer completed');
          this.events.onTransferCompleted?.();
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            const timeoutError = createError(ExtendedErrorType.CONNECTION_TIMEOUT);
            reject(timeoutError);
          }
        }, this.config.timeout);

      } catch (error) {
        const connectionError = createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE, {
          originalError: error
        });
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
    }
  }

  /**
   * Register event handlers
   */
  registerEvents(events: SignalingEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string, role: 'sender' | 'receiver'): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(createError(ExtendedErrorType.CONNECTION_TIMEOUT));
      }, this.config.timeout);

      // Listen for room joined confirmation
      const onRoomJoined = (data: RoomJoinedData) => {
        if (data.roomId === roomId) {
          clearTimeout(timeout);
          this.socket?.off(SocketEvents.ROOM_JOINED, onRoomJoined);
          this.socket?.off(SocketEvents.ROOM_ERROR, onRoomError);
          resolve();
        }
      };

      const onRoomError = (data: { error: string }) => {
        clearTimeout(timeout);
        this.socket?.off(SocketEvents.ROOM_JOINED, onRoomJoined);
        this.socket?.off(SocketEvents.ROOM_ERROR, onRoomError);
        reject(createError(ExtendedErrorType.INVALID_INPUT, { reason: data.error }));
      };

      this.socket.on(SocketEvents.ROOM_JOINED, onRoomJoined);
      this.socket.on(SocketEvents.ROOM_ERROR, onRoomError);

      // Send join room request
      this.socket.emit(SocketEvents.JOIN_ROOM, { roomId, role });
    });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.socket || !this.isConnected || !this.currentRoomId) {
      return;
    }

    this.socket.emit(SocketEvents.LEAVE_ROOM);
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(offer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.isConnected) {
      throw createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE);
    }

    this.socket.emit(SocketEvents.SEND_OFFER, { offer });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.isConnected) {
      throw createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE);
    }

    this.socket.emit(SocketEvents.SEND_ANSWER, { answer });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.socket || !this.isConnected) {
      throw createError(ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE);
    }

    this.socket.emit(SocketEvents.SEND_ICE_CANDIDATE, { candidate });
  }

  /**
   * Notify transfer started
   */
  notifyTransferStarted(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SocketEvents.TRANSFER_STARTED);
    }
  }

  /**
   * Notify transfer completed
   */
  notifyTransferCompleted(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(SocketEvents.TRANSFER_COMPLETED);
    }
  }

  /**
   * Get connection status
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Get peer ID
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * Register a custom event handler
   */
  on(event: string, handler: Function): void {
    if (!this.customEventHandlers.has(event)) {
      this.customEventHandlers.set(event, []);
      
      // Register socket.io event handler if socket exists
      if (this.socket) {
        this.socket.on(event, (data: any) => {
          const handlers = this.customEventHandlers.get(event) || [];
          handlers.forEach(handler => handler(data));
        });
      }
    }
    
    const handlers = this.customEventHandlers.get(event) || [];
    handlers.push(handler);
    this.customEventHandlers.set(event, handlers);
  }

  /**
   * Emit a custom event
   */
  emit(event: string, data?: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Generate a unique peer ID
   */
  private generatePeerId(): string {
    return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}