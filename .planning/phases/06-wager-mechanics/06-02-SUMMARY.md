---
phase: 06-wager-mechanics
plan: 02
subsystem: game-ui
tags: [react, framer-motion, game-flow, ux, accessibility, typescript]

# Dependency graph
requires:
  - phase: 06-wager-mechanics
    plan: 01
    provides: Wager data layer with state machine transitions and hook methods
  - phase: 02-game-core
    provides: GameScreen component and phase-based rendering pattern
  - phase: 04-learning-content
    provides: AnimatePresence patterns and modal overlay techniques
provides:
  - FinalQuestionAnnouncement: Full-screen dramatic announcement component
  - WagerScreen: Wager input with slider, outcome preview, and context-aware button
  - GameScreen integration: Conditional rendering for wager phases and final question styling
  - Complete wager flow UI: announcement → wager input → final question with extended timer
affects: [06-03-results-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native range input with custom Tailwind styling and CSS pseudo-elements"
    - "Context-aware button text based on slider value ('Play for Fun' vs 'Lock In Wager')"
    - "Full-screen phase transitions using AnimatePresence"
    - "Conditional visual styling for special game states (amber glow for final question)"

key-files:
  created:
    - frontend/src/features/game/components/FinalQuestionAnnouncement.tsx
    - frontend/src/features/game/components/WagerScreen.tsx
  modified:
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/pages/Game.tsx

key-decisions:
  - "Native range input instead of third-party slider library for simplicity and accessibility"
  - "Slider defaults to 25% of max (pre-populated via state machine in 06-01)"
  - "Zero-score edge case shows disabled slider with 'Play for Fun' button only"
  - "Final question badge and amber glow styling signals special status visually"
  - "Score popup disabled for final question (wager-only scoring has no base/speed breakdown)"

patterns-established:
  - "Full-screen dedicated UI for major phase transitions (not overlays)"
  - "aria-valuetext and aria-live for slider accessibility"
  - "Custom CSS pseudo-elements for native input styling (::-webkit-slider-thumb, ::-moz-range-thumb)"
  - "Timer reset effect when entering specific phase (Q10 answering phase)"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 6 Plan 2: Wager UI Components Summary

**Full-screen wager flow UI with dramatic announcement, native slider input (0 to half score), live outcome preview, context-aware button, and final question amber styling with extended 50s timer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T02:07:24Z
- **Completed:** 2026-02-13T02:10:50Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Built FinalQuestionAnnouncement component with pulsing golden text and spotlight gradient effect
- Built WagerScreen component with slider, category hint, outcome preview, and context-aware button
- Integrated wager phases into GameScreen with conditional rendering for full-screen transitions
- Added final question visual distinction with 50s timer, amber border glow, and "FINAL QUESTION" badge
- Wired wager methods from useGameState hook through Game.tsx to GameScreen to components
- Disabled score popup for final question (wager-only scoring has no base/speed breakdown to display)

## Task Commits

Each task was committed atomically:

1. **Task 1: FinalQuestionAnnouncement and WagerScreen components** - `45e07c9` (feat)
2. **Task 2: GameScreen integration and Game.tsx wiring** - `e96cdc8` (feat)

## Files Created/Modified

- `frontend/src/features/game/components/FinalQuestionAnnouncement.tsx` - Full-screen dramatic announcement with AnimatePresence, pulsing text animation, golden glow, decorative lines, and spotlight gradient
- `frontend/src/features/game/components/WagerScreen.tsx` - Wager input screen with native range slider (0 to half score), TOPIC_LABELS category display, live outcome preview (if correct/wrong), context-aware button text, zero-score edge case handling, custom CSS for slider thumb styling, locked state indicator
- `frontend/src/features/game/components/GameScreen.tsx` - Added imports for new components, updated GameScreenProps interface, added FINAL_QUESTION_DURATION constant (50s), conditional rendering for final-announcement/wagering/wager-locked phases, timer reset effect for Q10, extended timer duration for final question, amber border glow and badge for final question styling, disabled score popup for final question
- `frontend/src/pages/Game.tsx` - Pass setWagerAmount, lockWager, isFinalQuestion from hook to GameScreen

## Decisions Made

- **Native range input with custom CSS:** Used native `<input type="range">` with custom Tailwind and CSS pseudo-element styling instead of a third-party slider library for simplicity, accessibility, and smaller bundle size
- **Context-aware button text:** Button says "Play for Fun" when wager is 0, "Lock In Wager" when above 0 - no separate skip button needed
- **Zero-score edge case:** Users with 0 score see disabled slider and "No points to wager" message, can only click "Play for Fun"
- **Full-screen phase transitions:** Wager announcement and input are dedicated full-screen views (not overlays), matching the dramatic game show feel
- **Amber styling for final question:** Border glow, badge, and extended timer visually distinguish Q10 from regular questions
- **Disabled score popup for Q10:** Wager-only scoring has no base points or speed bonus breakdown to show in the popup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all TypeScript compiled cleanly, components rendered as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wager flow UI complete and integrated into game flow
- Users can now experience: Q9 reveal → "FINAL QUESTION" announcement → wager screen with slider → Q10 with 50s timer and amber styling
- State machine handles full transition chain from 06-01 data layer
- Wager amount and result are captured in game state for results screen display
- Ready for Plan 03: Results screen wager breakdown display (show wager amount, outcome, and dramatic score change separately from Q1-Q9)
- No blockers - full wager experience playable end-to-end

---
*Phase: 06-wager-mechanics*
*Completed: 2026-02-13*
