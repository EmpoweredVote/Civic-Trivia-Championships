# Architecture Research: v1.2 Community Question Collections

**Focus:** Integrating tag-based collections, collection picker, and question expiration into the existing Civic Trivia architecture
**Researched:** 2026-02-18
**Confidence:** HIGH (based on direct codebase analysis; no external library research needed)

## Executive Summary

The current architecture loads all 120 questions from a single JSON file (`backend/src/data/questions.json`) at server startup, holds them in module-scope memory, and randomly selects 10 per game. Adding community collections requires three fundamental changes: (1) questions must move from JSON to PostgreSQL to support tagging, expiration, and dynamic querying; (2) the game start flow must accept a `collectionId` parameter that filters question selection; (3) a background process must check for expired questions. The existing session management (Redis), scoring, and plausibility systems require zero changes -- the collection choice only affects which questions enter a session.

**Recommendation:** Migrate questions to PostgreSQL (Supabase, already in use), introduce a `collections` table and `question_tags` junction table, and modify the `POST /api/game/session` endpoint to accept an optional `collectionId`. The JSON file becomes a seed/migration source. This is a clean extension of the existing architecture with no rewrites required.

## Current Question Architecture

### How Questions Flow Today

```
Startup (one-time):
  questions.json ──readFileSync──> allQuestions[] (module scope in game.ts)

Game Start (per request):
  POST /api/game/session
    │
    ├─ If questionIds provided: lookup each in allQuestions[]
    ├─ Else: shuffle(allQuestions).slice(0, 10)
    │
    ├─ sessionManager.createSession(userId, selectedQuestions)
    │   └─ Stores full Question objects in Redis session
    │
    └─ Response: { sessionId, questions (stripped of correctAnswer) }

During Game:
  POST /api/game/answer
    └─ Reads question from session.questions[] (Redis)
        └─ No further access to allQuestions[]

Results:
  GET /api/game/results/:sessionId
    └─ Reads from session.answers[] (Redis)
        └─ No further access to allQuestions[]
```

**Key insight:** Once a session is created, questions are self-contained in the Redis session. Only the session creation step needs to know about collections.

### Current Question Shape

```typescript
interface Question {
  id: string;              // "q001"
  text: string;
  options: string[];       // Always 4
  correctAnswer: number;   // 0-3
  explanation: string;
  difficulty: string;      // "easy" | "medium" | "hard"
  topic: string;           // "Constitution", "Supreme Court", etc.
  topicCategory: string;   // "bill-of-rights", "judiciary", etc.
  learningContent?: {      // AI-generated educational content
    topic: string;
    paragraphs: string[];
    corrections: Record<string, string>;
    source: { name: string; url: string };
  };
}
```

### Current Question Distribution

| Topic Category | Count | Difficulty Spread |
|---------------|-------|-------------------|
| judiciary | 33 | Mixed |
| federalism | 26 | Mixed |
| congress | 17 | Mixed |
| amendments | 15 | Mixed |
| executive | 12 | Mixed |
| bill-of-rights | 7 | Mixed |
| elections | 4 | Mixed |
| civic-participation | 3 | Mixed |
| voting | 3 | Mixed |
| **Total** | **120** | 35 easy, 40 medium, 45 hard |

## JSON-to-Database Migration Decision

### Recommendation: Move Questions to PostgreSQL

**Verdict:** YES -- migrate questions from JSON to the existing Supabase PostgreSQL database.

**Rationale:**

| Concern | JSON File | PostgreSQL |
|---------|-----------|------------|
| Tag-based filtering | Requires loading all questions, filtering in-memory | SQL WHERE with JOIN on tags -- efficient, scalable |
| Question expiration | Requires manual timestamp checks on every request | SQL WHERE `expires_at IS NULL OR expires_at > NOW()` |
| Adding new questions | Requires redeployment (JSON is baked into build) | INSERT via admin API or migration script -- no deploy needed |
| Collection queries | Load all, filter in JS | Index-backed queries, fast at any scale |
| Content generation workflow | Generate JSON, merge, commit, deploy | Generate, INSERT, available immediately |
| Current question count | 120 -- trivial either way | Scales to thousands without code changes |
| Rollback risk | Zero -- keep JSON as seed file | Low -- seed from JSON if needed |

