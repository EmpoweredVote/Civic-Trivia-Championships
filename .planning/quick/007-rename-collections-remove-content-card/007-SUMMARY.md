---
phase: quick-007
plan: 01
subsystem: database, ui
tags: [collections, seed-data, admin-dashboard, naming]

# Dependency graph
requires:
  - phase: 21-community-collections
    provides: Collections table and admin dashboard
provides:
  - Cleaned collection names without 'Civics' suffix
  - Streamlined admin dashboard without placeholder card
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - backend/src/db/seed/collections.ts
    - frontend/src/pages/admin/AdminDashboard.tsx

key-decisions:
  - "Ran SQL update directly against live Supabase database to rename collections (seed file uses onConflictDoNothing)"

# Metrics
duration: 2min
completed: 2026-02-20
---

# Quick Task 007: Rename Collections & Remove Content Card Summary

**Removed 'Civics' suffix from 3 collection names in seed data + live DB, and deleted the Content Generation placeholder card from admin dashboard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:00:29Z
- **Completed:** 2026-02-20T17:02:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Renamed 'Federal Civics' -> 'Federal', 'Bloomington, IN Civics' -> 'Bloomington, IN', 'Los Angeles, CA Civics' -> 'Los Angeles, CA' in both seed file and live Supabase database
- Removed the "Content Generation - Coming Soon" placeholder card from AdminDashboard.tsx
- Verified TypeScript compilation passes cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename collections (seed data + live database)** - `b6c53a6` (fix)
2. **Task 2: Remove Content Generation card from admin dashboard** - `5cbe032` (fix)

## Files Created/Modified
- `backend/src/db/seed/collections.ts` - Updated 3 collection name fields to remove 'Civics' suffix
- `frontend/src/pages/admin/AdminDashboard.tsx` - Removed Content Generation placeholder card (16 lines deleted)

## Decisions Made
- Ran direct SQL UPDATE against live Supabase database using node pg client (the seed script uses onConflictDoNothing on slug, so changing the seed alone would not update existing rows)
- Used CommonJS node -e inline script rather than tsx for the database update (tsx inline mode had silent output issues)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsx -e` inline scripts produced no output (likely a Windows/MINGW64 compatibility issue with ESM inline evaluation); worked around by using `node -e` with CommonJS `require()` syntax instead

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Collection names are clean and consistent across seed data and live database
- Admin dashboard is streamlined with only functional cards remaining

---
*Quick Task: 007-rename-collections-remove-content-card*
*Completed: 2026-02-20*
