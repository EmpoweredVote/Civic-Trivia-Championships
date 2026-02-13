import { Router, Request, Response } from 'express';
import { storageFactory } from '../config/redis.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const storage = storageFactory.getStorage();
  const health = {
    status: 'healthy' as string,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: {
      type: storageFactory.isDegradedMode() ? 'memory' : 'redis',
      healthy: storageFactory.isRedisHealthy(),
      sessionCount: await storage.count()
    }
  };

  // Return 503 if Redis was expected (REDIS_URL set) but is down
  if (process.env.REDIS_URL && storageFactory.isDegradedMode()) {
    return res.status(503).json({
      ...health,
      status: 'degraded',
      message: 'Redis unavailable, using fallback storage'
    });
  }

  res.json(health);
});

export { router };
