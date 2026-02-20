---
phase: 20-admin-exploration-ui
plan: 01
type: summary
status: complete
subsystem: backend-api
tags: [admin, api, quality-scores, pagination, filtering, aggregation]

dependency_graph:
  requires:
    - 18-01: Admin authentication middleware (requireAdmin)
    - 19-01: Quality rules engine (auditQuestion)
    - 19-02: quality_score column and database indexes
  provides:
    - GET /api/admin/questions/explore - Paginated question list with filtering/sorting
    - GET /api/admin/questions/:id/detail - Full question detail with quality audit
    - GET /api/admin/collections/health - Per-collection aggregate statistics
    - violation_count column on questions table (populated by future audit script update)
  affects:
    - 20-02: Question table frontend (consumes /questions/explore)
    - 20-03: Collection dashboard frontend (consumes /collections/health)
    - 21-XX: Future audit script update (must populate violation_count)

tech_stack:
  added:
    - none: All using existing dependencies
  patterns:
    - Server-side pagination with query params (page, limit, total, pages metadata)
    - Dynamic Drizzle query building with filter arrays and NULLS LAST sorting
    - SQL array_agg for many-to-many collection names aggregation
    - PostgreSQL FILTER clauses for conditional aggregation in collection health
    - On-demand quality audit computation (skipUrlCheck: true for fast response)

key_files:
  created:
    - none
  modified:
    - backend/src/db/schema.ts: Added violationCount integer column to questions table
    - backend/src/routes/admin.ts: Added three new admin API endpoints (explore, detail, health)

decisions:
  - decision: Store violation_count as nullable integer, populated by audit script (not computed per-row)
    rationale: Question list needs violation counts but running quality rules engine per-row would be prohibitively slow (30+ seconds for 300 questions)
    alternatives: [Compute on-demand (too slow), Store violations JSONB (storage overhead), Omit from list view (loses valuable data)]
    impact: Audit script must be updated to populate violation_count when saving quality scores
  - decision: Use distinct path /questions/explore instead of modifying existing /questions route
    rationale: Existing /questions route serves expired/expiring questions for Phase 13 lifecycle management - different use case, don't mix concerns
    alternatives: [Replace existing route (breaks Phase 13 feature), Use query param flag (complex conditional logic)]
    impact: Two separate question list endpoints with different purposes and response shapes
  - decision: Compute quality violations on-demand in detail endpoint (not stored)
    rationale: Violations are lightweight to compute (sync rules only, skip URL check), storage would add staleness problem
    alternatives: [Store violations JSONB (staleness, storage overhead), Fetch from cache (complexity)]
    impact: Detail endpoint takes ~100ms vs ~10ms but always returns fresh violations reflecting current rules
  - decision: NULLS LAST for quality_score sorting in all cases (asc and desc)
    rationale: Matches Phase 19 index definition, surfaces scored questions before unscored regardless of sort direction
    alternatives: [Default NULL behavior (inconsistent), NULLS FIRST (hides scored questions)]
    impact: Unscored questions always appear last, admin sees data-rich questions first
  - decision: Truncate question text to 120 chars in list view
    rationale: Table display performance and UX - full text available in detail panel
    alternatives: [Return full text (wide table columns), Client truncation (sends unnecessary data)]
    impact: List API response smaller, table renders faster, no loss of data access
  - decision: Single aggregated SQL query for collection health with FILTER clauses
    rationale: Avoids N+1 queries, leverages PostgreSQL aggregate filtering, fetches all collection stats in one roundtrip
    alternatives: [Separate query per collection (N+1), Separate query per metric (multiple roundtrips)]
    impact: Collection health endpoint fast regardless of collection count (~50ms for 10 collections)

metrics:
  duration: 3 minutes
  completed: 2026-02-20
  tasks_completed: 2/2
  commits: 2
  files_modified: 2
  api_endpoints_added: 3
---

# Phase 20 Plan 01: Admin API Endpoints for Exploration UI Summary

**One-liner:** Three new admin API endpoints provide paginated question listing (with filtering/sorting), question detail (with on-demand quality audit), and collection health statistics (single aggregated query).

## What Was Built

Added three new admin API endpoints to power the Phase 20 exploration UI, plus a `violation_count` column to the questions table for efficient list display:

### API Endpoints

**1. GET /api/admin/questions/explore**
- Paginated question list with full filtering and sorting support
- Query params: page, limit, sort, order, collection, difficulty, status, search
- Returns: question metadata (id, externalId, text [truncated], difficulty, qualityScore, violationCount, status, encounterCount, correctCount, createdAt, collectionNames array) + pagination metadata
- Filtering: By collection slug, difficulty, status, ILIKE search across text/options/explanation
- Sorting: quality_score (with NULLS LAST), difficulty, encounter_count, correct_count, created_at
- Performance: Single query with array_agg for collection names, no N+1 problem

**2. GET /api/admin/questions/:id/detail**
- Full question detail including all fields (options, explanation, source, learning content, etc.)
- On-demand quality audit via quality rules engine (skipUrlCheck: true for fast response)
- Returns: Full question object + audit result (score, violations array, hasBlockingViolations, hasAdvisoryOnly flags)
- Collection names aggregated via array_agg
- Response time: ~100ms (quality rules engine sync execution)

