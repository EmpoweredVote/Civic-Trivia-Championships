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

    // Use raw SQL to avoid drizzle column reference issues
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

// Diagnostic endpoint to check database schema/table existence
router.get('/db-check', async (_req: Request, res: Response) => {
  try {
    // Check which schemas exist
    const schemas = await pool.query(
      `SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`
    );

    // Check for tables in civic_trivia schema
    const civicTables = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'civic_trivia' ORDER BY table_name`
    );

    // Check for tables in public schema
    const publicTables = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    // Check current search_path
    const searchPath = await pool.query(`SHOW search_path`);

    // Check current database name
    const dbName = await pool.query(`SELECT current_database(), current_schema()`);

    res.json({
      database: dbName.rows[0],
      searchPath: searchPath.rows[0],
      schemas: schemas.rows.map((r: any) => r.schema_name),
      civicTriviaSchema: {
        tables: civicTables.rows.map((r: any) => r.table_name),
        count: civicTables.rows.length
      },
      publicSchema: {
        tables: publicTables.rows.map((r: any) => r.table_name),
        count: publicTables.rows.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// One-time setup endpoint to create missing tables on production
router.post('/db-setup', async (_req: Request, res: Response) => {
  try {
    const results: string[] = [];

    // Create collections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "civic_trivia"."collections" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "description" text NOT NULL,
        "locale_code" text NOT NULL,
        "locale_name" text NOT NULL,
        "icon_identifier" text NOT NULL,
        "theme_color" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    results.push('collections table created/verified');

    // Create topics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "civic_trivia"."topics" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    results.push('topics table created/verified');

    // Create collection_topics junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "civic_trivia"."collection_topics" (
        "collection_id" integer NOT NULL REFERENCES "civic_trivia"."collections"("id") ON DELETE CASCADE,
        "topic_id" integer NOT NULL REFERENCES "civic_trivia"."topics"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("collection_id", "topic_id")
      )
    `);
    results.push('collection_topics table created/verified');

    // Create questions table (includes Phase 16 columns: status, expiration_history)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "civic_trivia"."questions" (
        "id" serial PRIMARY KEY,
        "external_id" text NOT NULL UNIQUE,
        "text" text NOT NULL,
        "options" jsonb NOT NULL,
        "correct_answer" integer NOT NULL,
        "explanation" text NOT NULL,
        "difficulty" text NOT NULL,
        "topic_id" integer NOT NULL REFERENCES "civic_trivia"."topics"("id"),
        "subcategory" text,
        "source" jsonb NOT NULL,
        "learning_content" jsonb,
        "expires_at" timestamptz,
        "status" text NOT NULL DEFAULT 'active',
        "expiration_history" jsonb DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    results.push('questions table created/verified');

    // Create collection_questions junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "civic_trivia"."collection_questions" (
        "collection_id" integer NOT NULL REFERENCES "civic_trivia"."collections"("id") ON DELETE CASCADE,
        "question_id" integer NOT NULL REFERENCES "civic_trivia"."questions"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("collection_id", "question_id")
      )
    `);
    results.push('collection_questions table created/verified');

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_collections_active_sort" ON "civic_trivia"."collections" ("is_active", "sort_order") WHERE "is_active" = true`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_topics_slug" ON "civic_trivia"."topics" ("slug")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_collection_topics_collection" ON "civic_trivia"."collection_topics" ("collection_id")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_collection_topics_topic" ON "civic_trivia"."collection_topics" ("topic_id")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_questions_topic_id" ON "civic_trivia"."questions" ("topic_id")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_questions_expires_at" ON "civic_trivia"."questions" ("expires_at") WHERE "expires_at" IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_questions_status" ON "civic_trivia"."questions" ("status")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_collection_questions_collection" ON "civic_trivia"."collection_questions" ("collection_id")`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_collection_questions_question" ON "civic_trivia"."collection_questions" ("question_id")`);
    results.push('indexes created/verified');

    // Verify tables now exist
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'civic_trivia' ORDER BY table_name`
    );

    res.json({
      success: true,
      steps: results,
      tablesNow: tables.rows.map((r: any) => r.table_name)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || String(error),
      detail: error?.detail || undefined
    });
  }
});

export { router };
