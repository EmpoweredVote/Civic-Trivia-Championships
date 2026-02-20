# Quick Task 013: Pause After Reveal - Tap to Continue

**One-liner:** Halved pre-reveal suspense to 375ms and replaced auto-advance with manual "Next Question" button and Space/Enter keyboard shortcut

## Changes Made

### Task 1: Halve suspense delay and remove auto-advance timer
**Commit:** ba27b93
**File:** `frontend/src/features/game/hooks/useGameState.ts`

- Changed `SUSPENSE_PAUSE_MS` from 750ms to 375ms for snappier pre-reveal pacing
- Removed `AUTO_ADVANCE_MS` constant (was 4000ms)
- Removed `autoAdvanceTimeoutRef`, `autoAdvancePausedAtRef`, `revealStartTimeRef` refs
- Removed the auto-advance `useEffect` that dispatched NEXT_QUESTION after timeout
- Removed `pauseAutoAdvance()` and `resumeAutoAdvance()` functions entirely
- Removed both from `UseGameStateReturn` interface and return object
- Simplified `nextQuestion()` to just dispatch without clearing timers
- Simplified cleanup useEffect (only suspenseTimeoutRef remains)

### Task 2: Add Next Question button and wire through Game.tsx
**Commit:** c79fe37
**Files:** `frontend/src/features/game/components/GameScreen.tsx`, `frontend/src/pages/Game.tsx`

- Added `nextQuestion` to GameScreen props (replacing `pauseAutoAdvance`/`resumeAutoAdvance`)
- Wired `nextQuestion` from `useGameState()` through Game.tsx to GameScreen
- Added centered "Next Question" button during reveal phase with teal theme
- Button displays "See Results" on the final question
- Button animates in with 0.5s delay to let reveal settle
- Added Space/Enter keyboard handler during reveal phase (disabled when Learn More modal is open)
- Updated screen reader announcements to include "Press Space or tap Next to continue"
- Simplified `handleOpenLearnMore`/`handleCloseLearnMore` (no more pause/resume calls)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles with zero errors (`npx tsc --noEmit`)
- Production build succeeds (`npm run build`)
- All success criteria met:
  - Suspense delay halved from 750ms to 375ms
  - No auto-advance after reveal
  - Visible Next Question button during reveal phase
  - Keyboard shortcuts (Space/Enter) work for advancing
  - Learn More modal still functional (no pause/resume needed)

## Key Files Modified

| File | Changes |
|------|---------|
| `frontend/src/features/game/hooks/useGameState.ts` | Halved suspense, removed auto-advance timer and related refs/functions |
| `frontend/src/features/game/components/GameScreen.tsx` | Added Next Question button, keyboard handler, updated props |
| `frontend/src/pages/Game.tsx` | Wired nextQuestion prop, removed pauseAutoAdvance/resumeAutoAdvance |