**What stays the same:**
- The JSON file remains as a seed/migration source
- The `generateLearningContent.ts` and `applyContent.ts` scripts can be adapted to write to DB instead of JSON
- Question shape is identical in the database (same fields, same types)
- Redis sessions still store full Question objects (no change to session logic)

**What NOT to do:**
- Do NOT use a hybrid approach (some questions in JSON, some in DB) -- this creates query complexity and cache invalidation problems
- Do NOT load all questions into memory at startup from DB -- use per-request queries with proper indexing

## Target Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend                                                         │
│                                                                  │
│  Dashboard ──> CollectionPicker ──> GameScreen (unchanged)       │
│       │              │                                           │
│       │              └─ GET /api/collections                     │
│       │                                                          │
│       └─ POST /api/game/session { collectionId? }                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend                                                          │
│                                                                  │
│  game.ts routes (modified)                                       │
│    ├─ POST /session: accepts collectionId, queries QuestionService│
│    ├─ POST /answer: UNCHANGED                                    │
│    └─ GET /results: UNCHANGED                                    │
│                                                                  │
│  NEW: collection.ts routes                                       │
│    ├─ GET /api/collections: list available collections           │
│    └─ GET /api/collections/:id: collection detail + question count│
│                                                                  │
│  NEW: QuestionService                                            │
│    ├─ getRandomQuestions(collectionId?, count): Question[]        │
│    ├─ getQuestionsByIds(ids): Question[]                         │
│    └─ (replaces in-memory allQuestions[] array)                  │
│                                                                  │
│  NEW: CollectionService                                          │
│    ├─ listCollections(): Collection[]                            │
│    └─ getCollection(id): Collection                              │
│                                                                  │
│  NEW: ExpirationService                                          │
│    └─ checkExpiredQuestions(): runs on interval or cron           │
│                                                                  │
│  SessionManager: UNCHANGED                                       │
│  ScoreService: UNCHANGED                                         │
│  ProgressionService: UNCHANGED                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase)                                            │
│  civic_trivia schema                                             │
│                                                                  │
│  EXISTING: users                                                 │
│  NEW: questions                                                  │
│  NEW: collections                                                │
│  NEW: question_tags (junction table)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Questions table (migrated from JSON)
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(20) PRIMARY KEY,           -- "q001", matches existing IDs
  text TEXT NOT NULL,
  options JSONB NOT NULL,               -- ["option1", "option2", "option3", "option4"]
  correct_answer SMALLINT NOT NULL,     -- 0-3
  explanation TEXT NOT NULL,
  difficulty VARCHAR(10) NOT NULL,      -- "easy", "medium", "hard"
  topic VARCHAR(100) NOT NULL,          -- "Constitution", "Supreme Court"
  topic_category VARCHAR(50) NOT NULL,  -- "bill-of-rights", "judiciary"
  learning_content JSONB,              -- Full learningContent object (nullable)
  expires_at TIMESTAMPTZ,              -- NULL = never expires
  is_active BOOLEAN DEFAULT TRUE,      -- Soft delete / manual disable
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT valid_correct_answer CHECK (correct_answer BETWEEN 0 AND 3),
  CONSTRAINT options_has_four CHECK (jsonb_array_length(options) = 4)
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id VARCHAR(50) PRIMARY KEY,           -- "general", "springfield-il", "dc-metro"
  name VARCHAR(200) NOT NULL,           -- "Springfield, IL"
  description TEXT,
  locale VARCHAR(100),                  -- Geographic locale if community-specific
  is_default BOOLEAN DEFAULT FALSE,     -- The "General Civics" collection
  is_active BOOLEAN DEFAULT TRUE,
  min_questions SMALLINT DEFAULT 10,    -- Minimum viable questions for a game
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: questions can belong to multiple collections
CREATE TABLE IF NOT EXISTS question_tags (
  question_id VARCHAR(20) NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  collection_id VARCHAR(50) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (question_id, collection_id)
);

-- Indexes for the queries we will run
CREATE INDEX idx_questions_active_unexpired
  ON questions (is_active)
  WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW());

CREATE INDEX idx_question_tags_collection
  ON question_tags (collection_id);

CREATE INDEX idx_question_tags_question
  ON question_tags (question_id);

CREATE INDEX idx_collections_active
  ON collections (is_active) WHERE is_active = TRUE;

-- Trigger for updated_at on questions
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Design decisions:**

