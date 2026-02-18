# Phase 13: Database Schema & Seed Migration - Research

**Researched:** 2026-02-18
**Domain:** PostgreSQL schema design and data migration
**Confidence:** HIGH

## Summary

This phase migrates 120 questions from JSON to PostgreSQL using best-practice schema design patterns. The standard approach uses junction tables for many-to-many relationships (questions-to-collections, collections-to-topics), JSONB for semi-structured learning content, and timestamptz for all temporal data. PostgreSQL's native pg driver with Drizzle ORM provides type-safe schema definitions and migration tooling ideal for TypeScript projects.

The research confirms that migration scripts should be immutable SQL files tracked in version control, with explicit rollback scripts provided. For bulk data insertion, COPY operations outperform batched INSERTs by 4-5x. JSONB columns should store only variable/optional data (learning content) while fixed attributes use strongly-typed columns, enabling query optimization. The project already uses the civic_trivia schema correctly, avoiding the common pitfall of using the public schema.

**Primary recommendation:** Use Drizzle ORM for type-safe schema definitions with raw SQL migrations for explicit control, JSONB columns indexed with GIN (jsonb_path_ops) for learning content queries, and junction tables with composite primary keys for all many-to-many relationships.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-postgres (pg) | 8.11.3+ | PostgreSQL driver | Already in project; most widely used Node.js PostgreSQL driver with native prepared statements |
| Drizzle ORM | 0.35+ | Type-safe schema/migrations | Lightweight TypeScript-first ORM with SQL-centric approach, zero dependencies, ideal for serverless |
| Drizzle Kit | 0.28+ | Migration CLI | Official companion for generating SQL migrations, schema introspection, and push commands |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @faker-js/faker | 8+ | Seed data generation | Only if generating test data; not needed for migrating existing questions |
| tsx | 4.7+ | TypeScript execution | Already in project; run migration scripts without compilation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle ORM | Knex.js | Knex has mature migration tooling but limited TypeScript inference; more boilerplate |
| Drizzle ORM | Prisma | Prisma provides excellent DX but adds heavy abstraction layer; code-generation overhead |
| Drizzle ORM | Raw SQL only | Maximum control but lose type safety; manual query building |
| Drizzle Kit | Graphile Migrate | Roll-forward only approach (no down migrations); different philosophy |

**Installation:**
```bash
npm install drizzle-orm drizzle-kit
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── src/
│   ├── db/
│   │   ├── schema.ts          # Drizzle table definitions
│   │   ├── migrations/        # Generated SQL files (immutable)
│   │   │   ├── 0001_create_collections_and_topics.sql
│   │   │   ├── 0002_create_questions.sql
│   │   │   └── meta/          # Drizzle Kit metadata
│   │   └── seed/
│   │       ├── seed.ts        # Main seed orchestrator
│   │       ├── collections.ts # Collection seed data
│   │       ├── topics.ts      # Topic seed data
│   │       └── questions.ts   # Question migration from JSON
│   └── config/
│       └── database.ts        # Existing pg Pool connection
├── drizzle.config.ts          # Drizzle Kit configuration
└── rollback.sql               # Manual rollback script
```

### Pattern 1: Junction Table for Many-to-Many
**What:** Two foreign keys with composite primary key, no surrogate ID
**When to use:** Modeling relationships where both sides exist independently (questions ↔ collections, collections ↔ topics)
**Example:**
```typescript
// Source: PostgreSQL community best practices
// https://hasura.io/learn/database/postgresql/core-concepts/6-postgresql-relationships/

export const collectionQuestions = pgTable('collection_questions', {
  collectionId: integer('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.collectionId, table.questionId] })
}));
```

