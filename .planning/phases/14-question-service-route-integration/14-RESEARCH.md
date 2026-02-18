# Phase 14: Question Service & Route Integration - Research

**Researched:** 2026-02-18
**Domain:** Database query layer, service architecture, graceful degradation patterns
**Confidence:** HIGH

## Summary

Phase 14 replaces JSON file reads with PostgreSQL queries via Drizzle ORM, introducing a QuestionService that handles collection-scoped question selection with difficulty constraints and recent-question tracking. The research confirms that Drizzle ORM (already installed in the project at v0.45.1) provides excellent TypeScript-first query patterns that integrate seamlessly with the existing node-postgres Pool connection. The project's existing Redis fallback pattern (Phase 9) provides a proven template for silent database degradation.

Key architectural findings: Service layer pattern matches existing codebase structure (progressionService, scoreService, sessionService). Drizzle queries are type-safe and SQL-like, avoiding ORM abstraction overhead. Question selection algorithm uses WHERE filtering with difficulty constraints plus ORDER BY RANDOM() LIMIT for small collections (120-200 questions), which is acceptable for this scale. Recent question tracking uses notInArray filtering with a simple exclusion list.

**Primary recommendation:** Create QuestionService as a module (not class) following existing service patterns. Use try-catch at service boundaries to catch database errors and fall back silently to JSON file reads. Transform database rows to match existing Question interface so zero changes are needed downstream.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | TypeScript ORM | Already in project, type-safe queries without abstraction overhead |
| pg (node-postgres) | 8.11.3 | PostgreSQL driver | Already configured with Pool, SSL, search_path |
| @types/pg | 8.10.9 | TypeScript types | Full type inference for queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm/node-postgres | 0.45.1 | Drizzle + pg integration | Wraps existing Pool (already done in db/index.ts) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drizzle-orm | Raw pg queries | Drizzle provides type safety and better DX with no perf cost |
| node-postgres | postgres.js | Project already uses node-postgres, no reason to switch |
| ORDER BY RANDOM() | TABLESAMPLE SYSTEM | TABLESAMPLE 1000x faster but overkill for 120-200 questions |

**Installation:**
No new packages needed — all dependencies already installed in Phase 13.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── questionService.ts      # NEW: Question selection logic
│   ├── sessionService.ts        # MODIFY: Use QuestionService
│   ├── progressionService.ts    # Existing pattern to follow
│   └── scoreService.ts          # Existing pattern to follow
├── routes/
│   └── game.ts                  # MODIFY: Accept collectionId param
└── db/
    ├── index.ts                 # Existing Drizzle instance
    └── schema.ts                # Existing schema definitions
```

### Pattern 1: Service Module (Not Class)

**What:** Export pure functions from a service module, matching existing patterns in the codebase.

**When to use:** For stateless business logic that doesn't need instantiation (matches progressionService, scoreService patterns).

**Example:**
```typescript
// Source: backend/src/services/progressionService.ts
export function calculateProgression(
  correctAnswers: number,
  totalQuestions: number
): { xpEarned: number; gemsEarned: number } {
  const xpEarned = 50 + correctAnswers;
  const gemsEarned = 10 + correctAnswers;
  return { xpEarned, gemsEarned };
}

export async function updateUserProgression(
  userId: number,
  score: number,
  correctAnswers: number,
  totalQuestions: number
): Promise<{ xpEarned: number; gemsEarned: number }> {
  const { xpEarned, gemsEarned } = calculateProgression(correctAnswers, totalQuestions);
  await User.updateStats(userId, xpEarned, gemsEarned, score, correctAnswers, totalQuestions);
  return { xpEarned, gemsEarned };
}
```

**Apply to QuestionService:** Export `selectQuestionsForGame()` as async function, not as method on a class instance.

### Pattern 2: Drizzle Query with Joins and Filtering

**What:** Use Drizzle's SQL-like query builder with type-safe joins and filter operators.

**When to use:** Querying across related tables (questions + collections + topics).

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/joins + https://orm.drizzle.team/docs/select
import { eq, inArray, notInArray, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { questions, collectionQuestions, collections } from '../db/schema.js';

// Query questions for a collection, excluding recent questions
const result = await db.select({
  id: questions.id,
  externalId: questions.externalId,
  text: questions.text,
  options: questions.options,
  correctAnswer: questions.correctAnswer,
  explanation: questions.explanation,
  difficulty: questions.difficulty,
  topicId: questions.topicId,
  subcategory: questions.subcategory,
  source: questions.source,
  learningContent: questions.learningContent
})
  .from(questions)
  .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
  .where(
    and(
      eq(collectionQuestions.collectionId, targetCollectionId),
      notInArray(questions.id, recentQuestionIds) // Exclude recent questions
    )
  );
```

