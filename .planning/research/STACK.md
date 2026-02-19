# Stack Research: v1.3 Admin UI, Telemetry, and Quality Tooling

**Domain:** Civic Trivia Championship -- admin tooling for content quality at scale
**Researched:** 2026-02-19
**Confidence:** HIGH (existing stack verified, new additions are minimal and well-scoped)

## Executive Summary

v1.3 adds four capabilities to an existing deployed trivia game: (1) an expanded admin UI for exploring all questions/collections, (2) question telemetry tracking (encounter and correct-answer counts), (3) a codified quality rules engine, and (4) a refined AI generation pipeline that uses quality rules. The critical insight: **almost nothing new needs to be installed.** The existing stack (React 18, TypeScript, Tailwind, Headless UI, Express, Drizzle ORM, PostgreSQL, Zod) handles all four requirements. The one recommended addition is `@tanstack/react-table` for the admin data tables, which replaces the hand-rolled table markup currently in `Admin.tsx` with a headless, sortable, filterable table engine that integrates naturally with Tailwind.

**One new frontend dependency. Zero new backend dependencies.**

## Current State Assessment

### What Already Exists

The codebase already has admin infrastructure from v1.2:

| Component | Location | Current Capability |
|---|---|---|
| Admin page | `frontend/src/pages/Admin.tsx` | Table of expired/expiring questions with renew/archive actions |
| Admin route | `frontend/src/App.tsx` line 37 | Protected route at `/admin` behind `ProtectedRoute` |
| Admin API | `backend/src/routes/admin.ts` | GET questions (with status filters), POST renew, POST archive |
| Admin hook | `frontend/src/features/admin/hooks/useAdminQuestions.ts` | Fetch/filter/action hook using Zustand auth store |
| Admin types | `frontend/src/features/admin/types.ts` | `AdminQuestion` interface, `StatusFilter` type |
| DB schema | `backend/src/db/schema.ts` | Full Drizzle schema: questions, collections, topics, junction tables |
| Question model | `backend/src/db/schema.ts` lines 54-92 | `questions` table with status, expiresAt, expirationHistory, JSONB fields |
| Drizzle ORM | `drizzle-orm@0.45.1` + `drizzle-kit@0.31.9` | Type-safe queries, migrations, schema management |
| Zod validation | `zod@4.3.6` | Backend validation (already installed) |
| Headless UI | `@headlessui/react@2.2.9` | Accessible dropdowns, listboxes, dialogs |
| AI generation | `backend/src/scripts/generateLearningContent.ts` | Claude-powered content generation with structured JSON output |

### What Does NOT Exist Yet

| Need | Current Gap |
|---|---|
| Browse ALL questions (not just expired) | Admin API only returns expired/expiring-soon/archived |
| Search/filter by text, topic, collection, difficulty | No search or multi-filter support |
| Sortable columns | Table is static HTML, no sort |
| Pagination | No pagination (loads all matching questions) |
| Telemetry columns | No encounter_count or correct_count on questions table |
| Telemetry recording | Answer submission does not increment counters |
| Quality score computation | No quality rules or scoring logic |
| Quality-gated generation | Generation script has no quality validation |

## Recommended Stack Additions

### Frontend: One New Dependency

| Package | Version | Purpose | Why This, Not Alternatives |
|---|---|---|---|
| `@tanstack/react-table` | `^8.21.3` | Headless table engine for admin data tables | See detailed rationale below |

#### Why @tanstack/react-table

The current `Admin.tsx` is 416 lines of hand-rolled table markup with inline status badges, date formatting, and action buttons. Adding sorting, multi-column filtering, pagination, and text search to this approach would balloon it to 800+ lines of tightly coupled UI logic.

TanStack Table v8 is headless -- it provides table state management (sorting, filtering, pagination, column visibility) without any UI. You render with Tailwind exactly as the existing admin page does. It does not impose a design system or CSS framework.

**Why not alternatives:**

| Alternative | Why Not |
|---|---|
| Hand-rolled sorting/filtering | Quadruples component complexity. Each sortable column needs state, comparators, icons. Pagination needs offset/limit state. This is exactly what TanStack Table abstracts. |
| AG Grid / MUI DataGrid | Full component libraries with their own CSS. Conflict with existing Tailwind-only approach. AG Grid is 200KB+. |
| Shadcn/ui Table | Shadcn uses Radix UI primitives. Project uses Headless UI. Mixing two headless UI systems creates inconsistency. Shadcn's table component is itself built on TanStack Table anyway. |
| react-data-table-component | Opinionated styling, not headless. Would fight Tailwind. |