### Pattern 2: JSONB for Semi-Structured Optional Data
**What:** Store variable/optional content in JSONB, fixed attributes in typed columns
**When to use:** Learning content with variable structure (some questions have it, others don't)
**Example:**
```typescript
// Source: PostgreSQL official documentation
// https://www.postgresql.org/docs/current/datatype-json.html

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  options: text('options').array().notNull(), // Fixed: always 4 options
  correctAnswer: integer('correct_answer').notNull(),
  explanation: text('explanation').notNull(),
  difficulty: text('difficulty').notNull(), // 'easy' | 'medium' | 'hard'
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id),

  // Optional learning content as JSONB
  learningContent: jsonb('learning_content').$type<{
    paragraphs: string[];
    corrections: Record<string, string>; // per-wrong-answer explanations
    source: {
      name: string;
      url: string;
    };
  }>(),

  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
```

### Pattern 3: Immutable Migrations with Explicit Rollback
**What:** SQL migration files never change after creation; rollback script separately maintained
**When to use:** All production database changes
**Example:**
```sql
-- File: migrations/0001_create_collections_and_topics.sql
-- Source: Best practices from graphile/migrate and postgres-migrations
-- https://github.com/graphile/migrate

-- Forward migration
CREATE TABLE civic_trivia.collections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  locale_code VARCHAR(10) NOT NULL,
  locale_name VARCHAR(50) NOT NULL,
  icon_identifier VARCHAR(50) NOT NULL,
  theme_color VARCHAR(7) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_slug ON civic_trivia.collections(slug);
CREATE INDEX idx_collections_active_sort ON civic_trivia.collections(is_active, sort_order)
  WHERE is_active = true;

-- File: rollback.sql (separate file)
-- Rollback script (run manually if needed)
DROP TABLE IF EXISTS civic_trivia.collection_questions CASCADE;
DROP TABLE IF EXISTS civic_trivia.questions CASCADE;
DROP TABLE IF EXISTS civic_trivia.collection_topics CASCADE;
DROP TABLE IF EXISTS civic_trivia.topics CASCADE;
DROP TABLE IF EXISTS civic_trivia.collections CASCADE;
```

### Pattern 4: Bulk Insert with COPY for Seed Data
**What:** Use PostgreSQL COPY command or multi-row INSERT for efficient bulk loading
**When to use:** Seeding 120+ questions and related data
**Example:**
```typescript
// Source: PostgreSQL bulk loading best practices
// https://www.postgresql.org/docs/current/populate.html

async function seedQuestions(pool: Pool, questions: Question[]) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Option 1: Multi-row INSERT (easier with Drizzle)
    await db.insert(questionsTable).values(questions);

    // Option 2: COPY for larger datasets (120 questions: INSERT is fine)
    // const copyStream = client.query(
    //   copyFrom('COPY civic_trivia.questions FROM STDIN CSV')
    // );

    await client.query('COMMIT');
    console.log(`Seeded ${questions.length} questions`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 5: Foreign Key Indexing
**What:** Always index foreign key columns for JOIN performance
**When to use:** All foreign keys (topic_id, collection_id, question_id)
**Example:**
```typescript
// Source: PostgreSQL foreign key indexing best practices
// https://www.cybertec-postgresql.com/en/index-your-foreign-key/

export const questions = pgTable('questions', {
  // ... other columns
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id),
}, (table) => ({
  // B-tree index for FK lookups
  topicIdx: index('idx_questions_topic_id').on(table.topicId),
  // GIN index for JSONB containment queries
  learningContentIdx: index('idx_questions_learning_content')
    .using('gin', table.learningContent.op('jsonb_path_ops'))
}));
```

### Anti-Patterns to Avoid
- **Adding columns with both DEFAULT and NOT NULL** – Can cause full table rewrite in older PostgreSQL versions; for new tables this isn't an issue
- **Flattening many-to-many into one-to-many** – Using single collection_id on questions instead of junction table limits future flexibility
- **Storing everything in public schema** – Project correctly uses civic_trivia schema
- **Using timestamp without timezone** – Use timestamptz for all temporal data
- **varchar(n) for variable text** – Use TEXT unless length validation required; no performance difference

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration tracking | Custom version table | Drizzle Kit migrations | Handles migration ordering, hashing, and metadata automatically |
| Schema type generation | Manual TypeScript types | Drizzle's infer types | Types derived from schema definitions prevent drift |
| Timestamp management | Custom trigger functions | PostgreSQL DEFAULT NOW() + app-level updates | Built-in functionality sufficient for created_at/updated_at |
| JSONB validation | Application-only checks | CHECK constraints + app validation | Database constraints prevent invalid data at source |
| Seed data idempotence | Custom upsert logic | INSERT ... ON CONFLICT DO NOTHING | Native PostgreSQL upsert handles re-running seeds |
| Connection pooling | Custom pool management | Existing pg Pool in config/database.ts | Already configured with proper pool settings |

**Key insight:** PostgreSQL provides robust built-in features for constraints, indexes, and upserts. Drizzle ORM generates accurate TypeScript types from schema definitions, eliminating manual type maintenance. Don't rebuild what the ecosystem provides.

## Common Pitfalls

### Pitfall 1: JSONB Column Size and TOAST Storage
**What goes wrong:** Storing large JSONB documents (>2KB) causes TOAST overhead; updates duplicate entire value
**Why it happens:** PostgreSQL moves large values to TOAST storage automatically, incurring extra I/O
**How to avoid:** Keep JSONB documents small (learning content per question should be well under 2KB); if exceeds 2KB, consider extracting to related tables
**Warning signs:** Slow updates on questions table despite indexing; TOAST table growing rapidly

### Pitfall 2: Wrong GIN Index Operator Class
**What goes wrong:** Using default jsonb_ops when jsonb_path_ops would be faster
**Why it happens:** Default GIN index is more flexible but creates larger indexes and slower searches
**How to avoid:** Use jsonb_path_ops for containment queries (@>) if you don't need key-exists operators (?, ?|, ?&)
**Warning signs:** Large index size (60-80% of table size); slow JSONB containment queries

### Pitfall 3: Missing Foreign Key Indexes
**What goes wrong:** Slow JOINs on collection_id or topic_id despite proper schema design
**Why it happens:** PostgreSQL doesn't automatically index FK columns (only the referenced PK)
**How to avoid:** Create B-tree indexes on ALL foreign key columns in child tables
**Warning signs:** Sequential scans on questions table when filtering by topic_id or joining to collections

### Pitfall 4: Forgetting to Run ANALYZE After Bulk Insert
**What goes wrong:** Query planner uses stale statistics, choosing sequential scans over index scans
**Why it happens:** ANALYZE isn't automatic after manual INSERT/COPY operations
**How to avoid:** Always run ANALYZE after seeding data
**Warning signs:** Slow queries immediately after migration that improve after autovacuum runs

### Pitfall 5: Non-Atomic Migration + Seed
**What goes wrong:** Migration succeeds but seed fails, leaving empty tables
**Why it happens:** Running migration and seed as separate operations without transaction wrapping
**How to avoid:** Separate concerns – migrations create schema, seeds populate data; both can be rolled back independently
**Warning signs:** Database has correct schema but no data; unclear which step failed

### Pitfall 6: AI Source Hallucination
**What goes wrong:** AI generates plausible but incorrect source URLs for civic questions
**Why it happens:** LLMs can confabulate authoritative-sounding but non-existent URLs
**How to avoid:** Verify EVERY AI-suggested source URL by visiting it; prefer official sources (.gov, archives.gov, congress.gov)
**Warning signs:** 404 errors on source URLs; URLs that don't mention the specific fact being cited

### Pitfall 7: Using timestamp Instead of timestamptz
**What goes wrong:** Ambiguous times across timezone changes; incorrect sorting of events
**Why it happens:** timestamp stores "picture of clock" not point in time; loses timezone context
**How to avoid:** Use timestamptz for ALL temporal columns (created_at, updated_at, expires_at)
**Warning signs:** Time comparisons behave unexpectedly; issues when server timezone changes

## Code Examples

Verified patterns from official sources:

### Example 1: Drizzle Schema Definition
```typescript
// Source: Drizzle ORM PostgreSQL documentation
// https://orm.drizzle.team/docs/get-started/postgresql-new

