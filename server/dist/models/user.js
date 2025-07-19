"use strict";
/**
 * User model for storing user data
 *
 * This model represents a user in the system with optional preferences
 * and transfer history. It's designed to be privacy-compliant and only
 * store minimal necessary data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const nanoid_1 = require("nanoid");
const database_1 = require("../database");
class UserModel {
    /**
     * Find a user by email
     */
    static async findByEmail(email) {
        const redis = (0, database_1.getRedisClient)();
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
                user.transferHistory = user.transferHistory.map((item) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
            }
            return user;
        }
        catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    /**
     * Create or update a user
     */
    static async upsert(userData) {
        const existingUser = await this.findByEmail(userData.email);
        const user = {
            id: userData.id || existingUser?.id || (0, nanoid_1.nanoid)(),
            email: userData.email,
            name: userData.name || existingUser?.name,
            picture: userData.picture || existingUser?.picture,
            createdAt: existingUser?.createdAt || new Date(),
            lastLogin: new Date(),
            preferences: userData.preferences || existingUser?.preferences || {},
            transferHistory: userData.transferHistory || existingUser?.transferHistory || []
        };
        // Store user data with 30-day expiration
        const redis = (0, database_1.getRedisClient)();
        await redis.set(`user:${user.email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
        return user;
    }
    /**
     * Update user preferences
     */
    static async updatePreferences(email, preferences) {
        const user = await this.findByEmail(email);
        if (!user) {
            return null;
        }
        user.preferences = {
            ...user.preferences,
            ...preferences
        };
        const redis = (0, database_1.getRedisClient)();
        await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
        return user;
    }
    /**
     * Add transfer to history
     */
    static async addTransferToHistory(email, transfer) {
        const user = await this.findByEmail(email);
        if (!user) {
            return null;
        }
        const newTransfer = {
            ...transfer,
            id: (0, nanoid_1.nanoid)(),
            timestamp: new Date()
        };
        // Add to beginning of array and limit to 50 items
        user.transferHistory = [newTransfer, ...user.transferHistory].slice(0, 50);
        const redis = (0, database_1.getRedisClient)();
        await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
        return user;
    }
    /**
     * Clear transfer history
     */
    static async clearTransferHistory(email) {
        const user = await this.findByEmail(email);
        if (!user) {
            return null;
        }
        user.transferHistory = [];
        const redis = (0, database_1.getRedisClient)();
        await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 30 * 24 * 60 * 60);
        return user;
    }
}
exports.UserModel = UserModel;
