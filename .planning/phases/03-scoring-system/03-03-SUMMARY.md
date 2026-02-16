---
phase: 03-scoring-system
plan: 03
subsystem: game-ui
tags: [react, framer-motion, animations, scoring-ui, results-screen]

# Dependency graph
requires:
  - phase: 03-02
    provides: Frontend scoring integration (GameAnswer with score breakdown, GameResult with aggregates)
  - phase: 02-game-core
    provides: Game state machine, GameScreen, ResultsScreen
provides:
  - Animated running score display (ScoreDisplay) with spring physics
  - Floating score popups (ScorePopup) with staggered base + speed bonus
  - Shake/red flash feedback on wrong answers
  - Orange/amber timeout treatment distinct from incorrect
  - Enhanced ResultsScreen with score breakdown, fastest answer, perfect game celebration
  - Per-question accordion with points badges and score detail
affects: [04-learning-content, future-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMotionValue + animate() for spring-animated score counter"
    - "AnimatePresence for floating popup enter/exit"
    - "3-state feedback system: correct (teal/gold), wrong (red/shake), timeout (amber)"
    - "Individual accordion pattern for per-question review"

key-files:
  created:
    - frontend/src/features/game/components/ScoreDisplay.tsx
    - frontend/src/features/game/components/ScorePopup.tsx
  modified:
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/ResultsScreen.tsx
    - frontend/src/pages/Game.tsx

key-decisions:
  - "ScoreDisplay uses Framer Motion spring physics for satisfying counter animation"
  - "ScorePopup shows staggered base + speed bonus with 0.15s delay"
  - "Wrong answers get shake + red flash, no popup"
  - "Timeouts show 'Time's up!' in amber-500, distinct from wrong answer red"
  - "Results screen shows total with base/speed split, no theoretical max"
  - "Per-question review uses individual accordions with points badges"
  - "Perfect game (10/10) gets golden text + 'Perfect Game!' label"
  - "Fastest answer highlighted with response time callout"

patterns-established:
  - "Spring-animated counter with useMotionValue for game-feel score updates"
  - "3-state answer feedback: correct/wrong/timeout with distinct visual treatments"
  - "Accordion pattern for expandable per-question review"

# Metrics
duration: ~4min
completed: 2026-02-10
---

# Phase 3 Plan 3: Score Display UI & Enhanced Results Summary

**Animated score HUD with floating popups, 3-state answer feedback, and comprehensive results screen with score breakdown, fastest answer, and perfect game celebration**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-02-10
- **Tasks:** 2 code + 1 human verification
- **Files created:** 2
- **Files modified:** 3

## Accomplishments
- ScoreDisplay component with spring-animated counter (useMotionValue), shake on wrong, red flash
- ScorePopup component with staggered floating "+100" base and "+N speed bonus" popups
- Timeout shows "Time's up!" in distinct orange/amber treatment
- GameScreen integrates both components in top HUD during gameplay
- ResultsScreen overhauled: total score with base/speed split, fastest answer callout, per-question accordion with points badges, perfect game golden treatment
- Scores formatted with comma separators for readability

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ScoreDisplay and ScorePopup, integrate into GameScreen** - `94fe901` (feat)
2. **Task 2: Enhance ResultsScreen with score breakdown, fastest answer, perfect game** - `0c16c8c` (feat)

## Files Created/Modified
- `frontend/src/features/game/components/ScoreDisplay.tsx` - Animated score counter with spring physics, shake animation, red flash overlay
- `frontend/src/features/game/components/ScorePopup.tsx` - Floating score popups with AnimatePresence, staggered base + speed bonus, amber timeout
- `frontend/src/features/game/components/GameScreen.tsx` - Integrated ScoreDisplay in HUD, ScorePopup during reveal phase
- `frontend/src/features/game/components/ResultsScreen.tsx` - Total score with base/speed split, fastest answer callout, per-question accordions with points badges, perfect game golden treatment
- `frontend/src/pages/Game.tsx` - Pass score-related data to GameScreen and ResultsScreen

## Decisions Made

1. **Spring physics for score counter** - useMotionValue with stiffness: 100, damping: 20 gives satisfying game-show feel
2. **Staggered popup animation** - Base points appear first, speed bonus 0.15s later for dramatic reveal
3. **3-state feedback system** - Correct (teal/gold popups), wrong (shake + red flash), timeout (amber "Time's up!") are visually distinct
4. **Individual question accordions** - Each question expandable independently for better UX vs toggle-all
5. **No theoretical max shown** - Just the score, per CONTEXT.md decision
6. **Perfect game golden treatment** - amber-400/yellow-400 text + "Perfect Game!" label with scale animation

## Deviations from Plan

None noted — both tasks executed as planned.

## Human Verification

Approved by user. Scoring UI verified:
- Running score visible during game, updates on reveal
- Correct answers show staggered base + speed bonus popups
- Wrong answers trigger shake + red flash
- Timeouts show distinct orange treatment
- Results screen shows full breakdown with fastest answer and per-question detail
- Perfect game golden celebration works

## Next Phase Readiness

**Phase 3 Complete.** All 3 plans executed:
- 03-01: Server-side scoring engine
- 03-02: Frontend scoring integration
- 03-03: Score display UI and enhanced results

**Ready for Phase 4 (Learning & Content):**
- Full scoring system operational end-to-end
- No blockers or concerns

---
*Phase: 03-scoring-system*
*Completed: 2026-02-10*