**Integration with existing patterns:**

```typescript
// TanStack Table works with existing Tailwind patterns
const table = useReactTable({
  data: questions,          // From existing useAdminQuestions hook
  columns: columnDefs,      // Type-safe column definitions
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});

// Render with existing Tailwind classes -- same <table> markup pattern as current Admin.tsx
```

**Bundle size:** ~53KB minified, ~14KB gzipped. Acceptable for an admin-only route that is code-split via React Router lazy loading.

**Confidence:** HIGH -- TanStack Table is the standard headless table for React. 8.21.3 is current stable. Works with React 18.

### Backend: Zero New Dependencies

Every backend need is covered by existing packages:

| Need | Existing Package | How |
|---|---|---|
| New admin API endpoints | `express@4.18.2` | Add routes to existing `routes/admin.ts` |
| Query building (sort, filter, paginate) | `drizzle-orm@0.45.1` | `orderBy()`, `where()`, `limit()`, `offset()` composable query builders |
| Input validation | `zod@4.3.6` | Validate query params, rule definitions |
| Schema migration (new columns) | `drizzle-kit@0.31.9` | `npx drizzle-kit generate` + `npx drizzle-kit push` |
| Quality rules engine | TypeScript (no library) | Pure functions: `(question) => QualityScore` |
| AI generation enhancement | `@anthropic-ai/sdk@0.74.0` | Already used in generation scripts |
| Telemetry recording | `drizzle-orm` + PostgreSQL | Atomic `SET encounter_count = encounter_count + 1` |

### Database: Schema Additions (No New Infra)

Telemetry columns go on the existing `questions` table. No separate telemetry table needed at this scale (320 questions, ~100 games/day estimated).

```sql
-- Add to existing questions table via Drizzle migration
ALTER TABLE civic_trivia.questions
  ADD COLUMN encounter_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;

-- Optional: index for quality scoring queries
CREATE INDEX idx_questions_encounter_count
  ON civic_trivia.questions(encounter_count)
  WHERE encounter_count > 0;
```

**Why columns on questions table, not a separate telemetry table:**

| Approach | Pros | Cons |
|---|---|---|
| Columns on `questions` | Single query for question + stats. Atomic increment. Simple. | Loses per-session granularity. |
| Separate `question_telemetry` table | Per-session detail, time-series analysis | Extra JOIN for every admin query. Aggregation needed. Over-engineered for 320 questions. |
| Separate `answer_events` table | Full event sourcing, any analysis possible | Massive table growth. Need background aggregation jobs. Way over-engineered. |

**Recommendation: Columns on `questions` table.** At 320 questions and modest traffic, aggregate counters are sufficient. The correct_rate is simply `correct_count / encounter_count`. If per-session analytics become needed later, an events table can be added without losing the aggregate counters.

**Where to increment:** In the `POST /api/game/answer` handler in `routes/game.ts`, after scoring the answer. Use a single atomic UPDATE:

```typescript
await db.update(questions)
  .set({
    encounterCount: sql`${questions.encounterCount} + 1`,
    correctCount: answer.isCorrect
      ? sql`${questions.correctCount} + 1`
      : questions.correctCount,
  })
  .where(eq(questions.id, questionDbId));
```

This pattern is safe under concurrent requests -- PostgreSQL handles the atomic increment.

## Quality Rules Engine: Pure TypeScript, No Library

The quality rules engine is a set of pure functions that evaluate question quality. No rules engine library (like `json-rules-engine` or `nools`) is needed because:

1. Rules are simple predicate functions, not complex conditional trees
2. The rule set is small (10-20 rules) and changes infrequently
3. Rules don't need dynamic loading or end-user editing
4. TypeScript provides type safety and testability

**Pattern:**

```typescript
// backend/src/services/qualityRules.ts
interface QualityRule {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  evaluate: (question: Question) => QualityViolation | null;
}

interface QualityViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
}

interface QualityReport {
  questionId: number;
  score: number;          // 0-100
  violations: QualityViolation[];
  passesMinimumBar: boolean;
}
```

