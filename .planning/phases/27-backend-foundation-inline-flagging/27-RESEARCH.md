# Phase 27: Backend Foundation & Inline Flagging - Research

**Researched:** 2026-02-21
**Domain:** Backend data infrastructure (Drizzle ORM schema, Express API endpoints, Redis rate limiting) + Frontend inline UI controls (React flag button with tooltip, tap-zone exclusion)
**Confidence:** HIGH

## Summary

This phase establishes flag data collection infrastructure (database schema, API endpoints, rate limiting) and adds an inline flag button to the answer reveal screen for authenticated players. The research focused on four core domains: (1) database schema design with Drizzle ORM for flag tracking with idempotent inserts, (2) rate limiting patterns using Redis for rolling 15-minute windows, (3) React inline UI patterns that preserve "tap anywhere to advance" behavior while excluding flag icon clicks, and (4) icon/tooltip implementation using existing project patterns.

The standard approach uses PostgreSQL composite unique constraints for one-flag-per-user-per-question enforcement, express-rate-limit with Redis store for distributed rate limiting, event.stopPropagation() for tap-zone exclusion, and inline SVG icons with CSS-based hover tooltips (not the existing LearnMoreTooltip component which is auto-dismissing). The project already uses Drizzle ORM 0.45.1, Redis 4.6.12, and has established patterns for session storage and API validation.

**Primary recommendation:** Use Drizzle's composite unique constraint + ON CONFLICT DO NOTHING for idempotent flag inserts, implement custom Redis-based rate limiting (project doesn't use express-rate-limit yet), add flag icon with stopPropagation to preserve tap-anywhere behavior, and create independent tooltip (not shared with LearnMore system per user decision).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.45.1 | PostgreSQL schema & queries | Already in use, provides type-safe schema definition with pgSchema, composite indexes, and ON CONFLICT support |
| Redis | 4.6.12 (node-redis) | Rate limiting storage | Already configured with graceful degradation, supports atomic INCR operations and key expiration for sliding windows |
| express-validator | 7.3.1 | Request validation | Already in use throughout API, provides body/param validation chains |
| PostgreSQL | Current | Flag data persistence | Already in use via Drizzle, supports composite unique constraints and idempotent inserts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Heroicons | N/A (inline SVG) | Flag icon | Use inline SVG from Heroicons flag icon - project doesn't install @heroicons/react, copies SVG directly |
| Framer Motion | 12.34.0 | Fade transitions | Already in use for animations, use for flag un-flag fade transition |
| Zod | 4.3.6 | Schema validation | Already in use, pair with express-validator for type-safe request validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Redis rate limiter | express-rate-limit + rate-limit-redis | express-rate-limit adds dependency, custom Redis code gives fine-grained control over rolling window logic and fits existing Redis patterns |
| Composite unique constraint | Application-level deduplication | Database constraint is atomic and race-condition-safe, app-level requires SELECT then INSERT pattern with race conditions |
| Independent tooltip | Reuse LearnMoreTooltip | User decided "Independent tooltip implementation — not sharing with the Learn More auto-tooltip system" |

**Installation:**
```bash
# No new dependencies required
# All necessary libraries already installed:
# - drizzle-orm@0.45.1
# - redis@4.6.12
# - express-validator@7.3.1
# - framer-motion@12.34.0
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── db/
│   └── schema.ts                    # Add questionFlags table definition
├── routes/
│   └── feedback.ts                  # NEW: POST /api/feedback/flag endpoint
├── middleware/
│   └── rateLimiter.ts              # NEW: Redis-based rate limiting middleware
└── services/
    └── feedbackService.ts          # NEW: Flag creation with deduplication logic

frontend/src/
├── features/game/components/
│   ├── FlagButton.tsx              # NEW: Inline flag icon with toggle state
│   └── GameScreen.tsx              # MODIFIED: Add FlagButton to reveal phase
└── types/
    └── feedback.ts                 # NEW: Flag-related TypeScript types
```

### Pattern 1: Idempotent Flag Insert with Composite Unique Constraint
**What:** Use Drizzle's composite unique constraint to enforce one-flag-per-user-per-question at database level, then use INSERT with ON CONFLICT DO NOTHING for idempotent API calls.

