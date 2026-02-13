---
phase: 06-wager-mechanics
plan: 01
subsystem: game-core
tags: [game-state, state-machine, scoring, validation, typescript]

# Dependency graph
requires:
  - phase: 05-progression-profile
    provides: Complete game flow with results and progression tracking
  - phase: 03-scoring-system
    provides: Server-side scoring infrastructure and session management
  - phase: 02-game-core
    provides: Game state machine and reducer pattern
provides:
  - Complete wager data layer with types, state machine transitions, and API contracts
  - Server-side wager validation (only Q10, max half score, non-negative)
  - Wager-only scoring for final question (no base points, no speed bonus)
  - Hook methods for wager flow (startWager, setWagerAmount, lockWager)
  - Automatic state transitions: final-announcement → wagering → wager-locked → answering
affects: [06-02-wager-ui, 06-03-results-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wager as optional parameter in answer submission (not separate endpoint)"
    - "Phase-based state machine for multi-step wager flow"
    - "Server-authority validation with client-side clamping"
    - "Extended question duration for final question (50s vs 25s)"

key-files:
  created: []
  modified:
    - frontend/src/types/game.ts
    - frontend/src/features/game/gameReducer.ts
    - frontend/src/services/gameService.ts
    - frontend/src/features/game/hooks/useGameState.ts
    - backend/src/services/sessionService.ts
    - backend/src/routes/game.ts

key-decisions:
  - "Wager integrated into answer submission (not separate endpoint) per research recommendations"
  - "Final question uses 50s duration instead of 25s"
  - "Wager-only scoring bypasses base points and speed bonus entirely"
  - "Default wager set to 25% of maximum (half of current score)"
  - "State machine reuses 'answering' phase for Q10 after wager locked"

patterns-established:
  - "Wager validation: only Q10, non-negative, max = floor(currentScore / 2)"
  - "Wager scoring: +wager for correct, -wager for incorrect/timeout"
  - "Four new game phases for wager flow inserted before 'complete'"
  - "Auto-transition pattern: announcement timer → startWager after 2.5s"
  - "Suspense pause pattern: lockWager → 1.5s delay → START_FINAL_QUESTION"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 6 Plan 1: Wager Mechanics Data Layer Summary

**Complete wager data and logic layer: types with 4 new phases, state machine with Q10 detection, server-side validation (max half score), wager-only scoring, and hook methods for UI consumption**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T05:21:18Z
- **Completed:** 2026-02-12T05:25:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended type system with 4 new GamePhase values and wager fields throughout the data flow
- Implemented complete state machine for wager flow with Q10 detection and phase guards
- Built server-side wager validation (only on Q10, max half of current score, non-negative)
- Implemented wager-only scoring logic (bypasses base points and speed bonus)
- Created hook methods (startWager, setWagerAmount, lockWager) with auto-transition timers
- Established 50-second duration for final question vs 25 seconds for regular questions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, state machine, and API service for wager flow** - `bee872d` (feat)
2. **Task 2: Backend wager validation, scoring, and hook wager methods** - `2b6c02f` (feat)

## Files Created/Modified

- `frontend/src/types/game.ts` - Added 4 new GamePhase values (final-announcement, wagering, wager-locked, final-question), wagerAmount/wagerCategory to GameState, optional wager field to GameAnswer, wagerResult to GameResult
- `frontend/src/features/game/gameReducer.ts` - Added 5 new GameAction types, implemented Q10 detection in NEXT_QUESTION, added wager to Q10 answers in REVEAL_ANSWER/TIMEOUT, adjusted responseTime for 50s duration, reset wager state on session create/quit
- `frontend/src/services/gameService.ts` - Extended submitAnswer to accept optional wager parameter, conditionally include in request body
- `frontend/src/features/game/hooks/useGameState.ts` - Added startWager/setWagerAmount/lockWager methods, modified lockAnswer/handleTimeout to include wager for Q10, added final-announcement auto-transition effect, extended gameResult to include wagerResult
- `backend/src/services/sessionService.ts` - Added wager field to ServerAnswer, wagerResult to GameSessionResult, FINAL_QUESTION_DURATION constant, wager validation (only Q10, non-negative, max half score), wager-only scoring logic, extended plausibility checks for 50s duration, wagerResult calculation in getResults
- `backend/src/routes/game.ts` - Extract wager from request body, pass to sessionManager.submitAnswer, include in response JSON, fix correct flag for wager scoring

## Decisions Made

- **Wager as answer parameter, not separate endpoint:** Research recommended integrating wager into answer submission to keep the flow atomic and avoid race conditions
- **50-second duration for final question:** Doubled from 25s to give players adequate time to read a potentially complex question after the wager decision
- **Wager-only scoring (no base/speed):** Final question scoring uses only the wager amount (+/- wager) with no base points or speed bonus to match game show mechanics
- **Default wager to 25% of max:** When entering wagering phase, pre-populate with 25% of maximum allowed (half of current score) as reasonable middle ground
- **Reuse 'answering' phase for Q10:** After wager locked, transition to existing 'answering' phase so SELECT_ANSWER/LOCK_ANSWER/REVEAL_ANSWER/TIMEOUT all work unchanged
- **Q10 without wager scores 0:** If final question answered without wager (edge case), treat as 0 wager to avoid punishing players

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compiled cleanly, logic implemented as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wager data layer complete and ready for UI implementation (Plan 02)
- State machine handles full transition chain: revealing (Q9) → NEXT_QUESTION → final-announcement → START_WAGER → wagering → SET_WAGER → LOCK_WAGER → wager-locked → START_FINAL_QUESTION → answering (Q10)
- Server validates all wager constraints and returns proper scoring
- Hook exposes all methods needed for UI components (announcement screen, wager input, suspense)
- gameResult includes wagerResult for results screen display (Plan 03)
- No blockers - ready to build UI components on this foundation

---
*Phase: 06-wager-mechanics*
*Completed: 2026-02-12*