Example rules (no external dependencies needed):

| Rule | Type | Logic |
|---|---|---|
| Question too short | `error` | `text.length < 20` |
| Question too long | `warning` | `text.length > 300` |
| Duplicate option text | `error` | `new Set(options).size !== options.length` |
| Missing explanation | `error` | `!explanation || explanation.length < 10` |
| Low correct rate | `warning` | `correct_count / encounter_count < 0.15` (after 50+ encounters) |
| High correct rate | `info` | `correct_count / encounter_count > 0.95` (after 50+ encounters) |
| Missing source URL | `error` | `!source?.url` |
| Expired source domain | `warning` | URL returns 404 (async, batch-only) |

**Confidence:** HIGH -- this is standard domain logic. No library needed.

## Admin UI Component Patterns

### Page Structure

The admin UI should follow the existing `Admin.tsx` pattern (single page within the app, not a separate SPA) but expand it with sub-navigation:

```
/admin                    -> Redirect to /admin/questions
/admin/questions          -> Question explorer (table with filters)
/admin/questions/:id      -> Question detail (full view + telemetry + quality report)
/admin/collections        -> Collection list with stats
/admin/collections/:id    -> Collection detail (questions in collection, aggregate stats)
/admin/quality            -> Quality dashboard (worst-scoring questions, rule violations)
```

**Routing approach:** Use nested routes within the existing React Router setup. The existing `ProtectedRoute` wrapper handles auth.

```typescript
// In App.tsx
<Route element={<ProtectedRoute />}>
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<Navigate to="questions" replace />} />
    <Route path="questions" element={<QuestionExplorer />} />
    <Route path="questions/:id" element={<QuestionDetail />} />
    <Route path="collections" element={<CollectionExplorer />} />
    <Route path="collections/:id" element={<CollectionDetail />} />
    <Route path="quality" element={<QualityDashboard />} />
  </Route>
</Route>
```

### Reusable Admin Components to Build

| Component | Purpose | Built With |
|---|---|---|
| `AdminLayout` | Sidebar nav + content area | Tailwind grid/flex |
| `DataTable` | Generic sortable/filterable table | `@tanstack/react-table` + Tailwind |
| `StatusBadge` | Colored pill badges (reuse existing pattern from `Admin.tsx`) | Tailwind |
| `DifficultyBadge` | Easy/Medium/Hard colored pills (reuse from `Admin.tsx`) | Tailwind |
| `QualityScoreBadge` | 0-100 score with color gradient | Tailwind |
| `FilterBar` | Collection, topic, difficulty, status dropdowns | Headless UI Listbox |
| `SearchInput` | Debounced text search | Native input + `useState` with debounce |
| `Pagination` | Page controls below table | TanStack Table pagination API |
| `StatCard` | Metric display (total questions, avg quality, etc.) | Tailwind |
| `DetailPanel` | Slide-over or page for question detail | Headless UI Dialog or dedicated route |

### Debounced Search: No Library Needed

For the search input, a simple debounce hook is sufficient. No need for `lodash.debounce` or `use-debounce`:

```typescript
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

## API Design for Admin Endpoints

All new endpoints extend the existing `routes/admin.ts` pattern (JWT-authenticated, Express router).

### New Endpoints Needed

| Method | Path | Purpose | Query Params |
|---|---|---|---|
| GET | `/api/admin/questions` | List all questions (paginated) | `page`, `limit`, `sort`, `order`, `search`, `status`, `difficulty`, `collectionId`, `topicId` |
| GET | `/api/admin/questions/:id` | Single question detail with telemetry + quality | -- |
| GET | `/api/admin/questions/:id/quality` | Quality report for one question | -- |
| POST | `/api/admin/questions/quality/batch` | Quality report for multiple questions | Body: `{ questionIds: number[] }` |
| GET | `/api/admin/collections` | List all collections with stats | -- |
| GET | `/api/admin/collections/:id` | Collection detail with aggregate telemetry | -- |
| GET | `/api/admin/quality/summary` | Overall quality dashboard data | -- |

### Server-Side vs Client-Side Filtering

**Use server-side pagination and filtering.** Even at 320 questions, establishing server-side patterns now means the admin UI scales when the question bank grows to 1,000+. The existing admin endpoint already does server-side filtering by status -- extend that pattern.

Drizzle ORM makes composable server-side queries straightforward:

```typescript
let query = db.select().from(questions);

