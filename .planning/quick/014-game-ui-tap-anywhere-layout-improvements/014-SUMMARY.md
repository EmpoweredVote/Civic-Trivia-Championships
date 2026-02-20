---
phase: quick-014
plan: 01
subsystem: ui
tags: [react, game-screen, mobile-ux, tap-anywhere, layout]

# Dependency graph
requires:
  - phase: quick-013
    provides: pause-after-reveal tap-to-continue flow
provides:
  - Tap-anywhere to advance during reveal phase
  - Compact score display in top-left corner
  - Question counter under progress dots
  - X close button removed (quit via Escape/pause only)
affects: [game-ui, mobile-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "stopPropagation on interactive children inside tap-anywhere container"
    - "compact prop pattern for conditional component sizing"

key-files:
  created: []
  modified:
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/ScoreDisplay.tsx

key-decisions:
  - "Kept Next Question button as visible affordance alongside tap-anywhere"
  - "Used stopPropagation on LearnMore, Next button, and modal to prevent double-trigger"
  - "Removed ConfirmDialog entirely since X button was only trigger"

patterns-established:
  - "compact prop on ScoreDisplay for reuse in tight layouts"

# Metrics
duration: 10min
completed: 2026-02-20
---

# Quick Task 014: Game UI Tap-Anywhere Layout Improvements Summary

**Tap-anywhere advance during reveal, compact score top-left, question counter under dots, X button removed for cleaner mobile layout**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-20T19:58:16Z
- **Completed:** 2026-02-20T20:08:45Z
- **Tasks:** 1 code task + 1 verification checkpoint
- **Files modified:** 2

## Accomplishments
- Tapping/clicking anywhere on the game background during reveal phase advances to next question
- Score display moved to top-left corner with compact styling (no "pts" label, smaller text)
- Question counter ("Q1 OF 8") repositioned directly under progress dots on the right
- X close button fully removed along with quit dialog state, handlers, and ConfirmDialog import
- stopPropagation on interactive elements prevents double-triggering from tap-anywhere
- Quit still accessible via Escape key triggering the pause overlay

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure top HUD layout and add tap-anywhere handler** - `55e7661` (feat)

## Files Created/Modified
- `frontend/src/features/game/components/GameScreen.tsx` - Tap-anywhere onClick, controls row restructured (score left, dots+counter right), X button and quit dialog removed, stopPropagation on interactive elements
- `frontend/src/features/game/components/ScoreDisplay.tsx` - Added optional `compact` prop for smaller padding, text, and hidden "pts" label

## Decisions Made
- Kept the "Next Question" button visible as a UI affordance even though tap-anywhere works -- users need a visible cue that they can advance
- Used stopPropagation approach (on LearnMore wrapper, Next button wrapper, and modal wrapper) rather than checking click target -- cleaner and more robust
- Removed ConfirmDialog component entirely since no other code in GameScreen used it -- the pause overlay (triggered by Escape) already has its own quit confirmation

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Game UI is cleaner with less visual clutter in the top bar
- Mobile viewport should show explanation text without scrolling thanks to reclaimed vertical space
- Pause overlay via Escape remains the only quit mechanism

---
*Quick task: 014-game-ui-tap-anywhere-layout-improvements*
*Completed: 2026-02-20*
