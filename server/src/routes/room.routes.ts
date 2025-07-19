import express from 'express';
import { RoomService } from '../services/room.service';
import { RateLimitService } from '../services/rate-limit.service';
import { createRoomSchema, joinRoomSchema } from '../models/room';
import { logger } from '../utils/logger';

const router = express.Router();

// Create a new room
router.post('/', async (req, res) => {
  try {
    // Rate limit check
    const clientId = req.ip || 'unknown';
    const isLimited = await RateLimitService.isRateLimited(clientId, 'create_room', {
      windowSeconds: 60 * 5, // 5 minutes
      maxRequests: 5
    });
    
    if (isLimited) {
      return res.status(429).json({
        error: 'Too many room creation requests. Please try again later.'
      });
    }
    
    // Validate input
    const parseResult = createRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.format()
      });
    }
    
    // Create room
    const room = await RoomService.createRoom(parseResult.data.metadata);
    
    // Return room data with code
    return res.status(201).json({
      id: room.id,
      code: room.code,
      expiresAt: room.expiresAt
    });
  } catch (error) {
    logger.error('Error creating room', { error });
    return res.status(500).json({
      error: 'Failed to create room'
    });
  }
});

// Join a room using a code
router.post('/join', async (req, res) => {
  try {
    // Rate limit check
    const clientId = req.ip || 'unknown';
    const isLimited = await RateLimitService.isRateLimited(clientId, 'join_room', {
      windowSeconds: 60, // 1 minute
      maxRequests: 10
    });
    
    if (isLimited) {
      return res.status(429).json({
        error: 'Too many join attempts. Please try again later.'
      });
    }
    
    // Validate input
    const parseResult = joinRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.format()
      });
    }
    
    const { code, peerId } = parseResult.data;
    
    // Get room by code
    const room = await RoomService.getRoomByCode(code);
    
    if (!room) {
      return res.status(404).json({
        error: 'Room not found or expired'
      });
    }
    
    if (room.status !== 'waiting') {
      return res.status(400).json({
        error: 'Room is not available for joining'
      });
    }
    
    // Add peer to room
    const updatedRoom = await RoomService.addPeerToRoom(
      room.id,
      'receiver',
      peerId
    );
    
    if (!updatedRoom) {
      return res.status(500).json({
        error: 'Failed to join room'
      });
    }
    
    // Return room data
    return res.status(200).json({
      id: updatedRoom.id,
      status: updatedRoom.status,
      metadata: updatedRoom.metadata
    });
  } catch (error) {
    logger.error('Error joining room', { error });
    return res.status(500).json({
      error: 'Failed to join room'
    });
  }
});

// Validate a room code
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Rate limit check
    const clientId = req.ip || 'unknown';
    const isLimited = await RateLimitService.isRateLimited(clientId, 'validate_code', {
      windowSeconds: 60, // 1 minute
      maxRequests: 20
    });
    
    if (isLimited) {
      return res.status(429).json({
        error: 'Too many validation attempts. Please try again later.'
      });
    }
    
    // Validate code
    const isValid = await RoomService.validateCode(code);
    
    return res.status(200).json({
      valid: isValid
    });
  } catch (error) {
    logger.error('Error validating code', { error });
    return res.status(500).json({
      error: 'Failed to validate code'
    });
  }
});

export const roomRoutes = router;