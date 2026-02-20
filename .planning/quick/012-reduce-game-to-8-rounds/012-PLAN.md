---
phase: quick
plan: 012
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/questionService.ts
  - backend/src/services/sessionService.ts
  - frontend/src/features/game/gameReducer.ts
  - frontend/src/features/game/hooks/useGameState.ts
  - frontend/src/features/game/components/GameScreen.tsx
  - frontend/src/features/game/components/QuestionCard.tsx
  - frontend/src/features/game/components/ProgressDots.tsx
  - frontend/src/features/game/components/ResultsScreen.tsx
autonomous: true

must_haves:
  truths:
    - "A new game starts with 8 questions instead of 10"
    - "Round 8 is the Final Question with wager mechanics"
    - "Progress dots show 8 dots, not 10"
    - "Question card shows 'Question N of 8'"
    - "Screen reader announces 'Question 1 of 8'"
    - "Final question wager scoring works correctly on Q8"
    - "Results screen shows wager info for Q8 (last question)"
  artifacts:
    - path: "backend/src/services/questionService.ts"
      provides: "8-question selection with difficulty balance"
      contains: "TOTAL_QUESTIONS = 8"
    - path: "backend/src/services/sessionService.ts"
      provides: "Final question detection at index 7"
    - path: "frontend/src/features/game/gameReducer.ts"
      provides: "Final question logic at last index"
    - path: "frontend/src/features/game/hooks/useGameState.ts"
      provides: "isFinalQuestion derived from questions.length"
  key_links:
    - from: "questionService.ts"
      to: "sessionService.ts"
      via: "question count determines final question index"
      pattern: "TOTAL_QUESTIONS"
    - from: "gameReducer.ts"
      to: "useGameState.ts"
      via: "final question index must match"
      pattern: "questions.length - 1"
---

<objective>
Reduce the game from 10 rounds to 8 rounds. Round 8 becomes the Final Question (wager round), replacing the previous round 10 in that role. All hardcoded references to 10 questions, index 9 (for final question), and "of 10" display strings must be updated.

Purpose: Shorter games improve session pacing and reduce player drop-off before the dramatic Final Question.
Output: All backend and frontend code updated so games are 8 rounds with Q8 as the Final Question.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update backend question selection and session scoring for 8 rounds</name>
  <files>
    backend/src/services/questionService.ts
    backend/src/services/sessionService.ts
  </files>
  <action>
**questionService.ts** -- Add a constant and update the difficulty selection algorithm:

1. Add a named constant at the top of the file (near the imports):
   ```ts
   const TOTAL_QUESTIONS = 8;
   ```

2. In `loadQuestionsFromJSON()` (line ~107): Change `.slice(0, 10)` to `.slice(0, TOTAL_QUESTIONS)`.

3. In the JSDoc comment for `applyDifficultySelection()` (lines ~112-119): Update the target distribution:
   - Q1 = easy (unchanged)
   - Q8 = hard (was Q10)
   - Q2-Q7 = 2 easy + 2 medium + 2 hard (shuffled) -- was Q2-Q9 with 3+3+2

4. In `applyDifficultySelection()`:
   - Line ~131: Change `if (total < 10)` to `if (total < TOTAL_QUESTIONS)`.
   - Lines ~148-156: Rename variable from `q10` to `qFinal` (cosmetic clarity). Logic stays the same (pick a hard question for the final slot).
   - Lines ~158-162: Update the middle question distribution. Was `needEasy = 3, needMedium = 3, needHard = 2` (8 middle questions for Q2-Q9). Now needs 6 middle questions for Q2-Q7: change to `needEasy = 2, needMedium = 2, needHard = 2`.
   - Line ~198: Update comment from "Shuffle the 8 middle questions" to "Shuffle the 6 middle questions".
   - Line ~201-202: Update the combine line: change from `[q1!, ...shuffledMiddle, q10!]` to `[q1!, ...shuffledMiddle, qFinal!]`. Update comment from `[Q1_easy, ...middle_8_shuffled, Q10_hard]` to `[Q1_easy, ...middle_6_shuffled, Q8_hard]`.

