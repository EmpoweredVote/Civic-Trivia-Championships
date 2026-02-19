# Phase 16: Expiration System - Research

**Researched:** 2026-02-18
**Domain:** Scheduled Tasks, Database Time-based Filtering, Health Monitoring
**Confidence:** HIGH

## Summary

This phase implements time-sensitive question expiration with three main components: (1) scheduled expiration sweeps, (2) health monitoring endpoints, and (3) admin review tooling. The existing codebase already has the foundation in place: the `expires_at` field exists on questions, the query layer excludes expired questions from new games, and session isolation prevents mid-game disruption.

The research confirms that Node.js cron scheduling for hourly tasks is straightforward with node-cron, a lightweight library that handles basic scheduling needs. For production robustness, structured logging (console.log with JSON format is sufficient for this scale) combined with database status fields provides dual surfacing for expired questions. The existing Express auth middleware pattern extends naturally to admin-only routes.

The key architectural decisions are already locked in from CONTEXT.md: 30-day expiring-soon threshold, no grace period, immediate reactivation on renewal, collection health tiers, and dual surfacing via logs and database state. The remaining discretion areas (health endpoint access level, cron error handling, audit trail storage) have clear patterns from the existing codebase and industry best practices.

**Primary recommendation:** Use node-cron for hourly sweeps with try-catch error handling and console.log JSON output. Extend existing auth middleware for admin routes. Store audit history as JSONB field on questions table (avoids separate table complexity). Health endpoint can be public (follows existing /health pattern).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.0.0 | Cron job scheduler | Lightweight, pure JavaScript, 222k packages depend on it, supports standard cron syntax |
| drizzle-orm | ^0.45.1 | Database ORM (already in use) | Already used in project, supports timestamp filtering with lt/lte/gt/gte operators |
| express | ^4.18.2 | Web framework (already in use) | Already used, existing auth middleware extends to admin routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | N/A | No additional libraries needed | Existing stack sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | node-schedule | More flexible scheduling (Date objects), but heavier and unnecessary for simple hourly cron |
| node-cron | Bree or BullMQ | Built-in retry/persistence, but overkill for non-critical hourly sweep |
| Separate audit table | JSONB field on questions | Separate table adds complexity; JSONB sufficient for audit trail use case |

**Installation:**
```bash
cd backend
npm install --save node-cron
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── cron/
│   ├── expirationSweep.ts    # Main sweep logic
│   └── startCron.ts           # Cron scheduler initialization
├── services/
│   └── questionService.ts     # Already filters expired questions
├── routes/
│   ├── health.ts              # Extend for collection health endpoint
│   └── admin.ts               # NEW: Admin-only routes for expired question management
└── server.ts                  # Register cron startup
```

### Pattern 1: Hourly Cron Sweep with Error Handling

**What:** Cron job that runs at the top of every hour, queries expired questions, logs findings, and updates database status.

**When to use:** For scheduled background tasks that don't need persistence across restarts.

**Example:**
```typescript
// Source: node-cron GitHub README + production best practices
import cron from 'node-cron';
import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { lte, and, isNotNull } from 'drizzle-orm';

export function startExpirationCron() {
  // Run at minute 0 of every hour: '0 * * * *'
  cron.schedule('0 * * * *', async () => {
    const startTime = Date.now();

    try {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Expiration sweep starting',
        timestamp: new Date().toISOString(),
        job: 'expiration-sweep'
      }));

      const now = new Date();

      // Find newly expired questions
      const expired = await db
        .select()
        .from(questions)
        .where(and(
          lte(questions.expiresAt, now),
          isNotNull(questions.expiresAt)
        ));

      // Log findings with structured output
      for (const q of expired) {
        console.log(JSON.stringify({
          level: 'warn',
          message: 'Question expired',
          timestamp: new Date().toISOString(),
          job: 'expiration-sweep',
          questionId: q.externalId,
          expiresAt: q.expiresAt,
          topic: q.topicId
        }));
      }

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        level: 'info',
        message: 'Expiration sweep completed',
        timestamp: new Date().toISOString(),
        job: 'expiration-sweep',
        expiredCount: expired.length,
        durationMs: duration
      }));

    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Expiration sweep failed',
        timestamp: new Date().toISOString(),
        job: 'expiration-sweep',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  });

  console.log('Expiration cron job registered (runs hourly at :00)');
}
```

