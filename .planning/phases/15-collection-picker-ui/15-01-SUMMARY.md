---
phase: 15-collection-picker-ui
plan: 01
subsystem: api
tags: [express, drizzle-orm, postgresql, collections, game-routes]

# Dependency graph
requires:
  - phase: 14-question-service-route-integration
    provides: QuestionService database integration and collection metadata helpers
provides:
  - GET /api/game/collections endpoint with active collections and question counts
  - MIN_QUESTION_THRESHOLD constant (10 questions)
  - Expired question filtering in collection counts
affects: [15-02-collection-picker-components, 15-03-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [collection query pattern with question count aggregation, expired question exclusion]

key-files:
  created: []
  modified: [backend/src/routes/game.ts]

key-decisions:
  - "Query excludes expired questions from count using LEFT JOIN through questions table"
  - "Filter threshold applied in JS after query (flexible for future configuration)"
  - "Collections ordered by sortOrder (Federal Civics first by seed data)"

patterns-established:
  - "Collection endpoint pattern: JOIN collections -> collectionQuestions -> questions with expiration check"
  - "Question counting uses COUNT(DISTINCT questionId)::int to avoid duplicates"

# Metrics
duration: 1.2min
completed: 2026-02-18
---

# Phase 15 Plan 01: Collections API Endpoint Summary

**GET /api/game/collections endpoint providing active collections with non-expired question counts for picker UI**

## Performance

- **Duration:** 1.2 min
- **Started:** 2026-02-19T01:55:25Z
- **Completed:** 2026-02-19T01:56:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added GET /api/game/collections route handler that returns active collections with question counts
- Implemented expired question filtering via three-table JOIN (collections -> collectionQuestions -> questions)
- Applied MIN_QUESTION_THRESHOLD (10) filter to exclude collections with insufficient questions
- Ordered results by sortOrder (Federal Civics first)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /collections endpoint to game routes** - `dd6f174` (feat)

**Plan metadata:** (pending - will be added after STATE.md update)

## Files Created/Modified
- `backend/src/routes/game.ts` - Added GET /collections endpoint with db imports, query logic, and error handling

## Decisions Made
- **Expired question exclusion:** Filter applied in WHERE clause during query to ensure accurate counts (questions.expiresAt IS NULL OR > NOW())
- **Threshold filter location:** Applied in JS after query for flexibility (could be made configurable via env var in future)
- **Response format:** Wrapped collections in object `{ collections: [...] }` for consistency with other API endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation succeeded, all imports resolved correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 15 Plan 02 (collection picker components).

**Provides:**
- Backend endpoint for fetching active collections
- Question count data for each collection
- Filtering logic to hide underpopulated collections

**Frontend can now:**
- Query GET /api/game/collections
- Display collection cards with accurate question counts
- Hide collections below minimum threshold

**Notes:**
- Backend server must be running for frontend to consume endpoint
- Seed data (Phase 13) ensures Federal Civics collection appears first
- Bloomington/LA collections are currently inactive (isActive=false) so won't appear until Phase 17

---
*Phase: 15-collection-picker-ui*
*Completed: 2026-02-18*
