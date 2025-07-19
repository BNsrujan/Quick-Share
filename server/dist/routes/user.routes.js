"use strict";
/**
 * User routes for managing user data
 *
 * These routes handle user preferences and transfer history,
 * ensuring privacy compliance and minimal data storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const user_1 = require("../models/user");
const express_rate_limit_1 = require("express-rate-limit");
const auth_1 = require("../utils/auth");
const router = express_1.default.Router();
// Rate limiting for user routes
const userLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.'
});
router.use(userLimiter);
// Middleware to verify authentication
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = await (0, auth_1.verifyToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
// Get user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await user_1.UserModel.findByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ preferences: user.preferences });
    }
    catch (error) {
        console.error('Error getting preferences:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});
// Update user preferences
const PreferencesSchema = zod_1.z.object({
    darkMode: zod_1.z.boolean().optional(),
    notificationsEnabled: zod_1.z.boolean().optional(),
    defaultChunkSize: zod_1.z.number().min(1024).max(10 * 1024 * 1024).optional()
});
router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        const validationResult = PreferencesSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: 'Invalid preferences data', details: validationResult.error });
        }
        const preferences = validationResult.data;
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const updatedUser = await user_1.UserModel.updatePreferences(req.user.email, preferences);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ preferences: updatedUser.preferences });
    }
    catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});
// Get transfer history
router.get('/history', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await user_1.UserModel.findByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ history: user.transferHistory });
    }
    catch (error) {
        console.error('Error getting transfer history:', error);
        res.status(500).json({ error: 'Failed to get transfer history' });
    }
});
// Add transfer to history
const TransferSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1).max(255),
    fileSize: zod_1.z.number().min(0),
    fileType: zod_1.z.string().max(100),
    direction: zod_1.z.enum(['sent', 'received']),
    recipientOrSender: zod_1.z.string().max(255).optional(),
    completed: zod_1.z.boolean()
});
router.post('/history', authMiddleware, async (req, res) => {
    try {
        const validationResult = TransferSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: 'Invalid transfer data', details: validationResult.error });
        }
        const transfer = validationResult.data;
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const updatedUser = await user_1.UserModel.addTransferToHistory(req.user.email, transfer);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, transferId: updatedUser.transferHistory[0].id });
    }
    catch (error) {
        console.error('Error adding transfer to history:', error);
        res.status(500).json({ error: 'Failed to add transfer to history' });
    }
});
// Clear transfer history
router.delete('/history', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const updatedUser = await user_1.UserModel.clearTransferHistory(req.user.email);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error clearing transfer history:', error);
        res.status(500).json({ error: 'Failed to clear transfer history' });
    }
});
exports.userRoutes = router;