**Key operators:**
- `eq(column, value)` — equality check
- `inArray(column, [values])` — IN clause
- `notInArray(column, [values])` — NOT IN clause
- `and(...conditions)` — combine multiple WHERE conditions
- `or(...conditions)` — OR logic

### Pattern 3: Silent Fallback with Try-Catch

**What:** Wrap database queries in try-catch, fall back to JSON on error, log to console only.

**When to use:** Database operations that have a known fallback (matches Phase 9 Redis degradation pattern).

**Example:**
```typescript
// Source: backend/src/config/redis.ts (adapted pattern)
export async function selectQuestionsForGame(
  collectionId: number | null,
  recentQuestionIds: string[]
): Promise<Question[]> {
  try {
    // Attempt database query
    const dbQuestions = await queryQuestionsFromDatabase(collectionId, recentQuestionIds);
    return transformToQuestionFormat(dbQuestions);
  } catch (error) {
    // Silent fallback — console log only
    console.warn('⚠️  Database query failed, falling back to JSON:', error);
    return loadQuestionsFromJSON();
  }
}
```

**Important:** Do NOT throw errors to the route handler — always return a valid Question[] array (either from DB or JSON).

### Pattern 4: Data Transformation Layer

**What:** Transform database rows to match existing Question interface so downstream code needs zero changes.

**When to use:** When database schema differs from application interfaces (DB has topicId, app expects topic string).

**Example:**
```typescript
// Source: Inferred from backend/src/services/sessionService.ts Question interface
// Database row structure (from schema.ts)
interface DBQuestion {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topicId: number;
  subcategory: string | null;
  source: { name: string; url: string };
  learningContent: { paragraphs: string[]; corrections: Record<string, string> } | null;
}

// Transform to match existing Question interface
function transformToQuestionFormat(dbRows: DBQuestion[], topicMap: Map<number, string>): Question[] {
  return dbRows.map(row => ({
    id: row.externalId,           // Use external_id (e.g., "q001") not database id
    text: row.text,
    options: row.options,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
    difficulty: row.difficulty,
    topic: topicMap.get(row.topicId) || 'Unknown',  // Look up topic name by ID
    topicCategory: row.subcategory || '',
    learningContent: row.learningContent ? {
      topic: topicMap.get(row.topicId) || 'Unknown',
      paragraphs: row.learningContent.paragraphs,
      corrections: row.learningContent.corrections,
      source: row.source
    } : undefined
  }));
}
```

**Critical detail:** Use `externalId` as the question ID (matches existing "q001" format), not the database auto-increment `id`.

### Anti-Patterns to Avoid

- **Class-based services with state:** Existing codebase uses stateless module functions, not class instances. Don't introduce new pattern.
- **Exposing database errors to routes:** Always handle errors at service boundary, return fallback data instead of throwing.
- **Changing Question interface:** Downstream code (sessionService, game routes, frontend) expects exact current format. Transform DB data to match.
- **Using database ID as question identifier:** Use `externalId` (e.g., "q001") to match existing JSON format and maintain backward compatibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe database queries | String interpolation or template literals | Drizzle ORM with schema imports | Prevents SQL injection, provides type inference, catches errors at compile time |
| Random selection from large tables | Fisher-Yates shuffle on full result set | PostgreSQL ORDER BY RANDOM() LIMIT | Database-level random selection is optimized, avoids loading entire table into memory |
| Connection pooling | Custom connection management | Existing pg Pool from config/database.ts | Already configured with SSL, reconnection, and search_path — reuse via Drizzle wrapper |
| Difficulty distribution algorithm | Complex weighted random sampling | Simple filtering + ORDER BY RANDOM() | For 120-200 questions, simple approach is fast enough and easier to maintain |

**Key insight:** Drizzle ORM provides type safety without the "ORM tax" — generated SQL is predictable and performant. The project already has Drizzle configured (Phase 13), so leverage it instead of writing raw SQL strings.

## Common Pitfalls

### Pitfall 1: Using TABLESAMPLE for Small Collections

**What goes wrong:** TABLESAMPLE SYSTEM is 1000x faster than ORDER BY RANDOM() but returns approximate counts and may include duplicates across multiple samplings.

**Why it happens:** Developers optimize prematurely after reading PostgreSQL performance guides.

**How to avoid:** Use ORDER BY RANDOM() LIMIT for collections under 1,000 questions. TABLESAMPLE is for big data (millions of rows), not needed for 120-200 question collections.

**Warning signs:** Query returns 8 questions when you asked for 10, or same question appears in multiple games at higher frequency than expected.

