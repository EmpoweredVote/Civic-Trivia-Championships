---
phase: 20-admin-exploration-ui
plan: 02
subsystem: ui
tags: [react, headless-ui, tailwind, admin, search-params, debounce]

requires:
  - phase: 20-01
    provides: "Admin API endpoints (question list, detail, collection health)"
  - phase: 18-02
    provides: "Admin shell layout and route guard"
provides:
  - "Question explorer page with sortable/filterable table"
  - "Question detail slide-over panel with violation badges"
  - "DifficultyRate component (TELE-03)"
  - "useDebounce reusable hook"
affects: [21-generation-pipeline]

tech-stack:
  added: []
  patterns:
    - "URL-driven state with useSearchParams for filter/sort/page persistence"
    - "Headless UI Dialog for accessible slide-over panel"
    - "Inline violation badges mapped by content section"

key-files:
  created:
    - frontend/src/pages/admin/QuestionsPage.tsx
    - frontend/src/pages/admin/components/QuestionTable.tsx
    - frontend/src/pages/admin/components/QuestionDetailPanel.tsx
    - frontend/src/pages/admin/components/DifficultyRate.tsx
    - frontend/src/hooks/useDebounce.ts
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "URL searchParams as single source of truth for all filter/sort/page state"
  - "Violations shown BOTH inline on content sections AND in summary section below"
  - "Violation-to-section mapping: partisan-framing/pure-lookup→question, ambiguous-answers/multiple-correct→options, weak/no-explanation→explanation, broken/no-source→source"
  - "Prev/next navigation within current page only (not cross-page)"

patterns-established:
  - "useSearchParams pattern for URL-persisted admin filters"
  - "Slide-over detail panel pattern with Headless UI Dialog"
  - "InlineViolationBadge component for contextual quality display"

duration: ~3min
completed: 2026-02-20
---

# Phase 20 Plan 02: Question Explorer + Detail Panel Summary

**Paginated question table with 9 sortable columns, URL-persisted filters, and Headless UI slide-over detail panel with inline violation badges and telemetry display**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 1

## Accomplishments
- Question explorer page at /admin/questions with search, 3 filter dropdowns, and sortable table
- All 9 required columns: text, collection, difficulty, quality score, encounters, correct rate, status, created, violations count
- Slide-over detail panel with full question content, inline violation badges mapped to content sections, and quality assessment summary
- DifficultyRate component showing calculated percentage or "Insufficient data" for <20 encounters (TELE-03)
- URL state persistence for all filters, sort, and pagination

## Task Commits

1. **Task 1: Question explorer page with table, filters, search, and pagination** - `2582c55` (feat)
2. **Task 2: Slide-over question detail panel with prev/next navigation** - `54bd634` (feat)

**Bug fix:** `6565028` (fix: resolve API integration bugs)

## Files Created/Modified
- `frontend/src/pages/admin/QuestionsPage.tsx` - Question explorer page with search, filters, table, pagination
- `frontend/src/pages/admin/components/QuestionTable.tsx` - Sortable data table with 9 columns
- `frontend/src/pages/admin/components/QuestionDetailPanel.tsx` - Slide-over panel with violation badges
- `frontend/src/pages/admin/components/DifficultyRate.tsx` - Calculated difficulty rate display (TELE-03)
- `frontend/src/hooks/useDebounce.ts` - Reusable debounce hook for search input
- `frontend/src/App.tsx` - Added /admin/questions route

## Decisions Made
- URL searchParams as single source of truth for filter/sort/page state (survives refresh, shareable)
- Violations displayed both inline on relevant content sections AND in summary section below
- Violation rules mapped to sections: question text (partisan-framing, pure-lookup), options (ambiguous-answers, multiple-correct), explanation (weak/no-explanation), source (broken/no-source)
- Prev/next navigation within current page results only (simplest correct implementation)

## Deviations from Plan

**1. [Rule 1 - Bug] API integration fixes**
- **Found during:** Task 1/2 integration
- **Issue:** API response shape mismatches and integration bugs
- **Fix:** Resolved in commit 6565028
- **Impact:** None on scope

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Question explorer complete, ready for collection health dashboard verification
- All EXPL-01, EXPL-02, TELE-03 requirements delivered

---
*Phase: 20-admin-exploration-ui*
*Completed: 2026-02-20*
