---
phase: 14
plan: 01
subsystem: data-layer
tags: [drizzle-orm, postgresql, question-service, difficulty-ordering, json-fallback]

dependency-graph:
  requires:
    - "13-03: DB seeded with questions, topics, collections, collectionQuestions"
    - "db/schema.ts: questions, topics, collections, collectionQuestions table definitions"
    - "db/index.ts: drizzle db instance"
    - "services/sessionService.ts: Question interface"
  provides:
    - "selectQuestionsForGame: collection-scoped, difficulty-balanced question selection"
    - "getCollectionMetadata: collection lookup by ID"
    - "getFederalCollectionId: slug-based federal collection ID resolution"
  affects:
    - "14-02: game route will call selectQuestionsForGame to replace static JSON reads"
    - "Future phases: any route needing collection-aware question fetching"

tech-stack:
  added: []
  patterns:
    - "Stateless exported functions (no class) matching progressionService pattern"
    - "Module-level caching for topic map and federal collection ID"
    - "Fisher-Yates shuffle for randomization"
    - "Drizzle ORM innerJoin with notInArray for recent exclusion"
    - "Silent catch-and-fallback error handling (never throws to caller)"

key-files:
  created:
    - backend/src/services/questionService.ts
  modified: []

decisions:
  - decision: "externalId used as Question.id (not DB serial id)"
    rationale: "Backward compatibility with all existing session/answer logic that uses string IDs like q001"
  - decision: "Module-level caching for topic map and federal collection ID"
    rationale: "Both are effectively immutable during runtime — avoids repeated DB round-trips"
  - decision: "gt(questions.expiresAt, now) in application layer rather than DB constant"
    rationale: "Avoids SQL NOW() function complexity in Drizzle and keeps filter testable"
  - decision: "Difficulty relaxation fills gaps from any available pool before warning"
    rationale: "Graceful degradation — partial sets are better than errors"

metrics:
  duration: "2 minutes"
  completed: "2026-02-18"
  tasks-completed: 1
  tasks-total: 1
  deviations: 0
---

# Phase 14 Plan 01: QuestionService Module Summary

**One-liner:** Drizzle ORM question service with difficulty-ordered selection (Q1=easy, Q10=hard), recent exclusion via notInArray, and silent JSON fallback on DB failure.

## What Was Built

Created `backend/src/services/questionService.ts` — a stateless module that replaces static JSON file reads with intelligent PostgreSQL queries through Drizzle ORM.

### Exported Functions

**`selectQuestionsForGame(collectionId: number | null, recentQuestionIds: string[]): Promise<Question[]>`**
- Main entry point. Resolves null collectionId to federal-civics, queries collection-scoped questions, applies difficulty selection algorithm, transforms DB rows to Question interface.
- Full try-catch wrapping with silent JSON fallback on any database error.

**`getCollectionMetadata(collectionId: number): Promise<{ id: number; name: string; slug: string } | null>`**
- Queries collections table by ID. Returns null on not-found or error (never throws).

**`getFederalCollectionId(): Promise<number>`**
- Queries collections WHERE slug = 'federal-civics'. Caches result. Returns 1 as hardcoded fallback on failure.

### Difficulty Selection Algorithm

- Q1: picked randomly from easy pool (falls back to medium, then hard)
- Q10: picked randomly from hard pool (falls back to medium, then easy)
- Q2-Q9: 3 from easy + 3 from medium + 2 from hard, shuffled randomly
- Constraint relaxation: fills gaps from any available pool; warns with console.warn if total < 10
- No duplicates guaranteed by removal from pools after selection

### Data Transformation

- `externalId` → `id` (critical for backward compat with existing session/answer logic)
- `topicId` → `topic` string via cached Map<number, string>
- `subcategory` → `topicCategory` (empty string if null)
- `learningContent` → mapped with topic name and source when non-null
- `source` → nested inside learningContent when present

### Private Internals

- `loadTopicMap()`: queries topics table, caches Map<number, string> in module scope
- `loadQuestionsFromJSON()`: readFileSync fallback, Fisher-Yates shuffle, returns first 10
- `applyDifficultySelection()`: pools by difficulty, implements ordered selection with relaxation
- `transformDBQuestions()`: maps DB rows to Question interface

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- All three public exports present: `selectQuestionsForGame`, `getCollectionMetadata`, `getFederalCollectionId`
- Drizzle imports confirmed: `eq`, `and`, `notInArray`, `isNull`, `or`, `gt` from `drizzle-orm`
- DB import from `../db/index.js`, schema from `../db/schema.js`
- JSON fallback via `readFileSync` of `../data/questions.json`
- `externalId` used as `id` (not DB serial)
- Difficulty selection: Q1=easy, Q10=hard, Q2-Q9=balanced mix with constraint relaxation

## Deviations from Plan

None — plan executed exactly as written.

## Next Plan Readiness

Ready for 14-02: game route integration.
- `selectQuestionsForGame` is ready to replace the static `allQuestions` array in `game.ts`
- The function signature (`collectionId: number | null, recentQuestionIds: string[]`) matches what plan 02 will call
- JSON fallback ensures zero regression risk during the route migration
