---
phase: 05-progression-profile
plan: 01
type: execute
status: complete
completed: 2026-02-12
duration: 4min
subsystem: progression-backend
tags: [database, schema, progression, xp, gems, stats, transactions]

requires:
  - phase: 03
    reason: "Built on game session management and scoring system"
  - phase: 02
    reason: "Uses authentication middleware and JWT tokens"

provides:
  - artifact: "users table progression columns"
    description: "7 new columns for tracking XP, gems, games played, best score, stats, and avatar"
  - artifact: "User.updateStats atomic transaction"
    description: "Thread-safe stats updates with GREATEST for best_score"
  - artifact: "progressionService"
    description: "XP/gems calculation (50+correct, 10+correct) and user stats updates"
  - artifact: "optionalAuth middleware"
    description: "Allows endpoints to work for both authenticated and anonymous users"
  - artifact: "progression in results API"
    description: "GET /results returns progression data for authenticated users"

affects:
  - phase: 05
    plan: 02
    reason: "Results screen will display the xpEarned/gemsEarned values"
  - phase: 05
    plan: 03
    reason: "Profile page will read totalXp, totalGems, and other stats"

tech-stack:
  added:
    - PostgreSQL ALTER TABLE with constraints and indexes
    - Transaction-based atomic updates with BEGIN/COMMIT/ROLLBACK
  patterns:
    - Optional authentication pattern for mixed auth/anon endpoints
    - Idempotent progression awarding with boolean flag
    - Atomic stat updates using SQL GREATEST and increments

key-files:
  created:
    - backend/src/services/progressionService.ts
  modified:
    - backend/schema.sql
    - backend/src/models/User.ts
    - backend/src/middleware/auth.ts
    - backend/src/services/sessionService.ts
    - backend/src/routes/game.ts

decisions:
  - decision: "XP formula: 50 base + 1 per correct answer"
    rationale: "Simple, predictable progression that rewards both participation and performance"
    alternative: "Could have used exponential or difficulty-weighted XP, but that adds complexity"

  - decision: "Gems formula: 10 base + 1 per correct answer"
    rationale: "Parallel structure to XP, future currency for avatar/cosmetic purchases"
    alternative: "Could have made gems rarer (only on perfect games), but that's too restrictive"

  - decision: "Progression awarded only on first results call"
    rationale: "Prevents double-awarding if user refreshes results page or API is called multiple times"
    implementation: "progressionAwarded boolean flag on GameSession"

  - decision: "best_score uses GREATEST, not increment"
    rationale: "Keeps the maximum score ever achieved, not cumulative. More meaningful stat."
    alternative: "Could track average score or score history, but best_score is simpler and more motivating"

  - decision: "Progression on results endpoint, not answer endpoint"
    rationale: "Awards progression once at game completion, not incrementally during play"
    alternative: "Could award after each correct answer, but that makes atomic updates harder and allows gaming the system"

metrics:
  - tasks-completed: 2
  - commits: 2
  - files-created: 1
  - files-modified: 5
  - database-tables-altered: 1
  - new-columns: 7
  - new-indexes: 2
---

# Phase 5 Plan 1: Progression Backend Summary

**One-liner:** Atomic XP/gems progression (50+correct, 10+correct) persists to PostgreSQL after authenticated game completion with idempotent awarding.

## Objective Achieved

Added database schema for user progression, created the progression service for XP/gems calculation and atomic stats updates, and wired game completion to persist progression for authenticated users. Anonymous users continue to work without any changes.

## Tasks Completed

### Task 1: Database schema migration and User model update

**What was done:**
- Added 7 new columns to users table: total_xp, total_gems, games_played, best_score, total_correct, total_questions, avatar_url
- Added CHECK constraints to prevent negative values for xp, gems, and games_played
- Created indexes on total_xp DESC and best_score DESC for future leaderboard queries
- Extended User interface with new progression fields and avatarUrl
- Added User.getProfileStats() method to retrieve only stats fields
- Added User.updateStats() method with atomic transaction (BEGIN/COMMIT/ROLLBACK)
- Added User.updateAvatarUrl() method for future avatar upload feature

**Verification:**
- Ran schema.sql migration successfully
- Verified all 7 columns exist in users table
- Confirmed User model compiles without TypeScript errors
- Tested database queries return correct data structure

**Commit:** `a9b89f2` - feat(05-01): add database schema for user progression

### Task 2: Progression service and game route wiring

**What was done:**
- Created progressionService.ts with calculateProgression() and updateUserProgression()
- XP formula: 50 + correctAnswers
- Gems formula: 10 + correctAnswers
- Added optionalAuth middleware to auth.ts - sets req.user if valid token, otherwise undefined (no error)
- Updated GameSession interface to support userId as string | number
- Added progressionAwarded boolean flag to prevent double-awarding
- Wired optionalAuth into POST /session endpoint
- Updated POST /session to extract userId from req.user?.userId or use 'anonymous'
- Updated GET /results to calculate and award progression for authenticated users
- Progression only awarded once per session (check progressionAwarded flag)
- Results API returns progression object for authenticated users, null for anonymous

**Verification:**
- Started backend server successfully
- Tested anonymous session creation - works identically to before
- Tested authenticated session creation - works with Bearer token
- Submitted 10 answers (9 correct) in authenticated game
- Results endpoint returned progression: { xpEarned: 59, gemsEarned: 19 } ✓
- Database confirmed stats updated: total_xp=59, total_gems=19, games_played=1, best_score=1275 ✓
- Called results endpoint second time - returned progression: null (no double-award) ✓
- Database confirmed stats unchanged after second call ✓

