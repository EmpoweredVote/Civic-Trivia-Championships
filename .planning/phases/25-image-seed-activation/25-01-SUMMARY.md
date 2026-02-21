---
phase: 25-image-seed-activation
plan: 01
subsystem: data, ui
tags: [sharp, drizzle-orm, export, seed, image-optimization]

# Dependency graph
requires:
  - phase: 23-collection-setup
    provides: "Fremont collection metadata in database (slug, topics, theme)"
  - phase: 24-question-generation
    provides: "92 active Fremont questions in database across 8 topics"
provides:
  - "Mission Peak banner image for Fremont collection card"
  - "Exported fremont-ca-questions.json with 92 active questions"
  - "Status-filtered export script (benefits all collections)"
  - "Fremont registered in seed script for reproducible deployment"
affects: [26-verification]

# Tech tracking
tech-stack:
  added: [sharp (dev dependency)]
  patterns: [status-filtered exports, community seed registration]

key-files:
  created:
    - frontend/public/images/collections/fremont-ca.jpg
    - backend/src/data/fremont-ca-questions.json
  modified:
    - backend/src/scripts/export-community.ts
    - backend/src/db/seed/seed-community.ts

key-decisions:
  - "Mission Peak from Lake Elizabeth as banner (public domain, Wikimedia Commons)"
  - "Status filter applied to ALL collection exports, not just Fremont"

patterns-established:
  - "Export script filters by status='active' to exclude drafts"

# Metrics
duration: ~7 min
completed: 2026-02-21
---

# Phase 25 Plan 01: Image, Seed & Activation Summary

**Mission Peak banner image, status-filtered question export (92 active), and Fremont seed script registration for collection activation**

## Performance

- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Added status='active' filter to export script, excluding 31 draft Fremont questions from export
- Exported fremont-ca-questions.json with exactly 92 active questions across 8 topic categories
- Added Mission Peak (from Lake Elizabeth) banner image as fremont-ca.jpg (40KB, 800x450)
- Registered Fremont in seed-community.ts LOCALES array for reproducible deployment
- Re-exported Bloomington and LA collections with new status filter (no change in question counts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status filter to export script and export Fremont questions** - `b26b952` (feat)
2. **Task 2: Add Mission Peak banner image and register Fremont in seed script** - `bb7829e` (feat)
3. **Task 3: Human verification checkpoint** - approved (banner image verified by user)

## Files Created/Modified
- `frontend/public/images/collections/fremont-ca.jpg` - Mission Peak banner image (public domain, Wikimedia Commons)
- `backend/src/data/fremont-ca-questions.json` - 92 active Fremont questions in ExportFile format
- `backend/src/scripts/export-community.ts` - Added `and` import, status='active' filter, Fremont export call
- `backend/src/db/seed/seed-community.ts` - Added fremont-ca to LOCALES array
- `backend/src/data/bloomington-in-questions.json` - Re-exported with status filter (116 questions, unchanged)
- `backend/src/data/los-angeles-ca-questions.json` - Re-exported with status filter (114 questions, unchanged)
- `backend/package.json` - Added sharp as dev dependency
- `backend/package-lock.json` - sharp installation

## Decisions Made
- Mission Peak from Lake Elizabeth chosen as banner image (public domain from Wikimedia Commons) — user requested skyline-style view over initial generic cityscape
- Status filter applied to ALL collection exports (not just Fremont) — improves data integrity for all future exports

## Deviations from Plan
None — plan executed as written. Banner image source was iterated with user feedback during checkpoint (Mission Peak from Wikimedia Commons instead of initial Unsplash attempt).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fremont collection ready for verification (Phase 26)
- 92 active questions exported and seed script registered
- Banner image in place for collection picker display
- No blockers

---
*Phase: 25-image-seed-activation*
*Completed: 2026-02-21*