**Source:** https://render.com/blog/postgresql-random-samples-big-tables - "TABLESAMPLE SYSTEM selects random heap blocks... returns approximately your target sample size"

### Pitfall 2: Forgetting to Transform Database IDs

**What goes wrong:** Database auto-increment IDs (1, 2, 3) are returned instead of externalId ("q001", "q002"), breaking frontend and session logic that expects "q001" format.

**Why it happens:** Selecting `questions.id` instead of `questions.externalId` in queries.

**How to avoid:** Always select `externalId` and alias it as `id` in transformation layer. Verify returned questions have `id: "q001"` format, not `id: 1`.

**Warning signs:** Frontend question display breaks, session answer submission fails with "Question not found", or frontend tries to submit answerId as a number.

### Pitfall 3: Difficulty Distribution with Insufficient Questions

**What goes wrong:** Collection has only 15 questions but algorithm tries to enforce "1 easy + 1 hard + 8 mixed" distribution, resulting in errors or question repeats.

**Why it happens:** Hard-coded distribution constraints without checking available questions per difficulty level.

**How to avoid:** Implement graceful degradation: If constraints can't be met (too few questions in a difficulty level), relax ordering rules and fill with available questions. User decision from CONTEXT.md: "drop difficulty ordering rules and fill with whatever's available rather than allowing repeats."

**Warning signs:** Query returns fewer than 10 questions, same question appears multiple times in one game, or service throws "Not enough questions" error.

### Pitfall 4: Silent Fallback Without Logging

**What goes wrong:** Database queries fail silently, app falls back to JSON, but no one notices until data drift becomes significant (new questions in DB never appear in games).

**Why it happens:** Fallback pattern implemented but logging omitted or sent to wrong stream.

**How to avoid:** Always log fallback events with clear indicators (⚠️ emoji, "FALLBACK" keyword) so ops can set up alerts. Use console.warn() not console.log() to distinguish from normal operations.

**Warning signs:** Database has 150 questions but games always show same 120 questions, new collection launches but questions don't appear.

### Pitfall 5: Not Awaiting Database Connection at Startup

**What goes wrong:** First game request after server start fails because database connection not established yet.

**Why it happens:** Drizzle lazy-loads connection on first query, server starts "successfully" even if DATABASE_URL is invalid.

**How to avoid:** Test database connection during server startup with a simple health check query (SELECT 1). Phase 13 already has Pool connection testing in config/database.ts — verify it's working.

**Warning signs:** First API request after deployment always fails, subsequent requests succeed.

## Code Examples

Verified patterns from official sources:

### Basic Drizzle Query with Filtering
```typescript
// Source: https://orm.drizzle.team/docs/select
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { questions, collectionQuestions } from '../db/schema.js';

const result = await db.select()
  .from(questions)
  .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
  .where(eq(collectionQuestions.collectionId, 1));
```

### Excluding Recent Questions with notInArray
```typescript
// Source: https://orm.drizzle.team/docs/operators
import { eq, notInArray, and } from 'drizzle-orm';

const excludedExternalIds = ['q001', 'q005', 'q010']; // Recent questions
const available = await db.select()
  .from(questions)
  .where(
    and(
      eq(questions.topicId, targetTopicId),
      notInArray(questions.externalId, excludedExternalIds)
    )
  );
```

### Filtering by Difficulty and Random Selection
```typescript
// Source: https://orm.drizzle.team/docs/select + PostgreSQL RANDOM()
import { eq, sql } from 'drizzle-orm';

// Select 1 easy question randomly
const easyQuestions = await db.select()
  .from(questions)
  .where(eq(questions.difficulty, 'easy'))
  .orderBy(sql`RANDOM()`)
  .limit(1);
```

### Graceful Fallback Pattern
```typescript
// Source: Adapted from backend/src/config/redis.ts SessionStorageFactory pattern
async function getQuestionsWithFallback(collectionId: number): Promise<Question[]> {
  try {
    const dbQuestions = await db.select().from(questions).where(eq(questions.collectionId, collectionId));
    if (dbQuestions.length === 0) {
      throw new Error('No questions found in database');
    }
    return transformQuestions(dbQuestions);
  } catch (error) {
    console.warn('⚠️  Database query failed, using JSON fallback:', error);
    return loadFromJSON();
  }
}
```

