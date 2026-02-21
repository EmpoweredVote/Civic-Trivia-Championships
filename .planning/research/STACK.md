# Technology Stack - Feedback Marks Feature

**Project:** Civic Trivia Championship - Feedback/Flagging System
**Researched:** 2026-02-21
**Context:** Subsequent milestone adding player feedback to existing validated stack

## Executive Summary

The feedback marks feature requires **minimal new dependencies** because your existing stack already provides most capabilities needed. The primary additions are:
1. **Database schema extensions** (new tables via Drizzle ORM)
2. **API rate limiting** for feedback endpoints (new middleware)
3. **Optional XSS sanitization** for free-text input (optional hardening)

Your existing stack already provides: authentication (JWT), validation (express-validator 7.3.1), database ORM (Drizzle 0.45.1), state management (Zustand), and PostgreSQL on Supabase.

## No New Core Dependencies Required

### Leverage Existing Stack

Your validated stack already handles the feedback feature requirements:

| Need | Existing Solution | Why Sufficient |
|------|------------------|----------------|
| Authentication | JWT via `authenticateToken` middleware | Feedback requires auth; middleware already implemented |
| Input validation | express-validator 7.3.1 | Already installed; includes `.trim()`, `.escape()`, `.isLength()` |
| Database ORM | Drizzle ORM 0.45.1 | Schema extensions fit existing patterns; supports JSONB for notes |
| Frontend state | Zustand 4.4.7 | Small flagging state (per-question thumbs) fits reducer pattern |
| API client | Fetch API | Simple POST endpoints don't need axios |
| Database | PostgreSQL (Supabase) | Already supports required table structure |

**Rationale:** Adding new libraries increases bundle size, maintenance burden, and learning curve. Your existing tools handle all core requirements.

## Recommended New Dependencies

### 1. Rate Limiting Middleware (Required)

**Library:** `express-rate-limit`
**Version:** `^7.4.1` (latest stable as of Feb 2026)
**Purpose:** Prevent feedback spam from malicious users

```bash
npm install express-rate-limit
```

**Why this library:**
- Industry standard with 10M+ weekly downloads
- Works natively with Express
- Supports per-user (IP/auth) rate limits
- Memory store sufficient for single-server setup (already using Upstash Redis for sessions)
- Follows IETF draft standards for RateLimit headers

**Configuration for feedback endpoints:**
```typescript
import rateLimit from 'express-rate-limit';

// Feedback submission rate limit: 10 flags per 15 minutes per user
export const feedbackRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per user
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: { error: 'Too many feedback submissions. Please try again later.' },
  keyGenerator: (req) => {
    // Use authenticated user ID, fall back to IP for guests
    return req.user?.id?.toString() || req.ip;
  },
  skip: (req) => {
    // Admins bypass rate limits for testing
    return req.user?.isAdmin === true;
  }
});
```

**Apply to feedback routes:**
```typescript
router.post('/feedback/flag', authenticateToken, feedbackRateLimiter, submitFlag);
router.post('/feedback/elaborate', authenticateToken, feedbackRateLimiter, submitElaboration);
```

**Alternative considered:** `express-slow-down` (slows requests instead of blocking). **Not chosen** because feedback spam should be blocked, not slowed.

