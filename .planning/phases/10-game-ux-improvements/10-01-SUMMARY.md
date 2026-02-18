---
phase: 10-game-ux-improvements
plan: 01
subsystem: ui
tags: [react, framer-motion, game-state-machine, timing-optimization]

# Dependency graph
requires:
  - phase: 09-redis-session-migration
    provides: Stable session persistence and state management foundation
provides:
  - Single-click answer selection for Q1-Q9 (immediate lock-in)
  - Q10 preserves two-step lock-in for wager question stakes
  - Snappier timing constants: 750ms suspense, 4s auto-advance, 1.5s popup
  - Updated question timer from 25s to 20s (50s for Q10 unchanged)
  - Refactored selectAnswer flow with shared submitAndReveal helper
affects: [10-02-layout-polish, game-ux-future-enhancements, answer-interaction-patterns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - State machine phase branching based on question index
    - Shared async helper for server submission with suspense coordination
    - Timing constants coordinated across multiple components for cohesive pacing

key-files:
  created: []
  modified:
    - frontend/src/features/game/gameReducer.ts
    - frontend/src/features/game/hooks/useGameState.ts
    - frontend/src/features/game/components/ScorePopup.tsx
    - frontend/src/types/game.ts

key-decisions:
  - "Q10 preserves two-step lock-in (select → confirm) for dramatic stakes differentiation"
  - "Question timer reduced from 25s to 20s to match snappier overall pace"
  - "ScorePopup duration reduced from 2s to 1.5s to fit within 4s auto-advance window"
  - "selectAnswer signature accepts optional timeRemaining for Q1-Q9 immediate submission"

patterns-established:
  - "State machine phase transitions conditional on question index (Q10 exception pattern)"
  - "Shared async helpers for server calls with Promise.all suspense coordination"
  - "Timing constants centralized in useGameState.ts with explanatory comments"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 10 Plan 01: Game UX Improvements Summary

**Single-click answer selection for Q1-Q9 with immediate lock-in, Q10 two-step preserved, timing optimized to 750ms suspense / 4s auto-advance / 20s questions**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-17T21:49:39Z
- **Completed:** 2026-02-17T21:51:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Q1-Q9 transition directly to 'locked' phase on answer selection (single-click answering)
- Q10 wager question preserves two-step select → lock-in flow for high-stakes drama
- All timing constants updated for snappier, game-show-like pacing
- Refactored state machine with Q10-aware branching logic
- Extracted shared submitAndReveal helper to eliminate code duplication
- Question timer reduced from 25s to 20s, matching overall faster flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor gameReducer for single-click answer selection** - `b6387e5` (feat)
2. **Task 2: Update timing constants and useGameState selectAnswer flow** - `97badda` (feat)

## Files Created/Modified

- `frontend/src/features/game/gameReducer.ts` - SELECT_ANSWER now branches on Q10 index, Q1-Q9 go directly to 'locked', responseTime uses 20s timer
- `frontend/src/features/game/hooks/useGameState.ts` - Timing constants updated (750ms/4s), selectAnswer refactored with submitAndReveal helper
- `frontend/src/features/game/components/ScorePopup.tsx` - Animation duration reduced from 2000ms to 1500ms
- `frontend/src/types/game.ts` - Updated GamePhase 'selected' comment to clarify Q10-only usage

## Decisions Made

**Q10 exception pattern:** Preserved two-step lock-in for Q10 wager question while implementing single-click for Q1-Q9. This maintains dramatic stakes differentiation - users can reconsider high-stakes wagers but can't accidentally double-tap on standard questions.

**Timing coordination:** All timing changes were made cohesively:
- Suspense pause: 1.5s → 750ms (50% reduction)
- Auto-advance: 6s → 4s (33% reduction)
- Score popup: 2s → 1.5s (25% reduction)
- Question timer: 25s → 20s (20% reduction)

This ensures the faster pace feels consistent across all game phases, not just answer selection.

**selectAnswer refactor:** Instead of using a unified SELECT_AND_LOCK action, kept SELECT_ANSWER and LOCK_ANSWER actions separate with branching logic in the reducer. This preserves action semantics (selection vs confirmation) while enabling conditional behavior based on question index.

**Shared helper extraction:** Created submitAndReveal async helper that both selectAnswer (Q1-Q9) and lockAnswer (Q10) call. This eliminates duplication of Promise.all suspense logic while maintaining single source of truth for server submission flow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation and build succeeded on first attempt after each task.

## Next Phase Readiness

**Ready for Plan 02 (Layout & Visual Polish):**
- State machine now supports single-click interactions (AnswerGrid can remove lock-in button for Q1-Q9)
- Timing constants available for animation duration coordination
- Q10 exception pattern established and documented
- All timing values are now centralized in useGameState.ts for easy reference

**Component updates needed in Plan 02:**
- AnswerGrid.tsx: Update onClick to call selectAnswer with timeRemaining for Q1-Q9
- GameTimer.tsx: Update onTimeUpdate to pass current time to AnswerGrid
- QuestionCard.tsx: Visual positioning and hierarchy changes
- GameScreen.tsx: Layout adjustments for 1/3 positioning

**No blockers or concerns** - state machine changes are backward compatible with existing UI components (they still work with current two-step flow). Plan 02 will update components to leverage new single-click capability.

---
*Phase: 10-game-ux-improvements*
*Completed: 2026-02-17*