### Collection Metadata Lookup
```typescript
// Source: https://orm.drizzle.team/docs/select
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { collections } from '../db/schema.js';

async function getCollectionMetadata(collectionId: number) {
  const result = await db.select({
    id: collections.id,
    name: collections.name,
    slug: collections.slug
  })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  return result[0] || null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma ORM | Drizzle ORM | 2024-2025 | Drizzle surged in popularity for TypeScript-first approach with less abstraction |
| Serial columns | Identity columns | PostgreSQL 10+ | Identity columns preferred for auto-increment (Phase 13 schema uses serial for compatibility) |
| ORDER BY RANDOM() always | TABLESAMPLE for big data | PostgreSQL 9.5+ | TABLESAMPLE 1000x faster but only needed for millions of rows |
| Class-based services | Function modules | 2023-2026 | Functional patterns reduce boilerplate, avoid "this" binding issues |

**Deprecated/outdated:**
- **Sequelize ORM:** Heavy abstraction, poor TypeScript support — Drizzle is modern alternative
- **TypeORM:** Similar to Sequelize issues, decorator-heavy — Drizzle preferred in 2026
- **Knex.js query builder:** Still viable but Drizzle provides better type inference

## Open Questions

Things that couldn't be fully resolved:

1. **How many games back should "recent questions" track?**
   - What we know: User decision is "last 2-3 games (~20-30 questions)"
   - What's unclear: Where to store this history — in-memory per user? Redis? Database table?
   - Recommendation: Start with in-memory Map<userId, string[]> that stores last 30 question IDs per user. This is simplest and matches sessionService's in-memory pattern. Can migrate to Redis/DB in future phase if needed.

2. **Should learning content be served from database or JSON?**
   - What we know: Phase 13 migrated learningContent to database JSONB column (33 questions have it)
   - What's unclear: User marked this as "Claude's Discretion" in CONTEXT.md
   - Recommendation: Serve from database — it's already there and avoids maintaining two data sources. Transformation layer handles the slight structure difference.

3. **What if Federal collection has 0 questions in database?**
   - What we know: Seed script should populate 120 questions, but could be deleted or DB could be empty
   - What's unclear: Should service throw error or fall back to JSON?
   - Recommendation: Fall back to JSON silently. Consistent with "if database unreachable, use JSON" pattern. Log warning so ops can investigate.

4. **Should collectionId flow as body field, route param, or query param?**
   - What we know: User marked this as "Claude's Discretion"
   - What's unclear: POST /session currently accepts { questionIds } in body, could add collectionId there
   - Recommendation: Add collectionId as optional body field in POST /session request. Matches existing pattern where body contains game session config. Query param would work too but body is more RESTful for creating resources.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM official docs — https://orm.drizzle.team/docs/get-started-postgresql, https://orm.drizzle.team/docs/select, https://orm.drizzle.team/docs/joins, https://orm.drizzle.team/docs/operators
- PostgreSQL official documentation — https://www.postgresql.org/docs/current/sql-select.html
- Project codebase (Phase 13 schema, existing services, Redis fallback pattern)

### Secondary (MEDIUM confidence)
- [How to Use Drizzle ORM with Node.js](https://oneuptime.com/blog/post/2026-02-03-nodejs-drizzle-orm/view) — 2026 best practices overview
- [Efficient Random Row Selection in PostgreSQL](https://jetrockets.com/blog/how-to-quickly-get-a-random-set-of-rows-from-a-postgres-table) — TABLESAMPLE vs ORDER BY RANDOM() comparison
- [How to take random samples from big PostgreSQL tables](https://render.com/blog/postgresql-random-samples-big-tables) — Performance benchmarks for random selection
- [Node.js Backend Best Practices Guide 2026](https://thedecipherist.com/articles/nodejs-backend-best-practices/) — Service architecture and error handling patterns
- [Graceful Degradation in Distributed Systems](https://www.geeksforgeeks.org/system-design/graceful-degradation-in-distributed-systems/) — Fallback pattern principles
- [PostgreSQL JSONB query performance](https://www.metisdata.io/blog/how-to-avoid-performance-bottlenecks-when-using-jsonb-in-postgresql) — JSONB filtering optimization

### Tertiary (LOW confidence)
- [Balanced difficulty task finder](https://pmc.ncbi.nlm.nih.gov/articles/PMC7501397/) — Academic research on adaptive difficulty, not directly applicable to fixed 10-question games

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and configured in Phase 13
- Architecture: HIGH - Existing codebase provides clear patterns to follow (service modules, Redis fallback)
- Pitfalls: HIGH - Verified with official docs and real-world PostgreSQL performance articles
- Question selection algorithm: MEDIUM - Simple approach (ORDER BY RANDOM()) is proven but balanced difficulty distribution needs implementation validation

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days — stable stack, Drizzle ORM mature)

**Key risks:**
- MEDIUM: Balanced difficulty distribution with constraint relaxation needs careful testing (edge case: small collections)
- LOW: Database fallback pattern — proven approach from Phase 9, well-understood
- LOW: Drizzle ORM query patterns — stable API, excellent documentation
