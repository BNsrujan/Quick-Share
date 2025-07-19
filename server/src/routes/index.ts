import { Express } from 'express';
import { roomRoutes } from './room.routes';
import { userRoutes } from './user.routes';
import healthRoutes from './health.routes';

export function setupRoutes(app: Express): void {
  // API routes
  app.use('/api/rooms', roomRoutes);
  app.use('/api/users', userRoutes);
  
  // Health and monitoring routes
  app.use('/health', healthRoutes);
}