---
phase: quick
plan: "018"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/gameModes.ts
  - backend/src/services/questionService.ts
  - backend/src/services/sessionService.ts
  - backend/src/routes/game.ts
  - frontend/src/features/game/gameReducer.ts
  - frontend/src/features/game/hooks/useGameState.ts
  - frontend/src/services/gameService.ts
  - frontend/src/types/game.ts
autonomous: true

must_haves:
  truths:
    - "A player who gets questions wrong sees more easy questions (stays in lower tiers longer)"
    - "A player who gets questions right progresses through tiers: easy-only -> easy/medium -> medium/hard -> hard final"
    - "Tier progression requires 2 correct answers per tier before advancing"
    - "The final question (position 8) is always hard difficulty regardless of performance"
    - "The game still has exactly 8 questions per session"
  artifacts:
    - path: "backend/src/services/gameModes.ts"
      provides: "Adaptive tier logic: getNextQuestionTier() and adaptive pool selection"
    - path: "backend/src/services/sessionService.ts"
      provides: "GameSession with adaptiveState (candidatePools, correctCount, currentTier)"
    - path: "backend/src/routes/game.ts"
      provides: "POST /answer returns nextQuestion for adaptive mode"
  key_links:
    - from: "backend/src/routes/game.ts (POST /answer)"
      to: "gameModes.ts (getNextQuestionTier)"
      via: "After scoring, determine next tier from correctCount, pick question from pool"
      pattern: "getNextQuestionTier|selectNextAdaptive"
    - from: "frontend/src/features/game/gameReducer.ts"
      to: "GameState.questions"
      via: "REVEAL_ANSWER action appends nextQuestion to questions array"
      pattern: "nextQuestion.*questions"
---

<objective>
Make the Easy Steps game mode truly adaptive by selecting questions dynamically based on player performance, rather than pre-assigning difficulty by position slot.

Purpose: Currently all 8 questions are selected at game start with fixed difficulty slots. A struggling player still gets medium/hard questions at positions 5-8. True adaptivity means players who answer incorrectly stay in easier tiers longer, seeing more easy questions until they demonstrate competence.

Output: Backend selects each next question on-the-fly after each answer, using correct-answer count to determine which difficulty tier to draw from. Frontend receives each next question in the answer response and appends it to the game state.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/017-easy-steps-progressive-difficulty-mode/017-SUMMARY.md

Key files to understand the current architecture:
@backend/src/services/gameModes.ts — Current easySteps strategy (static position-based)
@backend/src/services/questionService.ts — selectQuestionsForGame, applyDifficultySelection
@backend/src/services/sessionService.ts — GameSession interface, createSession, submitAnswer
@backend/src/routes/game.ts — POST /session (creates game), POST /answer (scores answers)
@frontend/src/features/game/gameReducer.ts — Game state machine (SESSION_CREATED, REVEAL_ANSWER, NEXT_QUESTION)
@frontend/src/features/game/hooks/useGameState.ts — startGame, submitAndReveal, selectAnswer
@frontend/src/services/gameService.ts — createGameSession, submitAnswer API calls
@frontend/src/types/game.ts — Question, GameState, GameAnswer types
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend adaptive question selection</name>
  <files>
    backend/src/services/gameModes.ts
    backend/src/services/questionService.ts
    backend/src/services/sessionService.ts
    backend/src/routes/game.ts
  </files>
  <action>
**gameModes.ts — Add adaptive tier logic:**

Add a new exported function `getNextQuestionTier(correctCount: number, questionNumber: number, totalQuestions: number)` that returns the allowed difficulty tiers for the next question:

```
Tier rules (based on cumulative correct count):
  - correctCount 0-1 (Tier 1): return ['easy']
  - correctCount 2-3 (Tier 2): return ['easy', 'medium']
  - correctCount 4-5 (Tier 3): return ['medium', 'hard']
  - Final question (questionNumber === totalQuestions): return ['hard'] (always, regardless of correctCount)
```

