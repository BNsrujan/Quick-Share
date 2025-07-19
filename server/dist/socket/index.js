"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const room_service_1 = require("../services/room.service");
const rate_limit_service_1 = require("../services/rate-limit.service");
const room_1 = require("../models/room");
const logger_1 = require("../utils/logger");
// Socket event types
var SocketEvents;
(function (SocketEvents) {
    // Room events
    SocketEvents["JOIN_ROOM"] = "join_room";
    SocketEvents["LEAVE_ROOM"] = "leave_room";
    SocketEvents["ROOM_JOINED"] = "room_joined";
    SocketEvents["ROOM_LEFT"] = "room_left";
    SocketEvents["ROOM_ERROR"] = "room_error";
    // WebRTC signaling events
    SocketEvents["SEND_OFFER"] = "send_offer";
    SocketEvents["RECEIVE_OFFER"] = "receive_offer";
    SocketEvents["SEND_ANSWER"] = "send_answer";
    SocketEvents["RECEIVE_ANSWER"] = "receive_answer";
    SocketEvents["SEND_ICE_CANDIDATE"] = "send_ice_candidate";
    SocketEvents["RECEIVE_ICE_CANDIDATE"] = "receive_ice_candidate";
    // Transfer status events
    SocketEvents["TRANSFER_STARTED"] = "transfer_started";
    SocketEvents["TRANSFER_PROGRESS"] = "transfer_progress";
    SocketEvents["TRANSFER_PAUSED"] = "transfer_paused";
    SocketEvents["TRANSFER_RESUMED"] = "transfer_resumed";
    SocketEvents["TRANSFER_COMPLETED"] = "transfer_completed";
    SocketEvents["TRANSFER_CANCELLED"] = "transfer_cancelled";
    SocketEvents["TRANSFER_ERROR"] = "transfer_error";
    SocketEvents["FILE_METADATA"] = "file_metadata";
})(SocketEvents || (SocketEvents = {}));
function setupSocketHandlers(io) {
    // Middleware for socket authentication and rate limiting
    io.use(async (socket, next) => {
        const clientId = socket.handshake.address;
        // Rate limit check for socket connections
        const isLimited = await rate_limit_service_1.RateLimitService.isRateLimited(clientId, 'socket_connect', {
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
    io.on('connection', (socket) => {
        logger_1.logger.info('Socket connected', {
            socketId: socket.id,
            peerId: socket.data.peerId
        });
        // Handle room joining
        socket.on(SocketEvents.JOIN_ROOM, async (data) => {
            try {
                const { roomId, role } = data;
                const peerId = socket.data.peerId;
                // Rate limit check
                const clientId = socket.handshake.address;
                const isLimited = await rate_limit_service_1.RateLimitService.isRateLimited(clientId, 'join_room_socket', {
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
                const room = await room_service_1.RoomService.getRoomById(roomId);
                if (!room) {
                    socket.emit(SocketEvents.ROOM_ERROR, {
                        error: 'Room not found or expired'
                    });
                    return;
                }
                // Add peer to room
                const updatedRoom = await room_service_1.RoomService.addPeerToRoom(roomId, role, peerId);
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
                logger_1.logger.info('Peer joined room', {
                    socketId: socket.id,
                    peerId,
                    roomId,
                    role
                });
            }
            catch (error) {
                logger_1.logger.error('Error joining room', { error });
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
                await room_service_1.RoomService.removePeerFromRoom(roomId, peerId);
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
                logger_1.logger.info('Peer left room', {
                    socketId: socket.id,
                    peerId,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error leaving room', { error });
            }
        });
        // Handle WebRTC offer
        socket.on(SocketEvents.SEND_OFFER, async (data) => {
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
                const isLimited = await rate_limit_service_1.RateLimitService.isRateLimited(clientId, 'send_offer', {
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
                logger_1.logger.info('WebRTC offer sent', {
                    socketId: socket.id,
                    peerId,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error sending offer', { error });
                socket.emit(SocketEvents.ROOM_ERROR, {
                    error: 'Failed to send offer'
                });
            }
        });
        // Handle WebRTC answer
        socket.on(SocketEvents.SEND_ANSWER, async (data) => {
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
                const isLimited = await rate_limit_service_1.RateLimitService.isRateLimited(clientId, 'send_answer', {
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
                logger_1.logger.info('WebRTC answer sent', {
                    socketId: socket.id,
                    peerId,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error sending answer', { error });
                socket.emit(SocketEvents.ROOM_ERROR, {
                    error: 'Failed to send answer'
                });
            }
        });
        // Handle ICE candidates
        socket.on(SocketEvents.SEND_ICE_CANDIDATE, async (data) => {
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
                const isLimited = await rate_limit_service_1.RateLimitService.isRateLimited(clientId, 'send_ice_candidate', {
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
                logger_1.logger.debug('ICE candidate sent', {
                    socketId: socket.id,
                    peerId,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error sending ICE candidate', { error });
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
                await room_service_1.RoomService.updateRoomStatus(roomId, room_1.RoomStatus.TRANSFERRING);
                // Notify all peers in the room
                io.to(roomId).emit(SocketEvents.TRANSFER_STARTED);
                logger_1.logger.info('Transfer started', {
                    socketId: socket.id,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error updating transfer status', { error });
            }
        });
        socket.on(SocketEvents.TRANSFER_COMPLETED, async () => {
            try {
                const roomId = socket.data.roomId;
                if (!roomId) {
                    return;
                }
                // Update room status
                await room_service_1.RoomService.updateRoomStatus(roomId, room_1.RoomStatus.COMPLETED);
                // Notify all peers in the room
                io.to(roomId).emit(SocketEvents.TRANSFER_COMPLETED);
                logger_1.logger.info('Transfer completed', {
                    socketId: socket.id,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error updating transfer status', { error });
            }
        });
        // Handle transfer progress updates
        socket.on(SocketEvents.TRANSFER_PROGRESS, (data) => {
            try {
                const roomId = socket.data.roomId;
                if (!roomId) {
                    return;
                }
                // Forward progress to other peers in the room
                socket.to(roomId).emit(SocketEvents.TRANSFER_PROGRESS, data);
                logger_1.logger.debug('Transfer progress updated', {
                    socketId: socket.id,
                    roomId,
                    progress: `${Math.round(data.progress.percentage)}%`
                });
            }
            catch (error) {
                logger_1.logger.error('Error forwarding transfer progress', { error });
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
                logger_1.logger.info('Transfer paused', {
                    socketId: socket.id,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling transfer pause', { error });
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
                logger_1.logger.info('Transfer resumed', {
                    socketId: socket.id,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling transfer resume', { error });
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
                logger_1.logger.info('Transfer cancelled', {
                    socketId: socket.id,
                    roomId
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling transfer cancellation', { error });
            }
        });
        // Handle transfer error
        socket.on(SocketEvents.TRANSFER_ERROR, (data) => {
            try {
                const roomId = socket.data.roomId;
                if (!roomId) {
                    return;
                }
                // Forward error to other peers in the room
                socket.to(roomId).emit(SocketEvents.TRANSFER_ERROR, data);
                logger_1.logger.error('Transfer error reported', {
                    socketId: socket.id,
                    roomId,
                    error: data.error
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling transfer error', { error });
            }
        });
        // Handle file metadata
        socket.on(SocketEvents.FILE_METADATA, (data) => {
            try {
                const roomId = socket.data.roomId;
                if (!roomId) {
                    return;
                }
                // Forward file metadata to other peers in the room
                socket.to(roomId).emit(SocketEvents.FILE_METADATA, data);
                logger_1.logger.info('File metadata shared', {
                    socketId: socket.id,
                    roomId,
                    fileName: data.metadata.name,
                    fileSize: data.metadata.size,
                    fileType: data.metadata.type
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling file metadata', { error });
            }
        });
        // Handle disconnection
        socket.on('disconnect', async () => {
            try {
                const roomId = socket.data.roomId;
                const peerId = socket.data.peerId;
                if (roomId && peerId) {
                    // Remove peer from room
                    await room_service_1.RoomService.removePeerFromRoom(roomId, peerId);
                    // Notify other peers in the room
                    socket.to(roomId).emit('peer_left', {
                        peerId
                    });
                    logger_1.logger.info('Peer disconnected from room', {
                        socketId: socket.id,
                        peerId,
                        roomId
                    });
                }
                logger_1.logger.info('Socket disconnected', {
                    socketId: socket.id,
                    peerId
                });
            }
            catch (error) {
                logger_1.logger.error('Error handling disconnect', { error });
            }
        });
    });
}