import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  localeCode: text('locale_code').notNull(),
  localeName: text('locale_name').notNull(),
  iconIdentifier: text('icon_identifier').notNull(),
  themeColor: text('theme_color').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  slugIdx: index('idx_collections_slug').on(table.slug),
  activeSortIdx: index('idx_collections_active_sort').on(table.isActive, table.sortOrder)
    .where(sql`${table.isActive} = true`)
}));

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  slugIdx: index('idx_topics_slug').on(table.slug)
}));

export const collectionTopics = pgTable('collection_topics', {
  collectionId: integer('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.collectionId, table.topicId] }),
  collectionIdx: index('idx_collection_topics_collection').on(table.collectionId),
  topicIdx: index('idx_collection_topics_topic').on(table.topicId)
}));
```

### Example 2: Seed Script with Idempotent Inserts
```typescript
// Source: PostgreSQL INSERT ... ON CONFLICT documentation
// https://www.postgresql.org/docs/current/sql-insert.html

import { db } from '../config/database';
import { collections, topics, collectionTopics } from './schema';
import questionsData from '../data/questions.json';

async function seed() {
  console.log('Starting seed...');

  // Seed collections
  const collectionValues = [
    {
      name: 'Federal Civics',
      slug: 'federal',
      description: 'Test your knowledge of U.S. federal government',
      localeCode: 'en-US',
      localeName: 'United States',
      iconIdentifier: 'flag-us',
      themeColor: '#1E3A8A',
      isActive: true,
      sortOrder: 1
    },
    {
      name: 'Bloomington, IN Civics',
      slug: 'bloomington-in',
      description: 'Bloomington city government and local civics',
      localeCode: 'en-US',
      localeName: 'Bloomington, Indiana',
      iconIdentifier: 'flag-in',
      themeColor: '#991B1B',
      isActive: false,
      sortOrder: 2
    },
    {
      name: 'Los Angeles, CA Civics',
      slug: 'los-angeles-ca',
      description: 'Los Angeles city government and local civics',
      localeCode: 'en-US',
      localeName: 'Los Angeles, California',
      iconIdentifier: 'flag-ca',
      themeColor: '#0369A1',
      isActive: false,
      sortOrder: 3
    }
  ];

  const insertedCollections = await db
    .insert(collections)
    .values(collectionValues)
    .onConflictDoNothing({ target: collections.slug })
    .returning();

  console.log(`Seeded ${insertedCollections.length} collections`);

  // Seed topics and questions (similar pattern)
  // ...

  // Run ANALYZE for fresh statistics
  await db.execute(sql`ANALYZE civic_trivia.collections`);
  await db.execute(sql`ANALYZE civic_trivia.topics`);
  await db.execute(sql`ANALYZE civic_trivia.questions`);

  console.log('Seed complete!');
}