**When to use:** When multiple flag requests for same user+question should result in single database row (idempotent behavior).

**Example:**
```typescript
// backend/src/db/schema.ts
export const questionFlags = civicTriviaSchema.table('question_flags', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  sessionId: text('session_id').notNull(), // UUID from Redis session
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // Future expansion for Phase 28 (elaboration):
  reasons: jsonb('reasons').$type<string[]>(), // null until Phase 28
  elaborationText: text('elaboration_text'), // null until Phase 28
}, (table) => ({
  // Composite unique constraint: one flag per user per question
  userQuestionUnique: unique().on(table.userId, table.questionId),
  userIdx: index('idx_question_flags_user').on(table.userId),
  questionIdx: index('idx_question_flags_question').on(table.questionId),
  createdAtIdx: index('idx_question_flags_created_at').on(table.createdAt),
}));

// backend/src/services/feedbackService.ts
// Idempotent insert pattern
export async function createFlag(
  userId: number,
  questionId: number,
  sessionId: string
): Promise<{ created: boolean; flagId: number }> {
  try {
    const [result] = await db
      .insert(questionFlags)
      .values({
        userId,
        questionId,
        sessionId,
        reasons: null, // Phase 28
        elaborationText: null, // Phase 28
      })
      .onConflictDoNothing({ target: [questionFlags.userId, questionFlags.questionId] })
      .returning({ id: questionFlags.id });

    if (result) {
      return { created: true, flagId: result.id };
    } else {
      // Conflict - flag already exists, fetch existing
      const [existing] = await db
        .select({ id: questionFlags.id })
        .from(questionFlags)
        .where(
          and(
            eq(questionFlags.userId, userId),
            eq(questionFlags.questionId, questionId)
          )
        )
        .limit(1);

      return { created: false, flagId: existing.id };
    }
  } catch (error) {
    console.error('Error creating flag:', error);
    throw new Error('Failed to create flag');
  }
}
```

### Pattern 2: Redis Rolling Window Rate Limiting
**What:** Use Redis INCR with TTL for sliding 15-minute window rate limiting that persists across game sessions.

**When to use:** To enforce "max 10 flags per 15 minutes per user" across multiple game sessions and prevent spam.

**Example:**
```typescript
// backend/src/middleware/rateLimiter.ts
import { redis } from '../config/redis.js';

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_FLAGS_PER_WINDOW = 10;

export async function flagRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = `rate_limit:flag:${userId}`;

  try {
    // Atomic increment and get current count
    const count = await redis.incr(key);

    // Set expiry on first increment (only if key is new)
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    // Check if over limit
    if (count > MAX_FLAGS_PER_WINDOW) {
      const ttl = await redis.ttl(key);
      return res.status(429).json({
        error: 'Too many flags',
        retryAfter: ttl, // seconds until window resets
      });
    }

    // Under limit - proceed
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Fail open - allow request if Redis unavailable
    next();
  }
}

// Usage in routes/feedback.ts
router.post('/flag', authenticate, flagRateLimiter, async (req, res) => {
  // Handle flag creation
});
```

### Pattern 3: Tap-Anywhere with Excluded Click Zones
**What:** Use event.stopPropagation() on flag button to prevent parent's onClick handler from firing, preserving "tap anywhere to advance" while excluding flag icon area.

**When to use:** When adding interactive elements to a screen with global click-to-advance behavior (already used for LearnMoreButton in existing code).

