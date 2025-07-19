import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomService } from '../services/room.service';
import { RateLimitService } from '../services/rate-limit.service';
import { RoomStatus } from '../models/room';
import { logger } from '../utils/logger';

// Socket event types
enum SocketEvents {
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
  FILE_METADATA = 'file_metadata'
}

// Socket client data
interface SocketData {
  peerId: string;
  roomId?: string;
  role?: 'sender' | 'receiver';
}

export function setupSocketHandlers(io: SocketIOServer): void {
  // Middleware for socket authentication and rate limiting
  io.use(async (socket, next) => {
    const clientId = socket.handshake.address;
    
    // Rate limit check for socket connections
    const isLimited = await RateLimitService.isRateLimited(clientId, 'socket_connect', {
      windowSeconds: 60, // 1 minute
      maxRequests: 30
    });
    
    if (isLimited) {
      return next(new Error('Too many connection attempts. Please try again later.'));
    }
    
    // Extract peer ID from handshake
    const peerId = socket.handshake.auth.peerId;
    if (!peerId) {
      return next(new Error('Peer ID is required'));
    }
    
    // Store peer ID in socket data
    socket.data.peerId = peerId;
    
    next();
  });
  
  // Handle socket connections
  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      peerId: socket.data.peerId
    });
    
    // Handle room joining
    socket.on(SocketEvents.JOIN_ROOM, async (data: { roomId: string, role: 'sender' | 'receiver' }) => {
      try {
        const { roomId, role } = data;
        const peerId = socket.data.peerId;
        
        // Rate limit check
        const clientId = socket.handshake.address;
        const isLimited = await RateLimitService.isRateLimited(clientId, 'join_room_socket', {
          windowSeconds: 60, // 1 minute
          maxRequests: 10
        });
        
        if (isLimited) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Too many join attempts. Please try again later.'
          });
          return;
        }
        
        // Get room
        const room = await RoomService.getRoomById(roomId);
        
        if (!room) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Room not found or expired'
          });
          return;
        }
        
        // Add peer to room
        const updatedRoom = await RoomService.addPeerToRoom(
          roomId,
          role,
          peerId
        );
        
        if (!updatedRoom) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Failed to join room'
          });
          return;
        }
        
        // Join socket room
        socket.join(roomId);
        
        // Store room ID and role in socket data
        socket.data.roomId = roomId;
        socket.data.role = role;
        
        // Notify client
        socket.emit(SocketEvents.ROOM_JOINED, {
          roomId,
          status: updatedRoom.status
        });
        
        // Notify other peers in the room
        socket.to(roomId).emit('peer_joined', {
          peerId,
          role
        });
        
        logger.info('Peer joined room', {
          socketId: socket.id,
          peerId,
          roomId,
          role
        });
      } catch (error) {
        logger.error('Error joining room', { error });
        socket.emit(SocketEvents.ROOM_ERROR, {
          error: 'Failed to join room'
        });
      }
    });
    
    // Handle room leaving
    socket.on(SocketEvents.LEAVE_ROOM, async () => {
      try {
        const roomId = socket.data.roomId;
        const peerId = socket.data.peerId;
        
        if (!roomId || !peerId) {
          return;
        }
        
        // Remove peer from room
        await RoomService.removePeerFromRoom(roomId, peerId);
        
        // Leave socket room
        socket.leave(roomId);
        
        // Notify client
        socket.emit(SocketEvents.ROOM_LEFT, {
          roomId
        });
        
        // Notify other peers in the room
        socket.to(roomId).emit('peer_left', {
          peerId
        });
        
        // Clear room ID and role from socket data
        delete socket.data.roomId;
        delete socket.data.role;
        
        logger.info('Peer left room', {
          socketId: socket.id,
          peerId,
          roomId
        });
      } catch (error) {
        logger.error('Error leaving room', { error });
      }
    });
    
    // Handle WebRTC offer
    socket.on(SocketEvents.SEND_OFFER, async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        const roomId = socket.data.roomId;
        const peerId = socket.data.peerId;
        
        if (!roomId || !peerId) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Not in a room'
          });
          return;
        }
        
        // Rate limit check
        const clientId = socket.handshake.address;
        const isLimited = await RateLimitService.isRateLimited(clientId, 'send_offer', {
          windowSeconds: 60, // 1 minute
          maxRequests: 20
        });
        
        if (isLimited) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Too many signaling attempts. Please try again later.'
          });
          return;
        }
        
        // Forward offer to other peers in the room
        socket.to(roomId).emit(SocketEvents.RECEIVE_OFFER, {
          peerId,
          offer: data.offer
        });
        
        logger.info('WebRTC offer sent', {
          socketId: socket.id,
          peerId,
          roomId
        });
      } catch (error) {
        logger.error('Error sending offer', { error });
        socket.emit(SocketEvents.ROOM_ERROR, {
          error: 'Failed to send offer'
        });
      }
    });
    
    // Handle WebRTC answer
    socket.on(SocketEvents.SEND_ANSWER, async (data: { answer: RTCSessionDescriptionInit }) => {
      try {
        const roomId = socket.data.roomId;
        const peerId = socket.data.peerId;
        
        if (!roomId || !peerId) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Not in a room'
          });
          return;
        }
        
        // Rate limit check
        const clientId = socket.handshake.address;
        const isLimited = await RateLimitService.isRateLimited(clientId, 'send_answer', {
          windowSeconds: 60, // 1 minute
          maxRequests: 20
        });
        
        if (isLimited) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Too many signaling attempts. Please try again later.'
          });
          return;
        }
        
        // Forward answer to other peers in the room
        socket.to(roomId).emit(SocketEvents.RECEIVE_ANSWER, {
          peerId,
          answer: data.answer
        });
        
        logger.info('WebRTC answer sent', {
          socketId: socket.id,
          peerId,
          roomId
        });
      } catch (error) {
        logger.error('Error sending answer', { error });
        socket.emit(SocketEvents.ROOM_ERROR, {
          error: 'Failed to send answer'
        });
      }
    });
    
    // Handle ICE candidates
    socket.on(SocketEvents.SEND_ICE_CANDIDATE, async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        const roomId = socket.data.roomId;
        const peerId = socket.data.peerId;
        
        if (!roomId || !peerId) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Not in a room'
          });
          return;
        }
        
        // Rate limit check
        const clientId = socket.handshake.address;
        const isLimited = await RateLimitService.isRateLimited(clientId, 'send_ice_candidate', {
          windowSeconds: 60, // 1 minute
          maxRequests: 50 // ICE candidates can be numerous
        });
        
        if (isLimited) {
          socket.emit(SocketEvents.ROOM_ERROR, {
            error: 'Too many signaling attempts. Please try again later.'
          });
          return;
        }
        
        // Forward ICE candidate to other peers in the room
        socket.to(roomId).emit(SocketEvents.RECEIVE_ICE_CANDIDATE, {
          peerId,
          candidate: data.candidate
        });
        
        logger.debug('ICE candidate sent', {
          socketId: socket.id,
          peerId,
          roomId
        });
      } catch (error) {
        logger.error('Error sending ICE candidate', { error });
        socket.emit(SocketEvents.ROOM_ERROR, {
          error: 'Failed to send ICE candidate'
        });
      }
    });
    
    // Handle transfer status updates
    socket.on(SocketEvents.TRANSFER_STARTED, async () => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Update room status
        await RoomService.updateRoomStatus(roomId, RoomStatus.TRANSFERRING);
        
        // Notify all peers in the room
        io.to(roomId).emit(SocketEvents.TRANSFER_STARTED);
        
        logger.info('Transfer started', {
          socketId: socket.id,
          roomId
        });
      } catch (error) {
        logger.error('Error updating transfer status', { error });
      }
    });
    
    socket.on(SocketEvents.TRANSFER_COMPLETED, async () => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Update room status
        await RoomService.updateRoomStatus(roomId, RoomStatus.COMPLETED);
        
        // Notify all peers in the room
        io.to(roomId).emit(SocketEvents.TRANSFER_COMPLETED);
        
        logger.info('Transfer completed', {
          socketId: socket.id,
          roomId
        });
      } catch (error) {
        logger.error('Error updating transfer status', { error });
      }
    });
    
    // Handle transfer progress updates
    socket.on(SocketEvents.TRANSFER_PROGRESS, (data: { progress: any }) => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward progress to other peers in the room
        socket.to(roomId).emit(SocketEvents.TRANSFER_PROGRESS, data);
        
        logger.debug('Transfer progress updated', {
          socketId: socket.id,
          roomId,
          progress: `${Math.round(data.progress.percentage)}%`
        });
      } catch (error) {
        logger.error('Error forwarding transfer progress', { error });
      }
    });
    
    // Handle transfer paused
    socket.on(SocketEvents.TRANSFER_PAUSED, () => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward pause event to other peers in the room
        socket.to(roomId).emit(SocketEvents.TRANSFER_PAUSED);
        
        logger.info('Transfer paused', {
          socketId: socket.id,
          roomId
        });
      } catch (error) {
        logger.error('Error handling transfer pause', { error });
      }
    });
    
    // Handle transfer resumed
    socket.on(SocketEvents.TRANSFER_RESUMED, () => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward resume event to other peers in the room
        socket.to(roomId).emit(SocketEvents.TRANSFER_RESUMED);
        
        logger.info('Transfer resumed', {
          socketId: socket.id,
          roomId
        });
      } catch (error) {
        logger.error('Error handling transfer resume', { error });
      }
    });
    
    // Handle transfer cancelled
    socket.on(SocketEvents.TRANSFER_CANCELLED, () => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward cancel event to other peers in the room
        socket.to(roomId).emit(SocketEvents.TRANSFER_CANCELLED);
        
        logger.info('Transfer cancelled', {
          socketId: socket.id,
          roomId
        });
      } catch (error) {
        logger.error('Error handling transfer cancellation', { error });
      }
    });
    
    // Handle transfer error
    socket.on(SocketEvents.TRANSFER_ERROR, (data: { error: string }) => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward error to other peers in the room
        socket.to(roomId).emit(SocketEvents.TRANSFER_ERROR, data);
        
        logger.error('Transfer error reported', {
          socketId: socket.id,
          roomId,
          error: data.error
        });
      } catch (error) {
        logger.error('Error handling transfer error', { error });
      }
    });
    
    // Handle file metadata
    socket.on(SocketEvents.FILE_METADATA, (data: { metadata: any }) => {
      try {
        const roomId = socket.data.roomId;
        
        if (!roomId) {
          return;
        }
        
        // Forward file metadata to other peers in the room
        socket.to(roomId).emit(SocketEvents.FILE_METADATA, data);
        
        logger.info('File metadata shared', {
          socketId: socket.id,
          roomId,
          fileName: data.metadata.name,
          fileSize: data.metadata.size,
          fileType: data.metadata.type
        });
      } catch (error) {
        logger.error('Error handling file metadata', { error });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        const roomId = socket.data.roomId;
        const peerId = socket.data.peerId;
        
        if (roomId && peerId) {
          // Remove peer from room
          await RoomService.removePeerFromRoom(roomId, peerId);
          
          // Notify other peers in the room
          socket.to(roomId).emit('peer_left', {
            peerId
          });
          
          logger.info('Peer disconnected from room', {
            socketId: socket.id,
            peerId,
            roomId
          });
        }
        
        logger.info('Socket disconnected', {
          socketId: socket.id,
          peerId
        });
      } catch (error) {
        logger.error('Error handling disconnect', { error });
      }
    });
  });
}