seed().catch(console.error);
```

### Example 3: Migration Configuration
```typescript
// File: drizzle.config.ts
// Source: Drizzle Kit documentation

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['civic_trivia'],
  verbose: true,
  strict: true
} satisfies Config;
```

### Example 4: JSONB Query with GIN Index
```typescript
// Source: PostgreSQL JSONB indexing documentation
// https://www.postgresql.org/docs/current/datatype-json.html

import { db } from '../config/database';
import { questions } from './schema';
import { sql } from 'drizzle-orm';

// Query questions that have learning content with specific source
const questionsWithNationalArchives = await db
  .select()
  .from(questions)
  .where(
    sql`${questions.learningContent} @> '{"source": {"name": "National Archives"}}'::jsonb`
  );

// This query uses the GIN index:
// CREATE INDEX idx_questions_learning_content
// ON civic_trivia.questions
// USING GIN (learning_content jsonb_path_ops);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Knex.js migrations | Drizzle ORM with Kit | 2023-2024 | Type-safe schema definitions eliminate manual type sync; SQL migrations still used |
| JSON type | JSONB type | PostgreSQL 9.4 (2014) | Binary format enables indexing and faster queries; now standard for all JSON storage |
| SERIAL columns | IDENTITY columns | PostgreSQL 10 (2017) | SQL standard compliance; better for replication (not critical for this phase) |
| timestamp | timestamptz | Always preferred | Avoids timezone ambiguity; critical for correctness |
| Separate ORM + migration tool | Unified Drizzle ecosystem | 2024+ | Single tool for schema, migrations, and type generation reduces complexity |

**Deprecated/outdated:**
- **SERIAL types**: Still work but IDENTITY columns preferred for new schemas; SERIAL is fine for this phase
- **Knex migrations**: Still widely used but Drizzle provides better TypeScript integration
- **JSON type**: Use JSONB unless you need exact whitespace/key order preservation
- **trust authentication**: Never use over TCP/IP (already handled correctly via DATABASE_URL)
- **SQL_ASCII encoding**: Use UTF8 (Supabase defaults to UTF8)

## Open Questions

Things that couldn't be fully resolved:

1. **Question: Should migration seed the 87 missing sources, or defer to Phase 17?**
   - What we know: Context says "AI-assisted sourcing" during migration; 33 questions already have sources
   - What's unclear: Whether this phase should include AI-assisted source lookup or just document the process
   - Recommendation: Include AI-assisted source lookup in this phase to meet requirement "ALL questions must have authoritative sources after migration" – use Claude with verification protocol