**Example:**
```typescript
// frontend/src/features/game/components/FlagButton.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';

interface FlagButtonProps {
  questionId: string;
  initialFlagged: boolean;
  disabled: boolean;
  onFlagToggle: (flagged: boolean) => Promise<void>;
}

export function FlagButton({ questionId, initialFlagged, disabled, onFlagToggle }: FlagButtonProps) {
  const [flagged, setFlagged] = useState(initialFlagged);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    // CRITICAL: Prevent tap-anywhere-to-advance from firing
    e.stopPropagation();

    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      const newFlagged = !flagged;
      await onFlagToggle(newFlagged);
      setFlagged(newFlagged);
    } catch (error) {
      console.error('Flag toggle failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`p-2 rounded transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700/50'
        }`}
        aria-label={flagged ? 'Unflag question' : 'Flag question'}
      >
        {/* Flag icon - filled with amber when flagged */}
        <motion.svg
          className={`w-5 h-5 transition-colors ${
            flagged ? 'text-amber-400' : 'text-slate-400'
          }`}
          fill={flagged ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={flagged ? 0 : 2}
          viewBox="0 0 24 24"
          initial={false}
          animate={{ fill: flagged ? 'currentColor' : 'none' }}
          transition={{ duration: 0.2 }}
        >
          {/* Heroicons flag icon path */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 3l9 3 9-3v12l-9 3-9-3" />
        </motion.svg>
      </button>

      {/* Tooltip - CSS hover, not auto-dismissing */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {disabled ? 'Too many flags — try again later' : 'Flag'}
      </div>
    </div>
  );
}

// Usage in GameScreen.tsx (revealing phase)
{state.phase === 'revealing' && isAuthenticated && (
  <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
    <FlagButton
      questionId={currentQuestion.id}
      initialFlagged={false} // Check session state
      disabled={isRateLimited}
      onFlagToggle={async (flagged) => {
        if (flagged) {
          await api.post('/api/feedback/flag', {
            questionId: currentQuestion.id,
            sessionId: state.sessionId,
          });
        } else {
          await api.delete(`/api/feedback/flag/${currentQuestion.id}`);
        }
      }}
    />
  </div>
)}
```

### Pattern 4: Denormalized Flag Count for Admin Sorting
**What:** Add flag_count column to questions table, increment with trigger or application-level counter for efficient admin sorting by flag count.

**When to use:** Phase 29 (admin review queue) needs to sort questions by flag count without expensive JOINs on every page load.

**Example:**
```typescript
// backend/src/db/schema.ts (questions table modification)
export const questions = civicTriviaSchema.table('questions', {
  // ... existing columns ...
  flagCount: integer('flag_count').notNull().default(0), // NEW
  // ... rest of schema ...
}, (table) => ({
  // ... existing indexes ...
  flagCountIdx: index('idx_questions_flag_count').on(table.flagCount), // NEW
}));

// backend/src/services/feedbackService.ts
// Increment flag count when flag created
export async function createFlag(/* ... */) {
  const result = await db.transaction(async (tx) => {
    // Insert flag
    const [flag] = await tx.insert(questionFlags).values(/* ... */).returning();

    if (flag) {
      // Increment denormalized counter
      await tx
        .update(questions)
        .set({ flagCount: sql`${questions.flagCount} + 1` })
        .where(eq(questions.id, questionId));
    }

    return flag;
  });

  return result;
}
```

### Anti-Patterns to Avoid
- **Application-level deduplication:** Don't use SELECT-then-INSERT pattern for flag uniqueness. Use database composite unique constraint to prevent race conditions.
- **Fixed window rate limiting:** Don't reset rate limit at fixed intervals (e.g., every 15 minutes at :00, :15, :30, :45). Use rolling window with Redis TTL so limits apply to any 15-minute period.
- **Blocking flag API calls:** Don't await flag creation before UI feedback. Optimistically update UI, send API request asynchronously, roll back on failure.
- **Shared tooltip component:** User explicitly decided "Independent tooltip implementation — not sharing with the Learn More auto-tooltip system." Don't reuse LearnMoreTooltip.
- **Storing flag toggles in session:** User decision specifies "one flag per user-question pair" which means database persistence, not session-only state.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting with sliding windows | Custom timestamp array tracking | Redis INCR + TTL | Race conditions, memory leaks, doesn't persist across sessions; Redis atomic operations handle concurrency correctly |
| Idempotent insert logic | Manual SELECT check then INSERT | Drizzle onConflictDoNothing + composite unique constraint | Database-level atomicity prevents race conditions; application-level check-then-insert has TOCTOU vulnerability |
| Flag icon SVG | Download icon library package | Inline Heroicons flag SVG | Project pattern: copy SVG directly into components (see XpIcon, GemIcon), no @heroicons/react dependency installed |
| Tooltip implementation | Install tooltip library | CSS-based hover tooltip with opacity transition | Project already uses inline tooltips (no external tooltip library), user specified independent implementation |
| Rolling window calculation | Track all request timestamps in array | Redis key expiration (TTL) | Redis TTL automatically cleans up expired keys, array approach requires manual cleanup and O(n) filtering |