1. **String IDs for collections** (`VARCHAR(50)`) rather than `SERIAL` -- allows meaningful slugs like `"springfield-il"` that are URL-friendly and human-readable. Collections are few and rarely created, so auto-increment adds no value.

2. **String IDs for questions** (`VARCHAR(20)`) -- matches existing `"q001"` format from JSON, ensures backward compatibility during migration.

3. **`options` as JSONB** -- the options array is always read as a whole and never queried individually. JSONB is simpler than a separate `question_options` table and matches the existing data shape.

4. **`learning_content` as JSONB** -- complex nested structure with paragraphs, corrections, and source. No need to normalize this; it is always read/written as a unit.

5. **`is_active` flag** -- soft delete for questions and collections. Allows disabling without data loss. The expiration service sets `is_active = false` when `expires_at` passes.

6. **`min_questions` on collections** -- prevents starting a game with a collection that has fewer than 10 valid questions. The API can return this count to the frontend for UI decisions.

### Key Query: Select 10 Random Questions for a Collection

```sql
-- Get 10 random active, non-expired questions from a specific collection
SELECT q.*
FROM questions q
JOIN question_tags qt ON q.id = qt.question_id
WHERE qt.collection_id = $1
  AND q.is_active = TRUE
  AND (q.expires_at IS NULL OR q.expires_at > NOW())
ORDER BY RANDOM()
LIMIT 10;
```

**For "Quick Play" (no collection selected):**

```sql
-- Default: pull from the default collection, or all active questions
SELECT q.*
FROM questions q
JOIN question_tags qt ON q.id = qt.question_id
JOIN collections c ON qt.collection_id = c.id
WHERE c.is_default = TRUE
  AND q.is_active = TRUE
  AND (q.expires_at IS NULL OR q.expires_at > NOW())
ORDER BY RANDOM()
LIMIT 10;
```

**Performance note:** `ORDER BY RANDOM()` is fine for tables under 10,000 rows. At 120-500 questions per collection, this is a non-issue. If collections grow to thousands, switch to `TABLESAMPLE` or a materialized sampling approach.

## Data Flow Changes

### Before (v1.1): Game Start

```
Client: POST /api/game/session {}
  │
  ▼
game.ts:
  shuffle(allQuestions)     ← Module-scope array loaded at startup
  .slice(0, 10)
  │
  ▼
sessionManager.createSession(userId, selectedQuestions)
  │
  ▼
Redis: SET session:{id} { questions: [...], answers: [], ... }
  │
  ▼
Response: { sessionId, questions (sans correctAnswer) }
```

### After (v1.2): Game Start

```
Client: POST /api/game/session { collectionId?: "springfield-il" }
  │
  ▼
game.ts:
  const questions = await questionService.getRandomQuestions(
    collectionId || null,   ← null means default collection
    10
  );
  │
  ▼
questionService (NEW):
  SQL query against questions + question_tags tables
  Returns Question[] with same shape as before
  │
  ▼
sessionManager.createSession(userId, selectedQuestions)  ← UNCHANGED
  │
  ▼
Redis: SET session:{id} { questions: [...], answers: [], ... }  ← UNCHANGED
  │
  ▼
Response: { sessionId, questions (sans correctAnswer), collectionId }
```

**Critical point:** Everything downstream of question selection is unchanged. The session stores full Question objects. The answer submission, scoring, plausibility detection, and results aggregation never need to know about collections.

### New Flow: Collection Listing

```
Client: GET /api/collections
  │
  ▼
collection.ts route (NEW):
  collectionService.listCollections()
  │
  ▼
SQL:
  SELECT c.*, COUNT(q.id) as question_count
  FROM collections c
  LEFT JOIN question_tags qt ON c.id = qt.collection_id
  LEFT JOIN questions q ON qt.question_id = q.id
    AND q.is_active = TRUE
    AND (q.expires_at IS NULL OR q.expires_at > NOW())
  WHERE c.is_active = TRUE
  GROUP BY c.id
  │
  ▼
Response: [
  { id: "general", name: "General Civics", questionCount: 120, isDefault: true },
  { id: "springfield-il", name: "Springfield, IL", questionCount: 52, isDefault: false },
  ...
]
```

### New Flow: Question Expiration

