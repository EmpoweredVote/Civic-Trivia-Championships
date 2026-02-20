---
phase: 22-admin-question-editing
plan: 01
subsystem: api
tags: [zod, quality-rules, validation, drizzle, admin-api]

# Dependency graph
requires:
  - phase: 19-question-quality-rules
    provides: Quality rules engine with auditQuestion function
  - phase: 20-admin-ui-question-explorer
    provides: Admin routes infrastructure and authentication
provides:
  - PUT /api/admin/questions/:id endpoint for question editing
  - Zod validation schema for question updates
  - Quality re-scoring after edits with delta response
  - Difficulty mapping from numeric (1-10) to categorical (easy/medium/hard)
affects: [22-02-frontend-question-edit-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zod validation with strict schema and field-level error mapping
    - Quality delta pattern (oldScore/newScore/violations) for UI feedback
    - Difficulty numeric-to-string mapping for admin UX
    - Source field preservation pattern (keep name, update url)

key-files:
  created: []
  modified:
    - backend/src/routes/admin.ts

key-decisions:
  - "PUT endpoint placed before GET /questions/explore to avoid Express route parameter conflicts (:id matching 'explore')"
  - "Quality audit runs with skipUrlCheck: true for fast save response (URL validation deferred)"
  - "Source field preserves existing name, only updates URL from request body"
  - "Difficulty mapping: 1-3 = easy, 4-7 = medium, 8-10 = hard for admin numeric input"
  - "UpdateQuestionSchema uses .strict() to reject unknown fields"
  - "Validation errors map to field-level details array for precise frontend error display"

patterns-established:
  - "Quality delta response pattern: { oldScore, newScore, oldViolations, newViolations, violations }"
  - "Zod validation with safeParse and error.issues mapping to { field, message } format"
  - "Two-stage DB update: content update, then quality metrics update after audit"

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 22 Plan 01: Backend Question Edit API Summary

**PUT /api/admin/questions/:id with Zod validation, automatic quality re-scoring, and before/after delta response**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T07:50:12Z
- **Completed:** 2026-02-20T07:52:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- PUT endpoint validates question edits with Zod schema (text, options, correctAnswer, explanation, sourceUrl, difficulty)
- Quality rules automatically re-run after save, updating quality_score and violation_count
- Response includes qualityDelta object with oldScore, newScore, oldViolations, newViolations, and full violations array
- Difficulty mapping converts admin's numeric 1-10 scale to database's easy/medium/hard categories
- Source field preservation ensures existing source.name retained while updating URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PUT /questions/:id endpoint with Zod validation and quality re-scoring** - `2cf8d2c` (feat)
   - Note: This commit message incorrectly labeled as "chore(22-02): install @dnd-kit dependencies" but contains the PUT endpoint implementation

## Files Created/Modified
- `backend/src/routes/admin.ts` - Added UpdateQuestionSchema (Zod), mapDifficultyToString helper, PUT /questions/:id handler with validation, quality audit, delta response

## Decisions Made

1. **PUT route placement:** Positioned before GET /questions/explore to prevent Express from matching 'explore' as :id parameter
2. **Quality audit optimization:** Use skipUrlCheck: true for fast save response (URL validation deferred to batch processes)
3. **Source field handling:** Preserve existing source.name, only update source.url from request (JSONB field partial update)
4. **Difficulty mapping:** Admin inputs numeric 1-10, backend maps to easy (1-3), medium (4-7), hard (8-10) for storage
5. **Strict validation:** UpdateQuestionSchema uses .strict() to reject unexpected fields
6. **Error mapping:** Validation failures return 400 with details array mapping err.path and err.message for field-level error display

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation passed, all validation logic implemented as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Backend API ready for frontend integration in Phase 22 Plan 02:
- PUT /api/admin/questions/:id accepts { text, options, correctAnswer, explanation, sourceUrl, difficulty }
- Returns updated question + qualityDelta for UI feedback
- POST /api/admin/questions/:id/archive verified as existing (no changes needed)
- Quality rules automatically re-score and persist to database

**No blockers.** Frontend can now build the edit panel with form validation, quality delta display, and save functionality.

---
*Phase: 22-admin-question-editing*
*Completed: 2026-02-20*