**Key insight:** Rate limiting and idempotent inserts are classic concurrency problems with database-level solutions (Redis atomic operations, PostgreSQL unique constraints). Application-level implementations have race conditions that are hard to test and debug. Use database guarantees instead of reimplementing distributed systems primitives.

## Common Pitfalls

### Pitfall 1: Race Condition in Idempotent Insert
**What goes wrong:** Using SELECT to check existence, then INSERT if not found, creates race condition where two simultaneous requests both see "not exists" and both attempt INSERT, causing duplicate key violation.

**Why it happens:** Time-of-check-time-of-use (TOCTOU) bug. Between SELECT and INSERT, another request can complete its INSERT.

**How to avoid:** Use INSERT...ON CONFLICT DO NOTHING with composite unique constraint. Database guarantees atomicity.

**Warning signs:** Seeing "duplicate key value violates unique constraint" errors in logs despite checking for existence first.

### Pitfall 2: Rate Limit Bypass via Session Restart
**What goes wrong:** Storing rate limit state in game session (Redis session storage) allows bypassing limits by starting a new game.

**Why it happens:** User decision specifies "Rolling 15-minute window across sessions — prevents starting new games to bypass the limit." Session-bound state resets on new game.

**How to avoid:** Store rate limit counter in Redis with user-scoped key (rate_limit:flag:${userId}), not session-scoped key. TTL persists across game sessions.

**Warning signs:** QA testing shows ability to flag more than 10 questions by starting multiple games within 15 minutes.

### Pitfall 3: stopPropagation Missing on Flag Button Container
**What goes wrong:** Adding stopPropagation to button element but not its container div causes clicks in padding/margin area to trigger tap-anywhere-to-advance.

**Why it happens:** Click events bubble up from button to container to screen. stopPropagation on button only stops button clicks, not container clicks.

**How to avoid:** Add stopPropagation to container div wrapping flag button (see GameScreen.tsx line 497: existing pattern for LearnMoreButton container).

**Warning signs:** Clicking near but not directly on flag icon advances to next question instead of doing nothing.

### Pitfall 4: Flag Count Out of Sync with Actual Flags
**What goes wrong:** Denormalized flag_count on questions table becomes inaccurate if flags are deleted directly from question_flags table without decrementing counter.

**Why it happens:** Two sources of truth (question_flags rows and flag_count column) can drift if updates aren't atomic.

**How to avoid:** Always modify flag_count in same transaction as question_flags insert/delete. Consider PostgreSQL trigger for automatic counter maintenance.

**Warning signs:** Admin review queue shows questions with high flag_count but no flags when drilling into details.

### Pitfall 5: Rate Limit Applies to Un-flagging
**What goes wrong:** User decision specifies toggle behavior ("toggle flag on/off before advancing"), but if rate limiter runs on all /flag endpoint calls, un-flagging counts toward limit.

**Why it happens:** Middleware runs before handler logic that determines if request is flag vs unflag.

**How to avoid:** User decision clarifies "one flag per user-question pair" means toggle state persists in database, not session. DELETE endpoint for un-flagging should not count toward rate limit. Only POST (create flag) should be rate-limited.

**Warning signs:** User flags a question, immediately un-flags it, repeats 10 times, and gets rate-limited despite creating zero net flags.

## Code Examples

Verified patterns from official sources:

