import { Router, Request, Response } from 'express';
import { storageFactory } from '../config/redis.js';
import { db } from '../db/index.js';
import { collections, collectionQuestions, questions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

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
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Query collection health with aggregated question counts
    const collectionHealthData = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        activeCount: sql<number>`
          COUNT(CASE
            WHEN ${questions.status} = 'active'
            AND (${questions.expiresAt} IS NULL OR ${questions.expiresAt} > ${soonThreshold})
            THEN 1
          END)
        `.as('active_count'),
        expiringSoonCount: sql<number>`
          COUNT(CASE
            WHEN ${questions.status} = 'active'
            AND ${questions.expiresAt} > ${now}
            AND ${questions.expiresAt} <= ${soonThreshold}
            THEN 1
          END)
        `.as('expiring_soon_count'),
        expiredCount: sql<number>`
          COUNT(CASE
            WHEN ${questions.status} = 'expired'
            THEN 1
          END)
        `.as('expired_count'),
        archivedCount: sql<number>`
          COUNT(CASE
            WHEN ${questions.status} = 'archived'
            THEN 1
          END)
        `.as('archived_count')
      })
      .from(collections)
      .leftJoin(collectionQuestions, eq(collections.id, collectionQuestions.collectionId))
      .leftJoin(questions, eq(collectionQuestions.questionId, questions.id))
      .where(eq(collections.isActive, true))
      .groupBy(collections.id, collections.name, collections.slug);

    // Compute tier and isPlayable for each collection, and build summary
    let totalActive = 0;
    let totalExpiringSoon = 0;
    let totalExpired = 0;
    let totalArchived = 0;

    const collectionsWithTier = collectionHealthData.map((col) => {
      const activeCount = Number(col.activeCount);
      const expiringSoonCount = Number(col.expiringSoonCount);
      const expiredCount = Number(col.expiredCount);
      const archivedCount = Number(col.archivedCount);

      // Compute tier
      let tier: 'Healthy' | 'At Risk' | 'Critical';
      if (activeCount >= 20) {
        tier = 'Healthy';
      } else if (activeCount >= 10) {
        tier = 'At Risk';
      } else {
        tier = 'Critical';
      }

      const isPlayable = activeCount >= 10;

      // Add to summary
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
        isPlayable
      };
    });

    res.json({
      summary: {
        totalCollections: collectionHealthData.length,
        totalActive,
        totalExpiringSoon,
        totalExpired,
        totalArchived
      },
      collections: collectionsWithTier
    });
  } catch (error) {
    console.error('Error fetching collection health:', error);
    res.status(500).json({ error: 'Failed to fetch collection health' });
  }
});

export { router };
