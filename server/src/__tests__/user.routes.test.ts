/**
 * Tests for user routes
 * 
 * This file contains tests for the user API routes, ensuring that
 * authentication and user data management work correctly.
 */

import request from 'supertest';
import express from 'express';
import { createServer } from '../server';
import { UserModel } from '../models/user';
import { generateToken } from '../utils/auth';

// Mock UserModel
jest.mock('../models/user', () => ({
  UserModel: {
    findByEmail: jest.fn(),
    upsert: jest.fn(),
    updatePreferences: jest.fn(),
    addTransferToHistory: jest.fn(),
    clearTransferHistory: jest.fn()
  }
}));

// Mock redis
jest.mock('../database', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn()
  },
  initializeDatabase: jest.fn().mockResolvedValue(true)
}));

describe('User Routes', () => {
  let app: express.Application;
  let httpServer: any;
  
  beforeAll(async () => {
    const server = await createServer();
    app = server.app;
    httpServer = server.httpServer;
  });
  
  afterAll(() => {
    httpServer.close();
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/users/preferences', () => {
    it('returns 401 without authorization header', async () => {
      const response = await request(app).get('/api/users/preferences');
      expect(response.status).toBe(401);
    });
    
    it('returns 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(response.status).toBe(401);
    });
    
    it('returns user preferences with valid token', async () => {
      // Mock user
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: { darkMode: true },
        transferHistory: []
      };
      
      // Mock findByEmail to return the user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      // Generate a token
      const token = generateToken({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });
      
      const response = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ preferences: mockUser.preferences });
      expect(UserModel.findByEmail).toHaveBeenCalledWith(mockUser.email);
    });
    
    it('returns 404 if user not found', async () => {
      // Mock findByEmail to return null
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      
      // Generate a token
      const token = generateToken({
        id: '123',
        email: 'nonexistent@example.com',
        name: 'Nonexistent User'
      });
      
      const response = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });
  
  describe('PUT /api/users/preferences', () => {
    it('updates user preferences with valid data', async () => {
      // Mock user
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: { darkMode: true, notificationsEnabled: true },
        transferHistory: []
      };
      
      // Mock updatePreferences to return the updated user
      (UserModel.updatePreferences as jest.Mock).mockResolvedValue(mockUser);
      
      // Generate a token
      const token = generateToken({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });
      
      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ darkMode: true, notificationsEnabled: false });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ preferences: mockUser.preferences });
      expect(UserModel.updatePreferences).toHaveBeenCalledWith(
        mockUser.email,
        { darkMode: true, notificationsEnabled: false }
      );
    });
    
    it('returns 400 with invalid preference data', async () => {
      // Generate a token
      const token = generateToken({
        id: '123',
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const response = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultChunkSize: 'invalid' }); // Should be a number
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid preferences data');
    });
  });
  
  describe('GET /api/users/history', () => {
    it('returns user transfer history with valid token', async () => {
      // Mock user with transfer history
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: {},
        transferHistory: [
          {
            id: 'transfer1',
            timestamp: new Date(),
            fileName: 'test.txt',
            fileSize: 1024,
            fileType: 'text/plain',
            direction: 'sent',
            completed: true
          }
        ]
      };
      
      // Mock findByEmail to return the user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      // Generate a token
      const token = generateToken({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });
      
      const response = await request(app)
        .get('/api/users/history')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ history: mockUser.transferHistory });
    });
  });
  
  describe('POST /api/users/history', () => {
    it('adds transfer to history with valid data', async () => {
      // Mock user with updated history
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: {},
        transferHistory: [
          {
            id: 'new-transfer',
            timestamp: new Date(),
            fileName: 'test.txt',
            fileSize: 1024,
            fileType: 'text/plain',
            direction: 'sent',
            completed: true
          }
        ]
      };
      
      // Mock addTransferToHistory to return the updated user
      (UserModel.addTransferToHistory as jest.Mock).mockResolvedValue(mockUser);
      
      // Generate a token
      const token = generateToken({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });
      
      const response = await request(app)
        .post('/api/users/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileName: 'test.txt',
          fileSize: 1024,
          fileType: 'text/plain',
          direction: 'sent',
          completed: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, transferId: 'new-transfer' });
      expect(UserModel.addTransferToHistory).toHaveBeenCalledWith(
        mockUser.email,
        {
          fileName: 'test.txt',
          fileSize: 1024,
          fileType: 'text/plain',
          direction: 'sent',
          completed: true
        }
      );
    });
    
    it('returns 400 with invalid transfer data', async () => {
      // Generate a token
      const token = generateToken({
        id: '123',
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const response = await request(app)
        .post('/api/users/history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // Missing required fields
          fileName: 'test.txt'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid transfer data');
    });
  });
  
  describe('DELETE /api/users/history', () => {
    it('clears transfer history', async () => {
      // Mock user with cleared history
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
        preferences: {},
        transferHistory: []
      };
      
      // Mock clearTransferHistory to return the updated user
      (UserModel.clearTransferHistory as jest.Mock).mockResolvedValue(mockUser);
      
      // Generate a token
      const token = generateToken({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });
      
      const response = await request(app)
        .delete('/api/users/history')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(UserModel.clearTransferHistory).toHaveBeenCalledWith(mockUser.email);
    });
  });
});