### Pattern 2: Collection Health Computation

**What:** Aggregation query that counts questions by status (active, expiring-soon, expired, archived) per collection and computes health tier.

**When to use:** For health endpoints that report system state.

**Example:**
```typescript
// Source: Drizzle ORM operators docs + project patterns
import { db } from '../db/index.js';
import { collections, questions, collectionQuestions } from '../db/schema.js';
import { lte, gt, and, isNotNull, isNull, or, sql } from 'drizzle-orm';

export async function computeCollectionHealth() {
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  const healthData = await db
    .select({
      collectionId: collections.id,
      collectionName: collections.name,
      collectionSlug: collections.slug,
      activeCount: sql<number>`COUNT(*) FILTER (WHERE
        (${questions.expiresAt} IS NULL OR ${questions.expiresAt} > ${soonThreshold})
      )`,
      expiringSoonCount: sql<number>`COUNT(*) FILTER (WHERE
        ${questions.expiresAt} > ${now} AND ${questions.expiresAt} <= ${soonThreshold}
      )`,
      expiredCount: sql<number>`COUNT(*) FILTER (WHERE
        ${questions.expiresAt} <= ${now}
      )`
    })
    .from(collections)
    .innerJoin(collectionQuestions, eq(collections.id, collectionQuestions.collectionId))
    .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
    .groupBy(collections.id, collections.name, collections.slug);

  return healthData.map(h => {
    const playableCount = h.activeCount;
    const tier = playableCount < 10 ? 'Critical'
               : playableCount < 20 ? 'At Risk'
               : 'Healthy';

    return {
      ...h,
      tier,
      isPlayable: playableCount >= 10
    };
  });
}
```

### Pattern 3: Admin Middleware Reuse

**What:** Extend existing `authenticateToken` middleware for admin-only routes.

**When to use:** Admin pages that require authentication.

**Example:**
```typescript
// Source: Existing backend/src/middleware/auth.ts pattern
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All /admin/* routes require authentication
router.use(authenticateToken);

// Admin route handlers
router.get('/expired-questions', async (req, res) => {
  // User is guaranteed to exist (req.user set by authenticateToken)
  // Implementation: query expired questions, return JSON
});

export { router };
```

### Pattern 4: Session Isolation (Already Implemented)

**What:** Game sessions snapshot question IDs at creation time, so mid-game expirations don't affect active games.

**When to use:** This is already implemented in `sessionService.ts`.

**Evidence:**
```typescript
// Source: backend/src/services/sessionService.ts lines 111-141
// Questions are stored in the session at creation:
const session: GameSession = {
  sessionId,
  userId,
  questions, // <- Snapshot of questions at game start
  answers: [],
  // ...
};
await this.storage.set(sessionId, session, 3600);
```

This means expired questions continue to work for in-progress games because the session holds the full question data, not just IDs.

### Anti-Patterns to Avoid

- **Hand-rolling retry logic for cron jobs:** Node-cron doesn't support retries. For this use case (hourly sweep), retries are unnecessary—next sweep runs in 1 hour anyway. If a sweep fails, log the error and wait for the next run.

- **Separate audit trail table:** Adds schema complexity, join overhead, and migration burden. For expiration/renewal history, a JSONB field on the questions table is simpler and sufficient.

- **Blocking queries in cron handler:** Cron runs on the main thread. Keep sweep queries fast with indexed fields. The existing `idx_questions_expires_at` index (lines 81-83 in schema.ts) already supports this.

- **Graying out blocked collections in UI:** CONTEXT.md specifies "hidden entirely from picker (not grayed out)." Don't return blocked collections in picker queries at all.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression parsing | Custom timer with setInterval math | node-cron library | Cron syntax is deceptively complex (leap years, DST, month boundaries); node-cron handles it correctly |
| Timestamp comparison in queries | String manipulation or Date arithmetic | Drizzle ORM's `lte`, `gte`, `gt`, `lt` operators | Handles timezone conversions, precision mismatches, and SQL parameterization automatically |
| Admin authentication | Custom token parsing | Existing `authenticateToken` middleware | Already handles JWT verification, blacklist checking, expiry—don't duplicate |
| Health tier computation | Frontend logic | Backend aggregation queries | Health status is system state, not UI concern; compute once on server, cache if needed |

