# Architecture Research: v1.3 Admin UI, Telemetry, and Quality Tooling

**Focus:** Integrating admin exploration UI, lightweight telemetry counters, and question quality rules into the existing Civic Trivia architecture
**Researched:** 2026-02-19
**Confidence:** HIGH (based on direct codebase analysis of all existing components)

## Executive Summary

The v1.2 architecture already has scaffolding for all three features: an admin route (`/api/admin`) with question management endpoints, an admin page (`/admin`) with content review UI, and a questions table in PostgreSQL ready for new columns. The work is extension, not creation. Telemetry requires adding two integer columns (`encounter_count`, `correct_count`) to the `questions` table and incrementing them during answer submission. The admin UI needs expanded routes for browsing all questions (not just expired ones) and collection management. Quality rules are applied at generation time (scripts) and surfaced in the admin UI for human review -- they do not need a runtime enforcement engine.

**Critical finding:** The admin routes currently have NO authorization check. Any authenticated user can access `/api/admin/*`. The `ProtectedRoute` wrapper on the frontend only checks `isAuthenticated`, not role. Before shipping admin features, an `is_admin` column must be added to the `users` table with a corresponding middleware guard.

## Current Architecture Snapshot (Post-v1.2)

### Existing Admin Infrastructure

```
Frontend:
  App.tsx
    └─ /admin route (ProtectedRoute wraps it -- auth only, no role check)
        └─ Admin.tsx -- "Content Review" page
            └─ useAdminQuestions hook
                └─ Calls /api/admin/questions, /api/admin/questions/:id/renew, /archive

Backend:
  server.ts
    └─ app.use('/api/admin', adminRouter)   -- line 58
        └─ routes/admin.ts
            ├─ router.use(authenticateToken)  -- auth only, no role check
            ├─ GET /questions?status=         -- list expired/expiring questions
            ├─ POST /questions/:id/renew      -- renew expired question
            └─ POST /questions/:id/archive    -- archive question
```

### Existing Game Flow (Telemetry Insertion Points)

```
POST /api/game/answer (routes/game.ts, line 169)
  │
  ├─ Validates session, question
  ├─ sessionManager.submitAnswer()     -- scoring + plausibility
  │     └─ Returns ServerAnswer with { questionId, selectedOption, basePoints, ... }
  │
  ├─ Gets question.correctAnswer from session
  │
  └─ Response: { basePoints, speedBonus, totalPoints, correct, correctAnswer }
      └─ "correct" boolean is already computed -- THIS is where telemetry fires
```

### Existing Database Schema (questions table)

The `questions` table in `backend/src/db/schema.ts` has these columns:
- `id` (serial PK), `externalId`, `text`, `options` (JSONB), `correctAnswer`
- `explanation`, `difficulty`, `topicId`, `subcategory`
- `source` (JSONB), `learningContent` (JSONB)
- `expiresAt`, `status`, `expirationHistory` (JSONB)
- `createdAt`, `updatedAt`

**Missing for v1.3:** `encounter_count` (integer), `correct_count` (integer)

### Existing User Model

The `users` table (via `backend/src/models/User.ts`, raw SQL queries against `pool`) has:
- `id`, `email`, `password_hash`, `name`
- `total_xp`, `total_gems`, `games_played`, `best_score`
- `total_correct`, `total_questions`
- `avatar_url`, `timer_multiplier`

**Missing for v1.3:** `is_admin` (boolean, default false)

