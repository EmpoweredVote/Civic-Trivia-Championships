import { Router, Request, Response } from 'express';
import { storageFactory } from '../config/redis.js';
import { pool } from '../config/database.js';

const router = Router();

/**
 * GET /health/live — liveness probe for Render's platform health check.
 *
 * Render polls the configured health check path every 5–10 seconds and does NOT
 * expose a way to change that interval, so this path must cost nothing: no Redis
 * command, no Postgres query, no I/O of any kind. If the process can answer this,
 * it is alive — which is all a platform restart decision needs.
 *
 * Point Render's "Health Check Path" setting here. Use GET /health (low frequency,
 * e.g. UptimeRobot) for dependency status, and /health?verbose=1 for session counts.
 *
 * `commit` is the SHA this instance is running, from RENDER_GIT_COMMIT (set
 * automatically by Render at build and runtime). It is a plain env read — no I/O —
 * so it does not violate the rule above. The post-deploy smoke workflow polls this
 * to tell "the new deploy is live" from "the old one is still answering"; without
 * it the only signals were process uptime and the frontend bundle hash, neither of
 * which identifies a commit. Deliberately here rather than on GET /health, which
 * runs a Postgres SELECT 1 and must not be polled in a loop.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    commit: process.env.RENDER_GIT_COMMIT ?? null,
  });
});

router.get('/', async (req: Request, res: Response) => {
  const storage = storageFactory.getStorage();

  // sessionCount is opt-in via ?verbose=1. On Redis it costs a KEYS scan, which
  // Upstash bills as a command — monitors poll this endpoint every few seconds,
  // so including it by default burned the whole free tier. isRedisHealthy()
  // reports connection state with no Redis command at all.
  const verbose = req.query.verbose === '1' || req.query.verbose === 'true';

  let dbHealthy = true;
  let dbError: string | undefined;
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    dbHealthy = false;
    dbError = err?.message || String(err);
  }

  const health = {
    status: 'healthy' as string,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      healthy: dbHealthy,
      ...(dbError ? { error: dbError } : {})
    },
    storage: {
      type: storageFactory.isDegradedMode() ? 'memory' : 'redis',
      healthy: storageFactory.isRedisHealthy(),
      ...(verbose ? { sessionCount: await storage.count() } : {})
    }
  };

  if (!dbHealthy) {
    return res.status(503).json({ ...health, status: 'degraded', message: 'Database unavailable' });
  }

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
      FROM "trivia"."collections" c
      LEFT JOIN "trivia"."collection_questions" cq ON c.id = cq.collection_id
      LEFT JOIN "trivia"."questions" q ON cq.question_id = q.id
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