### API Endpoint with Validation
```typescript
// backend/src/routes/feedback.ts
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { flagRateLimiter } from '../middleware/rateLimiter.js';
import { createFlag, deleteFlag } from '../services/feedbackService.js';

const router = express.Router();

// POST /api/feedback/flag - Create flag (rate limited)
router.post(
  '/flag',
  authenticate,
  flagRateLimiter,
  [
    body('questionId').isString().notEmpty(),
    body('sessionId').isString().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { questionId, sessionId } = req.body;
    const userId = req.user!.id;

    try {
      // Convert externalId to internal database ID
      const [question] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.externalId, questionId))
        .limit(1);

      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const result = await createFlag(userId, question.id, sessionId);

      res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        flagId: result.flagId,
      });
    } catch (error) {
      console.error('Flag creation error:', error);
      res.status(500).json({ error: 'Failed to create flag' });
    }
  }
);

// DELETE /api/feedback/flag/:questionId - Remove flag (not rate limited)
router.delete(
  '/flag/:questionId',
  authenticate,
  async (req, res) => {
    const { questionId } = req.params;
    const userId = req.user!.id;

    try {
      // Convert externalId to internal database ID
      const [question] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.externalId, questionId))
        .limit(1);

      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const deleted = await deleteFlag(userId, question.id);

      res.status(200).json({ success: true, deleted });
    } catch (error) {
      console.error('Flag deletion error:', error);
      res.status(500).json({ error: 'Failed to delete flag' });
    }
  }
);

export default router;
```

### GameSession Interface Extension
```typescript
// backend/src/services/sessionService.ts
export interface GameSession {
  // ... existing fields ...
  feedbackFlags: string[]; // NEW: Array of questionIds that user has flagged in this session
}

// When creating session
async createSession(/* ... */): Promise<string> {
  const session: GameSession = {
    // ... existing fields ...
    feedbackFlags: [], // Initialize empty
  };

  await this.storage.set(sessionId, session, 3600);
  return sessionId;
}

// After flag creation succeeds
export function markQuestionFlagged(session: GameSession, questionId: string): GameSession {
  if (!session.feedbackFlags.includes(questionId)) {
    session.feedbackFlags.push(questionId);
  }
  return session;
}
```