```
On interval (every hour) or cron:
  expirationService.checkExpiredQuestions()
  │
  ▼
SQL:
  UPDATE questions
  SET is_active = FALSE, updated_at = NOW()
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = TRUE
  RETURNING id, text, expires_at;
  │
  ▼
  Log expired questions for review
  (Future: notify admin via webhook/email)
  │
  ▼
  Check collections that now have < min_questions active
  (Future: alert to generate replacement content)
```

## Integration Points: Existing Components

### Modified Components

| Component | File | Change | Impact |
|-----------|------|--------|--------|
| Game routes | `backend/src/routes/game.ts` | Remove `allQuestions[]` module-scope load; use `QuestionService` instead | HIGH -- core question loading changes |
| Game session creation | `backend/src/routes/game.ts` | Accept `collectionId` in POST /session body | LOW -- one parameter addition |
| Question type | `backend/src/services/sessionService.ts` | No change to `Question` interface | NONE |
| Frontend game service | `frontend/src/services/gameService.ts` | `createGameSession(collectionId?)` | LOW -- one parameter addition |
| Frontend useGameState | `frontend/src/features/game/hooks/useGameState.ts` | Pass `collectionId` to `createGameSession` | LOW |
| Frontend Dashboard | `frontend/src/pages/Dashboard.tsx` | Add collection picker before "Quick Play" | MEDIUM -- new UI element |
| Frontend game types | `frontend/src/types/game.ts` | Add `Collection` type | LOW |
| Content generation script | `backend/src/scripts/generateLearningContent.ts` | Read from DB instead of JSON | MEDIUM |
| Content apply script | `backend/src/scripts/applyContent.ts` | Write to DB instead of JSON | MEDIUM |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `SessionManager` | Sessions already store full Question objects; no awareness of collections needed |
| `ScoreService` | Scoring is per-answer, independent of collection |
| `ProgressionService` | XP/gem awards are per-game, independent of collection |
| `Plausibility detection` | Per-answer timing analysis, independent of collection |
| `Redis storage` | Session shape is unchanged; same TTL, same serialization |
| `Auth middleware` | Authentication is orthogonal to collections |
| `GameScreen`, `QuestionCard`, `AnswerGrid` | These render questions from session state; source is irrelevant |
| `ResultsScreen` | Displays answers from session; no collection awareness needed |
| `WagerScreen` | Wager logic operates on session score, independent of collection |

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| QuestionService | `backend/src/services/questionService.ts` | Query questions from PostgreSQL with collection/expiration filtering |
| CollectionService | `backend/src/services/collectionService.ts` | CRUD operations for collections |
| Collection routes | `backend/src/routes/collections.ts` | REST API for collection listing/detail |
| ExpirationService | `backend/src/services/expirationService.ts` | Background job to deactivate expired questions |
| Seed migration script | `backend/src/scripts/seedQuestions.ts` | One-time migration from JSON to PostgreSQL |
| CollectionPicker | `frontend/src/features/game/components/CollectionPicker.tsx` | UI for selecting a collection before game start |
| Collection store or hook | `frontend/src/store/collectionStore.ts` or hook | State management for available collections |

## Architecture Patterns

### Pattern 1: Service Layer for Question Access

**What:** All question access goes through `QuestionService`, never direct DB queries in routes.

**Why:** The current architecture has question loading directly in `game.ts` (`readFileSync` at module scope). This was fine for JSON but is not appropriate for database access. A service layer provides:
- Single point of change for query logic
- Testability (mock the service, not the DB)
- Future caching layer insertion point

```typescript
// backend/src/services/questionService.ts
export class QuestionService {
  constructor(private pool: Pool) {}

  async getRandomQuestions(collectionId: string | null, count: number): Promise<Question[]> {
    if (collectionId) {
      // Query with collection filter
      const result = await this.pool.query(
        `SELECT q.* FROM questions q
         JOIN question_tags qt ON q.id = qt.question_id
         WHERE qt.collection_id = $1
           AND q.is_active = TRUE
           AND (q.expires_at IS NULL OR q.expires_at > NOW())
         ORDER BY RANDOM() LIMIT $2`,
        [collectionId, count]
      );
      return result.rows.map(this.mapRowToQuestion);
    } else {
      // Default collection
      const result = await this.pool.query(
        `SELECT q.* FROM questions q
         JOIN question_tags qt ON q.id = qt.question_id
         JOIN collections c ON qt.collection_id = c.id
         WHERE c.is_default = TRUE
           AND q.is_active = TRUE
           AND (q.expires_at IS NULL OR q.expires_at > NOW())
         ORDER BY RANDOM() LIMIT $1`,
        [count]
      );
      return result.rows.map(this.mapRowToQuestion);
    }
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    const result = await this.pool.query(
      `SELECT * FROM questions WHERE id = ANY($1) AND is_active = TRUE`,
      [ids]
    );
    return result.rows.map(this.mapRowToQuestion);
  }

  private mapRowToQuestion(row: any): Question {
    return {
      id: row.id,
      text: row.text,
      options: row.options,              // JSONB auto-parsed by pg driver
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      topic: row.topic,
      topicCategory: row.topic_category,
      learningContent: row.learning_content || undefined,
    };
  }
}
```

