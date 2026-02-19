---
phase: 18-foundation-admin-auth-telemetry
plan: 03
subsystem: database
tags: [drizzle-orm, postgres, telemetry, sql, atomic-increment]

# Dependency graph
requires:
  - phase: 13-collections
    provides: questions table schema
provides:
  - encounter_count and correct_count columns on questions table
  - Fire-and-forget telemetry recording service
  - Telemetry wired into answer submission endpoint
affects: [19-quality-scoring, 20-admin-ui, analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget async operations, atomic SQL increments for counters]

key-files:
  created:
    - backend/src/services/telemetryService.ts
    - backend/src/scripts/migrate-telemetry.ts
  modified:
    - backend/src/db/schema.ts
    - backend/src/routes/game.ts

key-decisions:
  - "Use externalId instead of database integer ID for telemetry to avoid extra DB lookup per answer"
  - "Fire-and-forget pattern with .catch(() => {}) to ensure telemetry never blocks gameplay"
  - "Atomic SQL increment (encounter_count + 1) to prevent race conditions from concurrent gameplay"

patterns-established:
  - "Fire-and-forget async operations: No await, .catch(() => {}) safety net, internal try/catch with logging"
  - "Telemetry service takes external string IDs to minimize query overhead"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 18 Plan 03: Question Telemetry Summary

**Atomic encounter and correctness tracking on every answer submission using fire-and-forget SQL increments**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T22:45:15Z
- **Completed:** 2026-02-19T22:48:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added encounter_count and correct_count columns to questions table with DEFAULT 0
- Created telemetry service with atomic SQL increment to prevent race conditions
- Wired telemetry into POST /api/game/answer with fire-and-forget pattern
- Telemetry records all gameplay (authenticated and anonymous users)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add telemetry columns to questions schema and run migration** - `35b7f2e` (feat)
   - Added encounterCount and correctCount to Drizzle schema
   - Created migrate-telemetry.ts script with proper env loading
   - Ran migration to add columns to civic_trivia.questions table

2. **Task 2: Create telemetry service and wire into answer submission** - `25b6e28` (feat)
   - Created telemetryService with recordQuestionTelemetry function
   - Wired into POST /api/game/answer route with fire-and-forget pattern
   - Telemetry does not block answer response

## Files Created/Modified

**Created:**
- `backend/src/services/telemetryService.ts` - Fire-and-forget telemetry recording with atomic SQL increments
- `backend/src/scripts/migrate-telemetry.ts` - Migration script to add telemetry columns to questions table

**Modified:**
- `backend/src/db/schema.ts` - Added encounterCount and correctCount integer columns with DEFAULT 0
- `backend/src/routes/game.ts` - Imported and called recordQuestionTelemetry in POST /answer route

## Decisions Made

1. **Use externalId for telemetry lookup instead of database integer ID**
   - Rationale: Session stores questions with externalId as the `id` field. Using externalId in telemetry avoids an extra DB query to resolve externalId → database ID on every answer submission.
   - Impact: Telemetry function signature accepts string externalId, WHERE clause uses eq(questions.externalId, externalId)

2. **Fire-and-forget pattern with double safety net**
   - Rationale: Telemetry must never block or slow down gameplay. Players should get instant feedback.
   - Implementation: No await on telemetry call, .catch(() => {}) on call site, plus internal try/catch in service
   - Impact: Telemetry errors are logged but never propagated to player

3. **Atomic SQL increment for counters**
   - Rationale: Concurrent gameplay could cause race conditions if we read-modify-write counters
   - Implementation: Use Drizzle sql template: encounterCount: sql\`${questions.encounterCount} + 1\`
   - Impact: Database handles increment atomically, no race conditions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added environment variable loading to migration script**
- **Found during:** Task 1 (Running migration script)
- **Issue:** Migration script failed with "password authentication failed" because it didn't load .env file. Database connection requires DATABASE_URL from environment.
- **Fix:** Changed from `import 'dotenv/config'` to `import '../env.js'` to use backend's proper env loading pattern
- **Files modified:** backend/src/scripts/migrate-telemetry.ts
- **Verification:** Migration ran successfully, columns added to database
- **Committed in:** 35b7f2e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to run migration. Followed existing env loading pattern from other scripts.

## Issues Encountered

None. Plan executed smoothly after fixing env loading pattern.

## User Setup Required

None - no external service configuration required. Migration uses existing DATABASE_URL from backend/.env.

## Next Phase Readiness

**Ready for next phase:**
- encounter_count and correct_count columns exist and are accumulating data
- Telemetry recording is live on all answer submissions
- Data ready for quality scoring algorithms (Phase 19)
- Admin UI (Phase 20) can display telemetry metrics

**No blockers or concerns.**

---
*Phase: 18-foundation-admin-auth-telemetry*
*Completed: 2026-02-19*