**Key insight:** Scheduled tasks in Node.js are simple for basic cron patterns but become complex with persistence/retries. This phase doesn't need those features—hourly sweep with error logging is sufficient.

## Common Pitfalls

### Pitfall 1: Cron Jobs Lost on App Restart

**What goes wrong:** Node-cron doesn't persist scheduled jobs. If the app restarts, cron schedules are re-registered, but any in-progress or failed sweep is lost.

**Why it happens:** Node-cron is in-process, not a system-level cron daemon.

**How to avoid:** For this use case, it's acceptable. Hourly sweeps mean max 59-minute delay if restart happens. If restart frequency is high, consider system-level cron (crontab) or a queue-based solution like BullMQ.

**Warning signs:** If logs show gaps longer than 1 hour between sweeps, investigate app restart frequency.

### Pitfall 2: Timezone Confusion with Timestamps

**What goes wrong:** Database stores UTC, JavaScript Date objects may render in local timezone, causing off-by-hours bugs in expiration logic.

**Why it happens:** PostgreSQL `timestamp with time zone` stores UTC but can display in session timezone. Drizzle ORM uses JavaScript Date objects which have timezone behavior.

**How to avoid:** Always compare Date objects directly (no string parsing). Drizzle ORM handles conversion. When logging, use `.toISOString()` to force UTC output.

**Warning signs:** Questions expiring at wrong times (off by 5-8 hours suggests timezone shift).

### Pitfall 3: Index Not Used for Expiration Queries

**What goes wrong:** Query performance degrades as question count grows, even though `idx_questions_expires_at` exists.

**Why it happens:** PostgreSQL may not use the index if the query also filters on other columns without a composite index, or if the index doesn't match the query pattern.

**How to avoid:** The existing index (lines 81-83 in schema.ts) uses a partial index (`WHERE expires_at IS NOT NULL`). Queries must use `lte(questions.expiresAt, now)` with `isNotNull(questions.expiresAt)` to match the index.

**Warning signs:** `EXPLAIN ANALYZE` shows Seq Scan instead of Index Scan on questions table.

### Pitfall 4: Expiring-Soon Calculation Errors

**What goes wrong:** Questions flagged as "expiring soon" when they're actually expired, or not flagged when they should be.

**Why it happens:** Boundary conditions: `expires_at <= now` is expired, `now < expires_at <= now+30days` is expiring-soon, `expires_at > now+30days` is active.

**How to avoid:** Use explicit date arithmetic with clear variable names: `soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)`. Test boundary cases in unit tests.

**Warning signs:** Admin page shows zero expiring-soon questions when some should exist, or shows expired questions as expiring-soon.

### Pitfall 5: Cron Handler Blocking the Event Loop

**What goes wrong:** Long-running expiration sweep blocks other HTTP requests, causing timeouts.

**Why it happens:** Node-cron runs scheduled functions on the main event loop. Heavy database queries or synchronous operations block.

**How to avoid:** Keep sweep queries fast (indexed), use async/await properly, log warnings if sweep takes >5 seconds. The hourly frequency and expected small result set (few expired per hour) make this low-risk for this phase.

**Warning signs:** HTTP request latency spikes correlate with cron execution times (top of every hour).

## Code Examples

Verified patterns from official sources:

### Expiration Query with Drizzle ORM

```typescript
// Source: Existing backend/src/services/questionService.ts lines 289-299
// Shows correct pattern for excluding expired questions
const now = new Date();
const baseConditions = and(
  eq(collectionQuestions.collectionId, targetCollectionId),
  or(
    isNull(questions.expiresAt),          // Never expires
    gt(questions.expiresAt, now)          // Expires in future
  )
);

const dbRows = await db
  .select({ /* ... */ })
  .from(questions)
  .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
  .where(baseConditions);
```

### Structured Console Logging

```typescript
// Source: Node.js logging best practices (BetterStack 2026)
// JSON format for log aggregation tools
console.log(JSON.stringify({
  level: 'info',
  message: 'Human-readable message',
  timestamp: new Date().toISOString(),
  context: {
    key: 'value',
    // Additional structured data
  }
}));
```

### Node-Cron Registration in Server Startup

