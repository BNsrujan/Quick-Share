import request from 'supertest';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from '../server';
import { initializeDatabase, closeDatabase } from '../database';

// Mock database
jest.mock('../database', () => {
  return {
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn().mockResolvedValue(undefined),
    getRedisClient: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockImplementation((key) => {
        if (key === 'code:VALID123') {
          return Promise.resolve('test-room-id');
        }
        if (key === 'room:test-room-id') {
          return Promise.resolve(JSON.stringify({
            id: 'test-room-id',
            code: 'VALID123',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            status: 'waiting',
            peers: {},
            metadata: {}
          }));
        }
        return Promise.resolve(null);
      }),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([])
    })
  };
});

describe('Server Integration Tests', () => {
  let app: any;
  let httpServer: any;
  let io: SocketIOServer;
  
  beforeAll(async () => {
    const server = await createServer();
    app = server.app;
    httpServer = server.httpServer;
    io = server.io;
    
    // Start the server
    httpServer.listen(0); // Use a random port
  });
  
  afterAll(async () => {
    // Close the server
    io.close();
    httpServer.close();
  });
  
  describe('API Routes', () => {
    it('should return 200 for health check', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
    
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .send({
          metadata: {
            fileName: 'test.txt',
            fileSize: 1024,
            fileType: 'text/plain'
          }
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('expiresAt');
    });
    
    it('should validate a room code', async () => {
      const response = await request(app)
        .get('/api/rooms/validate/VALID123');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true });
    });
    
    it('should return invalid for non-existent code', async () => {
      const response = await request(app)
        .get('/api/rooms/validate/INVALID');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: false });
    });
    
    it('should join a room with valid code', async () => {
      const response = await request(app)
        .post('/api/rooms/join')
        .send({
          code: 'VALID123',
          peerId: 'test-peer-id'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-room-id');
    });
    
    it('should reject joining with invalid code', async () => {
      const response = await request(app)
        .post('/api/rooms/join')
        .send({
          code: 'INVALID',
          peerId: 'test-peer-id'
        });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('WebSocket Connections', () => {
    let clientSocket: any;
    const serverUrl = `http://localhost:${httpServer.address().port}`;
    
    beforeEach((done) => {
      // Create a client socket
      clientSocket = SocketIOClient(serverUrl, {
        auth: {
          peerId: 'test-peer-id'
        },
        transports: ['websocket']
      });
      
      clientSocket.on('connect', done);
    });
    
    afterEach(() => {
      if (clientSocket.connected) {
        clientSocket.disconnect();
      }
    });
    
    it('should connect to socket server', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
    
    it('should join a room', (done) => {
      clientSocket.emit('join_room', {
        roomId: 'test-room-id',
        role: 'sender'
      });
      
      clientSocket.on('room_joined', (data) => {
        expect(data).toHaveProperty('roomId', 'test-room-id');
        expect(data).toHaveProperty('status');
        done();
      });
    });
    
    it('should handle WebRTC signaling', (done) => {
      // First join a room
      clientSocket.emit('join_room', {
        roomId: 'test-room-id',
        role: 'sender'
      });
      
      clientSocket.on('room_joined', () => {
        // Create a second client to test signaling
        const clientSocket2 = SocketIOClient(serverUrl, {
          auth: {
            peerId: 'test-peer-id-2'
          },
          transports: ['websocket']
        });
        
        clientSocket2.on('connect', () => {
          clientSocket2.emit('join_room', {
            roomId: 'test-room-id',
            role: 'receiver'
          });
          
          clientSocket2.on('room_joined', () => {
            // Send an offer from client 1
            const mockOffer = { type: 'offer', sdp: 'test-sdp' };
            clientSocket.emit('send_offer', { offer: mockOffer });
            
            // Client 2 should receive the offer
            clientSocket2.on('receive_offer', (data) => {
              expect(data).toHaveProperty('peerId', 'test-peer-id');
              expect(data).toHaveProperty('offer', mockOffer);
              
              // Clean up
              clientSocket2.disconnect();
              done();
            });
          });
        });
      });
    });
  });
});