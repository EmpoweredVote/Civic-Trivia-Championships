---
phase: 27-backend-foundation-inline-flagging
plan: 02
subsystem: ui, frontend
tags: [react, framer-motion, typescript, game-ui, flag-button]

# Dependency graph
requires:
  - phase: 27-01
    provides: Backend API endpoints POST /api/feedback/flag and DELETE /api/feedback/flag/:questionId with rate limiting
  - phase: 08-session-persistence
    provides: sessionId tracking in game state
  - phase: 09-authentication-tokens
    provides: isAuthenticated flag and accessToken from auth store
provides:
  - FlagButton component with amber fill toggle animation and CSS hover tooltip
  - Game.tsx flag state management with optimistic updates and rate limit detection
  - GameScreen flag button integration (reveal phase, authenticated users only)
  - ResultsScreen read-only flag indicators for flagged questions
  - stopPropagation on flag button to prevent tap-anywhere-to-advance from firing
affects: [28-flag-elaboration-ui, 29-admin-flag-review, frontend-flag-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic UI updates with rollback on API failure"
    - "stopPropagation on container div to prevent event bubbling to parent click handlers"
    - "Independent CSS tooltip implementation (not sharing LearnMoreTooltip system)"
    - "Read-only component state for display-only contexts (ResultsScreen)"

key-files:
  created:
    - frontend/src/features/game/components/FlagButton.tsx
  modified:
    - frontend/src/pages/Game.tsx
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/ResultsScreen.tsx

key-decisions:
  - "Independent tooltip implementation: FlagButton uses CSS hover tooltip instead of sharing LearnMoreTooltip system (user decision: independent tooltip)"
  - "stopPropagation on container div: Belt-and-suspenders approach matching existing LearnMoreButton pattern at line 497"
  - "Optimistic updates: Flag state changes immediately in UI, rolls back on API failure for responsive feel"
  - "Rate limit detection: 429 status code sets isRateLimited state, disables button with 'Too many flags' tooltip"

patterns-established:
  - "Optimistic UI pattern: Update local state immediately, call API async, rollback on failure"
  - "stopPropagation layering: Container div AND button both prevent propagation for reliable exclusion from parent click zones"
  - "Read-only prop pattern: Same component used for interactive (game) and display-only (results) contexts via readOnly prop"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 27 Plan 02: Backend Foundation & Inline Flagging Summary

**Inline flag button with amber toggle animation, optimistic updates, and stopPropagation exclusion from tap-to-advance zone**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T02:11:45Z
- **Completed:** 2026-02-22T02:15:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- FlagButton component renders flag icon with amber fill toggle animation on flag/unflag
- Game.tsx manages flaggedQuestions Set and handles POST/DELETE API calls with optimistic updates
- GameScreen shows flag button in top-right corner during reveal phase for authenticated users only
- ResultsScreen displays read-only amber flag icons next to questions that were flagged during session
- stopPropagation prevents flag button taps from triggering tap-anywhere-to-advance behavior
- Rate limit detection disables flag button with tooltip when 429 response received

## Task Commits

Each task was committed atomically:

1. **Task 1: FlagButton component + Game.tsx state management** - `49868f3` (feat)
2. **Task 2: GameScreen + ResultsScreen integration** - `a926dd7` (feat)

## Files Created/Modified
- `frontend/src/features/game/components/FlagButton.tsx` - Reusable flag button with amber fill animation, CSS tooltip, stopPropagation on container
- `frontend/src/pages/Game.tsx` - Flag state management with flaggedQuestions Set, isRateLimited state, handleFlagToggle with optimistic updates and 429 detection
- `frontend/src/features/game/components/GameScreen.tsx` - FlagButton rendered during reveal phase for authenticated users, positioned absolutely in top-right corner
- `frontend/src/features/game/components/ResultsScreen.tsx` - Read-only flag indicators shown next to question number and topic icon for flagged questions

## Decisions Made
- **Independent tooltip implementation:** FlagButton uses CSS hover tooltip instead of LearnMoreTooltip system. User explicitly decided tooltips should be independent per research context (avoiding tooltip system complexity for this simple use case)
- **stopPropagation on container div:** Added stopPropagation to both container div and button (belt-and-suspenders) matching existing LearnMoreButton pattern at line 497. Research identified this as critical to prevent tap-anywhere-to-advance from firing
- **Optimistic UI updates:** Flag state changes immediately in UI before API call completes, with rollback on failure. Rationale: Responsive feel for game experience, low risk (cosmetic state only)
- **Rate limit tooltip wording:** "Too many flags -- try again later" matches casual game tone while communicating limitation clearly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all tasks executed as planned

## User Setup Required
None - no external service configuration required. Flag button uses existing auth state and API endpoints from phase 27-01.

## Next Phase Readiness
**Ready for Phase 28 (Flag Elaboration UI):**
- Flag button functional and integrated into game flow
- flaggedQuestions state tracked throughout game session
- API calls working with proper error handling
- stopPropagation prevents accidental flag triggers from tap-to-advance

**Ready for Phase 29 (Admin Flag Review):**
- Flags being submitted to backend via POST /api/feedback/flag
- Flag data includes questionId and sessionId for admin review context
- Rate limiting prevents abuse (enforced by backend from 27-01)

**No blockers:** Frontend flag collection infrastructure complete. Post-game elaboration can build on flaggedQuestions state in Game.tsx.

---
*Phase: 27-backend-foundation-inline-flagging*
*Completed: 2026-02-22*