### Pattern 2: Optional Parameter for Backward Compatibility

**What:** `collectionId` is optional in POST /session. Omitting it uses the default collection.

**Why:** Existing clients (and the current "Quick Play" button) continue to work without changes. The collection picker is additive UI, not a required step.

```typescript
// Modified game.ts POST /session handler
router.post('/session', optionalAuth, async (req: Request, res: Response) => {
  const { questionIds, collectionId } = req.body;  // collectionId is NEW, optional

  let selectedQuestions: Question[];

  if (questionIds && Array.isArray(questionIds)) {
    // Explicit question IDs (existing behavior, kept for testing/admin)
    selectedQuestions = await questionService.getQuestionsByIds(questionIds);
  } else {
    // Random selection from collection (or default)
    selectedQuestions = await questionService.getRandomQuestions(
      collectionId || null,
      10
    );
  }

  if (selectedQuestions.length < 10) {
    return res.status(400).json({
      error: `Not enough questions available${collectionId ? ` in collection "${collectionId}"` : ''}. Need 10, found ${selectedQuestions.length}.`
    });
  }

  // Everything below is UNCHANGED
  const userId = req.user?.userId ?? 'anonymous';
  const sessionId = await sessionManager.createSession(userId, selectedQuestions);

  res.status(201).json({
    sessionId,
    questions: stripAnswers(selectedQuestions),
    degraded: storageFactory.isDegradedMode()
  });
});
```

### Pattern 3: Seed Migration with Idempotent Script

**What:** A one-time script migrates all 120 questions from JSON to PostgreSQL, tags them with the "general" default collection.

**Why:** Clean cutover from JSON to DB. The script is idempotent (uses INSERT ON CONFLICT DO NOTHING) so it can be re-run safely.

```typescript
// backend/src/scripts/seedQuestions.ts (sketch)
async function seed() {
  // 1. Create default collection
  await pool.query(`
    INSERT INTO collections (id, name, description, is_default)
    VALUES ('general', 'General Civics', 'Core U.S. civics questions', TRUE)
    ON CONFLICT (id) DO NOTHING
  `);

  // 2. Read JSON
  const questions = JSON.parse(readFileSync('src/data/questions.json', 'utf-8'));

  // 3. Insert each question
  for (const q of questions) {
    await pool.query(`
      INSERT INTO questions (id, text, options, correct_answer, explanation,
                            difficulty, topic, topic_category, learning_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [q.id, q.text, JSON.stringify(q.options), q.correctAnswer,
        q.explanation, q.difficulty, q.topic, q.topicCategory,
        q.learningContent ? JSON.stringify(q.learningContent) : null]);

    // 4. Tag with default collection
    await pool.query(`
      INSERT INTO question_tags (question_id, collection_id)
      VALUES ($1, 'general')
      ON CONFLICT DO NOTHING
    `, [q.id]);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Caching Questions in Memory After DB Migration

**What:** Loading all questions from DB into a module-scope array at startup (replicating the current JSON pattern).

**Why bad:** Defeats the purpose of the migration. Cache invalidation becomes a problem when questions are added, expired, or tagged. The database query per game-start is fast enough (~5-15ms for 10 random rows from a few hundred).

**Instead:** Query the database per request via `QuestionService`. If performance becomes an issue later (unlikely at <10K questions), add a short TTL cache (e.g., 60s) at the service layer.

### Anti-Pattern 2: Storing Collection ID in Redis Session

**What:** Adding `collectionId` to the `GameSession` object stored in Redis.

**Why bad:** Once questions are selected, the collection is irrelevant. Storing it adds data to every session for no operational purpose. The session already contains the actual Question objects.