2. **Question: What's the exact JSONB structure for learning content?**
   - What we know: Fields are paragraphs (array), corrections (object), source (object with name/url)
   - What's unclear: Should corrections be keyed by option index ('0', '1', '2', '3') or by option text?
   - Recommendation: Use string indexes ('0', '1', '2', '3') to match correctAnswer index pattern – simpler and consistent

3. **Question: Should topics be pre-populated with Federal topics only, or include Bloomington/LA topics?**
   - What we know: Federal has 7 main topics and 9 topicCategories; collections define valid topics
   - What's unclear: Whether to seed topics table with only Federal topics or anticipate future collection topics
   - Recommendation: Seed only Federal's 7 main topics + 9 subcategories as separate topic records; Phase 17 can add local topics when needed

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Official Documentation - JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) - JSONB vs JSON, indexing strategies
- [PostgreSQL Official Documentation - Populating a Database](https://www.postgresql.org/docs/current/populate.html) - Bulk loading best practices
- [PostgreSQL Wiki - Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This) - Anti-patterns and pitfalls
- [PostgreSQL Wiki - Database Schema Recommendations](https://wiki.postgresql.org/wiki/Database_Schema_Recommendations_for_an_Application) - Schema namespace best practices
- [Drizzle ORM - PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started/postgresql-new) - Official setup and usage guide

### Secondary (MEDIUM confidence)
- [Hasura - PostgreSQL Relationships](https://hasura.io/learn/database/postgresql/core-concepts/6-postgresql-relationships/) - Junction table patterns
- [CYBERTEC - Foreign Key Indexing](https://www.cybertec-postgresql.com/en/index-your-foreign-key/) - Why to index FKs
- [Tiger Data - Testing Postgres Ingest](https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy) - COPY vs INSERT benchmarks
- [Crunchy Data - Indexing JSONB](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) - GIN operator class comparison
- [pgAnalyze - Understanding GIN Indexes](https://pganalyze.com/blog/gin-index) - GIN index tradeoffs
- [GitHub - graphile/migrate](https://github.com/graphile/migrate) - Immutable migration philosophy
- [Supabase Docs - Seeding Your Database](https://supabase.com/docs/guides/local-development/seeding-your-database) - Seed script patterns

### Secondary (MEDIUM confidence) - ORM Comparisons
- [Kite Metric - Top Node.js ORMs 2025](https://kitemetric.com/blogs/top-5-node-js-orms-to-master-in-2025) - Ecosystem landscape
- [Marmelab - Kysely vs Drizzle](https://marmelab.com/blog/2025/06/26/kysely-vs-drizzle.html) - Type-safe query builder comparison
- [Better Stack - Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) - ORM tradeoffs

### Secondary (MEDIUM confidence) - Civic Education Sources
- [Center for Civic Education - National Standards](https://www.civiced.org/resource-materials/national-standards-for-civics-and-government) - Authoritative civics standards
- [EdSurge - Civics Takes Center Stage in 2026](https://www.edsurge.com/news/2026-01-14-civics-takes-center-stage-in-2026) - Current civic education initiatives
- [Microsoft 365 - How to Fact-Check AI](https://www.microsoft.com/en-us/microsoft-365-life-hacks/everyday-ai/how-to-fact-check-ai) - AI fact-checking protocols

### Tertiary (LOW confidence)
- [Medium - JSONB Operator Classes](https://medium.com/@josef.machytka/postgresql-jsonb-operator-classes-of-gin-indexes-and-their-usage-0bf399073a4c) - Technical deep dive (unverified)
- [Medium - Postgres TEXT vs VARCHAR](https://medium.com/the-table-sql-and-devtalk/postgres-text-vs-varchar-choosing-the-right-string-type-cbd20b4d84b2) - Performance comparison (community perspective)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Drizzle ORM well-documented; pg driver already in use; verified with official docs
- Architecture: HIGH - Junction table and JSONB patterns verified with official PostgreSQL wiki and documentation
- Pitfalls: HIGH - Anti-patterns sourced from official PostgreSQL "Don't Do This" wiki and pgAnalyze

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days - stable domain with mature tooling)
