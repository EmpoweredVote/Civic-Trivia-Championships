---
phase: quick
plan: "017"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/gameModes.ts
  - backend/src/services/questionService.ts
  - backend/src/routes/game.ts
  - frontend/src/services/gameService.ts
autonomous: true

must_haves:
  truths:
    - "Games default to progressive difficulty (easy-steps mode) without any client changes"
    - "Easy-steps mode serves Easy questions in early positions, graduating to Medium then Hard"
    - "Final question (Q8) is always Hard regardless of game mode"
    - "Classic balanced mode still works when explicitly requested via gameMode parameter"
    - "Game mode is swappable — adding a new mode requires only a new strategy function"
  artifacts:
    - path: "backend/src/services/gameModes.ts"
      provides: "Game mode strategy interface and implementations"
      exports: ["GameModeStrategy", "gameModes", "DEFAULT_GAME_MODE"]
    - path: "backend/src/services/questionService.ts"
      provides: "Updated selectQuestionsForGame accepting gameMode parameter"
      exports: ["selectQuestionsForGame"]
  key_links:
    - from: "backend/src/routes/game.ts"
      to: "backend/src/services/questionService.ts"
      via: "gameMode parameter passed through POST /session"
      pattern: "selectQuestionsForGame.*gameMode"
    - from: "backend/src/services/questionService.ts"
      to: "backend/src/services/gameModes.ts"
      via: "strategy function call"
      pattern: "gameModes\\[.*\\]"
---

<objective>
Implement "Easy Steps" progressive difficulty game mode and make it the default.

Purpose: New players currently face a random mix of difficulties. Easy Steps eases them in: early questions are Easy, graduating through Medium to Hard as they progress through the game. This makes the game more accessible while still challenging by the end.

Output: A pluggable game mode system where Easy Steps is the default, Classic (current balanced) mode is available by name, and new modes can be added by defining a single strategy function.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key files:
@backend/src/services/questionService.ts — Current difficulty selection logic (applyDifficultySelection)
@backend/src/routes/game.ts — POST /session endpoint that creates game sessions
@frontend/src/services/gameService.ts — createGameSession client call
@frontend/src/types/game.ts — Question and GameState types
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create game mode strategy system and Easy Steps implementation</name>
  <files>
    backend/src/services/gameModes.ts
    backend/src/services/questionService.ts
  </files>
  <action>
Create `backend/src/services/gameModes.ts` with:

1. Define the strategy interface:
```typescript
import type { DBQuestionRow } from './questionService.js';

// A game mode strategy takes shuffled difficulty pools + total question count
// and returns an ordered array of selected questions.
// The final question (last position) MUST always be hard.
export type GameModeStrategy = (
  easyPool: DBQuestionRow[],
  mediumPool: DBQuestionRow[],
  hardPool: DBQuestionRow[],
  totalQuestions: number
) => DBQuestionRow[];
```

2. Implement `easySteps` strategy:
   - Positions 1-2: Easy only (pull from easy pool)
   - Positions 3-4: Easy or Medium (pull from easy+medium combined, shuffled)
   - Positions 5-6: Medium or Hard (pull from medium+hard combined, shuffled)
   - Position 7: Hard only (pull from hard pool)
   - Position 8 (final): Hard only (pull from hard pool — this is always the final question)
   - Constraint relaxation: if a pool is exhausted for a tier, fall back to adjacent difficulty (e.g., if no easy left, use medium). Log a warning when relaxing.
   - Never return duplicates. Track picked question IDs in a Set.

3. Move the existing `applyDifficultySelection` logic from questionService.ts into this file as the `classic` strategy (Q1=easy, Q8=hard, Q2-Q7=2easy+2medium+2hard shuffled). Keep exact same behavior.

4. Export a registry object and default:
```typescript
export const gameModes: Record<string, GameModeStrategy> = {
  'easy-steps': easySteps,
  'classic': classic,
};
export const DEFAULT_GAME_MODE = 'easy-steps';
```

Then update `backend/src/services/questionService.ts`:

1. Export the `DBQuestionRow` interface (it is currently private — add `export` keyword).

2. Replace the `applyDifficultySelection` function body. Instead of inline logic, import `gameModes` and `DEFAULT_GAME_MODE` from `./gameModes.js` and delegate:
```typescript
import { gameModes, DEFAULT_GAME_MODE } from './gameModes.js';

function applyDifficultySelection(
  allRows: DBQuestionRow[],
  collectionId: number,
  gameMode?: string
): DBQuestionRow[] {
  const modeName = gameMode && gameModes[gameMode] ? gameMode : DEFAULT_GAME_MODE;
  const strategy = gameModes[modeName];

  const easyPool = shuffle(allRows.filter(q => q.difficulty === 'easy'));
  const mediumPool = shuffle(allRows.filter(q => q.difficulty === 'medium'));
  const hardPool = shuffle(allRows.filter(q => q.difficulty === 'hard'));

  if (allRows.length < TOTAL_QUESTIONS) {
    console.warn(`Relaxed difficulty constraints: only ${allRows.length} questions for collection ${collectionId}`);
    return shuffle(allRows);
  }

  return strategy(easyPool, mediumPool, hardPool, TOTAL_QUESTIONS);
}
```

3. Update `selectQuestionsForGame` signature to accept optional `gameMode?: string` parameter and pass it through to `applyDifficultySelection`.

IMPORTANT: Do NOT change the number of questions (keep TOTAL_QUESTIONS = 8). Do NOT change any scoring, session, or answer logic. The game mode ONLY affects which questions are selected and in what order.
  </action>
  <verify>