**Instead:** The collection ID is a query-time filter, not a session attribute. If you need it for analytics, log it at session creation time, do not store it in the session.

**Exception:** If results screen needs to display "You played: Springfield, IL", store just the collection name (not ID) as a display string in the session. This is a presentation concern, not a data model concern.

### Anti-Pattern 3: Duplicating Questions Across Collections

**What:** Copying question rows when adding to a new collection.

**Why bad:** Data duplication leads to inconsistency (edit one copy, forget another). The tag-based junction table explicitly avoids this.

**Instead:** One question row, many junction table rows. A question about the U.S. Constitution can be in "General Civics", "Springfield, IL", and "DC Metro" simultaneously via three `question_tags` rows.

### Anti-Pattern 4: Complex Expiration with Soft States

**What:** Having multiple expiration states (warning, expired, archived) with different query behaviors.

**Why bad:** Overengineering for the current scale. Two states are sufficient: active and inactive.

**Instead:** Binary: `is_active = TRUE` or `is_active = FALSE`. The expiration service flips the flag. A human reviews and either deletes or updates the question. Keep it simple.

## Build Order (Dependency Graph)

The following build order respects dependencies -- each step requires only previously completed steps.

### Step 1: Database Schema + Seed Migration

**Depends on:** Nothing (foundational)

**Tasks:**
1. Create `questions`, `collections`, `question_tags` tables in Supabase
2. Write and run `seedQuestions.ts` to migrate 120 questions from JSON
3. Create "General Civics" default collection
4. Tag all 120 questions with "general"
5. Verify data integrity: `SELECT COUNT(*) FROM questions` = 120

**Validates:** Schema design, JSON-to-DB mapping, no data loss

### Step 2: QuestionService + Route Integration

**Depends on:** Step 1 (database must be populated)

**Tasks:**
1. Create `QuestionService` with `getRandomQuestions()` and `getQuestionsByIds()`
2. Modify `POST /api/game/session` to use `QuestionService` instead of `allQuestions[]`
3. Remove `readFileSync` and module-scope `allQuestions` from `game.ts`
4. Keep `collectionId` parameter optional (null = default collection)
5. Verify existing "Quick Play" flow works unchanged

**Validates:** DB-backed question selection works; no regression in game flow

### Step 3: Collection API + Frontend Picker

**Depends on:** Step 2 (questions queryable by collection)

**Tasks:**
1. Create `CollectionService` and `GET /api/collections` route
2. Create `CollectionPicker` component on frontend
3. Modify `Dashboard` to show collection picker
4. Wire `collectionId` through `createGameSession()` to `POST /session`
5. "Quick Play" continues to work (uses default collection)

**Validates:** End-to-end collection selection flow

### Step 4: Question Expiration

**Depends on:** Step 2 (questions in database with `expires_at` column)

**Tasks:**
1. Create `ExpirationService` with periodic check
2. Run on server startup interval (e.g., every hour)
3. Log expired questions; set `is_active = FALSE`
4. Check for collections that drop below `min_questions`
5. Add `expires_at` to seed script for any time-sensitive existing questions

**Validates:** Expired questions no longer appear in games

### Step 5: Content Generation Workflow Update

**Depends on:** Step 2 (questions in database)

**Tasks:**
1. Modify `generateLearningContent.ts` to read from DB instead of JSON
2. Modify `applyContent.ts` to write to DB instead of JSON
3. Add support for generating community-specific questions (new prompt templates)
4. Add ability to tag generated questions with a collection

**Validates:** AI content pipeline works with database backend

### Dependency Diagram

```
Step 1: Schema + Seed
    │
    ▼
Step 2: QuestionService + Route ──────────┐
    │                                      │
    ├──────────────┐                       │
    ▼              ▼                       ▼
Step 3:        Step 4:                 Step 5:
Collection     Expiration             Content Gen
Picker         Service                Workflow
```

Steps 3, 4, and 5 are independent of each other and can be built in parallel after Step 2.

## Frontend Integration Detail

### Collection Picker Placement

The collection picker sits on the Dashboard, above the "Quick Play" button. It does NOT alter the game flow itself -- it simply determines which `collectionId` is passed when starting a game.

