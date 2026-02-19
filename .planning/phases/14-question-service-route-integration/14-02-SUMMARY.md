---
phase: 14
plan: 02
title: "Wire QuestionService into Game Routes"
subsystem: "game-routes"
tags: ["express", "game-routes", "session", "question-service", "collection", "frontend", "react"]

dependency-graph:
  requires: ["14-01"]
  provides: ["game-routes-using-db", "collection-scoped-sessions", "frontend-collection-types"]
  affects: ["15-collection-picker-ui", "17-content-generation"]

tech-stack:
  added: []
  patterns:
    - "In-memory per-user recent question tracking (Map<userId, string[]>)"
    - "Optional collectionMeta parameter pattern for backward-compatible session creation"
    - "Collection metadata propagated from route through session to results"

key-files:
  created: []
  modified:
    - "backend/src/routes/game.ts"
    - "backend/src/services/sessionService.ts"
    - "frontend/src/services/gameService.ts"
    - "frontend/src/types/game.ts"
    - "frontend/src/features/game/gameReducer.ts"
    - "frontend/src/features/game/hooks/useGameState.ts"

decisions:
  - id: "legacy-questionIds-path"
    decision: "Legacy questionIds POST body handled by fetching all questions from DB and filtering"
    rationale: "Backward compat with any legacy clients; avoids maintaining allQuestions variable"
  - id: "in-memory-recent-tracking"
    decision: "Module-level Map for recent questions — not persisted across restarts"
    rationale: "Sufficient for session variety; Redis/DB persistence deferred to future phase"

metrics:
  tasks-completed: 2
  tasks-total: 2
  duration: "2 min"
  completed: "2026-02-19"
---

# Phase 14 Plan 02: Wire QuestionService into Game Routes Summary

**One-liner:** Game routes now use PostgreSQL-sourced questions via QuestionService with collection scoping, recent-question tracking, and collection metadata in all responses.

## What Was Built

This plan completed the data layer swap for the game backend. The static `readFileSync` JSON loading at module scope in `game.ts` was replaced with async calls to `selectQuestionsForGame` from the QuestionService created in Plan 14-01.

**Backend changes:**
- `game.ts`: Removed top-level `readFileSync` / `JSON.parse` loading. Added imports from `questionService.js`. Added in-memory `recentQuestions` Map (MAX_RECENT=30) with `getRecentQuestionIds` and `recordPlayedQuestions` helpers. POST /session now accepts optional `collectionId`, resolves collection metadata, passes it to `createSession`, records played questions, and returns `collectionName`/`collectionSlug` in the response. GET /results now includes `collectionName`/`collectionSlug` from the session. GET /questions now async via `selectQuestionsForGame(null, [])`.
- `sessionService.ts`: `GameSession` interface gained `collectionId`, `collectionName`, `collectionSlug` fields. `createSession` accepts optional `collectionMeta` parameter — existing callers get null values (backward compatible).

**Frontend changes:**
- `types/game.ts`: `GameState` gained `collectionName: string | null` and `collectionSlug: string | null`.
- `services/gameService.ts`: `createGameSession` accepts optional `collectionId` param, returns `collectionName`/`collectionSlug`. `GameSessionResult` interface gained optional `collectionName`/`collectionSlug`.
- `gameReducer.ts`: `SESSION_CREATED` action type includes new collection fields. `initialGameState` sets both to null. `SESSION_CREATED` case sets collection fields from action.
- `useGameState.ts`: `startGame` destructures and dispatches `collectionName`/`collectionSlug`.

## Verification Results

- `npx tsc --noEmit` passes in backend: YES
- `npx tsc --noEmit` passes in frontend: YES
- `npm run build` succeeds in frontend: YES (478kB bundle, 3.43s)
- `game.ts` no longer has `readFileSync` loading at module scope: YES
- `game.ts` imports and calls `selectQuestionsForGame`: YES
- POST /session accepts `collectionId` body parameter: YES
- POST /session response includes `collectionName` and `collectionSlug`: YES
- GET /results response includes `collectionName` and `collectionSlug`: YES
- `GameSession` interface includes all three collection fields: YES
- Frontend `createGameSession` accepts optional `collectionId`: YES
- Frontend `GameState` includes `collectionName` and `collectionSlug`: YES
- Recent question tracking Map with MAX_RECENT=30: YES

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0fba6b8 | feat | Update backend routes and session to use QuestionService |
| 39f75b7 | feat | Update frontend types and gameService for collection support |

## Decisions Made

### Legacy questionIds Path
Clients sending `questionIds` in POST /session body now trigger a DB fetch (`selectQuestionsForGame(null, [])`) and filter to the requested IDs. This preserves backward compatibility without maintaining the removed `allQuestions` variable.

### In-Memory Recent Question Tracking
The `recentQuestions` Map is module-level and not persisted to Redis or the database. This is sufficient for per-deployment session variety — users get fresh questions within a server process lifecycle. Persistent tracking deferred to a future phase if needed.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 15 (Collection Picker UI) can now:
- Pass `collectionId` to `createGameSession(collectionId)` from the frontend
- Display `collectionName` from `GameState` in the game UI
- The backend already handles collection scoping end-to-end

No blockers. The data layer is fully wired.
