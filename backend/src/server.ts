// Load environment variables FIRST
import './env.js';

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router as authRouter } from './routes/auth.js';
import { router as gameRouter } from './routes/game.js';
import { router as profileRouter } from './routes/profile.js';
import { router as healthRouter } from './routes/health.js';
import { router as adminRouter } from './routes/admin.js';
import { storageFactory } from './config/redis.js';
import { initializeSessionManager } from './services/sessionService.js';
import { startExpirationCron } from './cron/startCron.js';
import { runMigrations } from './db/migrate.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Start server with async initialization
 * Ensures storage is initialized before accepting requests
 */
async function startServer() {
  // Run database migrations
  await runMigrations();

  // Initialize storage (Redis or Memory fallback)
  await storageFactory.initialize();

  // Initialize session manager with storage backend
  initializeSessionManager(storageFactory.getStorage());

  // Start expiration cron job
  startExpirationCron();

  // Middleware
  app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json());

  // Static file serving for uploads
  app.use('/uploads', express.static('uploads'));

  // Health check endpoint
  app.use('/health', healthRouter);

  // Auth routes
  app.use('/auth', authRouter);

  // Game routes
  app.use('/api/game', gameRouter);

  // Profile routes
  app.use('/api/users/profile', profileRouter);

  // Admin routes
  app.use('/api/admin', adminRouter);

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS enabled for: ${FRONTEND_URL}`);
    console.log(`Storage: ${storageFactory.isDegradedMode() ? 'in-memory (degraded)' : 'Redis'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