Add a new exported function `selectNextAdaptiveQuestion(candidatePools: Record<string, DBQuestionRow[]>, allowedDifficulties: string[], usedIds: Set<number>)` that picks ONE question from the candidate pools, preferring difficulties in the order given. Returns the question or undefined if pools exhausted. Mutates the pool by removing the picked question (shift from matching pool). Falls back to adjacent difficulties if preferred pools are empty.

Keep the existing `easySteps` static strategy function and `GameModeStrategy` type UNCHANGED (classic mode still uses the old system). The new functions are separate exports used by the adaptive flow.

**sessionService.ts — Extend GameSession for adaptive state:**

Add optional fields to the `GameSession` interface:
```typescript
// Adaptive difficulty state (only set for easy-steps mode)
adaptiveState?: {
  candidatePools: {
    easy: DBQuestionRow[];
    medium: DBQuestionRow[];
    hard: DBQuestionRow[];
  };
  correctCount: number;
  gameMode: string;
};
```

Import `DBQuestionRow` from `'./gameModes.js'`.

No other changes to sessionService.ts — the session creation and answer submission logic stays the same.

**questionService.ts — Add adaptive session creation path:**

Add a new exported function `createAdaptiveSession(collectionId: number | null, recentQuestionIds: string[])` that:
1. Resolves the collection ID (same as selectQuestionsForGame)
2. Queries ALL available questions for the collection (same query as existing)
3. Shuffles and splits into easy/medium/hard pools
4. Picks the FIRST question from easy pool (Tier 1 starts easy-only)
5. Returns `{ firstQuestion: Question, candidatePools: { easy: DBQuestionRow[], medium: DBQuestionRow[], hard: DBQuestionRow[] } }`

The existing `selectQuestionsForGame` stays unchanged for classic mode.

Also add a new exported function `transformSingleDBQuestion(row: DBQuestionRow): Promise<Question>` that transforms a single DB row to a Question (reusing the existing topicMap and transform logic). This is needed when the answer endpoint picks the next question.

**game.ts — Wire adaptive flow:**

In `POST /session`: When `gameMode` is `'easy-steps'` (or default), call `createAdaptiveSession` instead of `selectQuestionsForGame`. Create the session with just the first question, and store `adaptiveState` on the session:
```typescript
session.adaptiveState = {
  candidatePools: pools,
  correctCount: 0,
  gameMode: 'easy-steps',
};
```

Pass the single first question (as an array of 1) to `sessionManager.createSession()`.

In `POST /answer`: After scoring the answer, check if `session.adaptiveState` exists. If so:
1. Update `session.adaptiveState.correctCount` if the answer was correct
2. Determine the question number (session.answers.length, since the answer was just pushed)
3. If questionNumber < 8 (TOTAL_QUESTIONS):
   - Call `getNextQuestionTier(correctCount, questionNumber + 1, 8)` to get allowed difficulties
   - Call `selectNextAdaptiveQuestion(candidatePools, allowedDifficulties, usedIds)` to pick next question
   - Transform it to a Question via `transformSingleDBQuestion`
   - Push the new question onto `session.questions` (server-side)
   - Save the updated session
   - Include `nextQuestion` (stripped of correctAnswer) in the answer response JSON
4. If questionNumber === 8, no next question needed — game is complete

The `usedIds` set should be built from `session.questions.map(q => /* get DB id */)`. Since questions are stored with externalId as id, store the DB numeric ids in the adaptiveState as well:
```typescript
adaptiveState.usedQuestionIds: number[]  // Track DB IDs to prevent duplicates
```