## Integration Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend                                                             │
│                                                                      │
│  EXISTING (modified):                                                │
│    App.tsx         -- Add AdminRoute guard (checks user.isAdmin)     │
│    Admin.tsx       -- Expand from content-review to full admin hub   │
│    ProtectedRoute  -- UNCHANGED (AdminRoute is separate)             │
│    types/auth.ts   -- Add isAdmin to User type                       │
│    authStore.ts    -- UNCHANGED (User type update propagates)        │
│                                                                      │
│  NEW:                                                                │
│    features/admin/components/QuestionExplorer.tsx                     │
│    features/admin/components/QuestionDetail.tsx                       │
│    features/admin/components/CollectionManager.tsx                    │
│    features/admin/components/TelemetryBadge.tsx                      │
│    features/admin/hooks/useAdminCollections.ts                       │
│    features/admin/hooks/useQuestionDetail.ts                         │
│    components/AdminRoute.tsx                                         │
│                                                                      │
│  UNCHANGED:                                                          │
│    All game components (GameScreen, QuestionCard, AnswerGrid, etc.)  │
│    Dashboard, Login, Signup, Profile pages                           │
│    collections/ features                                             │
│    gameReducer, useGameState, useKeyPress                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend                                                              │
│                                                                      │
│  EXISTING (modified):                                                │
│    routes/admin.ts     -- Add CRUD endpoints, question explorer      │
│    routes/game.ts      -- Add telemetry increment after answer       │
│    middleware/auth.ts   -- Add requireAdmin middleware                │
│    db/schema.ts        -- Add encounter_count, correct_count columns │
│    models/User.ts      -- Add is_admin to queries                    │
│    routes/auth.ts      -- Include isAdmin in JWT/login response      │
│                                                                      │
│  NEW:                                                                │
│    services/telemetryService.ts   -- Async counter increment         │
│    middleware/admin.ts             -- OR inline in auth.ts            │
│                                                                      │
│  UNCHANGED:                                                          │
│    services/sessionService.ts     -- Session management              │
│    services/scoreService.ts       -- Score calculation               │
│    services/progressionService.ts -- XP/gems                         │
│    services/questionService.ts    -- Question selection               │
│    routes/health.ts, routes/profile.ts                               │
│    cron/startCron.ts                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase) -- civic_trivia schema                         │
│                                                                      │
│  MODIFIED:                                                           │
│    questions -- ADD encounter_count INTEGER DEFAULT 0 NOT NULL        │
│              -- ADD correct_count INTEGER DEFAULT 0 NOT NULL          │
│                                                                      │
│  MODIFIED:                                                           │
│    users    -- ADD is_admin BOOLEAN DEFAULT FALSE NOT NULL            │
│                                                                      │
│  UNCHANGED:                                                          │
│    collections, collection_questions, topics, collection_topics       │
└─────────────────────────────────────────────────────────────────────┘
```

## Detailed Integration Points

### 1. Admin Authorization (The Gap That Must Be Filled First)

**Current state:** The admin route at `backend/src/routes/admin.ts` line 10 applies `authenticateToken` to all routes. This verifies the JWT is valid but does NOT check if the user is an admin. Any logged-in user can call `GET /api/admin/questions` or `POST /api/admin/questions/:id/archive`. On the frontend, `/admin` is wrapped by `ProtectedRoute` which only checks `isAuthenticated`.

**Required changes:**

1. **Database migration:** Add `is_admin` column to `users` table.

```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Promote a specific user (run manually or via seed)
UPDATE users SET is_admin = TRUE WHERE email = '<admin-email>';
```

2. **Backend middleware:** Add `requireAdmin` middleware in `backend/src/middleware/auth.ts`:

```typescript
// Add to backend/src/middleware/auth.ts (after authenticateToken)
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // authenticateToken must run first to set req.user
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Query user's admin status
  const user = await User.findById(req.user.userId);
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
```

3. **Apply to admin routes** in `backend/src/routes/admin.ts`:

```typescript
// Change line 10 from:
router.use(authenticateToken);
// To:
router.use(authenticateToken);
router.use(requireAdmin);
```

4. **User model update** in `backend/src/models/User.ts` -- add `isAdmin` to all SELECT queries (add `is_admin as "isAdmin"` to the column list in `findByEmail`, `findById`, `getProfileStats`).

5. **Auth response update** -- include `isAdmin` in the login/refresh response so the frontend knows. Modify `backend/src/routes/auth.ts` to include it in the user object returned after login.

6. **Frontend User type** in `frontend/src/types/auth.ts`:

```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;  // NEW
}
```

7. **Frontend AdminRoute guard** -- new component:

```typescript
// frontend/src/components/AdminRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
```

8. **Route update** in `frontend/src/App.tsx`:

```typescript
// Change from:
<Route element={<ProtectedRoute />}>
  <Route path="/profile" element={<Profile />} />
  <Route path="/admin" element={<Admin />} />
</Route>