**Sources:**
- [express-rate-limit npm package](https://www.npmjs.com/package/express-rate-limit)
- [Rate Limiting in Express.js - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/)
- [How to Add Rate Limiting to Express APIs - OneUptime](https://oneuptime.com/blog/post/2026-02-02-express-rate-limiting/view)

### 2. XSS Sanitization (Optional but Recommended)

**Current status:** express-validator 7.3.1 includes `.escape()` sanitizer (already installed)

**Recommendation:** Use express-validator's built-in sanitization for feedback text:

```typescript
import { body, validationResult } from 'express-validator';

// Validation chain for feedback elaboration
export const validateFeedbackElaboration = [
  body('flagIds')
    .isArray({ min: 1 })
    .withMessage('At least one flag required'),
  body('flagIds.*')
    .isInt()
    .withMessage('Flag IDs must be integers'),
  body('notes')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be 1000 characters or less')
    .escape() // Escape HTML entities to prevent XSS
];
```

**Why NOT add a separate XSS library:**
- express-validator's `.escape()` converts `<`, `>`, `&`, `'`, `"` to HTML entities
- Admin UI will display plain text (React automatically escapes in JSX)
- Feedback notes are never rendered as raw HTML
- Adding `xss` or `express-xss-sanitizer` is unnecessary complexity

**If you later need rich formatting:**
- Consider `sanitize-html` for allowlist-based HTML sanitization
- Not needed for MVP (plain text feedback only)

**Sources:**
- [express-validator documentation](https://express-validator.github.io/)
- [Using Express-Validator for Data Validation - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/express-validator-nodejs/)
- [JavaScript Input Sanitization in Node.js: 2026 Guide](https://copyprogramming.com/howto/javascript-sanitizing-use-input-in-nodejs)

## Database Schema Extensions

### New Tables (Drizzle ORM Schema)

Add to `backend/src/db/schema.ts` in the `civic_trivia` schema:

```typescript
// Question flags table - tracks player thumbs-down during games
export const questionFlags = civicTriviaSchema.table('question_flags', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull(), // References public.users (outside schema, no FK constraint)
  sessionId: text('session_id').notNull(), // Redis session ID for context
  flaggedAt: timestamp('flagged_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'), // Nullable - elaborated later in post-game
  archived: boolean('archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: integer('archived_by') // Admin user ID, nullable
}, (table) => ({
  questionIdx: index('idx_question_flags_question_id').on(table.questionId),
  userIdx: index('idx_question_flags_user_id').on(table.userId),
  archivedIdx: index('idx_question_flags_archived')
    .on(table.archived)
    .where(sql`${table.archived} = false`), // Partial index for active flags
  flaggedAtIdx: index('idx_question_flags_flagged_at').on(table.flaggedAt)
}));

export type QuestionFlag = typeof questionFlags.$inferSelect;
export type NewQuestionFlag = typeof questionFlags.$inferInsert;
```

**Schema design rationale:**

| Decision | Rationale |
|----------|-----------|
| No FK to `users` table | Users table is in `public` schema; Drizzle schema is `civic_trivia`. Cross-schema FKs complicate migrations. Use application-level checks instead. |
| Include `sessionId` | Provides context: what game was played, what questions were seen, when flag occurred. Useful for investigating false positives. |
| Separate `notes` field | Nullable; populated later in post-game feedback flow. Keeps in-game flagging lightweight (single click). |
| `archived` + `archivedAt` + `archivedBy` | Soft delete pattern. Admins archive (not delete) bad flags. Preserves audit trail. |
| Partial index on `archived=false` | Admin flags queue filters to `archived=false`. Partial index speeds this common query. |
| Index on `flaggedAt` | Supports ordering by most recent flags in admin queue. |
| Index on `questionId` | Supports "show all flags for this question" in admin detail panel. |
| Index on `userId` | Future feature: show user's flagging history, detect spammers. |

**Foreign key indexing:** PostgreSQL automatically indexes the FK target (`questions.id`), but the source column (`question_id`) needs explicit indexing for join performance. Drizzle migration will create this automatically from the schema.

**Sources:**
- [Drizzle ORM PostgreSQL Best Practices Guide (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Drizzle ORM - Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Should I Create an Index on Foreign Keys in PostgreSQL? - Percona](https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/)
- [Foreign Key Indexing and Performance in PostgreSQL - Cybertec](https://www.cybertec-postgresql.com/en/index-your-foreign-key/)

### No Changes to Existing Tables

**Questions table:** No new columns needed. Flag counts derived via `COUNT(*)` query.

**Users table:** No new columns needed. User stats (`totalGems`, `totalXp`) already exist for future feedback rewards.

**Collections table:** No new columns needed.

## API Endpoint Patterns

### New Endpoints

Add to `backend/src/routes/feedback.ts` (new file):

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { feedbackRateLimiter } from '../middleware/rateLimit.js';
import { submitFlag, submitElaboration } from '../controllers/feedbackController.js';
import { validateFeedbackElaboration } from '../validators/feedbackValidators.js';

const router = Router();

// POST /api/feedback/flag - Thumbs-down a question during answer reveal
router.post('/flag',
  authenticateToken,
  feedbackRateLimiter,
  submitFlag
);

// POST /api/feedback/elaborate - Add notes to multiple flags in post-game
router.post('/elaborate',
  authenticateToken,
  feedbackRateLimiter,
  validateFeedbackElaboration,
  submitElaboration
);

export default router;
```

### Admin Endpoints

Add to existing `backend/src/routes/admin.ts`:

```typescript
// GET /api/admin/flags - Get flags queue (paginated, filtered by archived)
router.get('/flags', getFlagsQueue);

// GET /api/admin/flags/:questionId - Get flags for specific question
router.get('/flags/:questionId', getFlagsByQuestion);

// PATCH /api/admin/flags/:flagId/archive - Archive a flag
router.patch('/flags/:flagId/archive', archiveFlag);

// PATCH /api/admin/flags/bulk-archive - Archive multiple flags
router.patch('/flags/bulk-archive', bulkArchiveFlags);
```

**Integration with existing routes:**
- Admin routes already use `authenticateToken + requireAdmin` middleware
- Feedback routes follow same pattern as game routes (authenticated, rate-limited)
- No breaking changes to existing endpoints

## Frontend State Management

### Flagging State During Gameplay

**Approach:** Extend existing game reducer (no new Zustand store needed)

```typescript
// Add to frontend/src/features/game/gameReducer.ts

export type GameAction =
  | { type: 'SESSION_CREATED'; ... }
  | { type: 'SELECT_ANSWER'; ... }
  | { type: 'FLAG_QUESTION'; questionId: string }  // NEW
  | { type: 'UNFLAG_QUESTION'; questionId: string } // NEW
  | { type: 'REVEAL_ANSWER'; ... };

export type GameState = {
  phase: GamePhase;
  questions: Question[];
  answers: GameAnswer[];
  flaggedQuestionIds: Set<string>; // NEW: Track thumbs-down clicks
  // ... existing fields
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'FLAG_QUESTION': {
      // Only valid during 'revealing' phase (answer revealed, before next question)
      if (state.phase !== 'revealing') return state;

      const newFlags = new Set(state.flaggedQuestionIds);
      newFlags.add(action.questionId);
      return { ...state, flaggedQuestionIds: newFlags };
    }

    case 'UNFLAG_QUESTION': {
      // Allow unflagging during 'revealing' phase
      if (state.phase !== 'revealing') return state;

      const newFlags = new Set(state.flaggedQuestionIds);
      newFlags.delete(action.questionId);
      return { ...state, flaggedQuestionIds: newFlags };
    }

    // ... existing cases
  }
}
```

**Rationale:**
- Game state is already managed via `useReducer` with `gameReducer`
- Flagging is ephemeral game state (resets on new game)
- `Set<string>` provides O(1) toggle/check performance
- No need for global Zustand store (flags are per-game, not cross-component)
- Survives `NEXT_QUESTION` transitions (flags persist until game ends)

### Post-Game Feedback State

**Approach:** Local component state in `ResultsScreen.tsx`

```typescript
// In ResultsScreen.tsx
const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

// Render feedback form for flagged questions
{flaggedQuestionIds.map(questionId => (
  <div key={questionId}>
    <textarea
      value={feedbackNotes[questionId] || ''}
      onChange={(e) => setFeedbackNotes(prev => ({
        ...prev,
        [questionId]: e.target.value
      }))}
      placeholder="What didn't you like about this question? (optional)"
      maxLength={1000}
    />
  </div>
))}
```

**Rationale:**
- Feedback elaboration is one-time, post-game action
- No need to persist across navigations
- Local state keeps component self-contained
- `Record<questionId, notes>` maps question to feedback text

## What NOT to Add

### Libraries Explicitly Rejected

| Library | Why Not Needed |
|---------|---------------|
| `axios` | Fetch API sufficient for simple POST endpoints. Already using fetch in `gameService.ts`. |
| `react-hook-form` | Feedback form is simple (1 textarea per question). Controlled inputs sufficient. |
| `yup` / `zod` (frontend) | No complex client-side validation needed. Backend validates with express-validator. |
| `xss` / `sanitize-html` | express-validator's `.escape()` sufficient. No rich text rendering. |
| `rate-limit-redis` | Single-server deployment (Vercel/Fly.io). Memory store sufficient. Redis already used for game sessions, not rate limits. |
| `helmet` | Already best practice, but not specific to feedback feature. Consider adding globally if not present. |

### Features to Defer

**Not in this milestone:**
- Feedback reputation system (track user accuracy, reward good flags) - requires ML/heuristics
- Admin bulk actions UI (archive all flags for question) - API ready, UI can wait
- Email notifications for new flags - requires email service (SendGrid/Postmark)
- Flag categories ("incorrect answer", "misleading question", "typo") - complicates UI, defer until data shows need

## Integration Points with Existing Stack

### 1. Authentication Flow

```typescript
// Feedback endpoints use existing auth middleware
router.post('/feedback/flag', authenticateToken, feedbackRateLimiter, submitFlag);

// Frontend includes JWT token (already implemented)
const response = await fetch('/api/feedback/flag', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ questionId, sessionId })
});
```

**No changes needed** - JWT auth already works for authenticated endpoints.

### 2. Database Connection

```typescript
// Use existing Drizzle db instance
import { db } from '../db/index.js';
import { questionFlags } from '../db/schema.js';

// Insert flag
await db.insert(questionFlags).values({
  questionId: parseInt(questionId),
  userId: req.user.id,
  sessionId: sessionId,
  notes: null, // Elaborated later
  archived: false
});
```

**No changes needed** - Drizzle ORM already configured for Supabase PostgreSQL.

### 3. Admin Routes

```typescript
// Flags routes follow existing admin pattern
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

router.use(authenticateToken, requireAdmin); // Applied to all /api/admin/* routes

router.get('/flags', getFlagsQueue);
```

**No changes needed** - Admin middleware already exists.

### 4. Frontend Game Flow

```
[QuestionCard]
  → User clicks answer
  → dispatch({ type: 'SELECT_ANSWER' })
  → Transition to 'revealing' phase
  → [AnswerReveal] renders thumbs-down button (NEW)
  → User clicks thumbs-down
  → dispatch({ type: 'FLAG_QUESTION', questionId })
  → dispatch({ type: 'NEXT_QUESTION' })

[ResultsScreen]
  → Render flagged questions with textarea (NEW)
  → User adds notes (optional)
  → Click "Submit Feedback"
  → POST /api/feedback/elaborate with flagIds + notes
```

**Integration:** New components (`ThumbsDownButton`, `FeedbackForm`) fit into existing game flow without breaking changes.

## Migration Strategy

### 1. Database Migration

```bash
# Generate migration from schema changes
npm run db:generate

# Review generated SQL in src/db/migrations/
# Should create question_flags table + indexes

# Apply migration to production
npm run db:migrate
```

**Rollback plan:** Drizzle migrations are SQL files. Rollback = drop table + indexes.

### 2. Deployment Sequence

```
1. Deploy backend with new routes (flags endpoints return 404 initially, safe)
2. Run database migration (creates question_flags table)
3. Deploy frontend with thumbs-down button (calls new API)
4. Monitor logs for errors
```

**Zero-downtime:** New endpoints don't affect existing game flow. Old clients continue working.

## Environment Variables

### New Required Variables

```bash
# .env (backend)
ADMIN_EMAIL=admin@example.com  # Already exists for admin promotion
```

**No new env vars needed** - feedback feature uses existing database, Redis, JWT config.

### Optional Configuration

```bash
# Rate limit overrides (default values shown)
FEEDBACK_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
FEEDBACK_RATE_LIMIT_MAX=10            # 10 requests per window
```

## Performance Considerations

### Database Query Patterns

**Flags queue query** (admin UI):
```sql
SELECT
  qf.id, qf.question_id, qf.user_id, qf.flagged_at, qf.notes,
  q.text, q.external_id,
  COUNT(*) OVER (PARTITION BY qf.question_id) as flag_count
FROM civic_trivia.question_flags qf
JOIN civic_trivia.questions q ON qf.question_id = q.id
WHERE qf.archived = false
ORDER BY qf.flagged_at DESC
LIMIT 50 OFFSET 0;
```

**Performance:**
- Partial index on `archived=false` makes WHERE clause fast
- Index on `flagged_at` supports ORDER BY
- FK index on `question_id` makes JOIN cheap
- LIMIT 50 prevents large result sets

**Expected load:**
- Flag submission: ~1-5% of game sessions (most players don't flag)
- Admin queue access: <10 requests/day
- No need for caching layer

### API Response Times

| Endpoint | Expected Latency | Notes |
|----------|-----------------|-------|
| POST /feedback/flag | <100ms | Single INSERT query |
| POST /feedback/elaborate | <200ms | Batch UPDATE (1-10 flags) |
| GET /admin/flags | <300ms | JOIN + window function, paginated |
| GET /admin/flags/:id | <100ms | Simple WHERE + JOIN |

**Bottlenecks unlikely** - PostgreSQL handles this easily at expected scale (<10k flags total).

## Security Considerations

### Input Validation

```typescript
// Backend validation with express-validator
body('notes')
  .optional()
  .trim()
  .isLength({ max: 1000 })
  .escape() // XSS prevention
```

**Defense in depth:**
1. Client-side: `maxLength={1000}` on textarea
2. Server-side: express-validator checks length + escapes HTML
3. Database: `text` column (no length limit, but app enforces)
4. Display: React JSX auto-escapes (no `dangerouslySetInnerHTML`)

### Rate Limiting

**Per-user limits:**
- 10 flags per 15 minutes (prevents spam bursts)
- Admins bypass limits (testing, legitimate moderation)
- Uses user ID for authenticated, IP for anonymous (fallback only; feature requires auth)

**Why not per-question limits?**
- Multiple users can legitimately flag the same bad question
- Per-user limits already prevent individual spam

### Authorization

```typescript
// Only authenticated users can flag
router.post('/feedback/flag', authenticateToken, ...);

// Only admins can access flags queue
router.get('/admin/flags', authenticateToken, requireAdmin, ...);

// Users cannot archive their own flags (admin-only)
router.patch('/flags/:id/archive', authenticateToken, requireAdmin, ...);
```

**Privilege escalation prevention:**
- Flag submission records `req.user.id` (can't flag as another user)
- Archive operations check `req.user.isAdmin` (non-admins get 403)

## Testing Strategy

### Backend Tests

**Unit tests:**
```typescript
describe('submitFlag', () => {
  it('creates flag with authenticated user ID', async () => {
    const req = { user: { id: 1 }, body: { questionId: '123', sessionId: 'abc' } };
    await submitFlag(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects unauthenticated requests', async () => {
    const req = { user: null, body: { questionId: '123' } };
    await submitFlag(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('enforces rate limits', async () => {
    // Submit 11 flags rapidly
    for (let i = 0; i < 11; i++) {
      await request(app).post('/api/feedback/flag').set('Authorization', token);
    }
    expect(lastResponse.status).toBe(429); // Too Many Requests
  });
});
```

### Frontend Tests

**Component tests:**
```typescript
describe('ThumbsDownButton', () => {
  it('dispatches FLAG_QUESTION on click', () => {
    render(<ThumbsDownButton questionId="q1" onFlag={mockDispatch} />);
    fireEvent.click(screen.getByLabelText('Flag this question'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'FLAG_QUESTION', questionId: 'q1' });
  });

  it('shows unflag button when already flagged', () => {
    render(<ThumbsDownButton questionId="q1" flagged={true} />);
    expect(screen.getByText('Unflag')).toBeInTheDocument();
  });
});
```

### Integration Tests

**End-to-end flow:**
1. Play game as authenticated user
2. Flag question during answer reveal
3. Complete game
4. Add notes in post-game feedback
5. Submit feedback
6. Login as admin
7. View flags queue
8. Archive flag
9. Verify flag removed from queue

## Monitoring & Observability

### Metrics to Track

```typescript
// Log feedback events
console.log('FLAG_SUBMITTED', {
  userId: req.user.id,
  questionId,
  sessionId,
  timestamp: new Date().toISOString()
});

console.log('FEEDBACK_ELABORATED', {
  userId: req.user.id,
  flagCount: flagIds.length,
  hasNotes: notes !== null,
  timestamp: new Date().toISOString()
});
```

**Analytics questions:**
- How many flags per day? (usage trend)
- Which questions get flagged most? (quality issues)
- What % of flags include notes? (elaboration rate)
- How long until admin archives flags? (moderation latency)

### Error Tracking

**Expected errors:**
- 429 Too Many Requests (rate limit exceeded) - **not a bug**
- 401 Unauthorized (user logged out mid-game) - **expected, show login prompt**
- 404 Question Not Found (flagging deleted question) - **rare, log for investigation**

**Unexpected errors:**
- 500 Internal Server Error (DB connection failed) - **alert on-call**
- Foreign key violation (question_id doesn't exist) - **data integrity issue, investigate**

## Summary: Minimal Additions, Maximum Leverage

| Category | New Additions | Reused from Existing Stack |
|----------|--------------|---------------------------|
| Backend Dependencies | `express-rate-limit` (1 package) | express-validator, Drizzle ORM, JWT auth, PostgreSQL |
| Frontend Dependencies | None | Zustand, Fetch API, React hooks |
| Database Changes | 1 new table (`question_flags`) | Existing users, questions, collections tables |
| API Routes | 6 new endpoints (2 feedback, 4 admin) | Existing auth, admin middleware |
| Frontend State | Extend game reducer | Existing useReducer pattern |

**Total new npm dependencies: 1** (`express-rate-limit`)

**Why this is the right approach:**
- Minimizes technical debt (fewer dependencies to maintain)
- Faster implementation (leverage existing patterns)
- Lower risk (reuse battle-tested auth, validation, ORM)
- Easier testing (no new testing frameworks needed)
- Better performance (no unnecessary libraries in bundle)

Your existing stack is well-suited for this feature. The feedback system fits naturally into your architecture with minimal additions.

## Sources

### Rate Limiting
- [express-rate-limit npm package](https://www.npmjs.com/package/express-rate-limit)
- [Rate Limiting in Express.js - Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/)
- [How to Add Rate Limiting to Express APIs - OneUptime](https://oneuptime.com/blog/post/2026-02-02-express-rate-limiting/view)

### Input Validation & Sanitization
- [express-validator documentation](https://express-validator.github.io/)
- [Using Express-Validator for Data Validation - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/express-validator-nodejs/)
- [JavaScript Input Sanitization in Node.js: 2026 Guide](https://copyprogramming.com/howto/javascript-sanitizing-use-input-in-nodejs)

### Database Best Practices
- [Drizzle ORM PostgreSQL Best Practices Guide (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Drizzle ORM - Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Should I Create an Index on Foreign Keys in PostgreSQL? - Percona](https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/)
- [Foreign Key Indexing and Performance in PostgreSQL - Cybertec](https://www.cybertec-postgresql.com/en/index-your-foreign-key/)
