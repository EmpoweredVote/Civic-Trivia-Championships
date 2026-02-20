---
phase: quick
plan: 015
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/game/components/GameScreen.tsx
autonomous: true

must_haves:
  truths:
    - "Question text does not shift/jump when the countdown timer appears after the preview delay"
    - "Timer still appears and functions correctly when options are revealed"
    - "Layout is visually stable from the moment the question card is shown"
  artifacts:
    - path: "frontend/src/features/game/components/GameScreen.tsx"
      provides: "Reserved space for timer via fixed-height wrapper"
      contains: "min-h-[80px]"
  key_links:
    - from: "GameScreen.tsx timer wrapper"
      to: "GameTimer component (size=80)"
      via: "min-h-[80px] placeholder always rendered"
      pattern: "min-h-\\[80px\\]"
---

<objective>
Reserve space for the countdown timer when the question is first presented so the question text
does not shift downward when the timer appears after the 1-second preview delay.

Purpose: Eliminate the jarring layout shift that occurs when the GameTimer (80px circle) conditionally
renders after QUESTION_PREVIEW_MS, pushing the QuestionCard and AnswerGrid down.

Output: Modified GameScreen.tsx with a fixed-height timer container that is always rendered,
preventing content reflow.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/features/game/components/GameScreen.tsx
@frontend/src/features/game/components/GameTimer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace conditional timer rendering with always-present fixed-height wrapper</name>
  <files>frontend/src/features/game/components/GameScreen.tsx</files>
  <action>
In GameScreen.tsx, around lines 438-449, the timer is conditionally rendered inside the
AnimatePresence/motion.div block:

```tsx
{/* Timer - positioned above question */}
{(showOptions || state.phase === 'locked' || state.phase === 'revealing' || (state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) && (
  <div className="flex justify-center">
    <GameTimer ... />
  </div>
)}
```

Replace this with an always-rendered wrapper div that reserves the timer's space (80px from
CountdownCircleTimer size={80}), and conditionally render the timer INSIDE it:

```tsx
{/* Timer - always reserve space to prevent layout shift */}
<div className="flex justify-center min-h-[80px] items-center">
  {(showOptions || state.phase === 'locked' || state.phase === 'revealing' || (state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) && (
    <GameTimer
      key={timerKey}
      duration={isFinalQuestion ? finalQuestionDuration : questionDuration}
      onTimeout={onTimeout}
      onTimeUpdate={setCurrentTimeRemaining}
      isPaused={state.isTimerPaused || !showOptions}
    />
  )}
</div>
```

Key details:
- Use `min-h-[80px]` to match the GameTimer's `size={80}` prop exactly
- Keep `flex justify-center items-center` so the timer is centered within the reserved space
- The conditional logic for WHEN to show the timer remains identical
- The timer props remain identical
- Do NOT change GameTimer.tsx - only GameScreen.tsx
  </action>
  <verify>
1. Run `npx tsc --noEmit` from frontend/ to confirm no TypeScript errors
2. Visual check: Load the game, start a question. The question text should NOT shift/jump when the timer appears after the 1-second preview. The question card should remain in the same vertical position from initial render through timer appearance.
  </verify>
  <done>
The timer wrapper div is always rendered with min-h-[80px], the question text position is stable
from initial render, and the timer still appears and functions correctly after the preview delay.
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- During gameplay, question text remains vertically stable when transitioning from preview to answering phase
- Timer appears correctly after 1-second preview delay
- Timer functions normally (countdown, color changes, timeout handling)
- No visual regression on final question (amber badge + timer both visible)
</verification>

<success_criteria>
- Zero layout shift when timer appears after question preview
- All existing timer functionality preserved (countdown, pause, timeout flash)
- Question card position is identical at t=0ms and t=1000ms+ of question display
</success_criteria>

<output>
After completion, create `.planning/quick/015-reserve-timer-space-prevent-question-shift/015-SUMMARY.md`
</output>