// To:
<Route element={<ProtectedRoute />}>
  <Route path="/profile" element={<Profile />} />
</Route>
<Route element={<AdminRoute />}>
  <Route path="/admin" element={<Admin />} />
  <Route path="/admin/questions/:id" element={<QuestionDetail />} />
</Route>
```

### 2. Telemetry Capture (encounter_count, correct_count)

**Where it fires:** In `backend/src/routes/game.ts` at the `POST /answer` endpoint (line 169). After the answer is validated and scored, we know both `questionId` (the externalId) and whether the answer was correct.

**Schema change:**

```sql
ALTER TABLE civic_trivia.questions
  ADD COLUMN encounter_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE civic_trivia.questions
  ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;
```

Update `backend/src/db/schema.ts` to include:

```typescript
encounterCount: integer('encounter_count').notNull().default(0),
correctCount: integer('correct_count').notNull().default(0),
```

**Telemetry service** -- a thin wrapper for fire-and-forget counter increment:

```typescript
// backend/src/services/telemetryService.ts
import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Increment encounter and optionally correct counters for a question.
 * Fire-and-forget: errors are logged but never block the game flow.
 */
export async function recordQuestionOutcome(
  externalId: string,
  wasCorrect: boolean
): Promise<void> {
  try {
    if (wasCorrect) {
      await db.update(questions)
        .set({
          encounterCount: sql`${questions.encounterCount} + 1`,
          correctCount: sql`${questions.correctCount} + 1`,
        })
        .where(eq(questions.externalId, externalId));
    } else {
      await db.update(questions)
        .set({
          encounterCount: sql`${questions.encounterCount} + 1`,
        })
        .where(eq(questions.externalId, externalId));
    }
  } catch (error) {
    // Log but never throw -- telemetry must not break gameplay
    console.error(`Telemetry write failed for ${externalId}:`, error);
  }
}
```

**Integration in game route** (`backend/src/routes/game.ts`, inside `POST /answer` handler, after scoring):

```typescript
// After line ~205 (after correctAnswer is determined)
// Fire-and-forget telemetry -- do NOT await in the response path
const isCorrect = clientAnswer.basePoints > 0 ||
  (clientAnswer.wager !== undefined && clientAnswer.totalPoints > 0);
recordQuestionOutcome(questionId, isCorrect);  // no await

// Existing response unchanged
res.status(200).json({ ... });
```

**Key design decisions:**

- **Fire-and-forget:** The `recordQuestionOutcome` call is NOT awaited. Telemetry writes must never add latency to answer submission or block the game flow. If the DB write fails, it logs and the game continues.
- **Atomic increment:** Uses `SET encounter_count = encounter_count + 1` (not read-then-write) to handle concurrent game sessions correctly.
- **No batching needed:** At current scale (dozens of concurrent users, 10 questions per game), individual UPDATE statements are fine. Each UPDATE is ~1ms. If scale grows to thousands of concurrent sessions, batch writes using a queue.
- **externalId as key:** The game flow uses `externalId` (e.g., "q001") as the question identifier in sessions. The telemetry service matches on `externalId`, not the serial `id`.

### 3. Admin Question Explorer (Expanding the Existing Admin UI)

**Current admin UI scope:** The existing `Admin.tsx` page shows only expired/expiring questions with renew/archive actions. The existing `useAdminQuestions` hook calls `GET /api/admin/questions?status=` which only returns questions matching expiration-related filters.

**New scope:** A full question explorer that lets admins browse ALL questions with:
- Filter by collection, topic, difficulty, status
- View telemetry (encounter_count, correct_count, derived correct_rate)
- Click through to question detail view
- Edit question text, options, explanation

**New backend endpoints** (added to `backend/src/routes/admin.ts`):

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /api/admin/questions/all` | Browse all questions with filters | Paginated, replaces `/questions` for explorer view |
| `GET /api/admin/questions/:id` | Full question detail with telemetry | Returns all fields including counters |
| `PUT /api/admin/questions/:id` | Edit question fields | Text, options, explanation, difficulty |
| `GET /api/admin/collections` | List all collections (active + inactive) | With question counts |
| `PUT /api/admin/collections/:id` | Edit collection metadata | Name, description, isActive |
| `GET /api/admin/stats` | Dashboard summary stats | Total questions, avg correct rate, etc. |