Important: The answer response shape changes — add an optional `nextQuestion` field. This is backward-compatible (classic mode won't include it).
  </action>
  <verify>
Run `cd backend && npx tsc --noEmit` to confirm no type errors. Inspect the console output of POST /session and POST /answer by reading the code to confirm the adaptive flow is wired correctly.
  </verify>
  <done>
Backend creates easy-steps sessions with a single first question and candidate pools. Each answer submission dynamically selects the next question based on cumulative correct count and returns it in the response. Classic mode is unaffected.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend dynamic question appending</name>
  <files>
    frontend/src/types/game.ts
    frontend/src/services/gameService.ts
    frontend/src/features/game/gameReducer.ts
    frontend/src/features/game/hooks/useGameState.ts
  </files>
  <action>
**gameService.ts — Update submitAnswer return type:**

Add `nextQuestion?: Question` (imported from types/game) to the return type of `submitAnswer()`. The API response may now include a `nextQuestion` object. Pass it through in the return value.

**gameReducer.ts — Append next question on REVEAL_ANSWER and TIMEOUT:**

Update the `REVEAL_ANSWER` action handler: Add an optional `nextQuestion?: Question` field to the action type. When present, append it to the questions array in the new state:
```typescript
questions: action.nextQuestion
  ? [...state.questions, action.nextQuestion]
  : state.questions,
```

Do the same for the `TIMEOUT` action type — it also receives score data and should also accept and append `nextQuestion`.

Update the `GameAction` type union to include the new optional field on both `REVEAL_ANSWER` and `TIMEOUT`.

**useGameState.ts — Pass nextQuestion from server response to dispatch:**

In `submitAndReveal()`: Extract `nextQuestion` from the server response and include it in the `REVEAL_ANSWER` dispatch:
```typescript
dispatch({
  type: 'REVEAL_ANSWER',
  timeRemaining,
  scoreData: { ... },
  nextQuestion: serverResponse.nextQuestion,
});
```

In `handleTimeout()`: Same treatment — include `nextQuestion` from server response in the `TIMEOUT` dispatch. Note: for timeouts, the server still selects the next question (wrong answer, correctCount unchanged).

**Important behavioral note:** The `SESSION_CREATED` action now receives only 1 question for easy-steps mode (instead of 8). The `questions.length` will be 1 initially. The frontend already uses `state.questions.length` to determine `finalIndex` and `isFinalQuestion`. As questions are appended one at a time, these calculations naturally work:
- After SESSION_CREATED: questions.length = 1, finalIndex = 0 — this would incorrectly trigger final-question logic on Q1.

**Fix:** The frontend needs to know the total expected question count, not derive it from the array length. Add a `totalQuestions` field to `GameState` (in types/game.ts). Set it from the session response. Use `totalQuestions - 1` for finalIndex instead of `questions.length - 1`.

In **types/game.ts**: Add `totalQuestions: number` to `GameState`.

In **gameReducer.ts**:
- Add `totalQuestions: number` to `SESSION_CREATED` action type
- Set `totalQuestions` in SESSION_CREATED handler (from action)
- Set `totalQuestions: 0` in `initialGameState`
- Replace ALL uses of `state.questions.length - 1` for `finalIndex` with `state.totalQuestions - 1`
- Replace `nextIndex >= state.questions.length` completion check with `nextIndex >= state.totalQuestions`

In **useGameState.ts**:
- Change `isFinalQuestion` to use `state.totalQuestions - 1` instead of `state.questions.length - 1`
- Change wager detection in `selectAnswer` and `submitAndReveal` to use `state.totalQuestions - 1`
- Pass `totalQuestions: 8` in SESSION_CREATED dispatch (the server can also return this, but 8 is the constant)

In **gameService.ts**: The session response already includes `gameMode`. Add `totalQuestions` to the return type of `createGameSession`. If the server doesn't return it, default to 8.

In **game.ts (backend)**: Add `totalQuestions: 8` (or the TOTAL_QUESTIONS constant from questionService) to the POST /session response JSON. This makes the total explicit rather than inferred from array length.

**NEXT_QUESTION handler fix:** Currently checks `nextIndex >= state.questions.length` for game completion. Change to `nextIndex >= state.totalQuestions`. Also, the `finalIndex` for final-announcement trigger should be `state.totalQuestions - 1`.

**GameResult computation in useGameState.ts:** The `gameResult` computation uses `state.questions.length` for totalQuestions. Change to `state.totalQuestions`.

**ResultsScreen:** Check if it uses `questions.length` — it receives `questions` as a prop. The answers array will have all 8 answers by game end, and questions array will also have all 8 (appended one at a time). So ResultsScreen should work unchanged.
  </action>
  <verify>
Run `cd frontend && npx tsc --noEmit` to confirm no type errors. Then run `cd frontend && npm run build` to confirm the build succeeds. Manually trace through the game flow logic: SESSION_CREATED with 1 question -> answering -> REVEAL_ANSWER appends Q2 -> NEXT_QUESTION advances index -> answering Q2 -> ... -> Q7 REVEAL_ANSWER appends Q8 -> NEXT_QUESTION triggers final-announcement -> wagering -> final question -> complete.
  </verify>
  <done>
Frontend receives one question at session start and appends each subsequent question from answer responses. Game flow (timer, wager, final question, results) works correctly with totalQuestions-based indexing instead of array-length-based indexing. Classic mode unaffected (receives all 8 upfront, totalQuestions=8, no nextQuestion in responses).
  </done>
</task>

<task type="auto">
  <name>Task 3: Integration verification and logging</name>
  <files>
    backend/src/services/gameModes.ts
    backend/src/routes/game.ts
  </files>
  <action>
Add a console.log in the POST /answer adaptive branch that logs the tier progression for debugging:
```
[easy-steps-adaptive] Q{N}: correctCount={X}, tier={tierName}, picked={difficulty}
```

Add a final summary log when the last question is picked:
```
[easy-steps-adaptive] Session complete: difficulties=[easy, easy, easy, medium, easy, medium, hard, hard]
```

Verify these edge cases are handled in the code:
1. **Pool exhaustion:** If the preferred difficulty pool is empty, fall back to adjacent difficulties (easy->medium->hard or hard->medium->easy). The `selectNextAdaptiveQuestion` function should handle this.
2. **All wrong answers:** Player gets 0 correct through Q7 — should see mostly easy questions (stays in Tier 1), with Q8 still hard.
3. **All correct answers:** Player gets all correct — progresses through tiers rapidly (Q1-2 easy, Q3-4 easy/medium, Q5-6 medium/hard, Q7 medium/hard, Q8 hard).
4. **Classic mode unchanged:** Verify that when `gameMode='classic'` is passed, the old `selectQuestionsForGame` path is used, no adaptiveState is set, and no nextQuestion is returned in answers.

Also verify that the `stripAnswers` helper in game.ts is applied to `nextQuestion` before including it in the answer response (must remove `correctAnswer` from the next question to prevent cheating).
  </action>
  <verify>
Run `cd backend && npx tsc --noEmit` and `cd frontend && npm run build` — both must pass with zero errors. Read through the complete adaptive flow from session creation to final answer to confirm correctness. Trace the all-wrong-answers scenario manually through the code.
  </verify>
  <done>
Adaptive difficulty logging confirms tier progression. Edge cases (pool exhaustion, all wrong, all correct, classic mode) verified in code. No type errors in either backend or frontend builds.
  </done>
</task>

</tasks>

<verification>
1. `cd backend && npx tsc --noEmit` — zero type errors
2. `cd frontend && npm run build` — successful build
3. Code review: POST /session for easy-steps creates session with 1 question + candidate pools
4. Code review: POST /answer picks next question based on correctCount, returns it stripped of correctAnswer
5. Code review: Frontend appends nextQuestion to state.questions on REVEAL_ANSWER/TIMEOUT
6. Code review: finalIndex uses totalQuestions, not questions.length
7. Code review: Classic mode path unchanged (all 8 questions at start, no adaptive state)
</verification>

<success_criteria>
- Easy-steps mode creates sessions with 1 initial question and selects subsequent questions adaptically
- Tier progression: 0-1 correct = easy only, 2-3 correct = easy/medium, 4-5 correct = medium/hard, Q8 = always hard
- Players who answer incorrectly see more easy questions (stay in lower tiers)
- Players who answer correctly progress through harder tiers
- Final question is always hard difficulty
- Classic mode is completely unaffected
- Both backend and frontend compile without errors
- No correctAnswer leakage to frontend for upcoming questions
</success_criteria>

<output>
After completion, create `.planning/quick/018-fix-easy-steps-adaptive-difficulty/018-SUMMARY.md`
</output>
