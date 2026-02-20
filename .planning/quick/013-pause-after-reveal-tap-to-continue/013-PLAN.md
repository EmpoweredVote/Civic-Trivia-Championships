---
phase: quick
plan: 013
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/game/hooks/useGameState.ts
  - frontend/src/features/game/components/GameScreen.tsx
  - frontend/src/pages/Game.tsx
autonomous: true

must_haves:
  truths:
    - "Pre-reveal suspense delay is half the current duration (~375ms instead of ~750ms)"
    - "After answer reveal, game pauses indefinitely until user acts"
    - "A visible Next Question button appears during reveal phase"
    - "User can press Space or Enter to advance during reveal phase"
    - "Learn More modal still works during reveal pause"
  artifacts:
    - path: "frontend/src/features/game/hooks/useGameState.ts"
      provides: "Halved suspense timing, removed auto-advance timer"
    - path: "frontend/src/features/game/components/GameScreen.tsx"
      provides: "Next Question button and keyboard shortcut during reveal"
    - path: "frontend/src/pages/Game.tsx"
      provides: "Passes nextQuestion callback to GameScreen"
  key_links:
    - from: "GameScreen.tsx"
      to: "useGameState.ts nextQuestion"
      via: "prop passed through Game.tsx"
      pattern: "nextQuestion"
    - from: "GameScreen.tsx Next button"
      to: "gameReducer NEXT_QUESTION"
      via: "onClick -> nextQuestion()"
      pattern: "onClick.*nextQuestion"
---

<objective>
Change game flow so the pre-reveal suspense delay is halved and the post-reveal phase pauses indefinitely until the user taps "Next Question" (or presses Space/Enter).