**Why `/api/admin/questions/all` instead of modifying existing `/api/admin/questions`:** The existing endpoint is specifically designed for expiration management (the `status` param filters by expired/expiring-soon/archived). The explorer endpoint has different filter semantics (collection, topic, difficulty) and needs pagination. Keeping them separate preserves backward compatibility and keeps each endpoint focused.

**New frontend components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `QuestionExplorer` | `features/admin/components/QuestionExplorer.tsx` | Table view with filters, pagination, telemetry columns |
| `QuestionDetail` | `features/admin/components/QuestionDetail.tsx` | Full question view with edit form and telemetry chart |
| `CollectionManager` | `features/admin/components/CollectionManager.tsx` | Collection list with toggle active/inactive |
| `TelemetryBadge` | `features/admin/components/TelemetryBadge.tsx` | Reusable badge showing correct_rate with color coding |
| `AdminNav` | `features/admin/components/AdminNav.tsx` | Tab navigation between Content Review, Explorer, Collections |

**Admin page restructure** -- the existing `Admin.tsx` becomes a layout with tabs:

```
/admin              -- Admin hub with tab navigation
  ├─ Content Review  (existing functionality, now a tab)
  ├─ Question Explorer (new: browse all questions)
  └─ Collections     (new: manage collections)

/admin/questions/:id -- Question detail page (new route)
```

### 4. Quality Rules (Generation + Admin Review)

Quality rules are NOT a runtime system. They are applied at two points:

1. **Generation time:** Validation checks run in `backend/src/scripts/content-generation/` after AI generates questions. Rules like "minimum explanation length", "no duplicate options", "source URL required" are checked before INSERT.

2. **Admin review:** The admin UI surfaces telemetry-derived quality signals (e.g., a question with 95% correct rate may be too easy; a question with 5% correct rate may be broken). Admins can then edit, archive, or flag questions.

**No new runtime enforcement is needed.** Questions that pass generation validation and are inserted into the database are assumed valid for gameplay. The telemetry data informs post-hoc quality review.

**Quality signals displayed in admin UI:**

| Signal | Derivation | Threshold | Display |
|--------|-----------|-----------|---------|
| Correct rate | `correct_count / encounter_count` | < 15% = possibly broken, > 90% = possibly too easy | Color-coded badge |
| Encounter count | `encounter_count` | < 10 = insufficient data | Gray "needs data" badge |
| Staleness | `updatedAt` vs now | > 12 months = review suggested | Warning icon |

## Data Flow Changes

### Answer Submission (Modified)

```
Client: POST /api/game/answer { sessionId, questionId, selectedOption, timeRemaining }
  │
  ▼
routes/game.ts POST /answer handler:
  │
  ├─ sessionManager.submitAnswer()          -- UNCHANGED
  │     └─ Returns ServerAnswer
  │
  ├─ Gets correctAnswer from session        -- UNCHANGED
  │
  ├─ recordQuestionOutcome(questionId, isCorrect)   -- NEW (fire-and-forget)
  │     └─ UPDATE questions SET encounter_count = encounter_count + 1,
  │        correct_count = correct_count + (isCorrect ? 1 : 0)
  │        WHERE external_id = questionId
  │
  └─ Response: { basePoints, speedBonus, totalPoints, correct, correctAnswer }
                                             -- UNCHANGED
```

### Admin Question Browse (New)

```
Client: GET /api/admin/questions/all?collection=&topic=&difficulty=&page=1&limit=25
  │
  ▼
routes/admin.ts:
  ├─ authenticateToken   -- verify JWT
  ├─ requireAdmin        -- verify is_admin = true
  │
  ├─ Query: SELECT q.*, t.name as topic_name,
  │         ARRAY_AGG(c.name) as collection_names
  │         FROM questions q
  │         JOIN topics t ON q.topic_id = t.id
  │         LEFT JOIN collection_questions cq ON q.id = cq.question_id
  │         LEFT JOIN collections c ON cq.collection_id = c.id
  │         WHERE [filters]
  │         GROUP BY q.id, t.name
  │         ORDER BY q.created_at DESC
  │         LIMIT 25 OFFSET 0
  │
  └─ Response: {
       questions: [{ ...question, topicName, collectionNames,
                     encounterCount, correctCount, correctRate }],
       total: 347,
       page: 1,
       pageSize: 25
     }
```

