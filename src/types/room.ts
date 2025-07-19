/**
 * Room and signaling server types
 */

export interface Room {
  id: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'waiting' | 'connected' | 'transferring' | 'completed';
  peers: {
    sender?: {
      id: string;
      connectedAt?: Date;
    };
    receiver?: {
      id: string;
      connectedAt?: Date;
    };
  };
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
  };
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'room-created' | 'peer-joined' | 'peer-left' | 'error';
  roomId?: string;
  peerId?: string;
  data?: any;
  timestamp: Date;
}

export interface SignalingServer {
  // Room management
  createRoom(roomId: string, ttl: number): Promise<Room>;
  joinRoom(roomId: string, peerId: string): Promise<Room>;
  leaveRoom(roomId: string, peerId: string): Promise<void>;

  // WebRTC signaling
  sendOffer(roomId: string, offer: RTCSessionDescription): Promise<void>;
  sendAnswer(roomId: string, answer: RTCSessionDescription): Promise<void>;
  sendIceCandidate(roomId: string, candidate: RTCIceCandidate): Promise<void>;

  // Security
  validateCode(code: string): Promise<boolean>;
  rateLimit(clientId: string, action: string): Promise<boolean>;
}