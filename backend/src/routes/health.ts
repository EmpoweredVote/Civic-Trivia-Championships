import { Router, Request, Response } from 'express';
import { storageFactory } from '../config/redis.js';
import { pool } from '../config/database.js';

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

router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Use raw SQL with schema-qualified table names for Supabase compatibility
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        COUNT(CASE
          WHEN COALESCE(q.status, 'active') = 'active'
          AND (q.expires_at IS NULL OR q.expires_at > $1)
          THEN 1
        END)::int AS "activeCount",
        COUNT(CASE
          WHEN COALESCE(q.status, 'active') = 'active'
          AND q.expires_at > $2
          AND q.expires_at <= $1
          THEN 1
        END)::int AS "expiringSoonCount",
        COUNT(CASE
          WHEN q.status = 'expired'
          THEN 1
        END)::int AS "expiredCount",
        COUNT(CASE
          WHEN q.status = 'archived'
          THEN 1
        END)::int AS "archivedCount"
      FROM "civic_trivia"."collections" c
      LEFT JOIN "civic_trivia"."collection_questions" cq ON c.id = cq.collection_id
      LEFT JOIN "civic_trivia"."questions" q ON cq.question_id = q.id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.slug
    `, [soonThreshold, now]);

    let totalActive = 0;
    let totalExpiringSoon = 0;
    let totalExpired = 0;
    let totalArchived = 0;

    const collectionsData = result.rows.map((col: any) => {
      const activeCount = col.activeCount || 0;
      const expiringSoonCount = col.expiringSoonCount || 0;
      const expiredCount = col.expiredCount || 0;
      const archivedCount = col.archivedCount || 0;

      let tier: 'Healthy' | 'At Risk' | 'Critical';
      if (activeCount >= 20) tier = 'Healthy';
      else if (activeCount >= 10) tier = 'At Risk';
      else tier = 'Critical';

      totalActive += activeCount;
      totalExpiringSoon += expiringSoonCount;
      totalExpired += expiredCount;
      totalArchived += archivedCount;

      return {
        id: col.id,
        name: col.name,
        slug: col.slug,
        activeCount,
        expiringSoonCount,
        expiredCount,
        archivedCount,
        tier,
        isPlayable: activeCount >= 10
      };
    });

    res.json({
      summary: {
        totalCollections: collectionsData.length,
        totalActive,
        totalExpiringSoon,
        totalExpired,
        totalArchived
      },
      collections: collectionsData
    });
  } catch (error: any) {
    console.error('Error fetching collection health:', error);
    res.status(500).json({ error: 'Failed to fetch collection health', detail: error?.message || String(error) });
  }
});

export { router };