## Patterns to Follow

### Pattern 1: Fire-and-Forget Telemetry

**What:** Telemetry writes are dispatched without `await` in the request handler. Errors are caught internally and logged.

**Why:** Answer submission latency must not increase. A failed counter increment should never cause a 500 error during gameplay. The telemetry data is statistical (approximate counts are fine) so occasional missed writes are acceptable.

**Example:** See `recordQuestionOutcome` above. The function returns a Promise but the caller does not await it.

### Pattern 2: Reuse Existing Auth + Add Role Layer

**What:** Admin auth builds on top of the existing JWT + `authenticateToken` middleware. A new `requireAdmin` middleware chains after `authenticateToken` and checks the `is_admin` column.

**Why:** Do not build a separate auth system. The existing JWT infrastructure works. Adding a boolean column and a middleware function is the minimal change. The admin flag is checked per-request (not cached in JWT) so revoking admin access takes effect immediately.

**Alternative considered and rejected:** Encoding `isAdmin` in the JWT payload. This would avoid a DB query per admin request but means revoking admin access requires token invalidation. Since admin requests are low-frequency (human clicking around an admin panel), the per-request DB check is negligible.

### Pattern 3: Expand Existing Admin Routes, Don't Create a Separate Router

**What:** New admin endpoints are added to the existing `backend/src/routes/admin.ts` file, mounted at `/api/admin`.

**Why:** The router already exists, already has auth middleware applied via `router.use()`. Adding endpoints to it is simpler than creating a new router. The file is currently ~230 lines -- adding explorer and collection management endpoints will grow it to ~400-500 lines, which is still manageable for a single admin domain.

**If it gets too large:** Split into `routes/admin/questions.ts` and `routes/admin/collections.ts` with a barrel `routes/admin/index.ts`. But do this only if the file exceeds ~600 lines.

### Pattern 4: Derived Metrics, Not Stored Metrics

**What:** `correct_rate` is computed as `correct_count / encounter_count` at query time, not stored as a column.

**Why:** Storing a derived value creates an update anomaly (must recompute every time either counter changes). The division is trivial for the database to compute. Use `CASE WHEN encounter_count > 0 THEN correct_count::float / encounter_count ELSE NULL END` in the SELECT.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Awaiting Telemetry in the Answer Path

**What:** `await recordQuestionOutcome(...)` inside the POST /answer handler before sending the response.

**Why bad:** Adds ~1-5ms DB round-trip to every answer submission. Over 10 questions per game, that is 10-50ms of added latency for purely analytical data. If the DB is slow or temporarily unreachable, answer submission would fail.

**Instead:** Call without `await`. Let the Promise resolve in the background.

### Anti-Pattern 2: Admin Role in JWT Claims

**What:** Adding `isAdmin: true` to the JWT payload at login time and checking it in middleware without a DB query.

**Why bad:** If admin access is revoked, the user retains admin privileges until their JWT expires (could be hours). For a security-sensitive feature like admin access, stale authorization is unacceptable.

**Instead:** Check `is_admin` from the database on each admin request. The overhead is one simple query per admin page load, which is negligible.

### Anti-Pattern 3: Building a Real-Time Quality Enforcement Engine

**What:** Creating a system that automatically disables questions when their correct_rate falls below a threshold.

**Why bad:** Premature automation. Correct rate thresholds are subjective and context-dependent (a 10% correct rate on a "hard" question might be intentional). Automated disabling could remove valid questions, and reverting requires admin intervention anyway.

**Instead:** Surface quality signals in the admin UI. Let humans decide. Automation can be added later when patterns are well-understood.

### Anti-Pattern 4: Separate Admin Frontend Application

**What:** Building the admin UI as a separate React app, deployed to a different URL.

**Why bad:** Doubles build infrastructure, deployment config, and shared code management. The admin UI shares the same auth system, API client, and design tokens. A separate app would need to duplicate or package all of these.