5. In `selectQuestionsForGame()` JSDoc (line ~271-277): Update comments from "10 questions" to "8 questions", from "Q10=hard, Q2-Q9" to "Q8=hard, Q2-Q7". Change "@returns Array of up to 10" to "@returns Array of up to 8".

6. In the file-level doc comment for `loadQuestionsFromJSON()` (line ~101): Change "limited to 10" to "limited to 8".

**sessionService.ts** -- Update final question detection to use dynamic index based on questions array length:

1. Line ~86: Update comment from `// seconds (for Q10)` to `// seconds (for final question)`.

2. Line ~196-198: Change the hardcoded final question detection:
   ```ts
   // OLD:
   const isFinalQuestion = questionIndex === 9;
   // NEW:
   const isFinalQuestion = questionIndex === session.questions.length - 1;
   ```
   Update the comment from `(Q10 = index 9)` to `(last question in session)`.

3. Lines ~363-366 in `getResults()`: Change the wager result detection:
   ```ts
   // OLD:
   if (session.answers.length >= 10) {
     const finalAnswer = session.answers[9];
   // NEW:
   const finalIndex = session.questions.length - 1;
   if (session.answers.length >= session.questions.length) {
     const finalAnswer = session.answers[finalIndex];
   ```

Avoid: Do NOT change QUESTION_DURATION, FINAL_QUESTION_DURATION, or MAX_PLAUSIBLE_TIME_REMAINING constants -- those are time durations, not question counts. Do NOT change any scoring formulas in progressionService.ts (they already use `totalQuestions` parameter dynamically).
  </action>
  <verify>
Run `npx tsc --noEmit` from backend/ directory. Verify no type errors. Grep for remaining hardcoded `=== 9` or `[9]` or `>= 10` in both files to confirm none remain.
  </verify>
  <done>
Backend selects 8 questions per game with balanced difficulty (Q1=easy, Q2-Q7=mixed, Q8=hard). Final question detection uses dynamic `questions.length - 1` instead of hardcoded index 9. Wager result detection uses dynamic length check.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend game logic and UI for 8 rounds</name>
  <files>
    frontend/src/features/game/gameReducer.ts
    frontend/src/features/game/hooks/useGameState.ts
    frontend/src/features/game/components/GameScreen.tsx
    frontend/src/features/game/components/QuestionCard.tsx
    frontend/src/features/game/components/ProgressDots.tsx
    frontend/src/features/game/components/ResultsScreen.tsx
  </files>
  <action>
**gameReducer.ts** -- Replace all hardcoded index 9 checks with `state.questions.length - 1`:

1. Add a helper at the top of the reducer function (inside, before the switch):
   ```ts
   const finalIndex = state.questions.length - 1;
   ```

2. Line 72: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === finalIndex`.
3. Line 77: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === finalIndex`.
4. Line 127: Change `(state.currentQuestionIndex === 9 ? 50 : 20)` to `(state.currentQuestionIndex === finalIndex ? 50 : 20)`.
5. Line 128: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === finalIndex`.
6. Line 160: Same as line 127.
7. Line 161: Same as line 128.
8. Line 188: Change `if (nextIndex === 9)` to `if (nextIndex === state.questions.length - 1)` (cannot use `finalIndex` here since it would be based on pre-update length, but `state.questions.length` does not change).

   Actually: `finalIndex` is computed from `state.questions.length - 1` at the top of the reducer, and questions array does not change during NEXT_QUESTION. So `if (nextIndex === finalIndex)` is correct and cleaner.

9. Update all comments from "Q10" references to "final question" where they refer to the last question generically. Keep "Q10" only where it literally means question 10 (which it no longer does).

**useGameState.ts** -- Update hardcoded index 9 references:

1. Line 50: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === state.questions.length - 1`.
2. Line 78: Change `state.answers[9]` to `state.answers[state.questions.length - 1]`.
3. Line 117: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === state.questions.length - 1`.
4. Line 164: Change `state.currentQuestionIndex !== 9` to `state.currentQuestionIndex !== state.questions.length - 1`.
5. Line 190: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === state.questions.length - 1`.

**GameScreen.tsx** -- Update display strings and hardcoded index references:

