"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.revertMigrations = revertMigrations;
const index_1 = require("../index");
const logger_1 = require("../../utils/logger");
const roomManagementMigration = __importStar(require("./001-room-management"));
// List of migrations
const migrations = [
    {
        version: 1,
        name: 'room_management',
        up: roomManagementMigration.up,
        down: roomManagementMigration.down
    },
    // Add more migrations here as needed
];
// Run migrations
async function runMigrations() {
    const redis = (0, index_1.getRedisClient)();
    try {
        // Get current schema version
        const currentVersion = await redis.get('schema:version');
        const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0;
        logger_1.logger.info(`Current database schema version: ${currentVersionNum}`);
        // Apply pending migrations
        for (const migration of migrations) {
            if (migration.version > currentVersionNum) {
                logger_1.logger.info(`Applying migration ${migration.version}: ${migration.name}`);
                await migration.up();
                await redis.set('schema:version', migration.version.toString());
                logger_1.logger.info(`Migration ${migration.version} applied successfully`);
            }
        }
        logger_1.logger.info('All migrations applied successfully');
    }
    catch (error) {
        logger_1.logger.error('Migration failed', { error });
        throw error;
    }
}
// Revert migrations (for testing/development)
async function revertMigrations(targetVersion = 0) {
    const redis = (0, index_1.getRedisClient)();
    try {
        // Get current schema version
        const currentVersion = await redis.get('schema:version');
        const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0;
        logger_1.logger.info(`Current database schema version: ${currentVersionNum}`);
        // Sort migrations in descending order for reverting
        const sortedMigrations = [...migrations].sort((a, b) => b.version - a.version);
        // Revert migrations until target version
        for (const migration of sortedMigrations) {
            if (migration.version > targetVersion && migration.version <= currentVersionNum) {
                logger_1.logger.info(`Reverting migration ${migration.version}: ${migration.name}`);
                await migration.down();
                await redis.set('schema:version', (migration.version - 1).toString());
                logger_1.logger.info(`Migration ${migration.version} reverted successfully`);
            }
        }
        logger_1.logger.info(`Migrations reverted to version ${targetVersion}`);
    }
    catch (error) {
        logger_1.logger.error('Migration reversion failed', { error });
        throw error;
    }
}
