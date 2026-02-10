---
phase: 02-game-core
plan: 02
subsystem: game-logic
tags: [react, useReducer, state-machine, hooks, typescript]

# Dependency graph
requires:
  - phase: 02-01
    provides: Game types (GameState, GameAction, Question) and API endpoint for question fetching
provides:
  - Pure game state reducer with all phase transitions
  - useGameState hook wrapping reducer with lifecycle management
  - useKeyPress hook for keyboard shortcuts with cleanup
  - Suspense pause and auto-advance timing logic
affects: [02-03 (UI components will consume useGameState hook)]

# Tech tracking
tech-stack:
  added: []
  patterns: [reducer-based state machine, custom hooks for side effects, timeout management with cleanup]

key-files:
  created:
    - frontend/src/features/game/gameReducer.ts
    - frontend/src/features/game/hooks/useGameState.ts
    - frontend/src/features/game/hooks/useKeyPress.ts
  modified: []

key-decisions:
  - "useReducer pattern for game state machine ensures predictable transitions"
  - "1.5s suspense pause after lock-in for dramatic effect"
  - "4s auto-advance after reveal balances reading time with game pace"
  - "Keyboard shortcut hook excludes INPUT/TEXTAREA to prevent interference with forms"

patterns-established:
  - "Pure reducer pattern: all state transitions are pure functions without side effects"
  - "Hook-based side effects: timeouts and async operations handled in useGameState hook"
  - "Ref-based timeout management with cleanup on unmount"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 2 Plan 2: Game State Machine Summary

**Pure reducer-based state machine with useReducer, custom hooks for game lifecycle, suspense pause (1.5s), and auto-advance (4s) timing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T18:39:18Z
- **Completed:** 2026-02-10T18:40:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Game state reducer handles all phase transitions: idle → starting → answering → selected → locked → revealing → answering (next) → complete
- useGameState hook manages complete game lifecycle with async question fetching, suspense pause, and auto-advance
- useKeyPress hook handles keyboard shortcuts with proper cleanup and input exclusion
- All timeouts properly cleaned up on unmount

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement game state reducer** - `aa6a0fb` (feat)
2. **Task 2: Create useGameState and useKeyPress hooks** - `da0bf01` (feat)

## Files Created/Modified
- `frontend/src/features/game/gameReducer.ts` - Pure state machine reducer handling all game actions (START_GAME, SELECT_ANSWER, LOCK_ANSWER, REVEAL_ANSWER, TIMEOUT, NEXT_QUESTION, QUIT_GAME)
- `frontend/src/features/game/hooks/useGameState.ts` - Hook wrapping gameReducer with action dispatchers, async question fetching, suspense pause (1.5s), auto-advance (4s), and timeout cleanup
- `frontend/src/features/game/hooks/useKeyPress.ts` - Keyboard shortcut hook with event listener cleanup and input element exclusion

## Decisions Made
- **Suspense pause duration:** 1.5s after lock-in before reveal provides dramatic tension
- **Auto-advance duration:** 4s after reveal allows time to read explanation without feeling slow
- **Timeout type:** Used `number` instead of `NodeJS.Timeout` for browser compatibility
- **Manual advance cancels auto-advance:** User clicking "Next" clears the auto-advance timer to avoid double-transition

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript timeout type mismatch:** Initial implementation used `NodeJS.Timeout` type for timeout refs, but this caused type errors in browser environment. Fixed by using `number` type which works universally (setTimeout returns number in browser, NodeJS.Timeout in Node).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Game state machine complete and ready for UI integration (Plan 02-03). Components can now:
- Call `useGameState()` to access game state and action dispatchers
- Use `useKeyPress()` for keyboard shortcuts (A/B/C/D for answer selection)
- Consume `currentQuestion` and `gameResult` derived values
- Trigger state transitions via `startGame()`, `selectAnswer()`, `lockAnswer()`, `nextQuestion()`, etc.

All timing logic (suspense pause, auto-advance) is handled internally by the hooks, keeping UI components clean.

---
*Phase: 02-game-core*
*Completed: 2026-02-10*
