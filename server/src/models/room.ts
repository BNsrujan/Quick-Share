import { z } from 'zod';

// Room status enum
export enum RoomStatus {
  WAITING = 'waiting',
  CONNECTED = 'connected',
  TRANSFERRING = 'transferring',
  COMPLETED = 'completed',
  EXPIRED = 'expired'
}

// Peer type
export interface Peer {
  id: string;
  connectedAt?: Date;
}

// Room metadata
export interface RoomMetadata {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

// Room model
export interface Room {
  id: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  status: RoomStatus;
  peers: {
    sender?: Peer;
    receiver?: Peer;
  };
  metadata: RoomMetadata;
}

// Room creation input validation schema
export const createRoomSchema = z.object({
  metadata: z.object({
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    fileType: z.string().optional()
  }).optional()
});

// Room join input validation schema
export const joinRoomSchema = z.object({
  code: z.string().min(6).max(10),
  peerId: z.string()
});

// WebRTC signaling schemas
export const offerSchema = z.object({
  roomId: z.string(),
  offer: z.any()
});

export const answerSchema = z.object({
  roomId: z.string(),
  answer: z.any()
});

export const iceCandidateSchema = z.object({
  roomId: z.string(),
  candidate: z.any()
});