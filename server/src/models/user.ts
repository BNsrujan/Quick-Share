/**
 * User model for storing user data
 * 
 * This model represents a user in the system with optional preferences
 * and transfer history. It's designed to be privacy-compliant and only
 * store minimal necessary data.
 */

import { nanoid } from 'nanoid';
import { getRedisClient } from '../database';

export interface UserPreferences {
  darkMode?: boolean;
  notificationsEnabled?: boolean;
  defaultChunkSize?: number;
}

export interface TransferHistoryItem {
  id: string;
  timestamp: Date;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'sent' | 'received';
  recipientOrSender?: string;
  completed: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: Date;
  lastLogin: Date;
  preferences: UserPreferences;
  transferHistory: TransferHistoryItem[];
}

export class UserModel {
  /**
   * Find a user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const redis = getRedisClient();
    const userData = await redis.get(`user:${email}`);
    
    if (!userData) {
      return null;
    }
    
    try {
      const user = JSON.parse(userData);
      
      // Convert string dates back to Date objects
      user.createdAt = new Date(user.createdAt);
      user.lastLogin = new Date(user.lastLogin);
      
      if (user.transferHistory) {
        user.transferHistory = user.transferHistory.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
      
      return user;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }
  
  /**
   * Create or update a user
   */
  static async upsert(userData: Partial<User> & { email: string }): Promise<User> {
    const existingUser = await this.findByEmail(userData.email);
    
    const user: User = {
      id: userData.id || existingUser?.id || nanoid(),
      email: userData.email,
      name: userData.name || existingUser?.name,
      picture: userData.picture || existingUser?.picture,
      createdAt: existingUser?.createdAt || new Date(),
      lastLogin: new Date(),
      preferences: userData.preferences || existingUser?.preferences || {},
      transferHistory: userData.transferHistory || existingUser?.transferHistory || []
    };
    
    // Store user data with 30-day expiration
    const redis = getRedisClient();
    await redis.set(`user:${user.email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
    
    return user;
  }
  
  /**
   * Update user preferences
   */
  static async updatePreferences(email: string, preferences: UserPreferences): Promise<User | null> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }
    
    user.preferences = {
      ...user.preferences,
      ...preferences
    };
    
    const redis = getRedisClient();
    await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
    
    return user;
  }
  
  /**
   * Add transfer to history
   */
  static async addTransferToHistory(email: string, transfer: Omit<TransferHistoryItem, 'id' | 'timestamp'>): Promise<User | null> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }
    
    const newTransfer: TransferHistoryItem = {
      ...transfer,
      id: nanoid(),
      timestamp: new Date()
    };
    
    // Add to beginning of array and limit to 50 items
    user.transferHistory = [newTransfer, ...user.transferHistory].slice(0, 50);
    
    const redis = getRedisClient();
    await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
    
    return user;
  }
  
  /**
   * Clear transfer history
   */
  static async clearTransferHistory(email: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return null;
    }
    
    user.transferHistory = [];
    
    const redis = getRedisClient();
    await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
    
    return user;
  }
}