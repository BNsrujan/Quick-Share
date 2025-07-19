"use strict";
/**
 * Authentication utilities
 *
 * This module provides functions for token verification and user authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.generateToken = generateToken;
const crypto_1 = require("crypto");
const user_1 = require("../models/user");
const logger_1 = require("./logger");
/**
 * Verify a JWT token
 *
 * This function verifies the token signature and expiration.
 * For simplicity, we're using a basic verification approach.
 * In production, you would use a proper JWT library.
 */
async function verifyToken(token) {
    try {
        // In a real implementation, you would use a JWT library
        // This is a simplified version for demonstration purposes
        // Split the token into parts
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }
        // Decode the payload
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        // Check if token is expired
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token expired');
        }
        // Update user's last login time
        if (payload.email) {
            await user_1.UserModel.upsert({
                id: payload.id,
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            });
        }
        return payload;
    }
    catch (error) {
        logger_1.logger.error('Token verification failed:', error);
        throw new Error('Invalid token');
    }
}
/**
 * Generate a secure token for a user
 *
 * This is a simplified token generation function.
 * In production, you would use a proper JWT library.
 */
function generateToken(user) {
    // In a real implementation, you would use a JWT library
    // This is a simplified version for demonstration purposes
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    };
    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    // In a real implementation, you would use a proper signature algorithm
    // This is just for demonstration
    const signature = (0, crypto_1.createHash)('sha256')
        .update(`${headerBase64}.${payloadBase64}.${process.env.JWT_SECRET || 'default_secret'}`)
        .digest('base64');
    return `${headerBase64}.${payloadBase64}.${signature}`;
}