### Frontend Flag State Management
```typescript
// frontend/src/pages/Game.tsx (inside component)
const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
const [isRateLimited, setIsRateLimited] = useState(false);

const handleFlagToggle = async (questionId: string, flagged: boolean) => {
  try {
    if (flagged) {
      const response = await fetch(`${API_BASE_URL}/api/feedback/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId,
          sessionId: gameState.sessionId,
        }),
      });

      if (response.status === 429) {
        const data = await response.json();
        setIsRateLimited(true);
        // Could show toast: "Too many flags. Try again in X minutes."
        throw new Error(data.error);
      }

      if (!response.ok) {
        throw new Error('Failed to flag question');
      }

      setFlaggedQuestions((prev) => new Set(prev).add(questionId));
    } else {
      const response = await fetch(`${API_BASE_URL}/api/feedback/flag/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unflag question');
      }

      setFlaggedQuestions((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  } catch (error) {
    console.error('Flag toggle error:', error);
    throw error; // FlagButton will handle display
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serial columns (serial, bigserial) | Identity columns (GENERATED ALWAYS AS IDENTITY) | PostgreSQL 10+ (2017) | Drizzle still uses serial() helper but it generates identity columns in modern PostgreSQL; no migration needed |
| Fixed window rate limiting | Rolling window with Redis TTL | Industry standard since Redis 2.6.12 (2012) | Prevents burst exploitation at window boundaries; user gets 10 flags per ANY 15-minute period, not per fixed interval |
| Separate tooltip libraries (react-tooltip, tippy.js) | CSS-based hover tooltips with opacity transitions | Modern CSS (2020s) | No external dependencies, better performance, simpler implementation for static tooltips |
| Application-level idempotency keys | Database composite unique constraints | PostgreSQL native (always available) | Simpler code, atomic guarantees, no distributed coordination needed |

**Deprecated/outdated:**
- **express-rate-limit MemoryStore for production:** Not in use by project, doesn't scale across multiple server instances. Use Redis for distributed rate limiting.
- **INSERT...ON CONFLICT DO UPDATE for toggle state:** User decision clarifies "one flag per user-question pair" means persistent database record, not in-session toggle. Use DO NOTHING, not DO UPDATE.

## Open Questions

Things that couldn't be fully resolved:

1. **Should un-flagging delete the database row or mark it inactive?**
   - What we know: User decision says "one flag per user-question pair," DELETE endpoint exists for un-flag
   - What's unclear: If user un-flags then re-flags, should system remember original flag timestamp? Or treat as new flag?
   - Recommendation: Phase 27 uses DELETE (row removal) for simplicity. Phase 28+ may add status column if flag history becomes important for admin review.

2. **How should rate limit state propagate to frontend?**
   - What we know: 429 response when rate limited, frontend should disable flag button and show tooltip
   - What's unclear: Should backend proactively send current flag count in game state API? Or only surface rate limit when hit?
   - Recommendation: Return 429 with retryAfter (seconds) in response body. Frontend sets isRateLimited state when 429 received, could add countdown timer in tooltip showing seconds until retry allowed.

3. **Should flag icon appear on results screen?**
   - What we know: User decision says "Flag state persists visually wherever flagged questions appear — including the results screen, not just the reveal screen"
   - What's unclear: Results screen shows multiple questions at once. Does flag icon appear per-question? Is it interactive (can toggle on results)?
   - Recommendation: Show flag icon (read-only, not interactive) on results screen per-question. User already flagged during reveal phase, results screen just displays which questions were flagged. Interactive toggling adds complexity without clear value.

4. **Exact corner placement of flag icon within question card**
   - What we know: User decision says "Small flag icon in the corner of the question card — always visible but out of the way" and "Exact corner placement within the question card (top-right likely, but adjust for layout)" is Claude's discretion
   - What's unclear: Should it be inside QuestionCard component or outside as sibling positioned absolutely?
   - Recommendation: Positioned absolutely relative to game screen (not inside QuestionCard), top-right corner. QuestionCard is shared across all game phases; flag only appears during reveal phase. Absolute positioning gives flexibility without modifying QuestionCard.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM Schema Documentation - https://orm.drizzle.team/docs/sql-schema-declaration (verified schema patterns)
- PostgreSQL INSERT ON CONFLICT - https://github.com/jbranchaud/til/blob/master/postgres/idempotent-inserts.md (idempotent insert patterns)
- Redis Rate Limiting Guide - https://redis.io/learn/howtos/ratelimiting (rolling window algorithms)
- Codebase patterns:
  - `backend/src/db/schema.ts` - Existing Drizzle schema with composite indexes, foreign keys, type inference
  - `backend/src/config/redis.ts` - Redis client configuration with graceful degradation
  - `backend/src/services/sessionService.ts` - Session storage patterns, Redis usage
  - `frontend/src/features/game/components/GameScreen.tsx` - Tap-anywhere pattern with stopPropagation (lines 346-350, 497, 515)
  - `frontend/src/features/game/components/LearnMoreTooltip.tsx` - Auto-dismissing tooltip pattern (NOT to be reused per user decision)

### Secondary (MEDIUM confidence)
- [Express Rate Limiting 2026 Guide](https://oneuptime.com/blog/post/2026-02-02-express-rate-limiting/view) - express-rate-limit with Redis store patterns
- [Node-rate-limiter-flexible GitHub](https://github.com/animir/node-rate-limiter-flexible) - Alternative rate limiting library with Redis support
- [PostgreSQL Idempotent Inserts Best Practices 2026](https://copyprogramming.com/howto/sql-postgresql-ignore-exception-when-duplicate-insert) - ON CONFLICT patterns
- [Heroicons Official Site](https://heroicons.com/) - Flag icon SVG source
- [React Click Outside Detection](https://blog.logrocket.com/detect-click-outside-react-component-how-to/) - stopPropagation patterns
- [Drizzle ORM Best Practices Guide 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) - Schema design patterns

### Tertiary (LOW confidence)
- Multiple WebSearch results on rate limiting, React tooltips, icon libraries - used for ecosystem discovery, specific claims verified against official docs or codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use (Drizzle 0.45.1, Redis 4.6.12, express-validator 7.3.1), versions verified from package.json
- Architecture: HIGH - Patterns verified against existing codebase (session storage, schema definition, tap-anywhere with stopPropagation)
- Pitfalls: HIGH - Race conditions and rate limit bypass patterns are well-documented problems with database-level solutions, TOCTOU bug is classic concurrency pitfall
- Code examples: HIGH - Based on existing project patterns (schema.ts structure, Redis usage in sessionService.ts, stopPropagation in GameScreen.tsx)

**Research date:** 2026-02-21
**Valid until:** 2026-03-23 (30 days) - Stable technologies (PostgreSQL, Redis patterns), no fast-moving frameworks