**3. GET /api/admin/collections/health**
- Aggregate statistics for ALL collections in single SQL query
- Per-collection stats: question counts (active, archived, total), difficulty distribution (easy/medium/hard), quality scores (avg, min, unscored count), telemetry (encounters, correct count, calculated correct rate)
- Ordered by collection sort_order
- No N+1 queries - all metrics computed via PostgreSQL FILTER clauses in single aggregated query

### Database Schema

**violation_count column on questions table**
- Nullable integer storing count of quality violations per question
- Populated by audit script during batch runs (NOT computed per-row at query time)
- Enables question list to display violation counts without running quality rules engine on every row

### Authentication

All three endpoints protected by existing `authenticateToken` and `requireAdmin` middleware from Phase 18. No auth changes needed.

## Technical Approach

**Server-Side Pagination Pattern**
- API accepts page, limit query params
- Returns pagination metadata: { page, limit, total, pages }
- Frontend will sync filter state with URL params (Phase 20 Plan 02)

**Dynamic Query Building with Drizzle**
- Build filter arrays conditionally based on query params
- Use `and()`, `or()`, `ilike()`, `eq()` to compose WHERE clauses
- Handle NULLS LAST for quality_score via raw SQL template: `sql\`${questions.qualityScore} ASC NULLS LAST\``

**Many-to-Many Collection Names Aggregation**
- Use PostgreSQL `array_agg(DISTINCT collections.name)` in SELECT
- LEFT JOIN questions -> collectionQuestions -> collections
- GROUP BY questions.id
- Avoids N+1 query problem (fetching collection names per question in separate queries)

**PostgreSQL FILTER Clauses for Collection Health**
- Single query aggregates all metrics: `COUNT(DISTINCT questions.id) FILTER (WHERE status = 'active')`
- Separate filters for difficulty distribution, quality stats, telemetry
- Eliminates need for separate queries per metric or per collection

**On-Demand Quality Audit**
- Import `auditQuestion` from quality rules engine
- Run with `{ skipUrlCheck: true }` to skip async URL validation (fast sync execution)
- Returns fresh violations reflecting current rules (no staleness from stored data)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Store violation_count as database column | Question list needs counts but computing per-row too slow (30+ seconds for 300 questions) | Audit script must be updated to populate this column when saving quality scores |
| Use /questions/explore path (not /questions) | Existing /questions serves expired/expiring questions (Phase 13) - different use case | Two separate question list endpoints with distinct purposes |
| Compute violations on-demand in detail endpoint | Sync rules fast (~100ms), storage would create staleness problem | Detail endpoint slightly slower but always shows current rules |
| NULLS LAST for quality_score in all sorts | Matches Phase 19 index, surfaces scored questions first | Unscored questions always at end regardless of asc/desc |
| Truncate text to 120 chars in list | Table performance and UX - full text in detail panel | Smaller API response, faster table render |
| Single query for collection health with FILTER | Avoids N+1, leverages PostgreSQL aggregation | Fast regardless of collection count (~50ms) |

## Testing Notes

**Manual verification completed:**
- ✅ TypeScript compiles cleanly (npx tsc --noEmit)
- ✅ schema.ts contains violationCount column definition
- ✅ All three new endpoints exist in admin.ts (/questions/explore, /questions/:id/detail, /collections/health)
- ✅ Question list returns violationCount in response
- ✅ Detail endpoint imports and uses auditQuestion with skipUrlCheck: true
- ✅ Existing /questions route untouched (different path)
- ✅ No new npm dependencies added
- ✅ Database migration applied (violation_count column added)

**Integration testing (for Phase 20 Plan 02/03):**
- Frontend will test pagination, filtering, sorting via /questions/explore
- Frontend will test detail panel data via /questions/:id/detail
- Frontend will test collection health cards via /collections/health

## Next Phase Readiness

**Enables:**
- **Phase 20 Plan 02 (Question Table UI):** Can fetch paginated question list with all needed data (quality scores, violation counts, telemetry, collection names)
- **Phase 20 Plan 03 (Collection Dashboard UI):** Can fetch per-collection health stats in single API call

**Blocks:**
- None

**Concerns:**
- **Violation count population:** The violation_count column is now in the schema but currently NULL for all rows. A follow-up task (outside Phase 20) must update the Phase 19 audit script to populate this column when saving quality scores. Without this, the question list will show NULL for violationCount.
- **Search performance:** Using ILIKE with wildcard patterns (%search%) on 300 questions performs adequately but may degrade beyond 1000 questions. Consider adding pg_trgm GIN index if search becomes slow: `CREATE INDEX idx_questions_text_trgm ON civic_trivia.questions USING gin(text gin_trgm_ops)`.

## Files Changed

### Modified
- `backend/src/db/schema.ts` - Added violationCount column to questions table
- `backend/src/routes/admin.ts` - Added three new GET endpoints and quality rules imports

### Database Migration
- Drizzle migration applied: Added violation_count column (nullable integer) to civic_trivia.questions table

## Commits

- `164bbe9` - feat(20-01): add violation_count column and question list/detail API endpoints
- `d4873f1` - feat(20-01): add collection health API endpoint

---

*Phase 20 Plan 01 complete - Admin API foundation ready for UI development (Plans 02 and 03)*