Purpose: Give players unlimited time to read explanations without slowing the pre-reveal moment.
Output: Modified useGameState.ts, GameScreen.tsx, and Game.tsx with manual advance behavior.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/features/game/hooks/useGameState.ts
@frontend/src/features/game/components/GameScreen.tsx
@frontend/src/pages/Game.tsx
@frontend/src/features/game/gameReducer.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Halve suspense delay and remove auto-advance timer</name>
  <files>
    frontend/src/features/game/hooks/useGameState.ts
  </files>
  <action>
  In useGameState.ts:

  1. Change `SUSPENSE_PAUSE_MS` from `750` to `375`.

  2. Remove the `AUTO_ADVANCE_MS` constant entirely (line 10).

  3. Remove the entire `useEffect` block (lines 304-327) that auto-advances when `state.phase === 'revealing'`. This is the effect that sets `autoAdvanceTimeoutRef.current = setTimeout(...)` with `AUTO_ADVANCE_MS`.

  4. Remove `autoAdvanceTimeoutRef` ref declaration (line 43) and all references to it:
     - In `nextQuestion()` function (lines 232-235), remove the clearTimeout for autoAdvanceTimeoutRef — just keep `dispatch({ type: 'NEXT_QUESTION' })`.
     - In the cleanup useEffect at the bottom (lines 363-372), remove the autoAdvanceTimeoutRef cleanup.

  5. Remove `autoAdvancePausedAtRef` and `revealStartTimeRef` refs (lines 45-46).

  6. Remove `pauseAutoAdvance` function entirely (lines 270-278).

  7. Remove `resumeAutoAdvance` function entirely (lines 281-291).

  8. Remove `pauseAutoAdvance` and `resumeAutoAdvance` from the return object.

  9. Remove them from the `UseGameStateReturn` interface.

  Note: The Learn More modal in GameScreen currently calls `pauseAutoAdvance`/`resumeAutoAdvance`. Since there is no longer an auto-advance timer, these are unnecessary. GameScreen will be updated in Task 2 to remove these calls.
  </action>
  <verify>
  Run `npx tsc --noEmit` from the frontend directory. TypeScript will show errors in GameScreen.tsx and Game.tsx about missing pauseAutoAdvance/resumeAutoAdvance props — that is expected and will be fixed in Task 2.
  </verify>
  <done>
  SUSPENSE_PAUSE_MS is 375. No auto-advance timer exists. No pauseAutoAdvance/resumeAutoAdvance in useGameState.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Next Question button and wire nextQuestion through Game.tsx</name>
  <files>
    frontend/src/pages/Game.tsx
    frontend/src/features/game/components/GameScreen.tsx
  </files>
  <action>
  **Game.tsx changes:**

  1. Destructure `nextQuestion` from `useGameState()` (add it to the destructuring on ~line 13-31).

  2. Pass `nextQuestion` as a prop to `<GameScreen>`.

  3. Remove `pauseAutoAdvance` and `resumeAutoAdvance` from the destructuring and from the `<GameScreen>` props.

  **GameScreen.tsx changes:**

  1. Update `GameScreenProps` interface:
     - Add `nextQuestion: () => void`
     - Remove `pauseAutoAdvance: () => void`
     - Remove `resumeAutoAdvance: () => void`

  2. Update the component destructuring to add `nextQuestion` and remove `pauseAutoAdvance`/`resumeAutoAdvance`.

  3. Update `handleOpenLearnMore` (line 105-109): Remove the `pauseAutoAdvance()` call. Keep just `setShowTooltip(false)` and `setIsLearnMoreOpen(true)`.

  4. Update `handleCloseLearnMore` (line 112-115): Remove the `resumeAutoAdvance()` call. Keep just `setIsLearnMoreOpen(false)`.

  5. Add a "Next Question" button in the revealing phase. Place it AFTER the Learn More button section (after line 527, inside the same `motion.div`). Render it when `state.phase === 'revealing'`:

  ```tsx
  {/* Next Question button - pauses until user taps */}
  {state.phase === 'revealing' && (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      onClick={nextQuestion}
      className="mt-6 mb-4 px-8 py-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 min-h-[48px]"
      aria-label="Next question"
    >
      {state.currentQuestionIndex < state.questions.length - 1 ? 'Next Question' : 'See Results'}
    </motion.button>
  )}
  ```

  The button says "Next Question" for regular questions and "See Results" for the last question. It uses the teal color scheme consistent with the app. The `delay: 0.5` gives the reveal animation time to settle before the button appears.

  6. Add a keyboard shortcut for Space and Enter during reveal phase. Add a new `useEffect` block:

  ```tsx
  // Space/Enter to advance during reveal phase
  useEffect(() => {
    if (state.phase !== 'revealing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if Learn More modal is open
      if (isLearnMoreOpen) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        nextQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.phase, isLearnMoreOpen, nextQuestion]);
  ```

  Place this effect near the other keyboard handler effects (around line 186-201).

  7. Add a screen reader announcement when reveal pauses. In the existing effect that announces answer results (lines 243-264), append to the message: Add `' Press Space or tap Next to continue.'` to each message string.
  </action>
  <verify>
  Run `npx tsc --noEmit` from the frontend directory — should compile with zero errors.
  Run `npm run build` from the frontend directory — should build successfully.
  Then run `npm run dev` and play a game: after selecting an answer, verify (a) the suspense delay feels snappier, (b) the answer reveal pauses with a visible "Next Question" button, (c) clicking the button or pressing Space/Enter advances to the next question, (d) Learn More modal still opens and closes correctly during the pause.
  </verify>
  <done>
  Game pauses after reveal with a "Next Question" button. Space/Enter keyboard shortcut works. No auto-advance timer. Learn More modal still functional. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` succeeds
3. Play a full game and confirm:
   - Pre-reveal pause is noticeably shorter (~375ms)
   - Game pauses indefinitely after answer reveal
   - "Next Question" button is visible and styled consistently
   - Button text changes to "See Results" on final question
   - Clicking the button advances to next question
   - Pressing Space or Enter advances to next question
   - Learn More button/modal still works during reveal pause
   - Escape key pause overlay still works during answering phase
</verification>

<success_criteria>
- Suspense delay halved from 750ms to 375ms
- No auto-advance after reveal — game waits for explicit user action
- Visible, accessible "Next Question" button during reveal phase
- Keyboard shortcuts (Space/Enter) work for advancing
- All existing functionality (Learn More, pause overlay, streaks, final question flow) unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/013-pause-after-reveal-tap-to-continue/013-SUMMARY.md`
</output>