```typescript
// Source: node-cron GitHub + existing server.ts pattern
// In server.ts after storage initialization:
import { startExpirationCron } from './cron/startCron.js';

async function startServer() {
  await storageFactory.initialize();
  initializeSessionManager(storageFactory.getStorage());

  // Start cron jobs
  startExpirationCron();

  // Register middleware and routes...
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate audit table with history rows | JSONB audit field on main table | ~2020+ | Reduces joins, simpler schema, JSON queryability improved with jsonb_path_ops |
| Winston for structured logging | Pino for high-performance JSON logs | 2022-2024 | 5x faster, but for this phase console.log is sufficient (no heavy logging volume) |
| System cron (crontab) for Node.js tasks | In-process node-cron | 2018+ | Easier deployment (no system-level config), but no persistence across restarts |
| Separate health check services | Embedded health endpoints in app | 2020+ | Simpler deployment, health reflects actual app state |

**Deprecated/outdated:**
- **Agenda (MongoDB-based job queue):** Overkill for simple cron patterns; node-cron sufficient for hourly sweeps
- **String-based timestamp comparisons:** Modern ORMs (Drizzle) handle Date objects properly with parameterized queries
- **Manual JWT parsing in routes:** Express middleware pattern now standard

## Open Questions

Things that couldn't be fully resolved:

1. **Audit Trail Retention Policy**
   - What we know: CONTEXT.md specifies "tracks expiration/renewal history as an audit trail"
   - What's unclear: How long to retain audit history? Prune old entries?
   - Recommendation: Start with unbounded retention (JSONB field grows with each renewal), revisit if storage becomes an issue. Typical questions don't renew frequently enough to cause problems.

2. **Health Endpoint Caching**
   - What we know: Aggregation query counts questions per collection, computes tiers
   - What's unclear: Should results be cached? How long?
   - Recommendation: No caching initially. Query is fast (indexed join), and health state changes infrequently (hourly at most). Add caching if response time exceeds 100ms.

3. **Cron Error Notification**
   - What we know: Console.log JSON output for structured logging
   - What's unclear: Should failed sweeps trigger alerts (email, Slack, etc.)?
   - Recommendation: Start with log-only (monitoring tool can alert on ERROR logs). This phase doesn't include alerting infrastructure, so defer to operations team.

4. **Admin Page Access Control (Resolved)**
   - What we know: CONTEXT.md specifies "auth-required (logged-in users only)"
   - Decision: Use existing `authenticateToken` middleware. All logged-in users can access admin page initially. If role-based restrictions needed later, add a role check in the handler.

## Sources

### Primary (HIGH confidence)
- [node-cron GitHub](https://github.com/node-cron/node-cron) - v4.0.0 installation, cron syntax, basic usage
- Existing codebase (backend/src/db/schema.ts, backend/src/services/questionService.ts, backend/src/middleware/auth.ts) - Current patterns
- Drizzle ORM documentation (via search results) - Timestamp filtering operators

### Secondary (MEDIUM confidence)
- [BetterStack: Job Scheduling in Node.js with Node-cron](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) - Production patterns
- [LogRocket: Comparing the best Node.js schedulers](https://blog.logrocket.com/comparing-best-node-js-schedulers/) - node-cron vs alternatives
- [BetterStack: 11 Best Practices for Logging in Node.js](https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/) - Structured logging patterns
- [Medium: 4 Common Designs of Audit Trail](https://medium.com/techtofreedom/4-common-designs-of-audit-trail-tracking-data-changes-in-databases-c894b7bb6d18) - Audit table vs embedded approaches
- [MinervaDB: How NULL Values in PostgreSQL Affect Query Performance](https://minervadb.xyz/how-null-values-in-postgresql-affect-performance/) - Index performance with nullable timestamps

### Tertiary (LOW confidence)
- WebSearch results for cron error handling patterns (2026) - Manual retry logic required for node-cron
- WebSearch results for Pino vs Winston (2026) - Pino faster but not needed for this phase scale

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node-cron is industry standard, already have Express/Drizzle
- Architecture: HIGH - Patterns match existing codebase, verified against production best practices
- Pitfalls: MEDIUM - Identified from community sources and existing code inspection, but timezone/index issues require testing

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days - stable domain)
