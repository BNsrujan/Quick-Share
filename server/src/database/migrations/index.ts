import { getRedisClient } from '../index';
import { logger } from '../../utils/logger';
import * as roomManagementMigration from './001-room-management';

// Migration interface
interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// List of migrations
const migrations: Migration[] = [
  {
    version: 1,
    name: 'room_management',
    up: roomManagementMigration.up,
    down: roomManagementMigration.down
  },
  // Add more migrations here as needed
];

// Run migrations
export async function runMigrations(): Promise<void> {
  const redis = getRedisClient();
  
  try {
    // Get current schema version
    const currentVersion = await redis.get('schema:version');
    const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0;
    
    logger.info(`Current database schema version: ${currentVersionNum}`);
    
    // Apply pending migrations
    for (const migration of migrations) {
      if (migration.version > currentVersionNum) {
        logger.info(`Applying migration ${migration.version}: ${migration.name}`);
        await migration.up();
        await redis.set('schema:version', migration.version.toString());
        logger.info(`Migration ${migration.version} applied successfully`);
      }
    }
    
    logger.info('All migrations applied successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}

// Revert migrations (for testing/development)
export async function revertMigrations(targetVersion: number = 0): Promise<void> {
  const redis = getRedisClient();
  
  try {
    // Get current schema version
    const currentVersion = await redis.get('schema:version');
    const currentVersionNum = currentVersion ? parseInt(currentVersion, 10) : 0;
    
    logger.info(`Current database schema version: ${currentVersionNum}`);
    
    // Sort migrations in descending order for reverting
    const sortedMigrations = [...migrations].sort((a, b) => b.version - a.version);
    
    // Revert migrations until target version
    for (const migration of sortedMigrations) {
      if (migration.version > targetVersion && migration.version <= currentVersionNum) {
        logger.info(`Reverting migration ${migration.version}: ${migration.name}`);
        await migration.down();
        await redis.set('schema:version', (migration.version - 1).toString());
        logger.info(`Migration ${migration.version} reverted successfully`);
      }
    }
    
    logger.info(`Migrations reverted to version ${targetVersion}`);
  } catch (error) {
    logger.error('Migration reversion failed', { error });
    throw error;
  }
}