**Instead:** Admin UI lives as protected routes within the existing React app, under `/admin/*`. This is already the established pattern (the existing `Admin.tsx` page is at `/admin`).

## Build Order (Dependency Graph)

The following order respects dependencies and delivers testable increments.

### Step 1: Admin Authorization

**Depends on:** Nothing (foundational security gate)

**Files modified:**
- `users` table -- add `is_admin` column (SQL migration)
- `backend/src/models/User.ts` -- add `isAdmin` to all SELECT queries
- `backend/src/middleware/auth.ts` -- add `requireAdmin` function
- `backend/src/routes/admin.ts` -- add `router.use(requireAdmin)` after `authenticateToken`
- `backend/src/routes/auth.ts` -- include `isAdmin` in login/refresh response
- `frontend/src/types/auth.ts` -- add `isAdmin` to User interface
- `frontend/src/components/AdminRoute.tsx` -- new file
- `frontend/src/App.tsx` -- replace ProtectedRoute wrapper for /admin with AdminRoute

**Validates:** Only admin users can access admin features. Non-admin users get 403 on API and redirect on frontend.

### Step 2: Telemetry Schema + Capture

**Depends on:** Nothing (independent of admin auth, but naturally follows)

**Files modified:**
- `questions` table -- add `encounter_count`, `correct_count` columns (SQL migration)
- `backend/src/db/schema.ts` -- add columns to Drizzle schema
- `backend/src/services/telemetryService.ts` -- new file
- `backend/src/routes/game.ts` -- add fire-and-forget call in POST /answer handler

**Validates:** Playing a game increments counters. Verify with `SELECT external_id, encounter_count, correct_count FROM civic_trivia.questions WHERE encounter_count > 0`.

### Step 3: Admin Question Explorer API

**Depends on:** Step 1 (admin auth must be in place), Step 2 (telemetry columns must exist to query)

**Files modified:**
- `backend/src/routes/admin.ts` -- add `GET /questions/all`, `GET /questions/:id`, `PUT /questions/:id`

**Validates:** Admin can browse all questions with filters, see telemetry data, edit question fields.

### Step 4: Admin Question Explorer UI

**Depends on:** Step 3 (API endpoints must exist)

**Files created:**
- `frontend/src/features/admin/components/QuestionExplorer.tsx`
- `frontend/src/features/admin/components/QuestionDetail.tsx`
- `frontend/src/features/admin/components/TelemetryBadge.tsx`
- `frontend/src/features/admin/components/AdminNav.tsx`
- `frontend/src/features/admin/hooks/useQuestionDetail.ts`

**Files modified:**
- `frontend/src/pages/Admin.tsx` -- restructure as tabbed layout
- `frontend/src/features/admin/types.ts` -- expand types for explorer data
- `frontend/src/features/admin/hooks/useAdminQuestions.ts` -- add explorer query support
- `frontend/src/App.tsx` -- add `/admin/questions/:id` route

**Validates:** Admin can browse, filter, and inspect questions through the UI. Telemetry badges display correct rates.

### Step 5: Admin Collection Management

**Depends on:** Step 1 (admin auth)

**Files modified:**
- `backend/src/routes/admin.ts` -- add `GET /collections`, `PUT /collections/:id`

**Files created:**
- `frontend/src/features/admin/components/CollectionManager.tsx`
- `frontend/src/features/admin/hooks/useAdminCollections.ts`

**Validates:** Admin can view and toggle collection active/inactive status.

### Step 6: Quality Rules in Generation Scripts

**Depends on:** Step 2 (telemetry schema defines what to track), but can be built in parallel

**Files modified:**
- `backend/src/scripts/content-generation/generate-locale-questions.ts` -- add validation rules after generation
- New validation utility file for shared quality checks

**Validates:** Generated questions pass quality checks before insertion. Failed checks are logged with specific violation details.

### Dependency Diagram

```
Step 1: Admin Auth ───────────────────────┐
    │                                      │
    ├──────────────┐                       │
    ▼              ▼                       │
Step 3:        Step 5:                     │
Explorer API   Collection Mgmt            │
    │                                      │
    ▼                                      │
Step 4:                                    │
Explorer UI                                │
                                           │
Step 2: Telemetry ─────────────────────────┘
    │
    ▼
Step 6: Quality Rules (generation scripts)
```

