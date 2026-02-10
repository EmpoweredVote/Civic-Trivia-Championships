---
phase: 02-game-core
plan: 03
subsystem: ui-components
tags: [react, typescript, framer-motion, tailwindcss, game-ui, countdown-timer]

# Dependency graph
requires:
  - phase: 02-02
    provides: useGameState hook with game state machine
  - phase: 02-02
    provides: useKeyPress hook for keyboard shortcuts
  - phase: 02-01
    provides: Game type definitions and Question type
provides:
  - GameScreen container component for full game experience
  - AnswerGrid with responsive 2x2 layout and reveal animations
  - GameTimer with circular countdown and color transitions
  - ProgressDots for question position tracking
  - QuestionCard for question display
  - ConfirmDialog reusable component
affects:
  - phase: 02-04
    needs: GameScreen ready for integration into routing
  - phase: 02-05
    needs: Results display pattern established

# Tech tracking
tech-stack:
  added:
    - react-countdown-circle-timer (circular timer component)
    - framer-motion (answer reveal animations, dialog transitions)
  patterns:
    - Responsive CSS Grid (2x2 desktop, 1-column mobile)
    - Two-step lock-in UI pattern (select, then confirm)
    - AnimatePresence for smooth question transitions
    - Millionaire aesthetic (dark gradients, dramatic reveals)

key-files:
  created:
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/AnswerGrid.tsx
    - frontend/src/features/game/components/GameTimer.tsx
    - frontend/src/features/game/components/ProgressDots.tsx
    - frontend/src/features/game/components/QuestionCard.tsx
    - frontend/src/shared/components/ConfirmDialog.tsx
  modified: []

key-decisions:
  - "Circular timer depletes clockwise with teal->yellow->orange->red color transitions"
  - "Progress dots use neutral fill only, no correct/incorrect coloring"
  - "Two-step lock-in: click to select, 'Lock In' button to confirm"
  - "Reveal animation: fade wrong options to 30% opacity, scale correct answer to 1.05x"
  - "Keyboard shortcuts A/B/C/D for desktop answer selection"
  - "Quit dialog pauses game, shows 'Continue Playing' as primary action"
  - "Timeout shows 1s 'Time's up!' flash before revealing correct answer"
  - "Wrong answers show 'Not quite' feedback (never 'Wrong' or judgmental language)"

patterns-established:
  - "Game screen composition: top HUD (quit, progress, timer), centered question, bottom answer grid"
  - "AnimatePresence wraps question transitions for smooth fade/slide"
  - "Framer Motion animate prop for opacity and scale reveal effects"
  - "Reusable ConfirmDialog with overlay, role=dialog, aria-modal=true"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 2 Plan 3: Game Screen UI Summary

**Complete game interface with Millionaire aesthetic, circular countdown timer, responsive answer grid, and Framer Motion reveal animations**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-10 18:55 UTC
- **Completed:** 2026-02-10 18:57 UTC
- **Tasks completed:** 2/2
- **Files created:** 6 React components

## Accomplishments

Built the complete visual layer for the civic trivia game with Who Wants to Be a Millionaire aesthetic:

1. **GameTimer component** - Circular countdown using react-countdown-circle-timer with teal->yellow->orange->red color transitions at 20s, 10s, 5s, and 0s thresholds
2. **ProgressDots component** - 10 dots showing current question position with neutral fill (current = teal, past = dimmed teal, future = outline)
3. **QuestionCard component** - Displays question text prominently with topic badge and "X of 10" counter
4. **ConfirmDialog component** - Reusable confirmation dialog with Framer Motion AnimatePresence, overlay, and accessibility attributes
5. **AnswerGrid component** - Responsive 2x2 grid (desktop) / vertical stack (mobile) with:
   - Letter labels A/B/C/D on each option
   - Two-step lock-in flow (select highlights, Lock In button confirms)
   - Reveal animations: fade wrong options to 30% opacity, scale correct answer to 1.05x
   - Explanation display during reveal phase with "Not quite" feedback for wrong answers
6. **GameScreen container** - Main orchestrator component with:
   - Keyboard shortcuts A/B/C/D for answer selection
   - Quit dialog with confirmation
   - Timeout handling with 1s "Time's up!" flash message
   - Millionaire aesthetic: dark gradient background with radial bloom effect
   - AnimatePresence for smooth question transitions
   - Idle state with "Quick Play" button
   - Complete state with score display (placeholder until results screen in Plan 04)

## Task Commits

| Task | Commit  | Description                                                 |
| ---- | ------- | ----------------------------------------------------------- |
| 1    | 2789d31 | Create GameTimer, ProgressDots, QuestionCard, ConfirmDialog |
| 2    | eef96f0 | Create AnswerGrid and GameScreen container                  |

## Files Created/Modified

**Created (6 files):**
- `frontend/src/features/game/components/GameScreen.tsx` - Main game container (220 lines)
- `frontend/src/features/game/components/AnswerGrid.tsx` - Answer grid with animations (146 lines)
- `frontend/src/features/game/components/GameTimer.tsx` - Circular countdown timer (41 lines)
- `frontend/src/features/game/components/ProgressDots.tsx` - Progress indicator (33 lines)
- `frontend/src/features/game/components/QuestionCard.tsx` - Question display (27 lines)
- `frontend/src/shared/components/ConfirmDialog.tsx` - Reusable dialog (74 lines)

**Modified:** None

## Decisions Made

1. **Timer color transitions** - Used teal->yellow->orange->red at 20s, 10s, 5s, 0s thresholds to create dramatic tension
2. **Neutral progress dots** - Per CONTEXT.md, progress dots show position only, no correct/incorrect coloring to avoid judgment
3. **Two-step lock-in** - Select highlights option, Lock In button confirms to prevent accidental submissions
4. **Non-judgmental feedback** - Wrong answers show "Not quite" instead of "Wrong" or "Incorrect" to maintain encouraging tone
5. **Keyboard shortcuts** - A/B/C/D keys select answers during answering phase only (disabled during locked/revealing)
6. **Quit confirmation** - "Continue Playing" as cancel action reinforces staying in game
7. **Responsive grid** - CSS Grid with 2 columns on desktop (min-width 768px), 1 column on mobile for readability
8. **Reveal animations** - Framer Motion animate prop with 0.5s duration for smooth opacity and scale transitions

## Deviations from Plan

None - plan executed exactly as written. All components implemented per specification with:
- Responsive 2x2/vertical layout
- Circular timer with color transitions
- Two-step lock-in flow
- Framer Motion reveal animations
- Keyboard shortcuts
- Quit dialog
- Millionaire aesthetic

## Issues Encountered

**Minor TypeScript warning (auto-fixed):**
- **Issue:** Unused variable `isFuture` in ProgressDots component
- **Resolution:** Removed unused variable, conditional logic simplified
- **Rule applied:** Rule 1 (Bug) - auto-fixed during compilation check

No other issues encountered. All components compiled successfully on first attempt after minor fix.

## User Setup Required

None. All dependencies (framer-motion, react-countdown-circle-timer) were already installed in frontend package.json.

## Next Phase Readiness

**Ready for Plan 02-04 (Game Integration):**
- GameScreen component exports complete game experience
- Can be integrated into routing system
- Idle state handles game start
- Complete state ready for results screen connection

**Blockers:** None

**Concerns:** None

**Technical debt:** Timer time remaining calculation uses placeholder value (10s) in lockAnswer call. Future enhancement: expose timer ref from GameTimer to get actual remaining time.

---
*Phase: 02-game-core*
*Completed: 2026-02-10*