if (search) query = query.where(ilike(questions.text, `%${search}%`));
if (status) query = query.where(eq(questions.status, status));
if (difficulty) query = query.where(eq(questions.difficulty, difficulty));

query = query.orderBy(sortColumn).limit(limit).offset(offset);
```

## What NOT to Add

### 1. Separate Admin SPA or Framework (react-admin, Refine, AdminJS)

**Reason:** The admin UI is for 1-3 dev/authors. It is a few protected routes within the existing React app, not a standalone admin panel. Adding react-admin means a second routing system, second state management approach, and a separate build. The existing `Admin.tsx` proves the pattern works: standard React components with Tailwind.

**Confidence:** HIGH

### 2. Chart Library (Chart.js, Recharts, Nivo)

**Reason:** v1.3 admin needs quality scores and telemetry numbers, not time-series charts. Quality scores are displayed as colored badges (0-100). Telemetry is encounter_count and correct_rate displayed as text. If charts become needed in a future version, Recharts (~40KB) integrates well with React/Tailwind.

**Confidence:** HIGH -- charts are explicitly not in the v1.3 scope.

### 3. lodash or lodash.debounce

**Reason:** The only "utility" need is debouncing search input, which is 6 lines of custom hook (shown above). No need for a 70KB utility library or even a 1KB single-function package.

**Confidence:** HIGH

### 4. Form Library (React Hook Form, Formik)

**Reason:** The admin UI has no complex forms. Filters are dropdowns and a search input managed by component state. The quality rules engine has no user-editable form. If a question editing form is added later, React Hook Form would be appropriate then -- but it is not in v1.3 scope.

**Confidence:** HIGH

### 5. State Management Library for Admin (Redux Toolkit, Jotai)

**Reason:** Zustand is already installed (`zustand@4.4.7`). Admin state is simple: current filters, current page, search query. A Zustand store or even local component state handles this. No need for a second state library.

**Confidence:** HIGH

### 6. json-rules-engine or Similar Rules Library

**Reason:** Quality rules are 10-20 simple predicates evaluated synchronously. A rules engine library adds complexity (JSON rule definitions, engine instantiation, async evaluation) for something that is clearer as typed functions. If rules become user-editable or number 100+, reconsider.

**Confidence:** HIGH

### 7. Separate Telemetry Database (ClickHouse, TimescaleDB)

**Reason:** Aggregate counters on the questions table handle the scale. At 320 questions and modest traffic, a columnar analytics database is extreme over-engineering. PostgreSQL handles `SUM`, `AVG`, and `GROUP BY` on thousands of rows instantly.

**Confidence:** HIGH

### 8. Background Job Queue (BullMQ, pg-boss)

**Reason:** Quality scoring is synchronous and fast (evaluate 10-20 rules against a question object). Telemetry is a single atomic UPDATE per answer. Neither requires async job processing. The existing in-process `node-cron` handles the only scheduled task (expiration sweep).

**Confidence:** HIGH

## Installation Commands

### Frontend

```bash
cd frontend
npm install @tanstack/react-table
```

### Backend

```bash
# No new packages needed
# Telemetry columns added via Drizzle migration:
cd backend
npx drizzle-kit generate
npx drizzle-kit push
```

### Not Needed

```bash
# DO NOT install these
npm install react-admin         # No separate admin framework
npm install @tanstack/react-query  # Simple fetch hooks suffice at this scale
npm install recharts            # No charts in v1.3
npm install lodash              # Custom debounce hook instead
npm install react-hook-form     # No complex forms in v1.3
npm install json-rules-engine   # Pure TypeScript rules instead
npm install bullmq              # No background jobs needed
```

## Integration Points with Existing Stack

### 1. Telemetry Recording: game.ts Answer Handler

The `POST /api/game/answer` handler in `routes/game.ts` (line 169) already resolves the question and scores the answer. Add a telemetry increment after scoring, using the existing `db` instance and `questions` schema:

```typescript
// After line 205 in game.ts (after scoring logic)
// Fire-and-forget telemetry update (don't block response)
db.update(questions)
  .set({
    encounterCount: sql`${questions.encounterCount} + 1`,
    correctCount: answer.correct
      ? sql`${questions.correctCount} + 1`
      : undefined,
  })
  .where(eq(questions.id, dbQuestionId))
  .execute()
  .catch(err => console.error('Telemetry update failed:', err));