Steps 1 and 2 are independent foundations. Steps 3 and 5 depend on Step 1. Step 4 depends on Step 3. Step 6 depends on Step 2 conceptually but can be built in parallel.

## File-Level Change Map

### Backend Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/db/schema.ts` | MODIFY | Add `encounterCount`, `correctCount` to questions table definition |
| `backend/src/models/User.ts` | MODIFY | Add `isAdmin` to all SELECT queries, add to User interface |
| `backend/src/middleware/auth.ts` | MODIFY | Add `requireAdmin` middleware function |
| `backend/src/routes/admin.ts` | MODIFY | Add `requireAdmin` to middleware chain; add explorer + collection endpoints |
| `backend/src/routes/auth.ts` | MODIFY | Include `isAdmin` in user object on login/refresh response |
| `backend/src/routes/game.ts` | MODIFY | Import and call `recordQuestionOutcome` in POST /answer |
| `backend/src/services/telemetryService.ts` | NEW | `recordQuestionOutcome(externalId, wasCorrect)` |

### Frontend Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/types/auth.ts` | MODIFY | Add `isAdmin: boolean` to User interface |
| `frontend/src/components/AdminRoute.tsx` | NEW | Route guard checking `user.isAdmin` |
| `frontend/src/App.tsx` | MODIFY | Use AdminRoute for /admin/* routes |
| `frontend/src/pages/Admin.tsx` | MODIFY | Restructure as tabbed admin hub |
| `frontend/src/features/admin/types.ts` | MODIFY | Add explorer types, telemetry fields |
| `frontend/src/features/admin/components/QuestionExplorer.tsx` | NEW | Question browse table with filters |
| `frontend/src/features/admin/components/QuestionDetail.tsx` | NEW | Full question view + edit form |
| `frontend/src/features/admin/components/CollectionManager.tsx` | NEW | Collection management table |
| `frontend/src/features/admin/components/TelemetryBadge.tsx` | NEW | Correct-rate display component |
| `frontend/src/features/admin/components/AdminNav.tsx` | NEW | Tab navigation within admin |
| `frontend/src/features/admin/hooks/useQuestionDetail.ts` | NEW | Fetch + edit single question |
| `frontend/src/features/admin/hooks/useAdminCollections.ts` | NEW | Fetch collections for admin |

### Database Migrations

| Migration | SQL |
|-----------|-----|
| Add telemetry columns | `ALTER TABLE civic_trivia.questions ADD COLUMN encounter_count INTEGER NOT NULL DEFAULT 0; ALTER TABLE civic_trivia.questions ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;` |
| Add admin flag | `ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;` |

## Scalability Considerations

| Concern | Current Scale | At 10x Scale | Notes |
|---------|--------------|--------------|-------|
| Telemetry writes | ~100 writes/day | ~1,000 writes/day | Single UPDATE per answer, negligible |
| Admin API queries | ~10 requests/day | ~100 requests/day | Paginated, indexed, no concern |
| Counter accuracy | Exact (atomic increment) | Exact | No batching needed until >10K concurrent |
| Admin auth check | 1 DB query per admin request | Same | Could cache for 60s if needed, but unnecessary |

## Sources

**HIGH Confidence:**
- Direct analysis of all source files in `C:/Project Test/backend/src/` and `C:/Project Test/frontend/src/`
- Existing admin route: `backend/src/routes/admin.ts` (232 lines)
- Existing admin page: `frontend/src/pages/Admin.tsx` (416 lines)
- Auth middleware: `backend/src/middleware/auth.ts` (100 lines)
- Game route with answer flow: `backend/src/routes/game.ts` (285 lines)
- Session service: `backend/src/services/sessionService.ts` (432 lines)
- DB schema: `backend/src/db/schema.ts` (123 lines)
- User model: `backend/src/models/User.ts` (168 lines)
- Frontend routing: `frontend/src/App.tsx` (46 lines)
- Auth store: `frontend/src/store/authStore.ts` (45 lines)
- Auth types: `frontend/src/types/auth.ts` (33 lines)
- Protected route: `frontend/src/components/ProtectedRoute.tsx` (17 lines)