Run `cd /c/Project\ Test/backend && npx tsc --noEmit` to confirm no type errors.
Verify gameModes.ts exports GameModeStrategy, gameModes, DEFAULT_GAME_MODE.
Verify questionService.ts imports from gameModes.ts and selectQuestionsForGame accepts gameMode param.
  </verify>
  <done>
gameModes.ts exists with easy-steps and classic strategies. questionService.ts delegates to the strategy system. DEFAULT_GAME_MODE is 'easy-steps'. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire gameMode through the API route and frontend</name>
  <files>
    backend/src/routes/game.ts
    frontend/src/services/gameService.ts
  </files>
  <action>
Update `backend/src/routes/game.ts`:

1. In the POST /session handler, extract `gameMode` from `req.body` (alongside existing `questionIds` and `collectionId`):
```typescript
const { questionIds, collectionId, gameMode } = req.body;
```

2. Pass `gameMode` to `selectQuestionsForGame` in the normal path (line ~133):
```typescript
selectedQuestions = await selectQuestionsForGame(
  collectionId ?? null,
  getRecentQuestionIds(userId),
  gameMode
);
```

3. Include `gameMode` in the session response so the client knows which mode was used (add to the JSON response object):
```typescript
gameMode: gameMode || 'easy-steps',  // reflect what was actually used
```

Update `frontend/src/services/gameService.ts`:

1. Add optional `gameMode` parameter to `createGameSession`:
```typescript
export async function createGameSession(collectionId?: number, gameMode?: string): Promise<{
  sessionId: string;
  questions: Question[];
  degraded: boolean;
  collectionName: string;
  collectionSlug: string;
  gameMode: string;
}>
```

2. Build the request body to include gameMode when provided:
```typescript
const bodyObj: Record<string, unknown> = {};
if (collectionId !== undefined) bodyObj.collectionId = collectionId;
if (gameMode !== undefined) bodyObj.gameMode = gameMode;
const body = Object.keys(bodyObj).length > 0 ? JSON.stringify(bodyObj) : undefined;
```

3. Include `gameMode` in the return object: `gameMode: response.gameMode ?? 'easy-steps'`

NOTE: Do NOT change any call sites of `createGameSession` — the new parameters are optional so all existing callers continue to work unchanged, and they will automatically get the easy-steps default from the backend.
  </action>
  <verify>
Run `cd /c/Project\ Test/backend && npx tsc --noEmit` — no type errors.
Run `cd /c/Project\ Test/frontend && npx tsc --noEmit` — no type errors.
Grep for `selectQuestionsForGame` in game.ts to confirm gameMode is passed.
Grep for `gameMode` in gameService.ts to confirm the parameter exists.
  </verify>
  <done>
POST /session accepts optional gameMode parameter. Frontend gameService passes it through. Default behavior (no gameMode specified) uses easy-steps. Passing gameMode='classic' uses the original balanced algorithm. Both frontend and backend compile cleanly. No existing call sites broken.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add console logging for difficulty selection verification</name>
  <files>
    backend/src/services/gameModes.ts
  </files>
  <action>
Add a `console.log` at the end of BOTH the `easySteps` and `classic` strategy functions that logs the selected question difficulties in order, for verification during testing:

```typescript
console.log(`[${modeName}] Question difficulties: ${selected.map(q => q.difficulty).join(', ')}`);
```

Where `modeName` is 'easy-steps' or 'classic' respectively. This should appear as the last line before the return statement in each strategy function.

This log line lets us verify during manual testing that:
- easy-steps produces: easy, easy, easy/medium, easy/medium, medium/hard, medium/hard, hard, hard
- classic produces: easy, [mixed middle 6], hard

Also verify by reading the final gameModes.ts that:
- The easy-steps strategy has proper fallback logic (if not enough easy questions, pulls from medium; if not enough hard, pulls from medium)
- No duplicate questions can appear (Set-based tracking)
- Both strategies always return exactly TOTAL_QUESTIONS items (or fewer only if pool is truly exhausted)
  </action>
  <verify>
Read gameModes.ts end-to-end and confirm:
1. Both strategies log their difficulty sequence
2. easy-steps follows the tier progression: easy -> easy/medium -> medium/hard -> hard(final)
3. classic matches the original applyDifficultySelection behavior exactly
4. No duplicates possible (Set tracking)
5. Fallback logic exists for pool exhaustion
  </verify>
  <done>
Both game mode strategies include difficulty logging. Code review confirms correct progressive difficulty in easy-steps and preserved classic behavior.
  </done>
</task>

</tasks>

<verification>
1. `cd /c/Project\ Test/backend && npx tsc --noEmit` passes
2. `cd /c/Project\ Test/frontend && npx tsc --noEmit` passes
3. Backend starts without errors: `cd /c/Project\ Test/backend && npx tsx src/index.ts` (verify no import errors, then Ctrl+C)
4. Grep confirms gameMode plumbing: `grep -r "gameMode" backend/src/routes/game.ts backend/src/services/questionService.ts frontend/src/services/gameService.ts`
5. Verify DEFAULT_GAME_MODE is 'easy-steps': `grep "DEFAULT_GAME_MODE" backend/src/services/gameModes.ts`
</verification>

<success_criteria>
- New file gameModes.ts exists with pluggable strategy pattern
- easy-steps is the default game mode (games use progressive difficulty without any client changes)
- classic mode preserves exact original behavior
- Adding a new game mode requires only: (1) write a strategy function, (2) add it to the gameModes registry
- All existing functionality unchanged — no scoring, session, or UI changes
- Both TypeScript projects compile cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/017-easy-steps-progressive-difficulty-mode/017-SUMMARY.md`
</output>
