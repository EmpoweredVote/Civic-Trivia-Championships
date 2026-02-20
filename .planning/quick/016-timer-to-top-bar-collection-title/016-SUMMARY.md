---
phase: quick
plan: "016"
subsystem: ui
tags: [react, game-ui, layout, countdown-timer, tailwind]

# Dependency graph
requires:
  - phase: quick-015
    provides: "Reserved timer space layout in GameScreen"
provides:
  - "Timer embedded in top bar at 48px with configurable size prop"
  - "Collection title displayed above progress dots in right column"
  - "Reclaimed vertical space from removed timer wrapper"
affects: [game-ui, game-screen-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Absolute centering pattern for top bar timer (left-1/2 -translate-x-1/2)"
    - "GameTimer size prop with conditional rendering for small/large modes"

key-files:
  created: []
  modified:
    - frontend/src/features/game/components/GameTimer.tsx
    - frontend/src/features/game/components/GameScreen.tsx

key-decisions:
  - "48px timer size for top bar — large enough to read, small enough to not dominate the row"
  - "Hide warning/critical SVG icons at small sizes (< 60px) — they don't fit and clutter the small circle"
  - "Absolute positioning for timer centering — independent of left/right column width differences"
  - "Truncate collection name at 160px max-width to prevent overflow on long names"

patterns-established:
  - "GameTimer accepts size prop for flexible placement in different contexts"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Quick Task 016: Timer to Top Bar + Collection Title Summary

**48px countdown timer embedded in top bar center with collection name right-aligned above progress dots, reclaiming 80px vertical space**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T20:19:35Z
- **Completed:** 2026-02-20T20:23:35Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Moved countdown timer from dedicated 80px row into the top bar, centered between score (left) and dots (right)
- Added configurable `size` prop to GameTimer with automatic strokeWidth and text/icon adjustments for small sizes
- Relocated collection name to right column above ProgressDots for a compact three-column HUD layout
- Reclaimed ~80px of vertical space so question card sits closer to the top bar

## Task Commits

Each task was committed atomically:

1. **Task 1: Add size prop to GameTimer and restructure top bar layout** - `69490c3` (feat)

## Files Created/Modified
- `frontend/src/features/game/components/GameTimer.tsx` - Added optional `size` prop (default 80), `isSmall` flag for conditional strokeWidth (4 vs 6), text size (text-lg vs text-2xl), and icon visibility
- `frontend/src/features/game/components/GameScreen.tsx` - Restructured top bar to three-column layout with absolutely-centered timer, moved collection name to right column, removed 80px timer wrapper, tightened vertical spacing

## Decisions Made
- Used 48px as the top bar timer size — readable but compact enough for the HUD row
- Hidden warning/critical SVG icons when `size < 60` since they don't fit visually in a small circle
- Used CSS absolute positioning (`left-1/2 -translate-x-1/2`) for true centering regardless of left/right column width
- Added `truncate max-w-[160px]` to collection name to prevent overflow on long names
- Reduced HUD margin from `mb-4 md:mb-8` to `mb-2 md:mb-4` and question padding from `pt-2 md:pt-6` to `pt-0 md:pt-2`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Game UI layout tightened with all HUD elements in a single top bar row
- Timer functionality fully preserved (countdown, color changes, pause, timeout)
- Ready for further game UI refinements

---
*Quick task: 016-timer-to-top-bar-collection-title*
*Completed: 2026-02-20*
