// Load environment variables FIRST
import './env.js';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { router as gameRouter } from './routes/game.js';
import { router as profileRouter } from './routes/profile.js';
import { router as healthRouter } from './routes/health.js';
import { router as adminRouter } from './routes/admin.js';
import feedbackRouter from './routes/feedback.js';
import { router as leaderboardRouter } from './routes/leaderboard.js';
import { storageFactory } from './config/redis.js';
import { initializeSessionManager } from './services/sessionService.js';
import { startExpirationCron, startElectionDetectionCron, startPipelineCron } from './cron/startCron.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [FRONTEND_URL, process.env.FRONTEND_URL_ALT].filter((o): o is string => !!o);

/**
 * Whether a caller with this Origin may read our responses.
 *
 * No Origin header means a non-browser caller (server-to-server, curl, Render's
 * health probe). CORS does not govern those, so they pass.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  // Any localhost origin in development (Vite picks a new port when one is taken)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Start server with async initialization
 * Ensures storage is initialized before accepting requests
 */
async function startServer() {
  // Initialize storage (Redis or Memory fallback)
  await storageFactory.initialize();

  // Initialize session manager with storage backend
  initializeSessionManager(storageFactory.getStorage());

  // Start expiration cron job
  startExpirationCron();

  // Start election detection cron job
  startElectionDetectionCron();

  // Start international pipeline cron job
  startPipelineCron();

  // Middleware
  app.use(cors({
    // Signal a disallowed origin by omitting the CORS headers — the mechanism the
    // spec actually uses — rather than passing an Error. The Error fell through to
    // Express's default handler, so a rejected preflight answered 500, which reads
    // as "the API is broken" rather than "that origin is not allowed".
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true
  }));

  // cors() only omits the headers; it still calls next(), and simple requests
  // (GET, form-encoded POST) skip preflight altogether. Reject here so a
  // disallowed origin never reaches a route handler — the protection the thrown
  // Error used to provide — but with a status that says what happened.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isAllowedOrigin(req.headers.origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    next();
  });
  app.use(express.json());

  // Health check endpoint
  app.use('/health', healthRouter);

  // Game routes
  app.use('/api/game', gameRouter);

  // Profile routes
  app.use('/api/users/profile', profileRouter);

  // Admin routes
  app.use('/api/admin', adminRouter);

  // Feedback routes
  app.use('/api/feedback', feedbackRouter);

  // Leaderboard routes (public — no auth required)
  app.use('/api/leaderboard', leaderboardRouter);

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
