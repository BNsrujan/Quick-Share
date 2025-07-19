import { RoomService } from '../services/room.service';
import { getRedisClient } from '../database';
import { RoomStatus } from '../models/room';

// Mock Redis client
jest.mock('../database', () => {
  const mockRedisClient = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG')
  };
  
  return {
    getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn().mockResolvedValue(undefined)
  };
});

// Mock nanoid for predictable IDs and codes
jest.mock('nanoid', () => ({
  nanoid: jest.fn()
    .mockReturnValueOnce('test-room-id') // First call for room ID
    .mockReturnValueOnce('ABC123') // Second call for room code
    .mockReturnValue('random-id') // Subsequent calls
}));

describe('RoomService', () => {
  const mockRedis = getRedisClient() as jest.Mocked<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createRoom', () => {
    it('should create a new room with a secure code', async () => {
      const metadata = { fileName: 'test.txt', fileSize: 1024 };
      const room = await RoomService.createRoom(metadata);
      
      expect(room).toEqual(expect.objectContaining({
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING,
        metadata
      }));
      
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'room:test-room-id',
        expect.any(String),
        'EX',
        3600
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'code:ABC123',
        'test-room-id',
        'EX',
        3600
      );
    });
  });
  
  describe('getRoomById', () => {
    it('should return null if room does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const room = await RoomService.getRoomById('non-existent-id');
      
      expect(room).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('room:non-existent-id');
    });
    
    it('should return room if it exists', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING
      };
      
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockRoom));
      
      const room = await RoomService.getRoomById('test-room-id');
      
      expect(room).toEqual(mockRoom);
      expect(mockRedis.get).toHaveBeenCalledWith('room:test-room-id');
    });
  });
  
  describe('getRoomByCode', () => {
    it('should return null if code does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const room = await RoomService.getRoomByCode('INVALID');
      
      expect(room).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('code:INVALID');
    });
    
    it('should return room if code exists', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING
      };
      
      mockRedis.get
        .mockResolvedValueOnce('test-room-id') // First call for code lookup
        .mockResolvedValueOnce(JSON.stringify(mockRoom)); // Second call for room data
      
      const room = await RoomService.getRoomByCode('ABC123');
      
      expect(room).toEqual(mockRoom);
      expect(mockRedis.get).toHaveBeenCalledWith('code:ABC123');
      expect(mockRedis.get).toHaveBeenCalledWith('room:test-room-id');
    });
  });
  
  describe('addPeerToRoom', () => {
    it('should add a sender peer to the room', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING,
        peers: {},
        metadata: {}
      };
      
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockRoom));
      
      const updatedRoom = await RoomService.addPeerToRoom(
        'test-room-id',
        'sender',
        'peer-1'
      );
      
      expect(updatedRoom).toEqual(expect.objectContaining({
        id: 'test-room-id',
        status: RoomStatus.WAITING,
        peers: {
          sender: {
            id: 'peer-1',
            connectedAt: expect.any(Date)
          }
        }
      }));
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'room:test-room-id',
        expect.any(String),
        'EX',
        3600
      );
    });
    
    it('should update status to CONNECTED when both peers are present', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING,
        peers: {
          sender: {
            id: 'peer-1',
            connectedAt: new Date()
          }
        },
        metadata: {}
      };
      
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockRoom));
      
      const updatedRoom = await RoomService.addPeerToRoom(
        'test-room-id',
        'receiver',
        'peer-2'
      );
      
      expect(updatedRoom).toEqual(expect.objectContaining({
        id: 'test-room-id',
        status: RoomStatus.CONNECTED,
        peers: {
          sender: {
            id: 'peer-1',
            connectedAt: expect.any(Date)
          },
          receiver: {
            id: 'peer-2',
            connectedAt: expect.any(Date)
          }
        }
      }));
    });
  });
  
  describe('validateCode', () => {
    it('should return false for invalid code', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const isValid = await RoomService.validateCode('INVALID');
      
      expect(isValid).toBe(false);
    });
    
    it('should return true for valid code with waiting room', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.WAITING,
        peers: {},
        metadata: {}
      };
      
      mockRedis.get
        .mockResolvedValueOnce('test-room-id') // First call for code lookup
        .mockResolvedValueOnce(JSON.stringify(mockRoom)); // Second call for room data
      
      const isValid = await RoomService.validateCode('ABC123');
      
      expect(isValid).toBe(true);
    });
    
    it('should return false for valid code with non-waiting room', async () => {
      const mockRoom = {
        id: 'test-room-id',
        code: 'ABC123',
        status: RoomStatus.CONNECTED,
        peers: {},
        metadata: {}
      };
      
      mockRedis.get
        .mockResolvedValueOnce('test-room-id') // First call for code lookup
        .mockResolvedValueOnce(JSON.stringify(mockRoom)); // Second call for room data
      
      const isValid = await RoomService.validateCode('ABC123');
      
      expect(isValid).toBe(false);
    });
  });
});