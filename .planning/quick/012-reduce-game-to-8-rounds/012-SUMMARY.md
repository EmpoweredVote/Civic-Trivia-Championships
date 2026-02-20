---
phase: quick
plan: "012"
subsystem: game-engine
tags: [game-rounds, difficulty-balance, wager, frontend, backend]
dependency-graph:
  requires: []
  provides: [8-round-games, dynamic-final-question-detection]
  affects: []
tech-stack:
  added: []
  patterns: [dynamic-index-over-hardcoded, TOTAL_QUESTIONS-constant]
file-tracking:
  key-files:
    created: []
    modified:
      - backend/src/services/questionService.ts
      - backend/src/services/sessionService.ts
      - frontend/src/features/game/gameReducer.ts
      - frontend/src/features/game/hooks/useGameState.ts
      - frontend/src/features/game/components/GameScreen.tsx
      - frontend/src/features/game/components/QuestionCard.tsx
      - frontend/src/features/game/components/ProgressDots.tsx
      - frontend/src/features/game/components/ResultsScreen.tsx
decisions:
  - id: "012-01"
    decision: "Use TOTAL_QUESTIONS constant and dynamic questions.length - 1 throughout"
    rationale: "Eliminates hardcoded magic numbers; future round-count changes require only one constant update on backend"
metrics:
  duration: "~8 minutes"
  completed: "2026-02-20"
---

# Quick Task 012: Reduce Game to 8 Rounds Summary

**One-liner:** Reduced game from 10 to 8 rounds with dynamic final-question detection and rebalanced difficulty distribution (2+2+2 middle mix).

## What Changed

### Backend (questionService.ts)
- Added `TOTAL_QUESTIONS = 8` constant
- Updated difficulty distribution from 3-easy/3-medium/2-hard (8 middle) to 2-easy/2-medium/2-hard (6 middle)
- Renamed `q10` variable to `qFinal` for clarity
- Updated JSON fallback to slice 8 questions instead of 10

### Backend (sessionService.ts)
- Replaced hardcoded `questionIndex === 9` with `questionIndex === session.questions.length - 1`
- Replaced hardcoded `session.answers.length >= 10` / `session.answers[9]` with dynamic length checks

### Frontend (gameReducer.ts)
- Added `const finalIndex = state.questions.length - 1` at top of reducer
- Replaced all 6 occurrences of `=== 9` with `=== finalIndex`
- Updated all comments from "Q10" to "final question"

### Frontend (useGameState.ts)
- Replaced 5 occurrences of `=== 9` / `!== 9` / `[9]` with dynamic `questions.length - 1`

### Frontend (GameScreen.tsx)
- Updated "Q N of 10" display to "Q N of {state.questions.length}"
- Updated screen reader announcement from "Question 1 of 10" to dynamic template
- Replaced 4 hardcoded `=== 9` checks with `=== state.questions.length - 1`
- Added `totalQuestions` prop to QuestionCard usage

### Frontend (QuestionCard.tsx)
- Added `totalQuestions` prop to interface
- Updated aria-label from hardcoded "of 10" to dynamic "of ${totalQuestions}"

### Frontend (ProgressDots.tsx)
- Changed default `total` prop from 10 to 8

### Frontend (ResultsScreen.tsx)
- Replaced `index === 9` wager detection (2 occurrences) with `index === questions.length - 1`
- Updated perfect game announcement from "all 10 questions" to dynamic count
- Updated wager score breakdown from `.slice(0, 9)` to `.slice(0, -1)` (dynamic)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated ResultsScreen perfect game announcement**
- **Found during:** Task 2
- **Issue:** `announce.polite('Perfect game! You answered all 10 questions correctly!')` was hardcoded to 10
- **Fix:** Changed to dynamic template literal using `result.totalQuestions`
- **Files modified:** ResultsScreen.tsx

**2. [Rule 2 - Missing Critical] Updated ResultsScreen wager score breakdown slice**
- **Found during:** Task 2
- **Issue:** `result.answers.slice(0, 9)` was hardcoded to slice first 9 answers for non-wager score breakdown
- **Fix:** Changed to `result.answers.slice(0, -1)` which dynamically excludes last answer regardless of count
- **Files modified:** ResultsScreen.tsx

## Verification

- [x] `npx tsc --noEmit` passes in both backend/ and frontend/
- [x] Grep for `=== 9` in game-related files returns zero matches
- [x] Grep for `"of 10"` or `'of 10'` in game-related files returns zero matches
- [x] Grep for `.slice(0, 10)` or `>= 10` in questionService.ts and sessionService.ts returns zero matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | bb394c7 | Backend: 8-question selection and dynamic final-question detection |
| 2 | 0474d51 | Frontend: dynamic game logic and UI for 8 rounds |
