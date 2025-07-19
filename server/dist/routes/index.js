"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const room_routes_1 = require("./room.routes");
const user_routes_1 = require("./user.routes");
const health_routes_1 = __importDefault(require("./health.routes"));
function setupRoutes(app) {
    // API routes
    app.use('/api/rooms', room_routes_1.roomRoutes);
    app.use('/api/users', user_routes_1.userRoutes);
    // Health and monitoring routes
    app.use('/health', health_routes_1.default);
}