```
Dashboard Layout (v1.2):
┌────────────────────────────────┐
│  Welcome, [Name]!              │
│                                │
│  ┌──────────────────────────┐  │
│  │  Choose Your Collection  │  │
│  │                          │  │
│  │  [General Civics] (120)  │  │  ← Default selected
│  │  [Springfield, IL] (52)  │  │
│  │  [DC Metro] (87)         │  │
│  └──────────────────────────┘  │
│                                │
│     [ Quick Play ]             │  ← Uses selected collection
│     10 questions.              │
│                                │
└────────────────────────────────┘
```

### State Management

Two approaches, both valid:

**Option A: Local state in Dashboard (recommended for simplicity)**
```typescript
// Dashboard.tsx
const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

// Pass to game start
const handlePlay = () => {
  navigate('/play', { state: { collectionId: selectedCollection } });
};
```

**Option B: Zustand store (if collection selection persists across navigation)**
```typescript
// store/collectionStore.ts
export const useCollectionStore = create<CollectionState>((set) => ({
  selectedCollectionId: null,
  setSelectedCollection: (id: string | null) => set({ selectedCollectionId: id }),
}));
```

**Recommendation:** Start with Option A. A Zustand store is only needed if the selected collection must survive navigation away from Dashboard (e.g., returning from settings). For MVP, local state is sufficient.

### Frontend Service Changes

```typescript
// gameService.ts (modified)
export async function createGameSession(
  collectionId?: string   // NEW optional parameter
): Promise<{ sessionId: string; questions: Question[]; degraded: boolean }> {
  const body = collectionId ? { collectionId } : {};

  const response = await apiRequest<{ sessionId: string; questions: Question[]; degraded?: boolean }>(
    '/api/game/session',
    {
      method: 'POST',
      body: JSON.stringify(body),  // Was: no body
    }
  );

  return {
    sessionId: response.sessionId,
    questions: response.questions,
    degraded: response.degraded ?? false,
  };
}
```

### useGameState Changes

```typescript
// useGameState.ts (modified)
export function useGameState(collectionId?: string): UseGameStateReturn {
  // ...existing code...

  const startGame = async () => {
    try {
      const { sessionId, questions, degraded } = await createGameSession(collectionId);
      // ...rest unchanged
    } catch (error) {
      console.error('Failed to create game session:', error);
    }
  };

  // ...rest unchanged
}
```

## Scalability Considerations

| Concern | At 5 collections | At 50 collections | At 500 collections |
|---------|-------------------|--------------------|--------------------|
| Collection listing | Single query, <5ms | Single query, <10ms | Paginate, still fast |
| Question selection | 10 random from ~100, <10ms | Same per collection | Same per collection |
| Schema size | ~120 questions, trivial | ~3,000 questions | ~30,000 questions -- still fine for PostgreSQL |
| Expiration check | Scan ~120 rows/hour | Scan ~3,000 rows/hour | Add index on `expires_at`, still fast |
| Junction table | ~120 rows | ~5,000 rows | ~50,000 rows -- well within PG comfort zone |

**Bottom line:** PostgreSQL handles this scale without any caching, sharding, or optimization. The architecture is designed for simplicity at the current scale (hundreds of questions, dozens of collections) with a clear path to scaling if needed.

## Open Questions

1. **Should the session store the collection name for the results screen?** If so, add `collectionName: string` to the `GameSession` interface and `POST /session` response. This is purely a display concern.

2. **Should collections be ordered?** The schema has no `sort_order` column. If collections should appear in a specific order in the picker, add `sort_order SMALLINT DEFAULT 0` to the `collections` table.

3. **Should anonymous users see all collections?** The current auth model allows anonymous play. Collection access control (e.g., premium collections) is out of scope for v1.2 but the schema supports it with an additional `access_level` column.

4. **Batch INSERT for seed migration?** The seed script shown above inserts one-at-a-time for clarity. For 120 questions this is fine (~2 seconds). For larger imports, use a batch INSERT with `unnest()`.

## Sources

**HIGH Confidence:**
- Direct codebase analysis of all source files listed in this document
- Existing database schema from `backend/schema.sql`
- Current question data from `backend/src/data/questions.json` (120 questions analyzed)
- PostgreSQL documentation for `ORDER BY RANDOM()`, JSONB, partial indexes

**MEDIUM Confidence:**
- `ORDER BY RANDOM()` performance characteristics at scale (well-documented PostgreSQL behavior, verified for tables <100K rows)