```

**Note:** The game routes currently use `externalId` (e.g., "q001") for question identification. Telemetry updates need the database `id` (serial integer). A lookup from `externalId` to `id` is needed, or the session can store the database ID alongside the external ID.

### 2. Admin API Extension: routes/admin.ts

The existing `routes/admin.ts` applies `authenticateToken` middleware to all routes (line 10). New endpoints follow the same pattern. The existing Drizzle query patterns (joins, where conditions, ordering) extend naturally.

### 3. Quality Rules: New Service File

Create `backend/src/services/qualityRules.ts` as a pure module. No Express dependency. Called from:
- Admin API endpoints (on-demand quality report)
- Generation pipeline (post-generation quality gate)
- Batch quality sweep (CLI script)

### 4. Generation Pipeline Enhancement: Existing Script Pattern

The existing `generateLearningContent.ts` pattern (CLI args, file-based I/O, structured JSON output) extends to include a quality validation step after generation:

```typescript
// In generation script, after Claude returns content:
const qualityReport = evaluateQuality(generatedQuestion);
if (!qualityReport.passesMinimumBar) {
  console.warn(`Quality check failed for generated question: ${qualityReport.violations}`);
  // Retry with quality feedback in prompt, or skip
}
```

### 5. Drizzle Schema Extension

Add columns to the existing `questions` table definition in `backend/src/db/schema.ts`:

```typescript
// Add to questions table definition
encounterCount: integer('encounter_count').notNull().default(0),
correctCount: integer('correct_count').notNull().default(0),
```

Run `npx drizzle-kit generate` to create the migration, then `npx drizzle-kit push` to apply.

### 6. Frontend Route Structure

The existing `App.tsx` routes pattern extends cleanly. The current `/admin` route is a single page. Convert to a layout with nested routes using `<Outlet />` from react-router-dom (already installed).

## Sources

### HIGH Confidence (Codebase-Verified)

- Existing admin infrastructure: `frontend/src/pages/Admin.tsx`, `backend/src/routes/admin.ts`, `frontend/src/features/admin/` -- verified by direct code reading
- Database schema: `backend/src/db/schema.ts` -- Drizzle ORM schema with questions, collections, topics, junction tables
- Package versions: `frontend/package.json` and `backend/package.json` -- verified installed versions
- Generation pipeline: `backend/src/scripts/generateLearningContent.ts` -- Claude API integration pattern
- Game answer handler: `backend/src/routes/game.ts` lines 169-224 -- where telemetry will integrate

### HIGH Confidence (Official Documentation)

- [@tanstack/react-table npm](https://www.npmjs.com/package/@tanstack/react-table) -- v8.21.3, headless table for React
- [TanStack Table docs](https://tanstack.com/table/latest/docs/introduction) -- headless design, sorting/filtering/pagination APIs
- [Drizzle ORM Zod integration](https://orm.drizzle.team/docs/zod) -- Zod v4 compatibility confirmed
- [Drizzle ORM Zod v4 compatibility PR](https://github.com/drizzle-team/drizzle-orm/pull/4820) -- drizzle-zod supports Zod v4

### MEDIUM Confidence (Multiple Sources)

- TanStack Table bundle size (~53KB min, ~14KB gzip) -- reported across multiple sources, not independently verified
- PostgreSQL atomic increment safety -- well-documented PostgreSQL behavior for `SET col = col + 1`

---

**Next Steps for Roadmap:**

1. **Phase 1 (Telemetry):** Add encounter_count/correct_count columns, instrument answer handler -- prerequisite for quality scoring
2. **Phase 2 (Quality Rules):** Implement quality rules engine as pure TypeScript service, batch-evaluate existing questions
3. **Phase 3 (Admin UI):** Install @tanstack/react-table, build question explorer with filters/sort/pagination, quality scores
4. **Phase 4 (Generation Enhancement):** Add quality gate to generation pipeline, reject/retry low-quality generated questions

Phase 1 is the critical path -- telemetry data informs quality rules, and quality rules inform the admin UI display.
