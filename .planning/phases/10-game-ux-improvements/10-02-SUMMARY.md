---
phase: 10-game-ux-improvements
plan: 02
subsystem: ui
tags: [react, framer-motion, tailwind, layout, animations, game-ux]

# Dependency graph
requires:
  - phase: 10-game-ux-improvements/01
    provides: Single-click state machine and timing constants
provides:
  - Repositioned game layout with visual hierarchy (timer → question → answers)
  - Bold hover glow, press-down animation, pulsing suspense glow on answers
  - Non-selected answer dimming to 30% opacity
  - Score hidden during active answering
  - Larger question text with subtle question number in HUD
  - Faster slide transitions (0.2s)
affects: [game-ux-future-enhancements, accessibility-improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Conditional score visibility based on game phase
    - Framer Motion whileTap and boxShadow array animations
    - Reduced motion fallback for all new animations

key-files:
  created: []
  modified:
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/QuestionCard.tsx
    - frontend/src/features/game/components/AnswerGrid.tsx
    - frontend/src/features/game/components/GameTimer.tsx

key-decisions:
  - "Timer above question for visual hierarchy: timer → question → answers"
  - "Content pulled high on screen (pt-2/pt-6) so answers start in top half"
  - "Timer circle ring kept, inner oval border removed for cleaner look"
  - "Learn More button centered below answer grid"
  - "Hover glow uses teal-400/20 shadow to signal click = final answer"
  - "Pulsing glow during suspense with static fallback for reduced motion"

patterns-established:
  - "Phase-conditional UI rendering (score visibility, timer visibility)"
  - "Framer Motion boxShadow array for pulsing glow animations"
  - "useReducedMotion guard on all new motion effects"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 10 Plan 02: Layout & Visual Polish Summary

**Repositioned game layout with timer above question, bold hover/press/glow answer interactions, visual hierarchy refinements, and user-directed layout tuning**

## Performance

- **Duration:** ~5 minutes (execution) + user verification and 3 iteration rounds
- **Started:** 2026-02-17T21:55:00Z
- **Completed:** 2026-02-17T22:15:00Z
- **Tasks:** 2 auto + 1 checkpoint (approved after 3 iterations)
- **Files modified:** 4

## Accomplishments

- Game layout repositioned with content high on screen — answers start in top half
- Timer moved above question card (visual flow: timer → question → answers)
- Timer circle ring preserved, inner oval border removed for cleaner look
- Bold teal hover glow on answer buttons signals "click = final answer"
- Press-down animation (scale 0.95 with spring bounce) on answer tap
- Pulsing teal glow on selected answer during suspense phase
- Non-selected answers dim to 30% opacity after selection
- Score display hidden during active answering, visible during reveal
- Question text enlarged (3xl/4xl bold), question number moved to subtle HUD indicator
- Learn More button centered below answer grid
- Faster slide transitions between questions (0.2s)
- All animations respect reduced motion preference

## Task Commits

Each task was committed atomically:

1. **Task 1: Reposition layout and update visual hierarchy** - `95fcd48` (feat)
2. **Task 2: Polish AnswerGrid with hover glow, press animation, pulsing suspense** - `e102cdf` (feat)

**User-requested adjustments after checkpoint:**
3. **Remove timer oval, move timer above question, raise layout** - `cf8333a` (fix)
4. **Restore timer circle ring, remove inner oval border** - `d029d13` (fix)
5. **Center Learn More button below answer grid** - `ce70863` (fix)

## Files Created/Modified

- `frontend/src/features/game/components/GameScreen.tsx` - Repositioned layout (pt-2/pt-6), timer above question, score conditional visibility, selectAnswer passes timeRemaining, faster transitions
- `frontend/src/features/game/components/QuestionCard.tsx` - Larger question text (3xl/4xl bold), removed visible question number, subtle topic badge
- `frontend/src/features/game/components/AnswerGrid.tsx` - Hover glow, whileTap press animation, pulsing boxShadow during suspense, opacity dimming, reduced motion support
- `frontend/src/features/game/components/GameTimer.tsx` - Removed inner oval border, kept circle ring, color-shifting number text

## Decisions Made

- **Timer above question:** User preferred timer at top of game area for visual hierarchy (timer → question → answers), rather than below answers as originally planned
- **Content high on screen:** User requested content much higher — reduced padding from pt-24/33vh to pt-2/pt-6 so answer options start in top half of screen
- **Circle ring kept, inner oval removed:** User wanted the countdown circle animation but not the extra border/oval that appeared inside it during warning/critical states
- **Learn More centered:** Moved from right-aligned to centered below the answer grid per user feedback

## Deviations from Plan

### User-Requested Changes During Checkpoint

**1. Timer position changed from below answers to above question**
- **Original plan:** Timer below answer grid
- **User feedback:** Preferred timer above question for better visual flow
- **Fix:** Moved timer rendering before QuestionCard in GameScreen.tsx
- **Committed in:** cf8333a

**2. Layout pulled up significantly**
- **Original plan:** pt-24 mobile, pt-[33vh] desktop
- **User feedback:** Content started below midpoint of screen, needed to be much higher
- **Fix:** Changed to pt-2 mobile, pt-6 desktop
- **Committed in:** cf8333a

**3. Timer circle ring restored**
- **Original plan:** Had circular ring
- **Initial fix:** Removed ring entirely (misunderstood request)
- **User clarification:** Wanted circle ring but not the inner oval border
- **Fix:** Restored strokeWidth=6/size=80, removed inner rounded-full border styling
- **Committed in:** d029d13

**4. Learn More button repositioned**
- **Original plan:** Right-aligned below answers
- **User feedback:** Looked out of place
- **Fix:** Centered below answer grid with tighter margin
- **Committed in:** ce70863

---

**Total deviations:** 4 user-directed adjustments during checkpoint verification
**Impact on plan:** All changes were visual positioning/styling within scope. No architectural changes.

## Issues Encountered

None — all changes compiled and built cleanly on first attempt.

## Next Phase Readiness

**Phase 10 complete.** All game UX improvements delivered:
- Single-click answering for Q1-Q9 (Plan 01)
- Q10 two-step wager flow preserved (Plan 01)
- Snappier timing constants (Plan 01)
- Repositioned layout with visual hierarchy (Plan 02)
- Polished answer interactions (Plan 02)

**Ready for Phase 11: Plausibility Enhancement**
- No blockers or concerns
- Game flow is stable and user-approved

---
*Phase: 10-game-ux-improvements*
*Completed: 2026-02-17*