**Commit:** `17c94fc` - feat(05-01): wire progression to game completion

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Database Schema Changes

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_gems INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_correct INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- CHECK constraints
ALTER TABLE users
  ADD CONSTRAINT check_total_xp_non_negative CHECK (total_xp >= 0),
  ADD CONSTRAINT check_total_gems_non_negative CHECK (total_gems >= 0),
  ADD CONSTRAINT check_games_played_non_negative CHECK (games_played >= 0);

-- Indexes for leaderboards
CREATE INDEX IF NOT EXISTS idx_users_total_xp_desc ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_best_score_desc ON users(best_score DESC);
```

### Progression Formulas

**XP:** 50 (base) + correctAnswers
**Gems:** 10 (base) + correctAnswers

Examples:
- 0/10 correct: 50 XP, 10 gems
- 5/10 correct: 55 XP, 15 gems
- 10/10 correct: 60 XP, 20 gems

### Atomic Stats Update

```typescript
await client.query('BEGIN');
await client.query(
  `UPDATE users SET
     total_xp = total_xp + $1,
     total_gems = total_gems + $2,
     games_played = games_played + 1,
     best_score = GREATEST(best_score, $3),
     total_correct = total_correct + $4,
     total_questions = total_questions + $5
   WHERE id = $6`,
  [xpToAdd, gemsToAdd, score, correctAnswers, totalQuestions, id]
);
await client.query('COMMIT');
```

Key features:
- Transaction ensures all-or-nothing update
- GREATEST() keeps maximum score, not cumulative
- All other stats use atomic increments (safe for concurrent updates)

### Optional Authentication Pattern

```typescript
export async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    req.user = undefined;
    next();
    return;
  }

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      req.user = undefined;
      next();
      return;
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = undefined;
    next();
  }
}
```

This middleware enables mixed authentication endpoints:
- Valid token → req.user populated with userId
- No token or invalid token → req.user = undefined, no error
- Downstream handlers check typeof userId to distinguish authenticated vs anonymous

## Integration Points

**Upstream dependencies:**
- Phase 3 game session management (SessionManager)
- Phase 2 authentication (JWT tokens, auth middleware)
- Phase 1 database connection pool

**Downstream consumers:**
- Phase 5 Plan 2: Results screen will display xpEarned/gemsEarned
- Phase 5 Plan 3: Profile page will display totalXp, totalGems, etc.
- Future: Leaderboard queries will use total_xp DESC and best_score DESC indexes

## API Changes

### POST /api/game/session

**Changed:** Now accepts optional Authorization header
**Behavior:**
- With valid token: creates session with userId as number
- Without token or invalid token: creates session with userId='anonymous'
**Response:** Unchanged (sessionId + questions)

### GET /api/game/results/:sessionId

**Changed:** Now returns progression field
**Response structure:**
```json
{
  "answers": [...],
  "totalScore": 1275,
  "totalCorrect": 9,
  "totalQuestions": 10,
  "fastestAnswer": {...},
  "progression": {
    "xpEarned": 59,
    "gemsEarned": 19
  }
}
```

**Notes:**
- progression is null for anonymous users
- progression is null on second call (already awarded)

## Testing Evidence

**Test 1: Anonymous user (regression test)**
```bash
curl -X POST http://localhost:3000/api/game/session
# Returns: sessionId + questions ✓
```

**Test 2: Authenticated user progression**
```bash
# Created session with Bearer token
# Submitted 10 answers (9 correct, 1 incorrect)
curl http://localhost:3000/api/game/results/1566d476-ffa8-46a1-86d7-bcccc612d4c0
# Returns: progression: { xpEarned: 59, gemsEarned: 19 } ✓
```

**Test 3: Database verification**
```sql
SELECT total_xp, total_gems, games_played, best_score
FROM users WHERE email = 'test-progression@example.com';

-- Result: 59 | 19 | 1 | 1275 ✓
```

**Test 4: Idempotent progression**
```bash
# Called results endpoint second time
# Returns: progression: null ✓
# Database unchanged ✓
```

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Ready for:**
- ✓ Phase 5 Plan 2: Results screen can display progression rewards
- ✓ Phase 5 Plan 3: Profile page can fetch and display user stats
- ✓ Future leaderboard implementation (indexes already in place)

**Data available for next plans:**
- totalXp, totalGems (for profile display and leveling)
- gamesPlayed (for profile stats)
- bestScore (for profile and potential leaderboards)
- totalCorrect, totalQuestions (for accuracy percentage)
- avatarUrl (for avatar uploads in future plan)

## Success Criteria Met

- ✅ XP earned = 50 + correctAnswers for authenticated users
- ✅ Gems earned = 10 + correctAnswers for authenticated users
- ✅ Stats updated atomically in database (total_xp, total_gems, games_played, best_score, total_correct, total_questions)
- ✅ best_score uses GREATEST (keeps maximum, not incrementing)
- ✅ Anonymous users get null progression, no database errors
- ✅ No regression in existing game flow

## Commits

1. `a9b89f2` - feat(05-01): add database schema for user progression
2. `17c94fc` - feat(05-01): wire progression to game completion

## Files Changed

**Created:**
- backend/src/services/progressionService.ts

**Modified:**
- backend/schema.sql (+26 lines: 7 columns, 3 constraints, 2 indexes)
- backend/src/models/User.ts (+111 lines: updated interface, 3 new methods)
- backend/src/middleware/auth.ts (+31 lines: optionalAuth middleware)
- backend/src/services/sessionService.ts (+2 lines: userId type, progressionAwarded flag)
- backend/src/routes/game.ts (+38 lines: optionalAuth wiring, progression calculation)

**Total:** 1 file created, 5 files modified, 208 lines added