1. Line 192: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === state.questions.length - 1`.
2. Line 205: Same pattern.
3. Line 235: Change `'Question 1 of 10'` to `` `Question 1 of ${state.questions.length}` ``.
4. Line 392: Change `Q{state.currentQuestionIndex + 1} of 10` to `Q{state.currentQuestionIndex + 1} of {state.questions.length}`.
5. Line 458: Change `state.currentQuestionIndex === 9` to `state.currentQuestionIndex === state.questions.length - 1`.
6. Line 489: Same pattern.

**QuestionCard.tsx** -- Make the "of N" dynamic:

1. Add a `totalQuestions` prop to `QuestionCardProps`:
   ```ts
   interface QuestionCardProps {
     question: Question;
     questionNumber: number;
     totalQuestions: number;
   }
   ```
2. Update the component to accept `totalQuestions`:
   ```ts
   export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
   ```
3. Line 10: Change `aria-label={`Question ${questionNumber} of 10`}` to `aria-label={`Question ${questionNumber} of ${totalQuestions}`}`.
4. In GameScreen.tsx where QuestionCard is rendered (around line 483): Add `totalQuestions={state.questions.length}` prop.

**ProgressDots.tsx** -- Change default from 10 to 8:

1. Line 6: Change `total = 10` default to `total = 8`.

   Note: The component already receives `total={state.questions.length}` as a prop from GameScreen.tsx (line 398), so the default is just a fallback. Changing it ensures consistency.

**ResultsScreen.tsx** -- Update hardcoded index 9 references:

1. Lines 538 and 556: These use `index === 9` to detect the final question for wager display. Change both to check against the last index dynamically. The ResultsScreen receives `result` and `questions` as props. Use `index === questions.length - 1` instead of `index === 9`.

   Specifically:
   - Line 538: `index === 9 && answer.wager !== undefined && answer.wager > 0` becomes `index === questions.length - 1 && answer.wager !== undefined && answer.wager > 0`
   - Line 556: `index === 9 && answer.wager !== undefined && answer.wager === 0` becomes `index === questions.length - 1 && answer.wager !== undefined && answer.wager === 0`

Avoid: Do NOT change timer durations (QUESTION_DURATION=20, FINAL_QUESTION_DURATION=50) -- those are seconds, not question counts. Do NOT change any animation or confetti thresholds (streak counts, etc.).
  </action>
  <verify>
Run `npx tsc --noEmit` from frontend/ directory. Verify no type errors. Grep the entire frontend/src directory for remaining hardcoded `=== 9`, `[9]`, `of 10` (excluding CSS/style values like `z-10`, `w-10`, `h-10`, `gap-10`, `p-10`, `rounded-10`, `top-10`, `left-10`, `stiffness: 100`, `opacity.*10`, `y: 10`). All game-logic references to 9 or "of 10" should be gone.
  </verify>
  <done>
All frontend game logic uses dynamic `questions.length - 1` instead of hardcoded index 9. Progress dots default to 8. Question display shows "of 8" (or whatever the actual count is). Screen reader announces "Question 1 of 8". ResultsScreen shows wager info for the dynamically-determined final question.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes in both backend/ and frontend/ directories
2. Grep for `=== 9` in game-related files returns zero matches (excluding CSS/non-game files)
3. Grep for `"of 10"` or `'of 10'` in game-related files returns zero matches
4. Grep for `.slice(0, 10)` or `>= 10` in questionService.ts and sessionService.ts returns zero matches
5. Start backend and frontend dev servers, begin a new game -- verify 8 questions are loaded
6. Play through to Q7 reveal -- verify "FINAL QUESTION" announcement appears before Q8
7. Complete wager flow on Q8 -- verify wager scoring works correctly
8. Check results screen -- verify wager result shows for Q8
</verification>

<success_criteria>
- Games have exactly 8 rounds
- Round 8 is the Final Question with full wager mechanics
- All progress indicators show 8 rounds
- All accessibility text says "of 8"
- No hardcoded references to 10 questions or index 9 remain in game logic
- Scoring, XP, and gem calculations work correctly (they already use dynamic totalQuestions)
</success_criteria>

<output>
After completion, create `.planning/quick/012-reduce-game-to-8-rounds/012-SUMMARY.md`
</output>
